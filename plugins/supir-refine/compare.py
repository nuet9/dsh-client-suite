"""Build a side-by-side comparison: bicubic upscale vs SUPIR refinement."""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

FONT = r"C:\Windows\Fonts\msyh.ttc"


def font(size):
    try:
        return ImageFont.truetype(FONT, size)
    except Exception:
        return ImageFont.load_default()


def label(im, text, size=40):
    canvas = Image.new("RGB", (im.width, im.height + size + 14), (16, 16, 16))
    canvas.paste(im, (0, size + 14))
    ImageDraw.Draw(canvas).text((14, 6), text, fill=(240, 240, 240), font=font(size))
    return canvas


def main():
    if len(sys.argv) < 4:
        return 2
    src, out, target = sys.argv[1:4]
    a = Image.open(src).convert("RGB")
    b = Image.open(out).convert("RGB")
    a = a.resize(b.size, Image.LANCZOS)
    panels = [
        label(a, f"A  original {Image.open(src).width}px (bicubic -> {b.size[0]}px)"),
        label(b, f"B  SUPIR refined {b.size[0]}x{b.size[1]}"),
    ]
    sheet = Image.new("RGB", (b.size[0], sum(p.height for p in panels)), (10, 10, 10))
    y = 0
    for p in panels:
        sheet.paste(p, (0, y))
        y += p.height
    os.makedirs(os.path.dirname(target) or ".", exist_ok=True)
    sheet.save(target, quality=92)
    return 0


if __name__ == "__main__":
    sys.exit(main())
