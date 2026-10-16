# Production Artifact Inventory

The reproducible `dist/` build contains only runtime files and license notices. Exact paths at this build are listed below; `dist/production-files.json` is the machine-readable per-build inventory.

- **HTML:** `index.html`.
- **CSS:** `src/ui/showroom.css`.
- **Application JS:** `src/config.js`, `src/main.js`, `src/showroom.js`; `src/camera/rooftop-camera.js`; `src/controls/showroom-controls.js`; `src/environment/EnvironmentManager.js`, `city-context.js`, `city-facades.js`, `city-infill.js`, `city-site.js`, `heat-pump-wall.js`, `site-landscaping.js`, `studio-environment.js`; `src/flow/airflow-smoke.js`, `flow-focus.js`, `flow-visuals.js`, `pipe-topology.js`, `system-flow-data.js`, `system-flow.js`; `src/hotspots/rooftop-markers.js`; `src/lighting/studio-lights.js`; `src/loaders/city-assets.js`, `model-loader.js`; `src/ui/equipment-modal.js`, `flow-equipment.js`, `flow-impact.js`, `showroom-ui.js`.
- **Three.js local modules, all r170:** `src/vendor/three/build/three.module.js`; `src/vendor/three/examples/jsm/controls/OrbitControls.js`; `src/vendor/three/examples/jsm/loaders/GLTFLoader.js`, `RGBELoader.js`; `src/vendor/three/examples/jsm/libs/meshopt_decoder.module.js`; `src/vendor/three/examples/jsm/utils/BufferGeometryUtils.js`; and `src/vendor/three/LICENSE`.
- **200 Water model:** `assets/models/200-water-building.opt.glb`.
- **City context:** `assets/city-context/Building_Large_2.gltf` and `.bin`; `Building_Medium_2_001.gltf` and `.bin`; `Building_Small_1.gltf` and `.bin`; textures `T_Concrete_Asphalt_BaseColor.png`, `T_Concrete_BaseColor.png`, `T_Concrete_Normal.png`, `T_Concrete_ORM.png`, `T_dark_interior.png`, `T_lit_interior_1.png`, `T_lit_interior_2.png`, `T_MarbleFloor_BaseColor.png`, `T_MarbleFloor_Normal.png`, `T_MarbleFloor_ORM.png`, `T_MetalConcrete_BaseColor.png`, `T_MetalConcrete_Normal.png`, `T_MetalConcrete_ORM.png`, `T_RedBrick_BaseColor.png`, `T_RedBrick_Normal.png`, `T_RedBrick_ORM.png`, `T_Trim_BaseColor.png`, `T_Trim_Normal.png`, `T_Trim_ORM.png` in `assets/city-context/textures/`.
- **HDRI:** `assets/canary_wharf_4k.hdr`.
- **Equipment images:** `assets/equipments/ahu.png`, `ahu-popup.webp`, `heat_pump.png`, `heat_pump-popup.webp`.
- **Licenses/notices:** `LICENSE` (Apache-2.0), `THIRD-PARTY-NOTICES.txt` (Three.js MIT).
- **Build inventory:** `production-files.json`.

## Not Deployed

`docs/`; QA and runtime-audit scripts; `scripts/` development/build tooling; README/migration/extraction references; city source manifest; unused model exports and source textures; local Quaternius source-kit library; optimization scripts; reference imagery; package metadata/lockfiles; Git data; and internal notes. Required city BIN buffers are copied into the runtime city folder under plain asset names and do not expose the source-kit path.
