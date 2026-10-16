# Ventilation impact overlay

The existing zero-based flow indices are authoritative. No step is renamed or
reordered, and no system connection or equipment impact is inferred.

| Existing ID | Existing name | Impact content |
| --- | --- | --- |
| 0 | Fresh Outdoor Air | None |
| 1 | Used Indoor Air | Airflow rebalanced: 74,780 CFM before, 21,480 CFM after, 53,300 CFM less exhaust; pressure changes from 284% negative to balanced / slight positive. This is the existing exhaust-collection/rebalancing stage. |
| 2 | Energy Recovery | Recover energy, not air: ~72% heat-recovery effectiveness, with separate exhaust and outdoor-air paths and an energy-only connection. |
| 3 | Heat Pump | None |
| 4 | Supply Air | None |
| 5 | Exhaust | Ventilation impact: the existing final stage presents whole-retrofit annual totals: 26% ventilation energy reduction, 11.9M kBtu/yr saved, 664 tCO₂e/yr avoided. These totals are explicitly not attributed to this exhaust component. |

The final energy-use comparison shows a full Before bar and a shorter After
bar, with the removed segment fading and labeled “26% LESS.” Only the supplied
26% project impact is communicated numerically, including accessible labels;
baseline and remaining percentages are not displayed. The airflow band lengths use the exact
21,480 / 74,780 ratio. No additional airflow percentage, building-roadmap metric,
equivalency, financial estimate or per-equipment savings is introduced.

## Implementation

- `src/ui/flow-impact.js`: one reusable native details container, step-driven
  markup, inline SVG, deterministic entry/exit and media/toggle lifecycle.
- `src/ui/showroom.css`: existing typography, navy/blue/orange/cyan colors and
  panel styling, finite CSS animations, reduced motion and responsive layout.
- `src/flow/system-flow.js`: step/pause/exit/disposal hooks and safe overlay insets
  passed to the existing camera fit. Camera targets still come from the same
  active geometry bounds; viewing directions and engineering definitions are
  untouched. Only the usable viewport and framing offset reserve room for the
  desktop impact card. Inline expansion uses the same existing mobile fit.
- `package.json`: includes the new UI module in the existing syntax check.
- `docs/impact-qa.mjs`: browser integration checks and screenshots.

At widths of 1200px and above, the 288px impact panel docks to the right. Below
1200px, that same container moves inside the flow panel before navigation and
starts collapsed. Its native summary is keyboard accessible. Expansion scrolls
the impact section above the sticky primary controls, caps content height, and
leaves the upper 3D viewport available. Closing or leaving restores the normal
panel layout. No duplicate desktop/mobile cards are created.

The introduction takes 240ms, diagram animations finish within 1.35 seconds,
and step exit takes 140ms. An animation-end listener mounts only the latest
requested card; rapid navigation cannot accumulate timers or stale entries.
Pause applies CSS animation-play-state. Exit immediately cancels and clears the
overlay; re-entry starts from the original first step. Reduced motion displays
the final states without entrance or diagram motion.

Key values and their scope are normal accessible text. SVGs redundant with the
numbers are aria-hidden; the pressure and energy diagrams have descriptive
accessible labels. Air streams have text labels and distinct positions/arrows,
so color is not the only explanation.

## Cost and verification

The impact module imports no Three.js code and creates no scene objects,
materials, textures, canvas, renderer or external assets. It adds no dependency,
requestAnimationFrame, interval, count-up or continuously running animation.
Layout work is event driven; camera fitting reuses existing flow machinery.
There is only one bounded DOM subtree, replaced on entry and cleared on exit.

With the showroom on port 4173 and dedicated Chrome debugging on port 9224:

```text
npm.cmd run check
node docs/impact-qa.mjs
node docs/system-flow-qa.mjs
```

The impact checks cover all step mappings, exact values, proportional bands,
finite animations, rapid navigation, pause/restart/exit/re-entry, reduced motion,
one canvas, unchanged scene-object count, stable warmed renderer resources and
bounded DOM counts. Viewports include 1440×1000, 1280×800, 1024×768, 768×1024
and 390×844, including expanded inline cards. Screenshots go to the OS temporary
directory. The existing flow harness additionally checks topology, material and
camera restoration, airflow behavior and renderer/browser errors.
