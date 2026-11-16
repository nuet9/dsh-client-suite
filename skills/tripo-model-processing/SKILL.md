---
name: tripo-model-processing
description: Process static Tripo GLB into complete semantic props, clean geometry and bake hard surface normals while preserving each prop's original world position, orientation and size. Use for Tripo model processing / Tripo 模型处理, including ordinary chat and art toolbox tasks.
---

# Tripo 模型处理

Default delivery: processed GLB + small validation report. Preserve original world geometry for every prop. Background/headless only; no installs. BLEND only on explicit request with --blend.

Runner: scripts/runner.py relative to this skill; keep scripts/worker.py beside it. Use Python from load_workspace_dependencies. Supply the deployment's absolute Blender path with --blender, or set TRIPO_BLENDER_EXECUTABLE; no installation path is assumed. Windows launches must be hidden (windowsHide / CREATE_NO_WINDOW); runner launches Blender background hidden itself. The scripts directory needs write access for its private .cache; it is not a public deliverable.

1. Input path → run inspect --input <source.glb>. Read its bounded JSON. An exact-source successful plan avoids repeated semantic analysis.
2. If no cached plan: read [semantic grouping and plan format](references/plan-format.md). Inspect component manifest and optional --previews. Visually review complete objects once and create an explicit bounded plan covering every raw fragment exactly once. Distance alone cannot decide semantic grouping. Never mark semantic_reviewed true without real visual evidence.
3. Run process --input <source.glb> --output-dir <new-folder> [--plan <plan.json>] [--blend only if requested]. The runner cleans, verifies per-prop triangle coverage/world placement, material/UV preservation and reimported corner normals before publishing. Nonzero exit or needs_attention means no validated delivery; read the returned log/reason.
4. Run verify with the same --input and --output-dir for independent reimport validation. Deliver one absolute GLB output-folder link labelled 打开系统文件夹 (with a trailing slash), with actual validation stats. Do not expose internal cache/log files as deliverables.
5. Register completed result using art_toolbox: report for a toolbox job, otherwise import with kind tripo, absolute GLB/report paths, source input and actual verification. Discover its current schema; the toolbox integration owns registration, not the runner.

Read [runner usage and limits](references/runner.md) only for flags, cache, failures or supported features. No private source-specific grouping plans or models are shipped. Every new input needs its own visually reviewed plan; cached plans are valid only for the exact source and Blender version.
