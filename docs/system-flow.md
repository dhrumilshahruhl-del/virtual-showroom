# Guided rooftop system flow

Explore System Flow is a manual six-step walkthrough. Each step remains active
until the user selects Next, Previous, or a numbered step. There is no countdown,
progress timer, automatic advance, or automatic room closure. Pause/Resume
controls the camera, moving highlights, and wall reveal. Restart returns to the
first step. Finish, Exit Flow, or Escape smoothly restores the original camera,
wall state, hotspots, and controls.

The camera frames equipment beside the panel on desktop and above it on mobile.
The heat pump step frames the actual connected lower-room pipe cluster. Its
front wall remains at 20% opacity during the recovery and heat pump steps; shadows,
reflections, and structural edges remain. The wall becomes solid before
proceeding to the next step. The separate tall cabinet is not given an invented
pipe connection.

## Routes and accuracy

Traveling highlights are rendered on the original model surfaces. Lightweight
outdoor vapor, short center ribbons and sparse particles supplement only the
Fresh Outdoor Air intake hoods and Exhaust discharge hoods. There are no
invented internal air connections or floating energy tubes. The source
palette and building-local bounds distinguish these networks:

- Supply air: both lime intake hoods, supply housings, gray front connections,
  magenta branches and common header, and its downward outlet.
- Extract air: two independent yellow branch/trunk networks, gray connecting
  sleeves and extract housings, and brown discharge hoods. Travel is toward the
  negative-u discharge ends, consistent with the user's extract interpretation.
- Recovery energy: four upper cyan/light-blue/light-green/orange pipe headers
  and their port stubs, plus the lower perimeter and room pipe circuits.
- Heat pump assistance: actual lower red/dark-blue, cyan/light-blue, and central
  green/orange pipe sections with the connected small equipment bodies.

Model coordinates are converted to plant axes:
u = (x-z)/sqrt(2), v = (x+z)/sqrt(2), height = y.
Classifications and physical terminal seeds are in system-flow-data.js and
pipe-topology.js. At initialization, coincident exported vertices are welded
within each network and triangle-edge adjacency is built. Multi-source shortest
surface distances drive shader waves through real bends and branches. Missing
connections remain disconnected. No animation geometry bridges the gap between
the upper stubs near y10.5 and lower stubs near y5.45.

Physical placement is based on the source geometry. The anonymous merged GLB
does not contain a hydraulic schematic, hot/cold labels, or supply/return
directions. Cyan waves represent energy transfer, not verified water-flow
directions. Cabinet/component identities beyond the user's labels remain
unverified. Internal equipment air passages and building ductwork not modeled
in the GLB are not fabricated.

One reusable vec4 surface attribute and cached materials drive all six steps.
`flow-focus.js` centralizes masks, related zones, obstruction selection, and
references to the authoritative measured camera definitions. Step changes blend
six mask weights and related-zone weights over approximately 0.8 seconds,
without rebuilding geometry. Active surfaces retain their palette and texture;
an emissive accent follows the original distance wave with its original sign.
Energy pulses still make no claim about hydraulic direction.

| Step | Active surfaces / existing path | Related zones | Obstruction | Existing camera fallback (u, v, height) / span |
| --- | --- | --- | --- | --- |
| Fresh Outdoor Air | mask 1: supply intake hoods and intake-side housings | supply housing zone 1, recovery zone 3 | none | (29, -21.7, 12.4) / 16 |
| Used Indoor Air | mask 2: extract-left/right yellow branches, sleeves and housings | extract zone 2 | none | (24, -21.3, 4.6) / 40 |
| Energy Recovery | mask 4: upper and lower measured recovery circuits | supply zone 1, room zone 4 | heatPumpEnclosureWall over lower circuits | (29, -19.8, 10.6) / 15 |
| Heat Pump | mask 8: lower assistance circuits and room-equipment | recovery zone 3 | heatPumpEnclosureWall | (31.3, -19.4, 4.45) / 8.5 |
| Supply Air | mask 16: housings, front connections, magenta branches/header/outlet | supply zone 1, recovery zone 3 | none | (29, -18.9, 12) / 17 |
| Exhaust | mask 32: extract housings and brown discharge hoods | extract zone 2 | none | (18, -22.2, 4.8) / 51 |

Related prominence is 0.74, inactive classified equipment 0.38, architecture
0.52, and city context 0.30. These are linear material brightness factors,
not guaranteed screen luminance percentages. Textures, roughness and palette
identity remain intact. No blur or postprocessing is used. Outdoor terminal
effects are described in `docs/airflow-smoke.md`.
Camera fitting centers the bounds of the actual indexed active surfaces and
checks their corners against the usable viewport beside/above the existing UI.
The existing per-step spans, target fallbacks and viewing directions remain the
starting point; fitting pulls back only as needed to include the active bounds.

Shared source materials remain untouched. Focus materials are cached once,
including arrays and instanced city context, and original references are restored
on exit. No scene traversal or material creation occurs in animation updates.
Pause stops path time, camera and reveal; focus settles at the selected step.
Exit blends focus out during camera return and restores exact source references
at completion. Disposal also restores materials and releases temporary resources.

## Verification

Run npm run check for syntax checks. With the local server and a dedicated
headless Chrome instance on debugging port 9224, run:
node docs/system-flow-qa.mjs

The harness checks finite topology distances, absence of floating overlays,
steps holding past the old duration, Previous/Next, manual step selection,
Pause/Resume, persistent room reveal, wall restoration, Restart, Exit/Finish,
mobile panel framing, reduced motion, stable GPU resources, and browser errors.
Screenshots are written to the operating system temporary directory.
