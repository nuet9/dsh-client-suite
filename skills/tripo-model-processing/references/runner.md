# Runner usage and validation

Public CLI, all arguments passed as separate strings (never interpolate untrusted paths into a shell):

    python runner.py inspect --input SOURCE.glb [--previews]
    python runner.py process --input SOURCE.glb --output-dir NEW_FOLDER [--plan PLAN.json] [--blend]
    python runner.py verify --input SOURCE.glb --output-dir EXISTING_FOLDER

All actions accept --blender ABSOLUTE_EXE and --timeout SECONDS (default 600). Blender must be supplied with --blender or TRIPO_BLENDER_EXECUTABLE; no binary is bundled. Default output is exactly processed.glb + validation.json; --blend adds processed.blend. Existing delivery files are never overwritten. Logs, raw component BLEND, manifests, optional previews and compressed expected verification geometry live in the skill's scripts/.cache, never in delivery folders. Runner stdout is one bounded JSON result. Exit 0 = ok, 2 = needs_attention, other nonzero = execution/error. Logs contain detail; no visible GUI is opened.

Processing retains each prop's world geometry; joins may change local transforms/origins but never intentionally move, rotate or resize world vertices. Clean per fragment with remove_doubles at 1e-6, join according to plan, clean again, remove area <1e-12 faces and isolated vertices, orient face islands consistently, preserve dominant original side on open islands, split sharp edges at 35 degrees and bake area/angle weighted normals. No decimation, distance-based semantic clustering, pivot-centering or automatic preview/export batches.

Coverage checks compare source and final triangles per semantic prop, independent of global bounds. Maximum world vertex tolerance is 2e-6. All source triangles must survive exactly once except welded duplicates, triangles collapsed within weld tolerance and zero-area faces; counts are recorded. Per-triangle material and UV/color values must survive cleanup. Export/reimport verifies exact prop names/count, triangles, all UV channels/colors, nonzero finite normals and matching triangle-corner world normals with dot > .999. The original and exported GLB material definitions plus embedded texture hashes/references are compared conservatively. Unhandled material conversions fail validation before publishing. A source with no UV reports absent, never UV-verified.

Static triangle meshes only. Skins, animation, morph targets, GPU instances, external image URIs and unverified extensions return needs_attention before import. Current approved extensions: KHR_materials_unlit, KHR_texture_transform, KHR_materials_emissive_strength, KHR_mesh_quantization. Other extensions require explicit implementation/testing first. Inputs stay untouched. No packages are installed. Images are embedded in GLB; no texture sidecars are written.

verify uses the local compressed expected geometry keyed by output SHA256 and reimports GLB independently. Keep .cache/verified to rerun it; the GLB remains portable without that cache, but this CLI's full verification cannot run from only the two delivery files. If cache is lost, process the original again into a new directory. Source split cache checks Blender version and raw-cache SHA256. Changing Blender version requires inspecting/reviewing plan hashes for that version.

Toolbox host integration: use subprocess argument array [python, absoluteRunner, "process", "--input", inputs[0], "--output-dir", outputDir, "--blender", absoluteBlender] with hidden console, capture stdout, honor actual exit code and wait for completion. For a new source, start with inspect and pause for explicit visually reviewed grouping. Do not register needs_attention as completed. Toolbox registration remains in the caller; discover art_toolbox schema for report/import fields.
