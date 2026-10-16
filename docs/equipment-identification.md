# System Flow equipment identification

The feature adds one reusable, noninteractive HTML popup containing an equipment image and its name. Step definitions in `src/flow/system-flow-data.js` declare equipment IDs and ordered candidate marker IDs. Equipment definitions in `src/ui/flow-equipment.js` hold names, alt text, optimized image paths, and default preferred anchors.

## Files

- Runtime: `src/ui/flow-equipment.js`, `src/ui/showroom.css`, `src/flow/system-flow.js`, `src/flow/system-flow-data.js`, `src/flow/flow-visuals.js`, and `src/flow/airflow-smoke.js`.
- Assets: `assets/equipments/ahu-popup.webp` and `assets/equipments/heat_pump-popup.webp`.
- Tooling and documentation: `docs/equipment-popup-qa.mjs`, `scripts/optimize-equipment.py`, `scripts/equipment-contact-sheet.py`, and this report.

The existing user edits to the heat-pump source PNG and flow copy were preserved.

## Engineering mapping and anchors

Presentation order follows the existing `STEP_ORDER`, not the underlying engineering indices.

| Display step | Identification | Preferred marker | Other candidates |
| --- | --- | --- | --- |
| 1 Return Air | AHU | left-equipment | right-equipment |
| 2 Energy Recovery | AHU | upper-unit-1 | upper-unit-2, left-equipment, right-equipment |
| 3 Exhaust | AHU | left-equipment | right-equipment |
| 4 Fresh Outdoor Air | AHU | upper-unit-1 | upper-unit-2 |
| 5 Heat Pump | Heat Pump | central-structure | heat-pump-2 |
| 6 Supply Air | AHU | upper-unit-1 | upper-unit-2 |

These are the existing `ROOFTOP_MARKERS` coordinates, including their normal offset. Existing hotspot interactions and sprites outside guided flow are preserved.

The mapping uses the current topology masks, focus configuration, and equipment-modal descriptions. Return/exhaust select extract housings; fresh/supply select supply housings. Recovery selects pipe circuits serving the AHUs, whose documented role includes energy recovery. The heat-pump step selects the lower assistance circuits and room equipment. No step shows both equipment types: the current selection does not establish the heat pump as recovery equipment or actively select AHUs during the assistance step. No unresolved equipment-to-step mapping was introduced.

## Placement and lifecycle

The existing topology setup caches small building-local bounds for selected surfaces. Separate plume bounds reuse the existing smoke envelopes. These CPU-only bounds protect all mapped equipment/duct/pipe surfaces and the current smoke/ribbons, along with the toolbar, System Flow panel, and impact UI.

At camera settling and layout events, the popup projects these cached bounds and first searches for a shared label position between the two equipment markers, then positions beside either marker, including diagonal candidates. It tries a compact size if needed. It never changes camera framing or scene transforms. If no safe position exists in an unusually constrained viewport, identification is hidden instead of covering the visualization.

Every equipment step shows one label with two white marker dots and two neutral HTML leader lines, one from each relevant unit. Return Air and Exhaust connect left-equipment and right-equipment. Energy Recovery, Fresh Outdoor Air, and Supply Air connect upper-unit-1 and upper-unit-2. Heat Pump connects central-structure and heat-pump-2 at the measured centers of the two adjacent cabinet fronts, using a 0.02-unit surface offset instead of the pipe seed location. Lines reach separate attachment points on the label edge without length caps or distance-based hiding. The two connector elements are reused and hide together on exit or camera transitions.

Navigation replaces the contents of the same container. Pending wall transitions retain the current step's identification until the step changes. Exit hides the popup and connector immediately. Restart and re-entry use the existing step lifecycle. Pause retains identification; resume does not duplicate DOM. During camera movement, identification waits for a safe settled placement. A 180 ms entrance fade respects reduced motion. Resize and impact expansion trigger placement through the existing layout hooks. There is no added animation loop, scene traversal per frame, texture, mesh, sprite, canvas, or render target.

## Images and accessibility

Derived from the approved local PNGs, with originals preserved:

| Asset | Dimensions | Bytes |
| --- | --- | --- |
| ahu-popup.webp | 320 × 180 | 18,292 |
| heat_pump-popup.webp | 320 × 274 | 5,024 |

`scripts/optimize-equipment.py` reproducibly generates these assets. The replacement water-source cabinet image is used for Heat Pump.

Desktop popup footprint is 112 × 104 px. Mobile is 84 × 80 px with 72 × 48 px images; the compact fallback is 68 × 68 px with a 56 × 36 px image. Labels remain AHU and Heat Pump. Images use “Air handling unit” and “Water-source heat pump” alt text. The popup has no controls or tab stops and uses a polite live region.

## Verification

Run `node docs/equipment-popup-qa.mjs` with the local server on port 4173 and a dedicated Chrome debugging session on port 9224. `--lifecycle-only` skips the screenshot matrix. Screenshots and machine-readable results are generated in the OS temporary directory. `scripts/equipment-contact-sheet.py` assembles the six views for each width for visual review.

The lifecycle check passed current-order smoke isolation, wall reveal, impact mapping, pause/resume, restart, rapid navigation, exit material/camera/hotspot restoration, re-entry, reduced motion, delayed city loading, failed city loading, and Finish cleanup. The warmed renderer resource count remained 92 geometries and 37 textures across repeated flow use, with no runtime exceptions.

All six steps passed at 1440 × 1000, 1280 × 1000, 1024 × 1000, 768 × 1000, and 390 × 844. All 30 screenshots were visually reviewed: images and labels were correct, identification remained visible, and no popup overlapped the System Flow panel, impact UI, or toolbar. Equipment, ducts, pipe circuits, and current smoke/ribbon regions were protected by placement checks. Browser console inspection found no error messages.

The AHU paired-marker revision passed all 30 viewport/step combinations: each AHU step had exactly one image/name figure, two visible marker/leader elements with the correct equipment anchor IDs, and both line endpoints reached the shared label edge. Exit cleared every connector. The subsequent Heat Pump revision passed the five requested widths with one label and two connections. Both front-panel centers were verified against actual model geometry and all five views were visually inspected. Lifecycle, late/failed city loading, and resource stability checks passed again (92 geometries / 37 textures, no runtime exceptions).

Marker connections in every tested viewport:

| Step | White marker(s) connected to the single label |
| --- | --- |
| Return Air | left-equipment + right-equipment |
| Energy Recovery | upper-unit-1 + upper-unit-2 |
| Exhaust | left-equipment + right-equipment |
| Fresh Outdoor Air | upper-unit-1 + upper-unit-2 |
| Heat Pump | central-structure + heat-pump-2 |
| Supply Air | upper-unit-1 + upper-unit-2 |

Anchor selection adapts to the viewport and safe space rather than fixing a screen coordinate. Extremely constrained viewports beyond these tested layouts may hide the popup if no safe placement exists.

The legacy `docs/system-flow-qa.mjs` still assumes the old presentation order and an immediate Previous transition out of recovery; it fails that assertion. The new integration suite uses the current order and waits for the existing wall transition.
