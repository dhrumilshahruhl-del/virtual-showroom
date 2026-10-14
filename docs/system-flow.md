# Guided rooftop system flow

Explore System Flow is a manual six-step walkthrough. Each step remains active
until the user selects Next, Previous, or a numbered step. There is no countdown,
progress timer, automatic advance, or automatic room closure. Pause/Resume
controls the camera, moving highlights, and wall reveal. Restart returns to the
first step. Finish, Exit Flow, or Escape smoothly restores the original camera,
wall state, hotspots, and controls.

The camera frames equipment beside the panel on desktop and above it on mobile.
The heat pump step frames the actual connected lower-room pipe cluster. Its
front wall remains at 28% opacity until the user leaves that step; shadows,
reflections, and structural edges remain. The wall becomes solid before
proceeding to the next step. The separate tall cabinet is not given an invented
pipe connection.

## Routes and accuracy

There are no added splines, particle clouds, cones, or floating energy tubes.
Traveling highlights are rendered on the original model surfaces. The source
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

One reusable vec4 surface attribute and cloned material per source mesh drive
all six steps. Step changes update uniforms, not geometry. Exit disables the
shader effect; disposal restores original materials and releases attributes.

## Verification

Run npm run check for syntax checks. With the local server and a dedicated
headless Chrome instance on debugging port 9224, run:
node docs/system-flow-qa.mjs

The harness checks finite topology distances, absence of floating overlays,
steps holding past the old duration, Previous/Next, manual step selection,
Pause/Resume, persistent room reveal, wall restoration, Restart, Exit/Finish,
mobile panel framing, reduced motion, stable GPU resources, and browser errors.
Screenshots are written to the operating system temporary directory.
