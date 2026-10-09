# Environment realism pass

## Causes addressed

The previous city material replacement erased brick, concrete, trim, roof and normal textures. It also collapsed multiple primitive material slots into one material. Strong hemisphere/key/fill/rim lights and nearby white fog then flattened the remaining surfaces.

## Current presentation

- Preserve the three city models' original PBR textures and material slots. Tune glass reflection and opacity without treating interior textures as glass.
- Use Canary Wharf for image-based lighting, reflections and background. Environment intensity is 0.65; background intensity 0.72 and blur 0.035. ACES exposure is 0.85.
- Use one warm directional light at intensity 1.35 for cast shadows. Remove the studio hemisphere, fill and rim lights. The sun direction remains an artistic approximation, not a measured geographic match to the HDRI.
- Cast and receive shadows on city buildings and the hero. Use a 2048 shadow map, then cache it after static geometry finishes loading. Camera orbit does not regenerate shadows. Future changes to geometry or lights must set renderer.shadowMap.needsUpdate = true.
- Keep nearby geometry clear; atmospheric fog starts at 60 scene units and ends at 140.
- Add deterministic, reusable asphalt and pavement textures generated once per scene, four surrounding roads, dashed markings, and raised sidewalks.
- Seat city buildings using their transformed minimum Y bounds. Shared source geometry and textures are retained across the six instances.
- Space neighbors along blocks, with varied heights and setbacks, to avoid placing them against the hero. This is an illustrative urban context, not a survey of the actual 200 Water Street neighborhood.
- Apply the user-calibrated camera coordinates directly. Orbit distance limits derive from this pose rather than clamping it to 12 units. The orbit pivot remains near the rooftop, with the existing rooftop-safe polar limits.

## Preserved constraints

The 200 Water building geometry, position, rotation and scale are unchanged. Its palette texture includes engineering colors, so this pass does not recolor the magenta/yellow systems. That palette remains a limit on photorealism; a dedicated facade/glass material authoring pass would be needed for a photographic building presentation.

Only the three existing complete city building assets are loaded. No additional cars, people, vegetation, lights, models or postprocessing were introduced. The original production project is untouched.

## Validation and remaining work

`environment-qa.mjs` captures desktop, mobile, opposite orbit and closer rooftop views through an isolated Chrome debugging session on port 9223. The server must run on port 4173. Screenshots are stored beside this document. It waits for asset loading and records browser exceptions plus renderer counters.

The texture detail restores realism at the cost of more resident textures than the earlier flat-material treatment. Future optimization should deduplicate matching kit textures across the three glTF files, create KTX2 texture variants, and supply simpler city LODs. The HDRI asset is unchanged. No frame-rate claim is made without testing on target hardware.

The current experience has no separate equipment-focus mode; the close validation uses rooftop orbit and zoom. Fine equipment inspection will need its own focus target when that interaction is reintroduced.

## Rooftop and Site Refinement

The default camera now uses the exact user-calibrated pose recorded in `current-view-coordinates.md`. Automatic bounds fitting and desktop/portrait zoom multipliers were removed so they cannot override these coordinates. Reset view restores the calibrated pose. The building transform remains unchanged.

`city-site.js` defines street width and curb coordinates once. Roads now use 24% of the longest footprint dimension rather than 42%; setbacks use the same shared plan. All six city buildings are positioned from their rotated world bounds, outside the curb lines, rather than scattered independently of streets. The production building remains in its existing location.

`site-landscaping.js` adds four empty parking areas with marked bays and driveway connections, plus 28 trees. No vehicle assets are loaded. Candidate tree positions are rejected if canopy clearance overlaps buildings, roads or parking. Parking is constrained by road and building footprints. Trees are small background geometry with varied heights and canopy lobes, not detailed botanical models.

The trees use three instanced draw groups (trunks, crowns, beds); parking and driveways use two more. Geometry and parking texture are shared. Static shadows include the new site geometry. A tighter camera can cull nearby city meshes, but zoom alone does not reduce hero mesh complexity or guarantee fewer total draw calls after adding landscaping.

The browser check now asserts zero building/parking road overlaps and the presence of four parking areas and trees. Exact default camera/target values are recorded in `environment-validation.json` alongside renderer counters. The city remains illustrative rather than a geographically accurate street survey.

## Dense Background and Zoom Limit

Zoom-out is now capped at the calibrated default distance of approximately 6.4266957273 scene units. The user-supplied position, target and FOV remain unchanged. Zoom-in and orbit remain available.

`city-infill.js` fills the eight surrounding street blocks with 147 lightweight buildings, leaving the hero block, roads, tree clearance areas and parking available. A blocked plot can fit a smaller frontage building where space allows. Footprints are checked against all existing buildings, roads, parking, and tree canopies before placement.

The infill uses shared box geometry, instanced parapets and three reusable facade/roughness texture pairs generated locally. These are simplified architectural shells rather than additional detailed asset imports. Heights stay between 22% and 44% of the hero height. Batches are separated by street block for frustum culling. The existing six detailed kit buildings are retained.

Final desktop validation recorded 57 draw calls, 656900 triangles and 40 resident textures. Counters describe that camera view, not a frame-rate guarantee. The browser check exercises wheel zoom-out, checks the distance cap, tests building-to-building and road overlap, and saves desktop/mobile/orbit screenshots. It completed with zero browser exceptions.
