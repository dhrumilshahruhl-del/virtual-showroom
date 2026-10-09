# City Asset Audit And Integration Notes

## Asset Folder

`assets/models/Downtown City MegaKit[Standard]`

This is a modular city kit, not a single optimized city scene. It includes previews, source textures, engine-specific FBX exports, and individual glTF modules.

## Inventory Summary

- glTF export files: 153 `.gltf` plus 153 `.bin`
- glTF texture copies: 29 `.png`
- Source texture folder: concrete, brick, metal, roof, street, trim, dirt, interior HDR maps, blinds/curtains
- FBX exports: Unity and Unreal variants
- Preview/license files

## Geometry Findings

The full glTF export set totals approximately:

- 153 files
- 317 primitives
- 165,389 vertices
- 111,098 triangles

The only complete building assets found were:

| Asset | Vertices | Triangles | Materials | Textures |
|---|---:|---:|---:|---:|
| `Building_Large_2.gltf` | 64,052 | 45,122 | 12 | 18 |
| `Building_Medium_2_001.gltf` | 40,886 | 25,612 | 12 | 15 |
| `Building_Small_1.gltf` | 27,809 | 18,344 | 13 | 19 |

Most other assets are modular construction pieces: walls, trims, roofs, doors, streets, decals, sidewalks, props, stairs, and AC units.

## Ignored Assets

Ignored for the showroom runtime:

- FBX exports for Unity/Unreal
- Street decals, signs, arrows, lane markings, crosswalks
- Sidewalks and street pieces
- Doors, trims, cornices, modular wall pieces
- Props: AC units, bollards, drains, manholes, planters
- Interior HDR maps and detail textures
- Preview images and license file

Reason: these assets are close-range city-building details. They add draw calls, texture memory, and visual noise without helping the 200 Water Street building remain the hero.

## Imported Assets

Runtime imports are limited to:

- `Building_Large_2.gltf`
- `Building_Medium_2_001.gltf`
- `Building_Small_1.gltf`

These are used only as muted background skyline context.

## Optimizations Implemented

- Load only 3 building assets out of 153 glTF models.
- Clone the 3 loaded building geometries into 6 distant background buildings.
- Replace all original texture-heavy materials with 3 shared PBR materials:
  - muted facade
  - muted glass
  - muted roof
- Dispose original loaded texture/material references after replacement.
- Disable shadows on city buildings.
- Enable frustum culling on city meshes.
- Keep the city excluded from camera-fit calculations so it never controls framing.
- Place buildings far enough from the hero to preserve breathing room around 200 Water Street.

## Placement Strategy

The city context is created in `src/environment/city-context.js`.

It uses the 200 Water building bounds to create a sparse skyline ring around the hero. The layout varies:

- model type
- scale
- rotation
- spacing
- position around the hero building

The city is intentionally understated and lower-contrast so it supports the HDRI and does not compete with the building.

## HDRI Integration

The existing Canary Wharf HDRI remains the lighting/background source:

- `scene.environment`
- `scene.background`
- PMREM reflections

The city buildings use low `envMapIntensity` values so the HDRI affects them without making them visually dominant.

## Remaining Performance Concerns

- GLTFLoader still loads referenced textures before materials are replaced. They are disposed after replacement, but there is still a short startup cost.
- The three imported complete buildings total about 89k triangles before cloning. Cloning reuses geometry but still adds draw calls.
- A future optimized city proxy GLB would be better: merged geometry, no unused textures, and pre-baked shared materials.

## Future Recommendations

- Export a custom low-poly city shell as one GLB with 8-12 simplified background buildings.
- Remove all texture dependencies from the proxy city asset.
- Merge static city geometry by material.
- Add distance-based LOD only if the city becomes more complex.
- Keep the current modular city kit as a source library, not a runtime dependency.
