"""Inspect downloaded acceptance videos without making any API calls."""
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw

root = Path('.local/live')
summaries = []
for directory in sorted(root.iterdir()):
    video = directory / 'video.mp4'
    if not video.exists():
        continue
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_type,width,height,r_frame_rate,duration', '-of', 'json', str(video)], capture_output=True, check=True, text=True)
    info = json.loads(probe.stdout)
    (directory / 'probe.json').write_text(json.dumps(info, indent=2), encoding='utf-8')
    stream = next(s for s in info['streams'] if s['codec_type'] == 'video')
    duration = float(stream['duration'])
    times = [0, duration * .25, duration * .5, duration * .75, max(0, duration - .1)]
    sheet = Image.new('RGB', (1600, 240), 'white')
    draw = ImageDraw.Draw(sheet)
    for index, seconds in enumerate(times):
        frame = directory / f'frame-{index}.jpg'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', str(seconds), '-i', str(video), '-frames:v', '1', '-vf', 'scale=320:200:force_original_aspect_ratio=decrease', str(frame)], check=True, capture_output=True)
        with Image.open(frame) as image:
            sheet.paste(image, (index * 320, 22))
        draw.text((index * 320 + 4, 3), f'{directory.name} / {seconds:.2f}s', fill='black')
    sheet.save(directory / 'contact.jpg')
    decoded = subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(video), '-f', 'null', '-'], capture_output=True, text=True)
    summaries.append({'case': directory.name, 'duration': duration, 'width': stream['width'], 'height': stream['height'], 'fps': stream['r_frame_rate'], 'audio': any(s['codec_type'] == 'audio' for s in info['streams']), 'decodePassed': decoded.returncode == 0})
(root / 'media-summary.json').write_text(json.dumps(summaries, indent=2), encoding='utf-8')
print(json.dumps(summaries, indent=2))
