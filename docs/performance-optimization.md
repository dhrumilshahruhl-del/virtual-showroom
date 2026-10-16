# Conservative performance pass

## Subsequent controlled city memory / focus pass

The follow-up city-only pass is documented in `docs/city-context-optimization.md`, with fresh baseline/result JSON inventories. It preserves the progressive startup, DPR cap, hidden-tab pause, HDRI/PMREM, hero assets, flow/smoke and impact UI. It adds 19 static lossless PNG derivatives, configuration-aware texture sharing, explicit reference-counted ownership, and a permanent restrained city material baseline. Originals remain untouched.

Measured city texture objects: **61 -> 28** (52 imported objects -> 19 canonical imported textures, plus 9 procedural textures). **Estimated decoded texture footprint: 842.67 -> 58.67 MiB**, ~93.04% reduction; this is not a direct total-GPU or Chrome tab-memory measurement. Warmed renderer texture count: **70 -> 37**. Draw calls/triangles and geometry counts are unchanged in matching views. Three complete post-flow samples stayed at 87 geometries, 37 textures, 29 programs, 65 calls and 656,894 triangles. Controlled before/after Chrome tab memory remains unavailable.

The next recommended asset target is now a separately prepared 2K HDRI derivative. See the city report for the complete dimension table, ownership tests, visual comparison, measurement caveats and rollback instructions.

## Baseline established from current source and asset inspection

- Startup previously awaited HDRI, then rooftop GLB, then three city GLTFs before creating controls, hotspots, or System Flow.
- Active outdoor HDRI: `assets/canary_wharf_4k.hdr`, 26,173,896 bytes (24.96 MiB). The previous ~42 MB figure included three unrelated interior HDR files. There is no matching 2K outdoor HDRI in the repository.
- HDRI supplies both the background and PMREM-based PBR environment, with intensity and blur settings. Keeping it essential avoids introducing a different temporary lighting state.
- DPR cap was 2; antialiasing enabled; ACES tone mapping; PCF soft shadows and a 2048-square directional shadow map. Shadow maps already stopped updating continuously after startup.
- Imported city meshes cast and received shadows; some procedural foliage/infill also cast shadows.
- The render loop ran continuously with no explicit visibility handling. Idle rendering remains continuous in this pass.
- Three.js 0.170.0 uses the existing jsDelivr import map; no production bundler exists.
- Essential failure displayed the existing loading error. City failure formerly propagated through the same essential error path.

## Changes

- Load essential rooftop GLB and HDRI concurrently. Both must complete before the rooftop experience is displayed.
- Create controls, hotspots, and complete System Flow immediately after essential setup; clear the existing loading status, then start optional city loading.
- Late city registration uses the existing cached focus materials and current focus amount. City arrival never moves the camera, resets controls, changes the current step, or restarts flow.
- City failure logs a useful warning and leaves the rooftop usable. Procedural city resources are allocated only after model downloads succeed.
- All city meshes stop casting shadows; existing receive-shadow behavior and hero shadows remain unchanged. City appearance has no extra fade or per-frame material traversal.
- WebGL DPR cap is 1.5. HTML/CSS resolution is unaffected.
- Hidden documents stop the renderer animation loop. Visibility restoration restarts the Three.js clock before restarting the loop, excluding accumulated hidden time.
- Disposal removes the visibility listener and UI action listeners, ignores late essential completion, and disposes a city that completes after teardown. Environment loading discards a late HDR texture before creating PMREM on a disposed renderer.
- City cleanup disposes owned procedural resources while leaving borrowed GLTF geometries/materials/textures under the persistent loader cache's ownership. A late city completion cannot invalidate those same cached assets in another live instance.

## Verification and limits

Run `node docs/performance-qa.mjs` with a local server on 4173 and dedicated headless Chrome CDP on 9224. The test holds all three city requests while confirming usable controls and guided flow, releases the city during flow, checks shadow flags and DPR, exercises repeated forward/reverse navigation and resource samples, simulates document visibility events, and blocks city requests to verify optional failure.

The matching model preload is retained. Browser network instrumentation observed one rooftop GLB request, so there is no evidence of a duplicate download.

No source assets, CSS/impact UI, particle counts, engineering steps, material appearance settings, shadow-map type/resolution, or deployment dependencies changed. Total downloaded asset bytes are unchanged once the city finishes. Progressive loading removes city transfer/decode/setup from the interaction gate; it does not compress assets or promise lower fully loaded memory.

At DPR 2 devices the cap changes drawing-buffer area by `(1.5 / 2)^2`, or 43.75% fewer pixels. This is a geometric calculation, not a measured FPS or GPU-time improvement. DPR 1 devices are unchanged.

Renderer resource counts and JavaScript heap samples do not measure total browser/GPU process memory. Hardware visual inspection and real tab-switch testing remain useful complements to headless checks. City insertion can still incur a one-time decode/upload/shader cost and appears directly without a fade.

### Observed browser results

The performance QA passed with all three city GLTF requests deliberately held: controls and System Flow were usable first, then the city was released into an active flow. Blocking those requests also left the rooftop and flow usable without a blocking status. The DPR-2 browser reported WebGL DPR 1.5 and zero city shadow casters.

Three complete forward/reverse flow cycles, each with pause/resume, restart, exit, and reentry, recorded these post-exit samples after forced garbage collection:

| Cycle | JS heap bytes | Geometries | Textures | Programs | Draw calls | Triangles |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 177,243,642 | 88 | 70 | 29 | 65 | 656,894 |
| 2 | 177,313,738 | 88 | 70 | 29 | 65 | 656,894 |
| 3 | 177,331,874 | 88 | 70 | 29 | 65 | 656,894 |

Counts remained stable; heap changed by about 88 KB across these samples. These are current-state observations, not before/after savings or a complete process-memory measurement. No baseline draw-call or timing measurement was captured before editing, so no improvement percentage is claimed. The hidden-state test observed no renderer frame advance for two seconds and verified frames resumed on visibility restoration. Runtime exception collection was empty.

The additional lifecycle run paused during a camera transition: camera position stayed fixed while hidden and the move was still in progress 250 ms after resuming, excluding a hidden-time jump. Disposing with all city requests held, then releasing them, did not attach a city or restart rendering. The existing System Flow QA also passed desktop/mobile framing, reduced motion, correct networks, manual navigation, wall reveal, exact material restoration, and resource reuse.

The impact QA passed at 1440, 1280, 1024, 768, and 390 pixels, including verified values, finite animation, reduced motion, resource/DOM stability, and the simplified final energy comparison. Screenshot review found readable equipment, recovery circuits, smoke, and controls. No baseline pixel-diff comparison was performed; expected visual differences are reduced city shadowing and a less costly drawing buffer on high-DPI screens.

The smoke QA passed six-step isolation, pool sizes, depth/occlusion settings, pause/resume, restart, previous/next, rapid changes, inactive sleep, exit/reentry, desktop/mobile captures, and runtime error checks. Its animation-frame callback timings are not interpreted as GPU-time or FPS improvements from this optimization pass.

## Files changed

- `src/showroom.js`: startup, progressive city insertion, DPR, visibility, listener cleanup.
- `src/environment/city-context.js`: shadow flags, allocation ordering, borrowed-resource ownership.
- `src/environment/EnvironmentManager.js`: late-load disposal guard.
- `src/flow/flow-focus.js`, `src/flow/flow-visuals.js`, `src/flow/system-flow.js`: register late city context without rebuilding flow.
- `docs/impact-qa.mjs`: take its stable scene-object snapshot after progressive city completion.
- `docs/performance-qa.mjs`: loading, failure, lifecycle, visibility, repeated-flow measurements.
- `docs/performance-optimization.md`: baseline, results, limitations, next steps.

Next pass: preserve originals while preparing an optimized 2K outdoor HDRI, reduced city textures/KTX2, and a dedicated city export; separately evaluate production bundling/cache/compression and profile GPU memory on target devices.
