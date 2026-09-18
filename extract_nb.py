import json
with open('dataset/reef-starter-torch-fasterrcnn-train-lb-0-416.ipynb', encoding='utf-8') as f:
    nb = json.load(f)
cells = [c['source'] for c in nb['cells'] if c['cell_type'] == 'code']
with open('extract.py', 'w', encoding='utf-8') as f:
    for c in cells:
        f.write(''.join(c))
        f.write('\n# =========\n')
