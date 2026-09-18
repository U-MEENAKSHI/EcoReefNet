import os
import cv2
import time
import numpy as np
import pandas as pd
from pathlib import Path

import torch
import torchvision
from torch.utils.data import DataLoader, Dataset
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
from torchvision.models.detection import fasterrcnn_resnet50_fpn, FasterRCNN_ResNet50_FPN_Weights

try:
    import albumentations as A
    from albumentations.pytorch.transforms import ToTensorV2
    HAS_ALBU = True
except ImportError:
    HAS_ALBU = False
    print("Warning: albumentations not found. Running without augmentations.")


# ─────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────
DEVICE = torch.device('cuda') if torch.cuda.is_available() else torch.device('cpu')
BASE_DIR = Path("dataset/images")
CSV_PATH = Path("dataset/annotations.csv")
CHECKPOINT_DIR = Path("checkpoints")
NUM_EPOCHS = 10
BATCH_SIZE = 4

# Map string labels to integer classes
LABEL_MAP = {
    "Background": 0,
    "Healthy Coral": 1,
    "Bleached Coral": 2,
    "Dead Coral": 3
}

def ensure_dirs():
    BASE_DIR.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    # Dump a dummy CSV if it doesn't exist just so we can show how it's formatted
    if not CSV_PATH.exists():
        print(f"Creating dummy annotation file at {CSV_PATH} since none exists...")
        import json
        dummy_df = pd.DataFrame([
            {
                "image_id": "dummy1.jpg", 
                # annotations format: [{'x': 100, 'y': 100, 'width': 50, 'height': 50, 'label': 'Healthy Coral'}]
                "annotations": json.dumps([
                    {"x": 10, "y": 10, "width": 50, "height": 50, "label": "Healthy Coral"},
                    {"x": 100, "y": 80, "width": 40, "height": 100, "label": "Bleached Coral"}
                ])
            }
        ])
        dummy_df.to_csv(CSV_PATH, index=False)

        # Create dummy image
        dummy_img = np.zeros((720, 1280, 3), dtype=np.uint8)
        cv2.rectangle(dummy_img, (10,10), (60,60), (0,255,0), -1)
        cv2.rectangle(dummy_img, (100,80), (140,180), (0,255,255), -1)
        cv2.imwrite(str(BASE_DIR / "dummy1.jpg"), dummy_img)


# ─────────────────────────────────────────────────────────────────────
# DATASET
# ─────────────────────────────────────────────────────────────────────
class CoralDataset(Dataset):
    def __init__(self, df, transforms=None):
        self.df = df
        self.transforms = transforms

    def can_augment(self, boxes):
        if len(boxes) == 0:
            return False
        box_outside_image = ((boxes[:, 0] < 0).any() or (boxes[:, 1] < 0).any() 
                             or (boxes[:, 2] > 1280).any() or (boxes[:, 3] > 720).any())
        return not box_outside_image

    def get_annotations(self, row):
        # returns boxes in [x_min, y_min, x_max, y_max] and labels in int
        annots = eval(row['annotations']) if isinstance(row['annotations'], str) else row['annotations']
        
        boxes = []
        labels = []
        for ann in annots:
            x = float(ann['x'])
            y = float(ann['y'])
            w = float(ann['width'])
            h = float(ann['height'])
            label_str = ann.get('label', 'Healthy Coral')
            
            boxes.append([x, y, x + w, y + h])
            labels.append(LABEL_MAP.get(label_str, 1))
            
        if len(boxes) == 0:
            return np.zeros((0,4), dtype=float), np.zeros((0,), dtype=int)
            
        return np.array(boxes, dtype=float), np.array(labels, dtype=int)
    
    def get_image(self, row):
        img_path = BASE_DIR / row["image_id"]
        image = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
        if image is None:
            raise FileNotFoundError(f"Cannot find image: {img_path}")
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB).astype(np.float32)
        image /= 255.0
        return image
    
    def __getitem__(self, i):
        row = self.df.iloc[i]
        image = self.get_image(row)
        boxes, labels = self.get_annotations(row)
        
        n_boxes = boxes.shape[0]
        
        if n_boxes > 0:
            area = (boxes[:, 3] - boxes[:, 1]) * (boxes[:, 2] - boxes[:, 0])
        else:
            area = np.array([])
            
        target = {
            'boxes': torch.as_tensor(boxes, dtype=torch.float32),
            'area': torch.as_tensor(area, dtype=torch.float32),
            'image_id': torch.tensor([i]),
            'labels': torch.as_tensor(labels, dtype=torch.int64),
            'iscrowd': torch.zeros((n_boxes,), dtype=torch.int64)            
        }

        if self.transforms and HAS_ALBU and self.can_augment(boxes):
            sample = {
                'image': image,
                'bboxes': target['boxes'],
                'labels': target['labels']
            }
            sample = self.transforms(**sample)
            image = sample['image']
            
            if n_boxes > 0:
                target['boxes'] = torch.stack(tuple(map(torch.tensor, zip(*sample['bboxes'])))).permute(1, 0)
        else:
            # Fallback to simple tensor conversion
            if HAS_ALBU:
                image = ToTensorV2(p=1.0)(image=image)['image']
            else:
                image = torch.from_numpy(image).permute(2, 0, 1)

        # Handle empty box cases which FasterRCNN dislikes during training by adding dummy background boxes
        if len(target['boxes']) == 0:
            target['boxes'] = torch.zeros((0, 4), dtype=torch.float32)
            target['labels'] = torch.zeros((0,), dtype=torch.int64)
            
        return image, target

    def __len__(self):
        return len(self.df)


def get_train_transform():
    if not HAS_ALBU: return None
    return A.Compose([
        A.HorizontalFlip(p=0.5),
        A.VerticalFlip(p=0.5),
        A.RandomBrightnessContrast(p=0.2),
        ToTensorV2(p=1.0)
    ], bbox_params={'format': 'pascal_voc', 'label_fields': ['labels']})


# ─────────────────────────────────────────────────────────────────────
# MODEL & TRAINING
# ─────────────────────────────────────────────────────────────────────
def get_model(num_classes):
    model = fasterrcnn_resnet50_fpn(weights=FasterRCNN_ResNet50_FPN_Weights.DEFAULT)
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    # Replace the pre-trained head with a new one
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)
    model.to(DEVICE)
    return model

def collate_fn(batch):
    return tuple(zip(*batch))

def train_model():
    print(f"Loading data from {CSV_PATH}...")
    df = pd.read_csv(CSV_PATH)
    
    # Simple split (90% train, 10% val)
    df = df.sample(frac=1, random_state=42).reset_index(drop=True)
    split_idx = max(int(len(df) * 0.9), 1)
    df_train = df.iloc[:split_idx]
    df_val = df.iloc[split_idx:] if len(df) > 1 else df_train
    
    ds_train = CoralDataset(df_train, get_train_transform())
    
    dl_train = DataLoader(
        ds_train, batch_size=BATCH_SIZE, shuffle=True, 
        num_workers=0, collate_fn=collate_fn
    )

    model = get_model(num_classes=len(LABEL_MAP))
    params = [p for p in model.parameters() if p.requires_grad]
    optimizer = torch.optim.SGD(params, lr=0.005, momentum=0.9, weight_decay=0.0005)
    
    print(f"Starting training on {DEVICE} for {NUM_EPOCHS} epochs...")
    
    for epoch in range(NUM_EPOCHS):
        time_start = time.time()
        model.train()
        loss_accum = 0
        
        for batch_idx, (images, targets) in enumerate(dl_train, 1):
            images = list(image.to(DEVICE) for image in images)
            targets = [{k: v.to(DEVICE) for k, v in t.items()} for t in targets]

            # Forward pass
            loss_dict = model(images, targets)
            losses = sum(loss for loss in loss_dict.values())
            loss_value = losses.item()
            loss_accum += loss_value

            # Backward pass
            optimizer.zero_grad()
            losses.backward()
            optimizer.step()
            
        train_loss = loss_accum / len(dl_train)
        elapsed = time.time() - time_start
        
        # Save exact checkpoint required by app.py
        chk_name = CHECKPOINT_DIR / 'coral_model.pth'
        torch.save(model.state_dict(), str(chk_name))
        
        print(f"[Epoch {epoch+1:2d} / {NUM_EPOCHS:2d}] Train loss: {train_loss:.4f} "
              f"[{elapsed:.1f}s] -> Saved to {chk_name}")

    print("\nTraining Complete! Checkpoint saved as `checkpoints/coral_model.pth`.")
    print("EcoReef-Net `app.py` will automatically load these weights if started.")


if __name__ == '__main__':
    ensure_dirs()
    train_model()
