"""Overlay registered silhouettes and report signed landmark and span errors in pixels."""
import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageEnhance, ImageFilter, ImageOps


REFERENCE = (0, 215, 230)
RENDER = (255, 145, 45)
ALPHA_ROLE = "industrial-form-match.alpha-role"


def display_image(path):
    with Image.open(path) as image:
        display = ImageOps.exif_transpose(image).convert("RGBA")
        if image.info.get(ALPHA_ROLE) == "canvas-only":
            display.info[ALPHA_ROLE] = "canvas-only"
        return display


def outline(image, mask_path):
    if mask_path:
        mask = display_image(mask_path)
        if mask.size != image.size:
            raise ValueError(f"Mask has a different display size: {mask_path}")
        alpha = mask.getchannel("A")
        use_alpha = mask.info.get(ALPHA_ROLE) != "canvas-only" and alpha.getextrema()[0] < 128
        channel = alpha if use_alpha else mask.convert("L")
        source = "mask"
    else:
        channel = image.getchannel("A")
        if image.info.get(ALPHA_ROLE) == "canvas-only" or channel.getextrema()[0] >= 128:
            return Image.new("L", image.size), "none"
        source = "alpha"
    binary = channel.point(lambda value: 255 if value >= 128 else 0)
    if binary.getbbox() is None:
        raise ValueError("The silhouette has no foreground at the mask threshold of 128.")
    inset = ImageOps.expand(binary, border=1, fill=0).filter(ImageFilter.MinFilter(3))
    inset = inset.crop((1, 1, image.width + 1, image.height + 1))
    return ImageChops.subtract(binary, inset), source


def coordinate(values, size):
    if not isinstance(values, list) or len(values) != 2:
        raise ValueError("A point must be [x, y].")
    if any(type(v) not in (int, float) or not math.isfinite(v) or not 0 <= v <= limit
           for v, limit in zip(values, size)):
        raise ValueError(f"Point lies outside the display frame {size} or is not finite: {values}")
    return values


def pixel(point, size):
    return tuple(min(math.floor(v), limit - 1) for v, limit in zip(point, size))


def measure(annotations, size):
    landmarks = {}
    for mark in annotations.get("landmarks", []):
        name, role = mark["name"], mark["role"]
        if not isinstance(name, str) or not name.strip() or name in landmarks:
            raise ValueError(f"Landmarks need unique nonempty names: {name}")
        if role not in ("fit", "check"):
            raise ValueError(f"Choose fit or check for {name}.")
        ref = coordinate(mark["reference"], size)
        render = coordinate(mark["render"], size)
        distance = math.dist(ref, render)
        row = {
            "index": len(landmarks) + 1, "name": name, "role": role,
            "reference": ref, "render": render,
            "dx_px": render[0] - ref[0], "dy_px": render[1] - ref[1], "distance_px": distance,
        }
        if "uncertainty_px" in mark:
            uncertainty = mark["uncertainty_px"]
            if type(uncertainty) not in (int, float) or not math.isfinite(uncertainty) or uncertainty < 0:
                raise ValueError("uncertainty_px must be a finite, nonnegative number.")
            row.update(uncertainty_px=uncertainty, within_uncertainty=distance <= uncertainty)
        landmarks[name] = row
    spans = []
    for span in annotations.get("spans", []):
        start, end = landmarks[span["from"]], landmarks[span["to"]]
        reference_length = math.dist(start["reference"], end["reference"])
        measure_type = span.get("measure", "distance")
        if measure_type == "distance":
            render_length = math.dist(start["render"], end["render"])
        elif measure_type == "reference_axis" and reference_length > 0:
            axis = [(e - s) / reference_length for s, e in zip(start["reference"], end["reference"])]
            render_length = sum(a * (e - s) for a, s, e in zip(axis, start["render"], end["render"]))
        else:
            raise ValueError("Use distance or reference_axis; an axis needs distinct reference endpoints.")
        spans.append({"name": span["name"], "from": start["name"], "to": end["name"], "measure": measure_type,
                      "reference_px": reference_length, "render_px": render_length,
                      "delta_px": render_length - reference_length})
    return list(landmarks.values()), spans


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("reference", type=Path)
    parser.add_argument("render", type=Path)
    parser.add_argument("output", type=Path)
    ref_options = parser.add_mutually_exclusive_group()
    ref_options.add_argument("--reference-mask", type=Path)
    ref_options.add_argument("--ignore-reference-alpha", action="store_true",
                             help="ignore transparency from layout or canvas padding in an external image")
    parser.add_argument("--render-mask", type=Path)
    parser.add_argument("--annotations", type=Path)
    args = parser.parse_args()
    if args.output.suffix.lower() != ".png" or args.output.exists():
        parser.error("Choose a new PNG output path.")
    reference, render = display_image(args.reference), display_image(args.render)
    if reference.size != render.size:
        parser.error("Export both images with the same display frame and crop.")
    size = reference.size
    try:
        if args.ignore_reference_alpha:
            ref_edges, ref_source = Image.new("L", size), "none"
        else:
            ref_edges, ref_source = outline(reference, args.reference_mask)
        render_edges, render_source = outline(render, args.render_mask)
        if render_source == "none":
            raise ValueError("Use a transparent render or supply --render-mask.")
        annotations = {}
        if args.annotations:
            annotations = json.loads(args.annotations.read_text(encoding="utf-8-sig"))
            if not isinstance(annotations, dict) or annotations.get("size") != list(size):
                raise ValueError("Annotation size must match the display frame.")
        traces = annotations.get("reference_lines", [])
        for trace in traces:
            if len(trace) < 2:
                raise ValueError("A traced edge needs at least two points.")
            points = [pixel(coordinate(point, size), size) for point in trace]
            ImageDraw.Draw(ref_edges).line(points, fill=255)
        if traces:
            ref_source = "manual lines" if ref_source == "none" else f"{ref_source} + manual lines"
        marks, spans = measure(annotations, size)
    except (ValueError, KeyError, TypeError) as exc:
        parser.error(str(exc))

    base = Image.new("RGB", size, (35, 35, 35))
    base.paste(reference, mask=reference.getchannel("A"))
    overlay = ImageEnhance.Brightness(base).enhance(0.65)
    overlay.paste(REFERENCE, (0, 0, *size), ref_edges)
    overlay.paste(RENDER, (0, 0, *size), render_edges)
    overlay.paste((255, 255, 255), (0, 0, *size), ImageChops.darker(ref_edges, render_edges))
    draw = ImageDraw.Draw(overlay)
    for mark in marks:
        x, y = pixel(mark["reference"], size)
        u, v = pixel(mark["render"], size)
        draw.line([(x, y), (u, v)], fill="white")
        draw.ellipse((x-3, y-3, x+3, y+3), outline=REFERENCE)
        draw.line([(u-2, v-2), (u+2, v+2)], fill=RENDER)
        draw.line([(u-2, v+2), (u+2, v-2)], fill=RENDER)
        draw.text((u+4, v+2), str(mark["index"]), fill="white", stroke_width=1, stroke_fill="black")
    with args.output.open("xb") as stream:
        overlay.save(stream, format="PNG")
    print(json.dumps({"size": size, "reference_contour": ref_source, "render_contour": render_source,
                      "landmarks": marks, "spans": spans}, ensure_ascii=True, indent=2))


if __name__ == "__main__":
    main()
