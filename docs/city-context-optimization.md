# City context optimization and visual hierarchy

## Result and measurement scope

The city now uses 19 prepared PNG derivatives and a shared, reference-counted asset bundle. The runtime city texture inventory fell from **61 to 28 objects**. The **estimated decoded texture footprint** fell from **842.67 to 58.67 MiB**, a reduction of **784.00 MiB / 93.04%**. This sums potential RGBA8 allocations for distinct runtime textures with their complete mip chains; it is not measured GPU residency or Chrome tab memory.

The user's earlier ~1005 MB Chrome observation has no controlled matching after measurement. **Fully loaded Chrome tab memory before/after is unavailable.** CDP JavaScript heap and backing storage are reported separately below; they cannot be equated with the hover memory figure.

Fresh measurements are preserved in `docs/city-context-baseline.json` and `docs/city-context-results.json`. Both used the same Chrome CDP session, cache disabled, 1440x1000 viewport, DPR 1, and the same camera poses. City GLTF requests were held until the essential rooftop snapshot, then released. Every JSON snapshot includes the complete texture inventory, sampling configuration, source names, reference counts, and heap data. The original diagnostic's rounded 842.7 MiB total was reproducible. Its statement that one 2K RGBA8 mipmapped texture uses 22.37 MiB mixed decimal MB with MiB: the correct value is **21.33 MiB**. Its environment helper also used the wrong numeric enum for half-float byte sizing; the unchanged HDR source/PMREM estimates here use 8 bytes per RGBA half-float pixel.

## Assets and processing

Original models, PNGs, binary buffers, and HDRI remain untouched. Derivatives are isolated in `assets/city-context/`, with a manifest containing source SHA-256 hashes, roles, modes, dimensions, and disk sizes. Three small derived GLTF manifests only change image and buffer URIs; geometry, UVs, material definitions, primitive assignments and samplers remain identical. Their buffer URIs still reference the original city binaries.

Rebuild with `python docs/build-city-context.py` using the existing Pillow installation. There are no new runtime or package dependencies. PNG remains lossless; KTX2 was not introduced.

- Base colors: 2K to 1K; existing 1K marble stays 1K. Perceptual saturation is multiplied by 0.65 and contrast by 0.88 in the static derivatives.
- Normal maps: 2K to 512. Components are resampled as numeric float data, then vectors are renormalized. Alpha is retained and resized independently. No sRGB/color treatment is applied to normals.
- ORM: 2K or 1K to 512 with channel packing preserved and no color-space/art treatment. Alpha is retained where present.
- Interior imagery: existing 512 resolution retained; alpha preserved. These small window/interior images carry recognizable facade detail.
- Trim: base color retained at 1K to keep narrow facade trim legible; normal and ORM use 512.

The 19 source PNGs total 42,305,471 bytes; optimized PNGs total **6,646,213 bytes** (40.35 to 6.34 MiB). This disk/transfer comparison is distinct from the decoded footprint.

## Ranked texture comparison

All rows use runtime **RGBA8**, with mipmaps enabled, even where the PNG file itself stores RGB. MiB values below aggregate the actual observed texture objects for that source. The procedural city textures contribute another ~9.33 MiB before and after and are included in the 61/28 totals.

| Asset / role | Original -> optimized dimensions | Objects before -> after | Estimated before MiB | Estimated after MiB | Reduction MiB |
| --- | --- | ---: | ---: | ---: | ---: |
| Concrete asphalt base color | 2048² -> 1024² | 3 -> 1 | 64.00 | 5.33 | 58.67 |
| Red brick base color | 2048² -> 1024² | 3 -> 1 | 64.00 | 5.33 | 58.67 |
| Trim base color | 2048² -> 1024² | 3 -> 1 | 64.00 | 5.33 | 58.67 |
| Metal/concrete base color | 2048² -> 1024² | 2 -> 1 | 42.67 | 5.33 | 37.33 |
| Concrete base color | 2048² -> 1024² | 1 -> 1 | 21.33 | 5.33 | 16.00 |
| Marble floor base color | 1024² -> 1024² | 3 -> 1 | 16.00 | 5.33 | 10.67 |
| Concrete normal | 2048² -> 512² | 3 -> 1 | 64.00 | 1.33 | 62.67 |
| Concrete ORM | 2048² -> 512² | 3 -> 1 | 64.00 | 1.33 | 62.67 |
| Marble floor normal | 2048² -> 512² | 3 -> 1 | 64.00 | 1.33 | 62.67 |
| Red brick normal | 2048² -> 512² | 3 -> 1 | 64.00 | 1.33 | 62.67 |
| Red brick ORM | 2048² -> 512² | 3 -> 1 | 64.00 | 1.33 | 62.67 |
| Trim normal | 2048² -> 512² | 3 -> 1 | 64.00 | 1.33 | 62.67 |
| Trim ORM | 2048² -> 512² | 3 -> 1 | 64.00 | 1.33 | 62.67 |
| Metal/concrete normal | 2048² -> 512² | 2 -> 1 | 42.67 | 1.33 | 41.33 |
| Metal/concrete ORM | 2048² -> 512² | 2 -> 1 | 42.67 | 1.33 | 41.33 |
| Marble floor ORM | 1024² -> 512² | 3 -> 1 | 16.00 | 1.33 | 14.67 |
| Dark interior | 512² -> 512² | 3 -> 1 | 4.00 | 1.33 | 2.67 |
| Lit interior 1 | 512² -> 512² | 3 -> 1 | 4.00 | 1.33 | 2.67 |
| Lit interior 2 | 512² -> 512² | 3 -> 1 | 4.00 | 1.33 | 2.67 |

## Deduplication and ownership

`src/loaders/city-assets.js` owns the city independently of the hero GLTF cache. It loads the 19 image URLs once per active asset bundle. A small GLTFLoader plugin retains the standard PNG sampler setup; GLTFLoader still applies material color spaces, channels, and texture transforms. After parsing, canonical textures are selected using URL plus color space, flipY, wrapping, repeat/offset/rotation/center, filters, anisotropy, UV channel, texture matrix/auto-update, mipmap settings, mapping, format/type, alpha unpacking and internal format. Incompatible configurations would retain separate objects.

Measured imported objects: **52 -> 19**, removing 33 repeated scene texture objects. All 19 source images have one canonical runtime texture. Eighteen sources are reused between model parses; one is unique to a single model. No imported texture configurations required an incompatible variant in these assets. Nine distinct procedural city textures remain separate because they contain different imagery/material data. The lifecycle test additionally observed 59 unrendered loader/assignment intermediates discarded before exposure; this is not the scene-object reduction count.

Each city context receives its own material clones, while geometries and canonical imported textures are borrowed from a bundle. The existing focus system clones/restores these new baseline materials. Context disposal releases owned procedural geometry/materials/textures and its imported material clones, then releases the bundle lease. Canonical textures, template materials and shared geometry are disposed once when the final consumer releases. The registry is cleared at zero consumers. There is no persistent cache of old optimized city images or GLTF parsers.

Loading uses `Promise.allSettled` and waits for outstanding image requests before releasing a failed bundle. This cleans successful siblings and partially loaded textures when another file fails. Existing showroom guards still dispose a late city completion after teardown. Context disposal and lease release are idempotent.

## Visual hierarchy

The original building placement and silhouettes remain. All six imported buildings occupy nearby surrounding blocks and can be approached with the existing camera. They use a single optimized tier to avoid discontinuities or redundant near/far texture sets. Distant procedural infill already uses small 512 facade maps and remains independently batched.

Permanent city treatment is applied once during asset preparation:

- Moderate static saturation/contrast reduction preserves brick, concrete, trim and interior identities.
- Imported normal scale is 45% of the source response; environment intensity is 0.48 instead of 0.7.
- Opaque building materials retain distinct metalness but have a roughness floor of 0.68. Existing glass-specific response stays distinct, with roughness 0.25 instead of 0.18; no new transparency is introduced.
- Procedural infill windows are less dark against their facade/trim; their roughness maps retain a separate glass response with lower contrast.
- Trees keep green identity with restrained base/vertex saturation; road/parking markings are less bright, and ground/road noise is reduced.

No blur, extra fog, postprocessing, city animation, or per-frame traversal/allocation was added. The existing System Flow focus dims the new normal city baseline further using its existing 0.30 city brightness target. Exit restores the exact optimized materials, colors, roughness, opacity, depthWrite and normal scales, without accumulating changes.

The 200 Water building, rooftop, HVAC, ducts, pipes, enclosure and shadow quality were not changed in this pass. HDRI, PMREM, antialiasing, tone mapping, DPR cap 1.5, camera choreography, progressive loading, smoke budget, flow definitions, impact values and accessibility remain unchanged.

## Runtime before/after

| State | Geometries | Renderer textures | Programs | Calls | Triangles | City texture objects | Estimated city MiB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Before pass, before city | 33 | 8 | 14 | 13 | 568,790 | 0 | 0 |
| After pass, before city | 33 | 8 | 14 | 13 | 568,790 | 0 | 0 |
| Before pass, fully loaded overview | 58 | 41 | 24 | 65 | 656,894 | 61 | 842.67 |
| After pass, fully loaded overview | 58 | 35 | 24 | 65 | 656,894 | 28 | 58.67 |
| Before pass, warmed post-flow | 87 | 70 | 29 | 65 | 656,894 | 61 | 842.67 |
| After pass, warmed post-flow | 87 | 37 | 29 | 65 | 656,894 | 28 | 58.67 |

The cold overview has not uploaded all source textures, so its renderer texture-count change is smaller than after all six flow views have warmed the scene. Runtime Texture object counts, uploaded WebGL texture counts and actual GPU residency are different metrics. No FPS or total process-memory reduction is inferred from these counts.

CDP `Runtime.getHeapUsage`, after forced GC: fully loaded JS used heap was 40,173,620 bytes before and 39,872,916 after. Backing storage was 136,146,911 before and 128,809,374 after. External decoded browser image memory/GPU allocations are not included in these heap counters. The earlier ~177 MB figure came from a different API/setup and should not be treated as the same measurement.

### Three complete post-flow samples

| Cycle | Geometries | Renderer textures | Programs | Calls | Triangles | Used JS heap bytes | Backing storage bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 87 | 37 | 29 | 65 | 656,894 | 41,111,240 | 128,809,702 |
| 2 | 87 | 37 | 29 | 65 | 656,894 | 41,242,716 | 128,809,702 |
| 3 | 87 | 37 | 29 | 65 | 656,894 | 41,215,272 | 128,809,702 |

Each cycle traversed all six steps and exited; material references and values restored exactly each time. Renderer counts/backing storage stabilized. This provides no evidence of a growing flow-resource leak in these runs.

## Validation and compromises

`docs/city-optimization-qa.mjs --baseline` captures the original baseline; the default command captures the optimized result and three complete cycles. Do not overwrite the baseline artifact after optimization. Reproducible comparison screenshots are saved to the OS temp directory as `city-before-*` and `city-after-*`: overview, skyline/streets, close rooftop edge, active flow, and mobile at 390x844. Desktop is 1440x1000. Review found recognizable colored facades, windows, brick, concrete, trees and roads, without black/missing materials, new seams, or apparent normal/ORM corruption. Fine facade relief is intentionally weaker; the geometry remains sharp. No pixel-perfect identity is claimed for the context art treatment.

The static asset invariant checks passed all 19 source hashes, resulting PNG dimensions, packed ORM/alpha preservation, unit-length normal data, unchanged model/material/sampler definitions and valid original buffer references.

All 52 original imported texture configurations were compared with their canonical replacements: colorSpace, type, flipY, wrapping, UV repeat/offset/rotation/channel, filters, mipmap settings and anisotropy matched. The existing System Flow suite passed complete navigation, pause/resume, restart/finish, exit/reentry, reduced motion, wall reveal, topology isolation, desktop/mobile framing, exact restoration and resource reuse. Smoke QA passed all six steps and original pool/depth budgets. Impact QA passed verified values, finite animations, mapping, pause/navigation/restoration and stable DOM/resources at 1440, 1280, 1024, 768 and 390 pixels. Native CDP clicks opened supply, extract and heat-pump equipment dialogs; wheel zoom and Reset view responded correctly. Runtime exception checks and syntax checks passed.

`docs/city-resource-qa.mjs` passed concurrent sharing, no disposal while another city uses textures, exactly one disposal per canonical texture at the last owner, idempotent teardown, an empty registry after final disposal, fresh reinitialization and cleanup after a blocked normal-map request. Existing performance lifecycle QA passed delayed city insertion, optional city failure, hidden-tab pause/resume with clock reset, no camera jump, DPR 1.5 and late-load teardown.

## Rollback and next step

All original sources remain in their existing kit folder. The city-only asset path is the single `BASE` constant in `src/loaders/city-assets.js`; switching it to the original kit directory restores original image sources/resolutions while retaining safe ownership/deduplication. Reverting the city material and palette edits restores the old context art direction. The hero loader is independent.

## Files for this pass

- Runtime: new `src/loaders/city-assets.js`; city-only edits in `src/environment/city-context.js`, `city-infill.js` and `site-landscaping.js`.
- Static assets: `assets/city-context/` contains exactly 19 PNGs, three URI-only model manifests and one provenance manifest.
- Build/QA/evidence: `docs/build-city-context.py`, `city-optimization-qa.mjs`, `city-resource-qa.mjs`, `city-context-baseline.json`, `city-context-results.json`.
- Reports: this document and the city-pass addition in `docs/performance-optimization.md`.
- `package.json` adds the changed city modules to the existing syntax-check command; it adds no dependencies.

Earlier uncommitted performance/diagnostic work was preserved. This pass does not commit or push the repository.

Remaining known contributors, ranked by estimates: unchanged HDR source plus PMREM output (~160 MiB combined, plus unmeasured internal targets), optimized city textures (~58.67 MiB), rooftop geometry (~32.7 MiB), then city geometry (~7 MiB). Browser/driver overhead and decoded CPU image storage remain unmeasured. **Recommended single next step:** prepare and compare a valid 2K HDRI derivative alongside the original; preserve HDR range and verify the background/reflections before adoption. KTX2 remains a separate future pipeline option, not part of this implementation.
