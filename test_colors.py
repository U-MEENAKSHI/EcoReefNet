import cv2
import numpy as np

colors = {
    "BrightCyan-Bleached": (230, 200, 150), # BGR format: mostly Blue and Green, less red
    "PaleCyan-Bleached": (200, 190, 160),
    "BlueWater-Bleached": (250, 180, 100),  # Very blue
    "Brown-Rubble1": (80, 100, 120),  # BGR for Brown
    "Grey-Rubble2": (100, 100, 100),  # Grey
    "Healthy1": (120, 180, 200),      # Yellow/Green
    "Healthy2": (50, 150, 50),        # Dark Green
}

for name, color in colors.items():
    img = np.zeros((10, 10, 3), dtype=np.uint8)
    img[:] = color
    rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    l_channel = cv2.cvtColor(rgb, cv2.COLOR_RGB2LAB)[:,:,0]
    s = np.mean(hsv[:,:,1])
    v = np.mean(hsv[:,:,2])
    l = np.mean(l_channel)
    print(f"{name:20}: L={l:5.1f} | S={s:5.1f} | V={v:5.1f}")
