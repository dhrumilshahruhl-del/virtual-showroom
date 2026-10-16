# Memory Diagnostic

This is a diagnostic report only. No production optimization was made for this report. The existing uncommitted performance-pass changes were preserved.

## Current observation

The user observed approximately **1005 MB** in Chrome's tab-memory display. That value is not equivalent to JavaScript heap, `renderer.info`, decoded image memory, or exact GPU allocation. It may include browser process overhead, decoded CPU images, WebGL driver allocations, GPU textures, shader/program memory, command buffers, and other resources that Three.js cannot expose.

The controlled diagnostic used the current project on a 1440×1000 headless Chrome page with cache disabled. The runtime diagnostic completed after the rooftop became ready and again after the progressively loaded city appeared. The active outdoor HDRI file is 26,173,896 bytes (24.95 MiB); the other HDR files in the repository are not referenced by the showroom.

## Runtime snapshot

| State | JS heap | Geometries | Textures reported by `renderer.info` | Programs | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Rooftop ready, before city | unavailable in this headless run | 33 | 8 | 14 | 13 | 568,790 |
| City fully loaded | unavailable in this headless run | 58 | 41 | 24 | 65 | 656,894 |

The runtime object inventory found 3 explicitly referenced texture objects before city insertion: the HDR background, PMREM environment, and the smoke texture. After city insertion it found 64 explicitly referenced texture objects: 1 HDR background, 1 PMREM texture, 61 city textures, and 1 smoke texture. The difference between this object inventory and `renderer.info.memory.textures` is expected: `renderer.info` counts uploaded WebGL textures, while the object inventory counts Three.js texture objects and does not represent exact driver allocation.

The drawing buffer was 1440×1000 at device pixel ratio 1 and renderer pixel ratio 1 in the controlled run. A later diagnostic run reported 1418×902 because the showroom root’s measured layout area was smaller than the requested browser viewport; this is a layout dimension, not a resource leak.

## Estimated memory by category

These are **estimated decoded GPU texture and buffer footprints**, not measured GPU memory. Ordinary RGBA8 textures use width × height × 4 with approximately 33% mip overhead when mipmaps are enabled. Half-float RGBA environment resources use approximately width × height × 8. Driver packing, compression, tiling, alignment, and residency are not included.

| Category | Estimated memory | Confidence |
| --- | ---: | --- |
| City textures | **~842.7 MiB** across 61 runtime texture objects | High for the object inventory and arithmetic; medium for actual GPU residency |
| City geometry | **~7.0 MiB** decoded attribute/index arrays | High for counted Three.js buffers; medium for driver allocation |
| Rooftop textures | No large rooftop image textures were found through the material texture slots; one 128×4 smoke texture is ~2 KiB | Medium; `renderer.info` reports additional uploaded resources not attributable through this inventory |
| Rooftop geometry | **~32.7 MiB** decoded attributes/index arrays | High for counted Three.js buffers; medium for driver allocation |
| HDR source | **~64 MiB** estimated as 4096×2048 RGBA half-float | Medium; runtime type is HalfFloatType and exact driver storage is implementation-dependent |
| PMREM/environment | **~96 MiB** estimated as the 3072×4096 RGBA half-float cube-UV texture | Medium; the runtime PMREM image dimensions and type were observed, but internal render-target allocation may differ |
| Main drawing buffer | ~5.5 MiB for RGBA8 color at 1440×1000, plus depth/stencil allocation | Medium; exact attachments are driver-managed |
| Shadow map | 2048×2048; approximately 16 MiB if treated as a 4-byte depth allocation | Low/medium; exact shadow texture format is not exposed here |
| Smoke/flow | One 128×4 smoke texture (~2 KiB), small flow attributes, instanced smoke buffers | High that it is small relative to city textures |
| Other known resources | Procedural city canvases, materials, shaders, PMREM intermediates, browser/WebGL overhead | UNKNOWN |
| Unattributed/browser/GPU overhead | The remainder up to Chrome’s tab-memory value | UNKNOWN; cannot be safely assigned from Three.js APIs |

## Top texture consumers

The city inventory contains 37 unique 2048×2048 unsigned-byte RGBA `ImageBitmap` textures with mipmaps. Each is approximately:

`2048 × 2048 × 4 × 4/3 ≈ 22.37 MiB estimated decoded footprint`

Together they account for approximately **827.7 MiB**. There are also 6 unique 1024×1024 textures (~5.59 MiB each with mipmaps), 15 unique 512×512 textures (~1.40 MiB each), 2 unique 256×256 textures (~0.33 MiB each), and 1 512×256 texture (~0.17 MiB). The resulting city total is approximately 842.7 MiB.

The three loaded city GLTF manifests reference 19 unique PNG source files. The largest source files are:

| Source file | Disk size | Runtime role |
| --- | ---: | --- |
| `T_RedBrick_Normal.png` | 6.94 MiB | City normal map |
| `T_MetalConcrete_Normal.png` | 4.59 MiB | City normal map |
| `T_Trim_BaseColor.png` | 4.22 MiB | City base color |
| `T_Concrete_Normal.png` | 4.21 MiB | City normal map |
| `T_Trim_Normal.png` | 3.91 MiB | City normal map |
| `T_Trim_ORM.png` | 2.42 MiB | City ORM map |
| `T_RedBrick_ORM.png` | 2.24 MiB | City ORM map |
| `T_MetalConcrete_ORM.png` | 1.77 MiB | City ORM map |

The source PNG set is approximately 40.35 MiB on disk, while its decoded runtime representation is much larger. This explains why disk size alone understates the memory cost.

The runtime `ImageBitmap` objects do not retain a usable source URL in the inspected Three.js object, so the diagnostic cannot assign every runtime texture object to a filename by identity. The GLTF manifests provide the source-file correlation above. The 61 city texture objects are larger than the 19 unique source files because the three separately parsed GLTF documents create separate runtime texture objects for repeated source images and because procedural city materials add small runtime textures.

## City cost

| Metric | Before city | After city | Delta |
| --- | ---: | ---: | ---: |
| `renderer.info.memory.geometries` | 33 | 58 | +25 |
| `renderer.info.memory.textures` | 8 | 41 | +33 |
| Programs | 14 | 24 | +10 |
| Draw calls | 13 | 65 | +52 |
| Triangles | 568,790 | 656,894 | +88,104 |
| Counted geometry buffers | ~32.7 MiB rooftop | ~39.7 MiB rooftop + city | +~7.0 MiB city |
| Runtime city texture objects | 0 | 61 | +61 |
| Estimated decoded city texture footprint | 0 | ~842.7 MiB | +~842.7 MiB |

The city’s geometry is modest relative to its textures. City textures are the strongest supported explanation for the large fully loaded memory observation.

The city context loads exactly these three GLTF files:

- `Building_Large_2.gltf`
- `Building_Medium_2_001.gltf`
- `Building_Small_1.gltf`

The layout instantiates six city building clones from those three parsed assets. Geometry and material objects are shared by clones within each parsed asset. The repeated source textures across separately parsed GLTF files are represented by distinct runtime texture/source objects; this is a confirmed duplication at the Three.js object level. Exact driver-level duplicate upload behavior cannot be proven from `renderer.info` alone.

## Rooftop analysis

The rooftop contributes approximately 32.7 MiB of decoded geometry buffers in the current runtime inventory and 568,790 triangles before city insertion. The compressed rooftop GLB on disk is approximately 3.3 MiB, which is not comparable to decoded GPU buffer memory. The object inventory found no large rooftop image textures through the inspected material slots; the renderer reports 8 uploaded textures before city insertion because its count includes resources not fully attributable through that inventory. The rooftop itself is therefore not the leading measured memory category.

## HDRI / PMREM cost

The lifecycle is:

`canary_wharf_4k.hdr` → `RGBELoader` → 4096×2048 HalfFloat RGBA texture → `PMREMGenerator.fromEquirectangular()` → 3072×4096 HalfFloat cube-UV environment texture → `scene.environment`.

The original HDR texture is also assigned to `scene.background`, while the PMREM output is assigned to `scene.environment`. They are different texture objects; the diagnostic confirmed `scene.background !== scene.environment`. The source HDR therefore remains resident for the visible background while PMREM remains resident for PBR reflections. The source is not a temporary resource in this architecture.

The original file is 24.95 MiB on disk. Runtime estimates are approximately 64 MiB for the half-float source and 96 MiB for the PMREM texture. `PMREMGenerator.dispose()` and the PMREM render target are disposed by `EnvironmentManager.dispose()`, but only when the showroom itself is disposed. No duplicate HDRI or duplicate PMREM was confirmed during this run.

## Render targets and shadows

There is one main drawing buffer, one directional shadow-casting light, and one observed 2048×2048 shadow map. The renderer uses `PCFSoftShadowMap`; the shadow map is not continuously updated after initial setup except when the wall reveal changes it. No post-processing render targets were found in the application code. PMREM is the additional environment render target.

At a 1440×1000 drawing buffer, the RGBA8 color attachment is approximately 5.5 MiB. Depth/stencil and driver allocations are additional and browser-managed. These allocations cannot explain an ~800 MiB category by themselves.

## Geometry and flow resources

The counted geometry estimate is approximately 32.7 MiB for rooftop buffers, 7.0 MiB for city buffers, and 2.4 KiB for flow attributes. Smoke uses shared instanced geometry and one small procedural texture. Existing QA confirms one smoke pool, stable geometry/texture counts through repeated flow navigation, and no resource growth attributable to flow transitions.

## Duplicate resources

Confirmed:

- Three separately parsed city GLTF documents create separate runtime texture/source objects for repeated source imagery. The runtime inventory found 61 city texture objects while the three manifests reference 19 unique source PNG files.
- Six city building placements reuse cloned geometry/material references within the parsed assets rather than loading six additional GLTF files.

Not confirmed:

- No duplicate rooftop GLB network request was observed; the model preload and GLTFLoader request resulted in one observed model request.
- No duplicate HDR source texture or PMREM texture was confirmed.
- No repeated smoke pool, duplicate city context, or flow-created resource growth was confirmed.

## Stability test

The current performance QA completed three forward/reverse System Flow cycles with pause/resume, restart, exit, and reentry. Post-exit samples were:

| Cycle | JS heap bytes | Geometries | Textures | Programs | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 177,243,642 | 88 | 70 | 29 | 65 | 656,894 |
| 2 | 177,313,738 | 88 | 70 | 29 | 65 | 656,894 |
| 3 | 177,331,874 | 88 | 70 | 29 | 65 | 656,894 |

These counts stabilized. JavaScript heap changed by approximately 88 KiB across those samples. This is evidence against a continuously growing System Flow resource leak, but it is not a full Chrome process-memory measurement.

## Likely causes of high fully loaded memory

### High confidence

- City textures dominate the estimated decoded texture footprint: approximately 842.7 MiB across 61 runtime city texture objects.
- Many city textures are 2048×2048 RGBA8 with mipmaps; 37 such runtime objects account for approximately 827.7 MiB by the stated estimate.

### Medium confidence

- Repeated city GLTF parsing creates separate texture/source objects for repeated PNG files, increasing decoded memory beyond the 19 unique source files’ disk footprint.
- HDR source plus PMREM may occupy approximately 160 MiB by half-float estimates, though the exact driver allocation is unknown.

### Low confidence

- Browser/WebGL overhead, driver residency, decoded image copies, shader allocations, and internal render targets account for the difference between these estimates and the observed Chrome tab value. Their exact contribution is not exposed by the current APIs.

## Potential optimization opportunities

These are recommendations only and were not implemented.

| Recommendation | Potential impact | Visual risk | Implementation risk | Confidence |
| --- | --- | --- | --- | --- |
| Prepare a lower-resolution city texture tier or KTX2/Basis pipeline | Very high; city texture estimate is the dominant category | Medium if applied uniformly; low if limited to distant context | Medium/high | High |
| Deduplicate shared city textures across the three parsed GLTF assets | High if source images currently decode/upload separately | Low | Medium | High |
| Export a dedicated lightweight city GLB using only the six displayed buildings and required materials | High network and decoded-resource reduction | Medium | Medium/high | High |
| Produce a new valid 2K HDRI while preserving the original 4K source | Medium; source and PMREM estimates are substantial | Medium for background/reflections | Medium | Medium |
| Investigate whether the background can use a separate lightweight representation while retaining PMREM for reflections | Medium | Medium/high | Medium/high | Medium |
| Profile shadow attachment formats and target-device GPU memory | Low/medium compared with city textures | Low | Low/medium | Medium |

The likely highest-value, lowest-visual-degradation target is deduplicating the repeated city textures or introducing a compressed/lower-resolution city texture tier. A valid optimized HDRI is the next lower-risk asset change after that, provided it is created alongside and does not replace the original.

## Measurement limits

`renderer.info` reports counts, draw calls, and triangles, but not total GPU memory. JavaScript heap is not Chrome tab memory. Chrome tab hover memory can include GPU allocations, decoded image memory, browser overhead, WebGL driver allocations, shader/program memory, and command buffers. Therefore, the estimates above are not expected to sum exactly to the observed ~1005 MB. The unexplained remainder is explicitly left as browser/GPU overhead rather than assigned without evidence.
