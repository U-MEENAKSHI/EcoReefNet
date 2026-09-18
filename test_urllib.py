import urllib.request
import urllib.parse
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from email.mime.base import MIMEBase
from io import BytesIO
import uuid

boundary = uuid.uuid4().hex
headers = {'Content-Type': f'multipart/form-data; boundary={boundary}'}

# Dummy image data
img_data = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'

body = b''
for i in range(2):
    body += f'--{boundary}\r\n'.encode('utf-8')
    body += f'Content-Disposition: form-data; name="images"; filename="test{i}.png"\r\n'.encode('utf-8')
    body += b'Content-Type: image/png\r\n\r\n'
    body += img_data
    body += b'\r\n'
body += f'--{boundary}--\r\n'.encode('utf-8')

req = urllib.request.Request('http://127.0.0.1:5000/process-collection', data=body, headers=headers)
try:
    response = urllib.request.urlopen(req)
    print("Status:", response.getcode())
    print("Success")
except urllib.error.HTTPError as e:
    print('HTTPError:', e.code)
    print(e.read().decode())
except Exception as e:
    print('Error:', e)
