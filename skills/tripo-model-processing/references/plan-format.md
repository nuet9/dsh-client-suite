# Semantic review and explicit plan

Run inspect first. It returns paths, component count, source SHA256, a compact manifest and a plan template; the CLI never prints hundreds of components. Read only needed manifest slices. --previews explicitly requests three orthographic PNGs and preview-labels.json under the source cache. Coordinates pair fragment IDs with image positions. Inspect those images with an available image tool; use complete-prop visual evidence and source context. Small overlapping fragments may need additional focused views made with headless Blender. No model, proximity, connectedness or bounding-box heuristic alone certifies a complete semantic prop.

Use a short Python script to copy plan-template.json to a durable plan file and add the groups; do not print or transcribe the large component_hashes array. Keep source_sha256, blender, id_scheme and component_hashes unchanged. Add groups, for example:

    "semantic_reviewed": true,
    "groups": [
      {"name": "Folding_Chair_Left", "ids": [0, 2, 3]},
      {"name": "Storage_Box", "ids": [1, 4]}
    ]

Each zero-based ID appears exactly once in the plan. Names must be unique, nonempty, shorter than 64 characters, and accepted unchanged by Blender. Use one complete prop per group. Do not join separate props because they touch, and do not leave rails, legs, handles or cables of one prop detached without semantic justification. When evidence is ambiguous, obtain focused views or request the missing grouping decision.

ID scheme loose-location-stable-v1: factory-empty import → select meshes → Blender loose separation → stable sort by object.location (matching the legacy workflow) → zero-based index. Human label Loose_001 corresponds to ID 0. Exact source SHA256, Blender version and a per-component geometry/world-transform/material/UV/color digest bind the plan to its input. This is intentionally not a universal geometry-only semantic cache: differing source material/UV/scene data must never inherit a prior grouping blindly.

After successful processing and verification, the runner stores successful-plan.json in that source's cache and checks it against freshly inspected component hashes. No source model, private plan or cache is shipped. No semantic review is implied for a new input.
