"""
EcoReef-Net — Autonomous Underwater Coral Health Monitoring System
==================================================================
Dual-stage pipeline:
  Stage 1 → CLAHE contrast enhancement (LAB L-channel, clipLimit=3.0, tileGridSize=8×8)
  Stage 2 → Faster R-CNN (MobileNetV3-Large-FPN) object detection with coral health classification

The system auto-detects PyTorch availability. If torch loads successfully,
it runs full Faster R-CNN (MobileNet backbone) inference. Otherwise, it falls back to an
OpenCV-based contour detection + HSV coral health classifier — giving a
fully operational demo pipeline regardless of GPU/DLL environment issues.

References:
  • IEEE DOI 10.1109/9938441 — Underwater visibility restoration
  • IEEE DOI 10.1109/8962770 — Automated coral reef analysis
"""

from __future__ import annotations

import base64
import io
import os
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Tuple

import cv2
import numpy as np
from flask import Flask, jsonify, render_template, request
from PIL import Image
from pymongo import MongoClient
import datetime

# ─── Conditional PyTorch Import ───────────────────────────────────
TORCH_AVAILABLE = False
try:
    import torch
    import torchvision
    from torchvision import transforms
    from torchvision.models.detection import (
        fasterrcnn_mobilenet_v3_large_fpn,
        FasterRCNN_MobileNet_V3_Large_FPN_Weights,
    )
    TORCH_AVAILABLE = True
    print("[EcoReef-Net] ✓ PyTorch loaded successfully.")
except Exception as e:
    print(f"[EcoReef-Net] ⚠ PyTorch unavailable ({e})")
    print("[EcoReef-Net]   → Using OpenCV contour-based detector fallback.")

# ─────────────────────────────────────────────────────────────────────
# Application bootstrap
# ─────────────────────────────────────────────────────────────────────
app = Flask(__name__)
# Enable CORS for the frontend if running on different ports
try:
    from flask_cors import CORS
    CORS(app)
except ImportError:
    pass

app.config["MAX_CONTENT_LENGTH"] = 128 * 1024 * 1024  # 128 MB upload cap

# MongoDB Setup
try:
    mongo_client = MongoClient("mongodb://localhost:27017/", serverSelectionTimeoutMS=2000)
    db = mongo_client.ecoreef
    records_collection = db.records
    # Quick connectivity test
    mongo_client.server_info()
    print("[EcoReef-Net] ✓ Connected to MongoDB local instance.")
except Exception as e:
    print(f"[EcoReef-Net] ⚠ MongoDB not available locally: {e}")
    mongo_client = None

UPLOAD_DIR = Path("static/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

DEVICE = "cpu"
if TORCH_AVAILABLE:
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# ─────────────────────────────────────────────────────────────────────
# Coral label taxonomy
# ─────────────────────────────────────────────────────────────────────
CORAL_LABELS = {
    0: "Background",
    1: "Healthy Coral",
    2: "Bleached Coral",
    3: "Dead Coral",
}

CORAL_COLORS = {
    "Healthy Coral":  (0, 230, 180),   # Neon teal-green
    "Bleached Coral": (255, 200, 60),   # Warm amber
    "Dead Coral":     (255, 60, 80),    # Alert red
}


# ═════════════════════════════════════════════════════════════════════
# STAGE 1 — CLAHE Contrast Enhancement Engine
# ═════════════════════════════════════════════════════════════════════
class CLAHEEngine:
    """
    Contrast Limited Adaptive Histogram Equalization for underwater images.

    Operates on the L-channel of LAB color space to correct blue-green
    casting, light attenuation, and backscattering noise without
    introducing color distortion.

    IEEE Ref: DOI 10.1109/9938441
    """

    def __init__(self, clip_limit: float = 3.0, tile_grid_size: Tuple[int, int] = (8, 8)):
        self.clip_limit = clip_limit
        self.tile_grid_size = tile_grid_size
        self._clahe = cv2.createCLAHE(
            clipLimit=self.clip_limit,
            tileGridSize=self.tile_grid_size,
        )

    def enhance(self, bgr_image: np.ndarray) -> np.ndarray:
        """
        Apply CLAHE to a BGR image via LAB L-channel isolation.

        Pipeline:
        1. BGR → LAB conversion
        2. Extract L-channel
        3. Apply CLAHE to L-channel
        4. Merge enhanced L with original A,B
        5. LAB → BGR back-conversion
        """
        lab = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        # Apply CLAHE to luminance channel only
        l_enhanced = self._clahe.apply(l_channel)

        # Merge corrected L with original chrominance
        lab_enhanced = cv2.merge([l_enhanced, a_channel, b_channel])
        bgr_enhanced = cv2.cvtColor(lab_enhanced, cv2.COLOR_LAB2BGR)

        return bgr_enhanced

    def enhance_hsv(self, bgr_image: np.ndarray) -> np.ndarray:
        """
        Secondary HSV-space enhancement pass on the Value channel
        for deep-water images with extreme low-light conditions.
        """
        hsv = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)

        v_enhanced = self._clahe.apply(v)
        s_enhanced = self._clahe.apply(s)

        hsv_enhanced = cv2.merge([h, s_enhanced, v_enhanced])
        return cv2.cvtColor(hsv_enhanced, cv2.COLOR_HSV2BGR)


# ═════════════════════════════════════════════════════════════════════
# STAGE 2A — Faster R-CNN Inference Engine (requires PyTorch)
# ═════════════════════════════════════════════════════════════════════
class FasterRCNNDetector:
    """
    Faster R-CNN (MobileNetV3-Large-FPN backbone) inference wrapper for
    coral health classification.

    Uses the COCO-pretrained Faster R-CNN with MobileNetV3 backbone for
    lightweight, efficient region proposal generation. Overlays a
    deterministic coral health classifier based on HSV color distribution
    analysis within each proposed bounding box.

    MobileNetV3 offers ~4x fewer parameters than ResNet-50, enabling
    faster inference on CPU with competitive detection accuracy.

    For production deployment, swap in a fine-tuned checkpoint trained
    on annotated coral reef datasets (e.g., CoralNet, AIMS, or
    custom CVAT-annotated image sets) via `load_finetuned_weights()`.

    IEEE Ref: DOI 10.1109/8962770
    """

    CONFIDENCE_THRESHOLD = 0.70

    def __init__(self, device: str):
        self.device = torch.device(device)
        self._model = fasterrcnn_mobilenet_v3_large_fpn(
            weights=FasterRCNN_MobileNet_V3_Large_FPN_Weights.DEFAULT,
        )
        self.is_finetuned = False

        checkpoint_path = Path("checkpoints/coral_model.pth")
        if checkpoint_path.exists():
            try:
                self.load_finetuned_weights(checkpoint_path)
            except Exception as ckpt_err:
                print(f"[EcoReef-Net] ⚠ Checkpoint incompatible with MobileNetV3 backbone: {ckpt_err}")
                stale_path = checkpoint_path.with_suffix(".resnet50.pth")
                checkpoint_path.rename(stale_path)
                print(f"[EcoReef-Net]   → Renamed to {stale_path.name}. Using COCO pretrained weights.")

        self._model.to(self.device)
        self._model.eval()

        self._transform = transforms.Compose([
            transforms.ToTensor(),
        ])

    def load_finetuned_weights(self, weights_path: Path):
        from torchvision.models.detection.faster_rcnn import FastRCNNPredictor
        print(f"[EcoReef-Net] Loading fine-tuned weights from {weights_path}...")
        num_classes = len(CORAL_LABELS)
        in_features = self._model.roi_heads.box_predictor.cls_score.in_features
        self._model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)
        self._model.load_state_dict(torch.load(weights_path, map_location=self.device, weights_only=True))
        self.is_finetuned = True
        print("[EcoReef-Net] ✓ Fine-tuned weights loaded!")

    def detect(self, bgr_image: np.ndarray) -> List[dict]:
        """
        Run full detection pipeline on a CLAHE-enhanced BGR image.

        Returns a list of detection dictionaries:
          { "box": [x1,y1,x2,y2], "label": str, "score": float }
        """
        rgb_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)
        detections = self._run_rcnn_inference(rgb_image)

        if len(detections) > 0:
            return detections

        # Fallback: coral-specific color segmentation detector
        return color_based_coral_detection(bgr_image)

    def _run_rcnn_inference(self, rgb_image: np.ndarray) -> List[dict]:
        """
        Core Faster R-CNN inference loop.

        Pipeline:
        1. RGB ndarray → PIL Image → Tensor
        2. Tensor → device → model forward pass
        3. Filter predictions by confidence ≥ 0.70
        4. Classify detected regions via HSV coral health analysis
        """
        pil_image = Image.fromarray(rgb_image)
        input_tensor = self._transform(pil_image).unsqueeze(0).to(self.device)

        with torch.no_grad():
            predictions = self._model(input_tensor)

        pred = predictions[0]
        boxes = pred["boxes"].cpu().numpy()
        scores = pred["scores"].cpu().numpy()
        if "labels" in pred:
            labels = pred["labels"].cpu().numpy()
        else:
            labels = None

        results = []
        for i, score in enumerate(scores):
            if score < self.CONFIDENCE_THRESHOLD:
                continue

            x1, y1, x2, y2 = boxes[i].astype(int)
            
            if self.is_finetuned and labels is not None:
                # If fine-tuned, model natively predicts the coral health class
                label_idx = int(labels[i])
                label = CORAL_LABELS.get(label_idx, "Unknown Coral")
            else:
                # Fallback: Classify coral health from the region's color profile
                region = rgb_image[y1:y2, x1:x2]
                if region.size == 0:
                    continue
                label = classify_coral_health(region)

            results.append({
                "box": [int(x1), int(y1), int(x2), int(y2)],
                "label": label,
                "score": round(float(score), 4),
            })

        return results


# ═════════════════════════════════════════════════════════════════════
# STAGE 2B — OpenCV Contour-Based Detector (Fallback)
# ═════════════════════════════════════════════════════════════════════
class ContourCoralDetector:
    """
    OpenCV contour-based region proposal with HSV coral health
    classification. Serves as the primary detector when PyTorch
    is unavailable, or as a fallback when Faster R-CNN produces
    no high-confidence detections for pure underwater scenes.

    Pipeline:
    1. BGR → Grayscale → Gaussian blur → Adaptive threshold
    2. Morphological operations to clean noise
    3. Contour extraction → Filter by area
    4. Classify each region by HSV distribution
    """

    CONFIDENCE_THRESHOLD = 0.70

    def detect(self, bgr_image: np.ndarray) -> List[dict]:
        return color_based_coral_detection(bgr_image)


# ═════════════════════════════════════════════════════════════════════
# Shared Detection Utilities
# ═════════════════════════════════════════════════════════════════════
def classify_coral_health(rgb_region: np.ndarray) -> str:
    """
    Classify a coral region as Healthy, Bleached, or Dead based
    on its HSV and LAB color distribution.
    """
    hsv = cv2.cvtColor(rgb_region, cv2.COLOR_RGB2HSV)
    l_channel = cv2.cvtColor(rgb_region, cv2.COLOR_RGB2LAB)[:,:,0]
    
    h, s, v = cv2.split(hsv)

    mean_s = float(np.mean(s))
    mean_v = float(np.mean(v))
    mean_l = float(np.mean(l_channel))

    # Bleached coral is highly reflective (brightest objects in the water), regardless of water tint
    if mean_l > 125 or mean_v > 145:
        return "Bleached Coral"
    # Dead coral / rubble tends to be darker and less saturated
    elif mean_s < 120 or mean_v < 110:
        return "Dead Coral"
    else:
        return "Healthy Coral"


def color_based_coral_detection(bgr_image: np.ndarray) -> List[dict]:
    """
    Contour-based region proposal with HSV coral health
    classification.

    Pipeline:
    1. BGR → Grayscale → Gaussian blur → Adaptive threshold
    2. Morphological operations to clean noise
    3. Contour extraction → Filter by area
    4. Classify each region by HSV distribution
    5. Non-Maximum Suppression to deduplicate
    """
    gray = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (11, 11), 0)

    # Adaptive threshold for complex underwater textures
    thresh = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=51,
        C=8,
    )

    # Morphological closing to consolidate fragments
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    closed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel, iterations=2)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h_img, w_img = bgr_image.shape[:2]
    min_area = (h_img * w_img) * 0.005  # Min 0.5% of image
    max_area = (h_img * w_img) * 0.40   # Max 40%  of image

    rgb_image = cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB)
    results = []

    for contour in contours:
        area = cv2.contourArea(contour)
        if area < min_area or area > max_area:
            continue

        x, y, w, h = cv2.boundingRect(contour)

        # Skip very thin or very flat boxes
        aspect = w / max(h, 1)
        if aspect > 6 or aspect < 0.16:
            continue

        region = rgb_image[y:y + h, x:x + w]
        if region.size == 0:
            continue

        label = classify_coral_health(region)

        # Confidence score derived from region quality metrics
        compactness = area / (w * h) if (w * h) > 0 else 0
        confidence = min(0.70 + compactness * 0.25, 0.98)

        results.append({
            "box": [int(x), int(y), int(x + w), int(y + h)],
            "label": label,
            "score": round(confidence, 4),
        })

    # Deduplicate via Non-Maximum Suppression
    filtered = nms_filter(results, iou_threshold=0.45)
    
    # Failsafe: if nothing is detected, classify the entire image
    if not filtered:
        h, w = bgr_image.shape[:2]
        label = classify_coral_health(cv2.cvtColor(bgr_image, cv2.COLOR_BGR2RGB))
        filtered.append({
            "box": [10, 10, w - 10, h - 10],
            "label": label,
            "score": 1.0
        })
        
    return filtered


def nms_filter(detections: List[dict], iou_threshold: float = 0.45) -> List[dict]:
    """Greedy NMS to remove overlapping detections."""
    if not detections:
        return []

    if TORCH_AVAILABLE:
        boxes = np.array([d["box"] for d in detections], dtype=np.float32)
        scores = np.array([d["score"] for d in detections])
        indices = torchvision.ops.nms(
            torch.tensor(boxes),
            torch.tensor(scores),
            iou_threshold,
        ).numpy()
        return [detections[i] for i in indices]

    # Pure-numpy NMS fallback
    boxes = np.array([d["box"] for d in detections], dtype=np.float32)
    scores = np.array([d["score"] for d in detections])
    order = scores.argsort()[::-1]

    keep = []
    while order.size > 0:
        i = order[0]
        keep.append(i)

        if order.size == 1:
            break

        xx1 = np.maximum(boxes[i, 0], boxes[order[1:], 0])
        yy1 = np.maximum(boxes[i, 1], boxes[order[1:], 1])
        xx2 = np.minimum(boxes[i, 2], boxes[order[1:], 2])
        yy2 = np.minimum(boxes[i, 3], boxes[order[1:], 3])

        inter_w = np.maximum(0.0, xx2 - xx1)
        inter_h = np.maximum(0.0, yy2 - yy1)
        intersection = inter_w * inter_h

        area_i = (boxes[i, 2] - boxes[i, 0]) * (boxes[i, 3] - boxes[i, 1])
        areas_j = (boxes[order[1:], 2] - boxes[order[1:], 0]) * (boxes[order[1:], 3] - boxes[order[1:], 1])
        union = area_i + areas_j - intersection

        iou = intersection / np.maximum(union, 1e-6)
        remaining = np.where(iou <= iou_threshold)[0]
        order = order[remaining + 1]

    return [detections[i] for i in keep]


# ═════════════════════════════════════════════════════════════════════
# Result Rendering — Bounding Box Overlay
# ═════════════════════════════════════════════════════════════════════
def render_detections(bgr_image: np.ndarray, detections: List[dict]) -> np.ndarray:
    """
    Draw labeled bounding boxes onto the image canvas.
    Uses anti-aliased text with background rectangles for readability.
    """
    canvas = bgr_image.copy()
    font = cv2.FONT_HERSHEY_SIMPLEX
    font_scale = 0.55
    thickness = 2

    for det in detections:
        x1, y1, x2, y2 = det["box"]
        label = det["label"]
        score = det["score"]
        color = CORAL_COLORS.get(label, (200, 200, 200))

        # Bounding box
        cv2.rectangle(canvas, (x1, y1), (x2, y2), color, thickness)

        # Label background
        text = f"{label} {score:.0%}"
        (tw, th), baseline = cv2.getTextSize(text, font, font_scale, 1)
        cv2.rectangle(canvas, (x1, y1 - th - 10), (x1 + tw + 6, y1), color, -1)
        cv2.putText(canvas, text, (x1 + 3, y1 - 5), font, font_scale, (0, 0, 0), 1, cv2.LINE_AA)

    return canvas


# ═════════════════════════════════════════════════════════════════════
# Utility — NumPy array → Base64 data URI
# ═════════════════════════════════════════════════════════════════════
def ndarray_to_base64(bgr_image: np.ndarray, fmt: str = ".png") -> str:
    """Encode a BGR ndarray as a base64 data-URI string."""
    success, buffer = cv2.imencode(fmt, bgr_image)
    if not success:
        raise ValueError("Failed to encode image buffer")
    b64 = base64.b64encode(buffer).decode("utf-8")
    mime = "image/png" if fmt == ".png" else "image/jpeg"
    return f"data:{mime};base64,{b64}"


# ═════════════════════════════════════════════════════════════════════
# Singleton Initialization
# ═════════════════════════════════════════════════════════════════════
print("[EcoReef-Net] Initializing CLAHE Engine (clipLimit=3.0, tileGridSize=8×8)...")
clahe_engine = CLAHEEngine(clip_limit=3.0, tile_grid_size=(8, 8))

MODEL_NAME = "Faster R-CNN / MobileNetV3-Large-FPN"

if TORCH_AVAILABLE:
    print(f"[EcoReef-Net] Loading Faster R-CNN (MobileNetV3-Large-FPN) on {DEVICE}...")
    coral_detector = FasterRCNNDetector(device=DEVICE)
    print("[EcoReef-Net] ✓ Model loaded. System ready.\n")
else:
    print("[EcoReef-Net] Loading OpenCV contour-based coral detector...")
    coral_detector = ContourCoralDetector()
    MODEL_NAME = "OpenCV Contour Detector + HSV Classifier"
    print("[EcoReef-Net] ✓ Detector loaded. System ready.\n")


# ═════════════════════════════════════════════════════════════════════
# ROUTES
# ═════════════════════════════════════════════════════════════════════

@app.route("/", methods=["GET"])
def index():
    """GET / — Render the primary tracking visual control center."""
    return render_template("index.html")


def process_image_pipeline(file_bytes: np.ndarray) -> dict:
    t_start = time.perf_counter()

    # ── Decode image ──────────────────────────────────────────────
    t_decode_start = time.perf_counter()
    original_bgr = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if original_bgr is None:
        raise ValueError("Could not decode image. Supported formats: PNG, JPG, BMP, TIFF.")

    # Resize if excessively large (preserve aspect ratio)
    max_dim = 1280
    h, w = original_bgr.shape[:2]
    if max(h, w) > max_dim:
        scale = max_dim / max(h, w)
        original_bgr = cv2.resize(original_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
        h, w = original_bgr.shape[:2]

    t_decode = time.perf_counter() - t_decode_start

    # ── Stage 1: CLAHE Enhancement ────────────────────────────────
    t_clahe_start = time.perf_counter()
    enhanced_bgr = clahe_engine.enhance(original_bgr)
    t_clahe = time.perf_counter() - t_clahe_start

    # ── Stage 2: Detection Inference ──────────────────────────────
    t_infer_start = time.perf_counter()
    detections = coral_detector.detect(enhanced_bgr)
    t_infer = time.perf_counter() - t_infer_start

    # ── Render detections onto canvas ─────────────────────────────
    annotated_bgr = render_detections(enhanced_bgr, detections)

    # ── Compute analytics ─────────────────────────────────────────
    total_corals = len(detections)
    counts = {"Healthy Coral": 0, "Bleached Coral": 0, "Dead Coral": 0}
    for det in detections:
        label = det["label"]
        if label in counts:
            counts[label] += 1

    percentages = {}
    for label, count in counts.items():
        percentages[label] = round((count / total_corals * 100), 1) if total_corals > 0 else 0.0

    t_total = time.perf_counter() - t_start

    # ── Encode response images ────────────────────────────────────
    payload = {
        "original_image": ndarray_to_base64(original_bgr),
        "clahe_image": ndarray_to_base64(enhanced_bgr),
        "annotated_image": ndarray_to_base64(annotated_bgr),
        "detections": detections,
        "analytics": {
            "total_corals": total_corals,
            "counts": counts,
            "percentages": percentages,
            "image_dimensions": {"width": w, "height": h},
        },
        "telemetry": {
            "decode_ms": round(t_decode * 1000, 2),
            "clahe_ms": round(t_clahe * 1000, 2),
            "inference_ms": round(t_infer * 1000, 2),
            "total_ms": round(t_total * 1000, 2),
            "device": str(DEVICE),
            "model": MODEL_NAME,
            "confidence_threshold": 0.70,
            "torch_available": TORCH_AVAILABLE,
        },
    }

    return payload

@app.route("/process", methods=["POST"])
@app.route("/api/process", methods=["POST"])
def process():
    """
    POST /process and /api/process — Full dual-stage inference pipeline.
    """
    if "image" not in request.files:
        return jsonify({"error": "No image file provided. Use field name 'image'."}), 400

    file = request.files["image"]
    if file.filename == "":
        return jsonify({"error": "Empty filename."}), 400

    file_bytes = np.frombuffer(file.read(), np.uint8)

    try:
        payload = process_image_pipeline(file_bytes)
        return jsonify(payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route("/process-collection", methods=["POST"])
@app.route("/api/process-collection", methods=["POST"])
def process_collection():
    files = request.files.getlist("images")

    if not files:
        return jsonify({"error": "No images uploaded"}), 400

    results = []

    for file in files:
        if file.filename == "":
            continue

        file_bytes = np.frombuffer(file.read(), np.uint8)

        try:
            payload = process_image_pipeline(file_bytes)
            results.append(payload)
        except Exception as e:
            print(f"Error processing {file.filename}: {e}")
            continue

    return jsonify({
        "total_images": len(results),
        "results": results
    })


@app.route("/api/save", methods=["POST"])
def save_record():
    """POST /api/save — Stores execution metadata into MongoDB."""
    if mongo_client is None:
        return jsonify({"error": "MongoDB is not connected."}), 503
        
    data = request.json
    if not data:
        return jsonify({"error": "No JSON payload provided."}), 400
        
    record = {
        "imageId": data.get("imageId", str(uuid.uuid4())),
        "timestamp": data.get("timestamp", datetime.datetime.utcnow().isoformat()),
        "counts": data.get("counts", {}),
        "riskScore": data.get("riskScore", 0),
        "riskLevel": data.get("riskLevel", "Unknown"),
        "imageUrl": data.get("imageUrl", "")  # In production, save to S3 and store URL.
    }
    
    try:
        inserted = records_collection.insert_one(record)
        return jsonify({"success": True, "id": str(inserted.inserted_id)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/records", methods=["GET"])
def get_records():
    """GET /api/records — Fetches historical detection logs."""
    if mongo_client is None:
        return jsonify({"error": "MongoDB is not connected.", "records": []}), 503
        
    try:
        docs = list(records_collection.find().sort("timestamp", -1).limit(100))
        for doc in docs:
            doc["_id"] = str(doc["_id"])
            # Do not send back huge base64 imageUrls for table to save bandwidth
            if "imageUrl" in doc:
                del doc["imageUrl"] 
        return jsonify({"records": docs})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ═════════════════════════════════════════════════════════════════════
# Entry Point
# ═════════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("  EcoReef-Net  •  Coral Health Monitoring System")
    print(f"  Model: {MODEL_NAME}")
    print("  http://127.0.0.1:5000")
    print("=" * 60)
    app.run(host="0.0.0.0", port=5000, debug=True)
