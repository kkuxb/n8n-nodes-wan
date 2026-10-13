"""Compare the source clip against generated extension windows; no API calls."""
import json
import subprocess
from pathlib import Path
import numpy as np

root = Path('.local/live')
def frames(video):
    run = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(video), '-vf', 'fps=2,scale=160:90,format=gray', '-f', 'rawvideo', 'pipe:1'], capture_output=True, check=True)
    return np.frombuffer(run.stdout, dtype=np.uint8).reshape(-1, 90, 160).astype(float)

source = frames(root / 'default-1080p/video.mp4')
results = []
for name in ['extend-backward', 'extend-forward', 'extend-both']:
    video = root / name / 'video.mp4'
    if not video.exists():
        continue
    output = frames(video)
    scores = [{'sourceStartsAtSeconds': offset / 2, 'meanAbsolutePixelDifference': round(float(np.abs(output[offset:offset + len(source)] - source).mean()), 3)} for offset in range(len(output) - len(source) + 1)]
    best = min(scores, key=lambda score: score['meanAbsolutePixelDifference'])
    results.append({'case': name, 'bestAlignment': best, 'allOffsets': scores})
(root / 'extension-alignment.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps([{'case': result['case'], **result['bestAlignment']} for result in results], indent=2))
