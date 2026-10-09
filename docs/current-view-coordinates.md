# Current View Coordinates

Snapshot created after removing the separate roof model, generated equipment, flow paths, and labels.

## Default Camera

These values live in `DEFAULT_VIEW.camera` inside `src/showroom.js`.

```json
{
  "position": {
    "x": -4.04481,
    "y": 8.44405,
    "z": 3.45996
  },
  "target": {
    "x": -0.079,
    "y": 3.4,
    "z": 3.82373
  },
  "fov": 30
}
```

## Building Transform

These values live in `DEFAULT_VIEW.building` inside `src/showroom.js`.

```json
{
  "position": {
    "x": -0.95273,
    "y": 3.39428,
    "z": 1.97859
  },
  "rotation": {
    "x": 0,
    "y": 3.83266,
    "z": 0
  },
  "scale": {
    "x": 0.06535,
    "y": 0.06535,
    "z": 0.06535
  }
}
```

## Runtime Camera

The user-supplied pose above is applied exactly after loading. Automatic bounds fitting and viewport-specific zoom multipliers have been removed. Resize changes only the projection aspect ratio. Orbit controls save this pose, so Reset view restores these coordinates and FOV.

## Orbit Controls

Zoom-out is capped at the default camera-to-target distance (approximately 6.4266957273 scene units). Zoom-in and orbit remain enabled. Wheel and touch zoom cannot move farther away than the saved default pose.

These values live in `src/controls/showroom-controls.js`.

```json
{
  "enableDamping": true,
  "dampingFactor": 0.07,
  "enablePan": false,
  "minPolarAngle": 0.34,
  "maxPolarAngle": 0.92,
  "minDistance": "Math.max(1, initialDistance * 0.22)",
  "maxDistance": "initialDistance"
}
```

## Active Assets

`docs/environment-validation.json` records the latest tested desktop camera and target. The JSON above is the authoritative default pose and building transform.

```text
assets/models/200-water-building.opt.glb
assets/canary_wharf_4k.hdr
assets/models/Downtown City MegaKit[Standard]/Exports/glTF (Godot)/Building_Large_2.gltf
assets/models/Downtown City MegaKit[Standard]/Exports/glTF (Godot)/Building_Medium_2_001.gltf
assets/models/Downtown City MegaKit[Standard]/Exports/glTF (Godot)/Building_Small_1.gltf
```

## Removed Runtime Elements

```text
assets/models/200-water-roof-only.opt.glb
src/equipment/rooftop-retrofit.js
src/labels/engineering-labels.js
Flow / Equipment / Labels toolbar controls
```
