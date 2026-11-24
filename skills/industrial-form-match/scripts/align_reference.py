"""Rotate the EXIF-oriented display image, then crop. Coordinates use image-edge pixels."""
import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageOps
from PIL.PngImagePlugin import PngInfo


ALPHA_ROLE = "industrial-form-match.alpha-role"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--clockwise", type=float, help="clockwise rotation in degrees")
    mode.add_argument("--axis", nargs=4, type=float, metavar=("TOP_X", "TOP_Y", "BOTTOM_X", "BOTTOM_Y"))
    parser.add_argument("--axis-check", nargs=2, type=float, action="append", default=[],
                        metavar=("X", "Y"), help="independently picked section center, held out of the axis fit")
    parser.add_argument("--crop", nargs=4, type=int, metavar=("LEFT", "TOP", "RIGHT", "BOTTOM"))
    parser.add_argument("--point", nargs=2, type=float, action="append", default=[])
    args = parser.parse_args()
    if args.output.suffix.lower() != ".png" or args.output.exists():
        parser.error("Choose a new PNG output path.")
    if args.axis_check and not args.axis:
        parser.error("--axis-check requires --axis.")

    with Image.open(args.source) as source:
        stored_size = source.size
        orientation = source.getexif().get(274, 1)
        display = ImageOps.exif_transpose(source).convert("RGBA")
        canvas_alpha = (source.info.get(ALPHA_ROLE) == "canvas-only"
                        or display.getchannel("A").getextrema()[0] >= 128)
    width, height = display.size
    angle = args.clockwise
    if args.axis:
        x1, y1, x2, y2 = args.axis
        if (x1, y1) == (x2, y2):
            parser.error("Choose two distinct axis points.")
        if any(point in ([x1, y1], [x2, y2]) for point in args.axis_check):
            parser.error("An axis check must use an independent section.")
        angle = math.degrees(math.atan2(x2 - x1, y2 - y1))
    coordinates = (args.axis or []) + [v for point in args.axis_check + args.point for v in point]
    if not all(math.isfinite(v) for v in [angle, *coordinates]):
        parser.error("Coordinates and angles must be finite.")
    left, top, right, bottom = args.crop or (0, 0, width, height)
    if not (0 <= left < right <= width and 0 <= top < bottom <= height):
        parser.error("Crop must lie inside the rotated display canvas.")
    cx, cy = width / 2, height / 2
    rotated = display.rotate(-angle, Image.Resampling.BICUBIC, center=(cx, cy))
    result = rotated.crop((left, top, right, bottom))
    result.info.clear()
    png_info = PngInfo()
    if canvas_alpha:
        png_info.add_text(ALPHA_ROLE, "canvas-only")
    with args.output.open("xb") as stream:
        result.save(stream, format="PNG", pnginfo=png_info)

    a = math.cos(math.radians(angle))
    b = math.sin(math.radians(angle))
    tx, ty = cx - a*cx + b*cy - left, cy - b*cx - a*cy - top
    forward = [[a, -b, tx], [b, a, ty]]
    inverse = [[a, b, -a*tx - b*ty], [-b, a, b*tx - a*ty]]

    def to_crop(x, y):
        return [a*x - b*y + tx, b*x + a*y + ty]

    points = [{"source": p, "crop": to_crop(*p)} for p in args.point]
    checks = []
    if args.axis:
        axis_x = to_crop(*args.axis[:2])[0]
        for point in args.axis_check:
            projected = to_crop(*point)
            checks.append({"source": point, "crop": projected, "offset_px": projected[0] - axis_x})
    print(json.dumps({
        "coordinate_space": "EXIF-oriented display image, top-left origin, x right, y down",
        "stored_size": stored_size, "exif_orientation": orientation, "source_size": display.size,
        "center": [cx, cy], "clockwise": angle, "crop": [left, top, right, bottom],
        "forward": forward, "inverse": inverse, "points": points, "axis_checks": checks,
    }, indent=2))


if __name__ == "__main__":
    main()
