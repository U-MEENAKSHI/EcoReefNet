import requests
import numpy as np
import cv2

# create dummy image
img = np.zeros((500, 500, 3), dtype=np.uint8)
img[100:200, 100:200] = [200, 100, 50]  # give it some color
cv2.imwrite("dummy_test.png", img)

with open("dummy_test.png", "rb") as f:
    r = requests.post("http://127.0.0.1:5000/process", files={"image": f})

print(r.status_code)
data = r.json()
print("Detections:")
for d in data.get("detections", []):
    print(d)
print("Analytics counts:", data.get("analytics", {}).get("counts"))
