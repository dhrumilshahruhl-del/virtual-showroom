# Rooftop Virtual Showroom Migration Plan

## Current Direction

The showroom is now a building-only premium viewer for the existing 200 Water Street model. The separate roof-only model, generated retrofit equipment, flow paths, and projected labels were removed from the active app because they were misaligned and interfered with centering the building.

The original 200 Water Landing Project remains untouched.

## Active Runtime Assets

- `assets/models/200-water-building.opt.glb`: the only building/model asset loaded by the showroom.
- `assets/canary_wharf_4k.hdr`: used as HDRI lighting, reflections, and background atmosphere.

## Removed From Active App

- `assets/models/200-water-roof-only.opt.glb`
- `src/equipment/rooftop-retrofit.js`
- `src/labels/engineering-labels.js`
- Flow, equipment, and label toolbar buttons
- Label overlay DOM
- Runtime flow/equipment animation hooks

## Current Architecture

```text
assets/
  canary_wharf_4k.hdr
  models/
    200-water-building.opt.glb
docs/
  ROOFTOP_3D_MODEL_EXTRACTION.md
src/
  camera/
    rooftop-camera.js
  controls/
    showroom-controls.js
  environment/
    EnvironmentManager.js
    studio-environment.js
  lighting/
    studio-lights.js
  loaders/
    model-loader.js
  ui/
    showroom-ui.js
    showroom.css
  main.js
  showroom.js
```

## Default View Calibration

The app includes a **Copy view** button. After manually positioning the building, clicking it copies camera and building coordinates as JSON. Those coordinates can be pasted back into the chat and set as the new default in `DEFAULT_VIEW` inside `src/showroom.js`.

## Environment Decisions

- `EnvironmentManager.js` isolates HDRI setup.
- The Canary Wharf HDRI is used only as lighting/background data.
- No Canary Wharf geometry is imported or recreated.
- PMREM is used for image-based lighting/reflections.
- Renderer uses ACES Filmic tone mapping, SRGB output, and controlled exposure.

## Remaining TODOs

- Tune the default building position until it is visually centered.
- Consider lowering HDRI resolution for mobile if profiling shows startup cost is too high.
- Remove unused rooftop-specific helpers from `src/camera/rooftop-camera.js` later if the project stays building-only.

## City Realism Update

See `docs/environment-realism.md` for the current material, street, lighting, shadow and camera decisions. City source PBR textures are now retained rather than replaced with flat colors. Streets and sidewalks are generated locally, lane markings use instancing, and static shadows are cached. `docs/current-view-coordinates.md` reflects the revised bounds-based camera fit. Browser validation artifacts are stored in `docs/`.

The follow-up refinement adds `city-site.js` for a shared curb/road placement plan and `site-landscaping.js` for instanced trees and parking. Neighbor footprints are aligned to streets and checked for overlaps. The default rooftop view is closer; its calibration and tested coordinates are preserved in `docs/`.

The latest default uses the user's exact camera position (-4.04481, 8.44405, 3.45996), target (-0.079, 3.4, 3.82373), and FOV 30. Automatic camera fitting has been removed so it cannot overwrite this calibration. Reset view restores the same pose.

Zoom-out is capped at that default distance. `city-infill.js` adds 147 instanced background building shells to the surrounding tiled blocks, sharing geometry and locally generated facade textures. It preserves existing roads, parking and tree clearances without loading additional city assets. See `docs/environment-realism.md` and `docs/environment-validation.json` for implementation decisions and validation results.
