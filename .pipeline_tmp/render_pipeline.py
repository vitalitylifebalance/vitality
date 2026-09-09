import json
import os
import subprocess
import sys
import textwrap

from PIL import Image, ImageDraw, ImageFont

FONT_PATH = '/System/Library/Fonts/Helvetica.ttc'
FONT_INDEX = 1  # bold
FONT_SIZE = 22
WRAP_CHARS = 34
LINE_SPACING = 6
BOTTOM_MARGIN = 30
OUTLINE = 2


def wrap_text(text):
    lines = textwrap.wrap(text, width=WRAP_CHARS)
    return lines if lines else [text]


def render_subtitle_png(text, video_width, out_path):
    font = ImageFont.truetype(FONT_PATH, FONT_SIZE, index=FONT_INDEX)
    lines = wrap_text(text)

    # measure
    dummy = Image.new('RGBA', (10, 10))
    ddraw = ImageDraw.Draw(dummy)
    line_heights = []
    line_widths = []
    for line in lines:
        bbox = ddraw.textbbox((0, 0), line, font=font)
        line_widths.append(bbox[2] - bbox[0])
        line_heights.append(bbox[3] - bbox[1])
    max_line_h = max(line_heights) if line_heights else FONT_SIZE
    total_h = len(lines) * max_line_h + (len(lines) - 1) * LINE_SPACING + OUTLINE * 2 + 8

    img = Image.new('RGBA', (video_width, int(total_h)), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    y = OUTLINE + 4
    for line, lw in zip(lines, line_widths):
        x = (video_width - lw) // 2
        # outline
        for dx in (-OUTLINE, 0, OUTLINE):
            for dy in (-OUTLINE, 0, OUTLINE):
                if dx == 0 and dy == 0:
                    continue
                draw.text((x + dx, y + dy), line, font=font, fill=(0, 0, 0, 255))
        draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))
        y += max_line_h + LINE_SPACING

    img.save(out_path)
    return img.size


def build_and_render(video_path, segments, video_width, png_dir, out_path):
    os.makedirs(png_dir, exist_ok=True)
    png_paths = []
    for i, seg in enumerate(segments):
        png_path = os.path.join(png_dir, f'seg{i:03d}.png')
        render_subtitle_png(seg['texto'], video_width, png_path)
        png_paths.append(png_path)

    inputs = ['-i', video_path]
    for p in png_paths:
        inputs += ['-i', p]

    filter_parts = []
    prev_label = '0:v'
    for i, seg in enumerate(segments):
        in_label = f'{i+1}:v'
        out_label = f'v{i+1}' if i < len(segments) - 1 else 'vout'
        filt = (
            f"[{prev_label}][{in_label}]overlay="
            f"enable='between(t,{seg['start']},{seg['end']})':"
            f"x=(W-w)/2:y=H-h-{BOTTOM_MARGIN}[{out_label}]"
        )
        filter_parts.append(filt)
        prev_label = out_label

    filter_complex = ';'.join(filter_parts)

    cmd = [
        'ffmpeg', '-y'
    ] + inputs + [
        '-filter_complex', filter_complex,
        '-map', '[vout]', '-map', '0:a',
        '-c:a', 'copy', '-c:v', 'libx264', '-crf', '20', '-preset', 'fast',
        out_path
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stderr[-4000:])
        raise RuntimeError(f'ffmpeg failed for {out_path}')
    return out_path


if __name__ == '__main__':
    video_path = sys.argv[1]
    json_path = sys.argv[2]
    video_width = int(sys.argv[3])
    out_path = sys.argv[4]
    png_dir = sys.argv[5]

    with open(json_path) as f:
        segments = json.load(f)

    build_and_render(video_path, segments, video_width, png_dir, out_path)
    print('DONE', out_path)
