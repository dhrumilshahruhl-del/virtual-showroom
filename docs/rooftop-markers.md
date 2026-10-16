# Rooftop Markers

Five white dots mark the left and right duct equipment boxes, both upper central units, and the first of the two lower-room heat pump cabinets.

Anchors are building-local surface coordinates in `src/hotspots/rooftop-markers.js`. They were raycast against the optimized building at the saved default view; they are not screen-space percentages. The marker group is parented directly to the building, preserving attachment through translation, rotation, and scale changes.

Dots share one texture and remain approximately 18 CSS pixels across. The heat pump dot uses a separate material with depth testing disabled and renders above the enclosure so it stays visible and clickable when the wall is solid. Other dots use depth testing for natural occlusion. A subtle dark outline keeps them visible against pale equipment. Disposal releases both materials and the shared texture.

The calibration utility `docs/hotspot-calibration.mjs` requires the local showroom server and a Chrome debugging session on port 9223. Some source faces have reversed winding, so their surface normals need outward correction when selecting offsets.

The heat pump hotspot uses the measured front-panel center `fromPlant(30.23516, -20.28151, 3.55185)`, with an outward normal along positive X/Z and a 0.02-unit surface offset. The former position was on the nearby pipe connection rather than the cabinet. It opens the Heat Pump modal. A second, flow-only anchor at `fromPlant(31.43937, -20.28151, 3.55185)` marks the adjacent heat pump front panel. Guided flow connects both HTML dots to one Heat Pump label; it adds no WebGL sprites. `docs/heat-pump-anchor-qa.mjs` checks both centers against measured cabinet front-panel vertices. The separate wall Reveal/Solid control uses its original building-local anchor `[14.85, 7.15, -35.70]`.
