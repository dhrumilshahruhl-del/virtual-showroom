# Rooftop Markers

Five white dots mark the left and right duct equipment boxes, both upper central units, and the central structure's front wall.

Anchors are building-local surface coordinates in `src/hotspots/rooftop-markers.js`. They were raycast against the optimized building at the saved default view; they are not screen-space percentages. The marker group is parented directly to the building, preserving attachment through translation, rotation, and scale changes.

Dots share one texture and material, remain approximately 18 CSS pixels across, and use depth testing for natural occlusion. A subtle dark outline keeps them visible against pale equipment. No labels, separate rooftop model, geometry changes, or camera changes are introduced. Disposal releases the shared marker resources.

The calibration utility `docs/hotspot-calibration.mjs` requires the local showroom server and a Chrome debugging session on port 9223. Some source faces have reversed winding, so their surface normals need outward correction when selecting offsets.
