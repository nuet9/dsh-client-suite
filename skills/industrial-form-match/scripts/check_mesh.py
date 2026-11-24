"""Read-only topology checks on evaluated objects in Blender's active view layer."""
import argparse
from collections import Counter
import json
import math
from pathlib import Path
import sys

import bmesh
import bpy


TYPES = {"MESH", "CURVE", "SURFACE", "FONT"}
INTENTS = {"solid", "sheet", "review", "skip"}


def signed_shell_volumes(bm):
    """Track components separately so that a reversed shell is not hidden by another shell."""
    group = {}
    origins = []
    for seed in bm.faces:
        if seed in group:
            continue
        index = len(origins)
        origins.append(seed.verts[0].co.copy())
        group[seed] = index
        pending = [seed]
        while pending:
            face = pending.pop()
            for edge in face.edges:
                for neighbor in edge.link_faces:
                    if neighbor not in group:
                        group[neighbor] = index
                        pending.append(neighbor)
    volumes = [0.0] * len(origins)
    for triangle in bm.calc_loop_triangles():
        shell = group[triangle[0].face]
        a, b, c = (loop.vert.co - origins[shell] for loop in triangle)
        volumes[shell] += a.dot(b.cross(c)) / 6.0
    return volumes


def inspect(obj, intent, graph, relative_area):
    row = {"name": obj.name, "object_type": obj.type, "intent": intent}
    if intent == "skip":
        return {**row, "status": "skipped"}
    evaluated = obj.evaluated_get(graph)
    bm = bmesh.new()
    try:
        mesh = evaluated.to_mesh()
        if mesh is None:
            return {**row, "status": "review", "notes": ["no_evaluated_mesh"]}
        bm.from_mesh(mesh)
        linear = evaluated.matrix_world.to_3x3()
        determinant = linear.determinant()
        bm.transform(linear.to_4x4())  # world scale without distant world-origin coordinates
        bm.normal_update()
        diagonal_sq = 0.0
        if bm.verts:
            for axis in range(3):
                low = min(v.co[axis] for v in bm.verts)
                high = max(v.co[axis] for v in bm.verts)
                diagonal_sq += (high - low) ** 2
        area_limit = diagonal_sq * relative_area
        counts = {
            "vertices": len(bm.verts), "edges": len(bm.edges), "faces": len(bm.faces),
            "boundary_edges": sum(e.is_boundary for e in bm.edges),
            "edges_over_two_faces": sum(len(e.link_faces) > 2 for e in bm.edges),
            "loose_edges": sum(e.is_wire for e in bm.edges),
            "isolated_vertices": sum(not v.link_edges for v in bm.verts),
            "nonmanifold_vertices": sum(not v.is_manifold for v in bm.verts),
            "winding_conflicts": sum(e.is_manifold and not e.is_contiguous for e in bm.edges),
            "near_zero_faces": sum(f.calc_area() <= area_limit for f in bm.faces),
        }
        issues = [name for name in ("edges_over_two_faces", "loose_edges", "isolated_vertices",
                                    "nonmanifold_vertices", "winding_conflicts", "near_zero_faces") if counts[name]]
        notes = []
        if not counts["faces"]:
            issues.append("no_faces")
        if determinant == 0:
            issues.append("singular_object_transform")
        if intent == "solid" and counts["boundary_edges"]:
            issues.append("boundary_edges")
        elif intent == "review":
            notes.append("classify_part_before_acceptance")
        volumes = None
        if not issues and not counts["boundary_edges"] and not counts["nonmanifold_vertices"]:
            volumes = signed_shell_volumes(bm)
            if determinant < 0:
                volumes = [-v for v in volumes]
            if intent == "solid" and len(volumes) == 1 and volumes[0] <= 0:
                issues.append("inward_or_zero_volume_shell")
            elif any(v <= 0 for v in volumes):
                notes.append("inspect_shell_orientation_and_nested_cavities")
        status = "issues" if issues else "review" if notes else "ok"
        return {**row, **counts, "area_limit": area_limit, "mirrored_transform": determinant < 0,
                "shell_signed_volumes": volumes, "status": status, "issues": issues, "notes": notes}
    finally:
        bm.free()
        evaluated.to_mesh_clear()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--parts", type=Path, help="JSON with a default intent and exact object-name overrides")
    parser.add_argument("--output", type=Path, required=True, help="new report JSON")
    parser.add_argument("--relative-area", type=float, default=1e-14,
                        help="face area threshold as a fraction of squared part diagonal; zero for exact zero only")
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    args = parser.parse_args(argv)
    if args.output.suffix.lower() != ".json" or args.output.exists():
        parser.error("Choose a new .json report path.")
    if not math.isfinite(args.relative_area) or args.relative_area < 0:
        parser.error("--relative-area must be finite and nonnegative.")
    policy = json.loads(args.parts.read_text(encoding="utf-8-sig")) if args.parts else {}
    if not isinstance(policy, dict) or set(policy) - {"default", "objects"}:
        parser.error("Part policy accepts default and objects.")
    default = policy.get("default", "review")
    overrides = policy.get("objects", {})
    if not isinstance(overrides, dict) or any(not isinstance(v, str) or v not in INTENTS
                                              for v in [default, *overrides.values()]):
        parser.error("Part intents are solid, sheet, review or skip.")
    layer = bpy.context.view_layer
    objects = sorted((obj for obj in layer.objects if obj.type in TYPES), key=lambda obj: obj.name)
    missing = set(overrides) - {obj.name for obj in objects}
    if missing:
        parser.error(f"Object names absent from the inspected view layer: {sorted(missing)}")
    graph = bpy.context.evaluated_depsgraph_get()
    rows = [inspect(obj, overrides.get(obj.name, default), graph, args.relative_area) for obj in objects]
    scene = bpy.context.scene
    report = {
        "file": bpy.data.filepath, "blender": bpy.app.version_string, "scene": scene.name,
        "view_layer": layer.name, "frame": scene.frame_current, "relative_face_area": args.relative_area,
        "collection_instancers": [o.name for o in layer.objects if o.instance_type == "COLLECTION"],
        "summary": dict(Counter(row["status"] for row in rows)), "objects": rows,
    }
    with args.output.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write("\n")
    print("Mesh audit:", json.dumps(report["summary"]), "->", args.output)


if __name__ == "__main__":
    main()
