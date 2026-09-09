import json
import subprocess
import sys

import numpy as np
from PIL import Image


def ffprobe_json(path):
    cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
           '-show_entries', 'stream=codec_type', '-of', 'json', path]
    out = subprocess.run(cmd, capture_output=True, text=True).stdout
    return json.loads(out)


def has_audio(path):
    data = ffprobe_json(path)
    return any(s.get('codec_type') == 'audio' for s in data.get('streams', []))


def get_duration(path):
    data = ffprobe_json(path)
    return float(data['format']['duration'])


def frame_has_white_bottom_strip(path, at_time, sample_out):
    cmd = ['ffmpeg', '-y', '-ss', str(at_time), '-i', path, '-frames:v', '1',
           '-update', '1', sample_out]
    subprocess.run(cmd, capture_output=True, text=True)
    img = Image.open(sample_out).convert('RGB')
    w, h = img.size
    strip = np.array(img.crop((0, h - 100, w, h)))
    # white-ish pixels: all channels high
    white_mask = (strip[:, :, 0] > 200) & (strip[:, :, 1] > 200) & (strip[:, :, 2] > 200)
    return bool(white_mask.sum() > 50), int(white_mask.sum())


if __name__ == '__main__':
    video_path = sys.argv[1]
    orig_duration = float(sys.argv[2])
    mid_time = float(sys.argv[3])
    sample_out = sys.argv[4]

    dur = get_duration(video_path)
    dur_ok = abs(dur - orig_duration) <= 0.2
    audio_ok = has_audio(video_path)
    white_ok, white_count = frame_has_white_bottom_strip(video_path, mid_time, sample_out)

    print(json.dumps({
        'video': video_path,
        'duration': dur,
        'orig_duration': orig_duration,
        'duration_ok': dur_ok,
        'audio_ok': audio_ok,
        'label_detected': white_ok,
        'white_px': white_count,
    }, indent=1))
