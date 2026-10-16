# Outdoor airflow vapor

`src/flow/airflow-smoke.js` adds a pooled illustration of outdoor air at the
existing terminals. It is not smoke simulation, pollution, or a hydraulic effect.
Labels and the six existing engineering stages remain unchanged.

## Which stages receive vapor

| Stage | Treatment |
| --- | --- |
| Fresh Outdoor Air | Two blue plumes converge from open atmosphere into the green intake hood lips. |
| Used Indoor Air | Existing orange surface animation along modeled yellow branches and housings. No outdoor intake or free-space connection is invented. |
| Energy Recovery | Existing cyan surface energy pulses; no vapor. |
| Heat Pump | Existing cyan assistance pulses and enclosure reveal; no vapor. |
| Supply Air | Existing blue surface animation on housings and magenta supply branches/header/downward outlet. This modeled enclosed route receives no atmospheric plume. |
| Exhaust | Two warm orange plumes leave the verified brown discharge hoods toward negative plant-u, expanding and dissolving. |

The previous implementation contained surface waves, not free-space ribbons or
sprite particles. Those waves remain. The new atmospheric segments each receive
a restrained center ribbon and eight small, faster particles, with no extensions
between equipment or across missing model connections.

## Terminal evidence

Intake anchors were measured from indexed palette-12 GLB vertices. The left
hood spans plant-u 24.464–26.187, v -23.729–-23.117, height 12.015–12.928;
the right spans u 31.835–33.519, v -23.757–-23.161, height 12.039–12.912.
The vapor endpoints are the center of each outer sloping lip, approximately
(25.326, -23.528, 12.472) and (32.677, -23.554, 12.476).
The dominant intake direction is positive-v, following the existing intake to
the supply equipment and downstream header. The illustration has no added lift.

Discharge anchors reuse the existing `FLOW_NETWORKS` extract-left/right seeds:
(-4.45, -22.15, 4.71) and (38.5, -22.15, 4.71), in plant coordinates.
These are within the measured palette-11 discharge hood lips. Negative-u motion
matches the existing extract interpretation. Model scale is 0.06535 scene units
per building-local unit; all anchors inherit the building transform.

No water-flow direction or unmodeled internal HVAC connection is claimed.

## Rendering and lifecycle

- Four preallocated plumes, only two active at once, on steps 1 or 6.
- Each plume batches 22 soft vapor cards and 8 smaller particles into one
  instanced draw. A separate narrow strip supplies its center ribbon.
- One generated 128×128 irregular feathered alpha texture, two shared geometries,
  eight cached shader materials, four draw calls for the active pair.
- Particle phase, size, rotation, lateral motion, convergence/expansion and
  lifetime opacity are computed from deterministic instance attributes in the
  vertex shader. No per-frame object, material or texture creation is needed.
- Normal transparency, depthTest enabled, depthWrite disabled. Solid equipment
  and architecture occlude the vapor. Neither vapor nor its ribbon casts shadows.
- Same-color cards use one batch without individual particle sorting; their soft
  low-opacity density avoids hard intersections. No bloom, fluid solver, volume
  marching, external image or additional renderer pass is used.
- Step changes fade outgoing plumes out and incoming plumes in. Fully hidden
  plumes stop advancing. Pause freezes time and fade; resume continues the pool.
- Restart recycles the deterministic phases. Exit fades out during camera return
  and then resets/hides the pool. Reduced motion keeps a static vapor illustration.
- Focus materials are prepared before attaching the vapor pool. Vapor cannot be
  accidentally included in the equipment/city dimming material cache.
- Existing camera fitting includes the short outdoor plume extents. Exhaust
  receives a higher oblique view `[1, 2.2, 0]` because ray tests found the old
  viewpoint hid the right discharge hood behind the enclosure. The other five
  viewing directions and all camera transition behavior are preserved.

## Verification

With the local server on port 4173 and a dedicated headless Chrome debugging
session on port 9224:

```text
npm.cmd run check
node docs/airflow-smoke-qa.mjs
node docs/system-flow-qa.mjs
```

The airflow harness captures all six stages and mobile intake/exhaust views,
checks pool budgets, stage isolation, depth settings, pause/resume, restart,
previous/next, rapid navigation, inactive sleep, exit/re-entry, reduced motion,
and stable scene/resource counts. It compares frame intervals with the pool
hidden versus visible at the same camera and focus state. Screenshots and the
optional `--baseline` measurements are written to the operating-system temp folder.

The initial headless baseline measured about 6.1 ms median frame intervals on
this machine. These measurements are display/callback limited and do not certify
performance on every user's GPU; the paired rendering comparison and fixed
four-draw budget provide additional evidence. No device detection or quality
selector is introduced.
