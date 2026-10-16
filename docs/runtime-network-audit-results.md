# Production Runtime Network Audit Results

Run: 2026-10-16 against the production output served from `dist/` at `http://127.0.0.1:4174/`, with browser cache disabled. The capture opened the showroom, allowed progressive city loading, launched System Flow, selected all six steps, tested Previous/Next and Pause/Resume, exited, and re-entered.

- **Request hosts:** `127.0.0.1:4174` only.
- **Third-party origins:** none.
- **Local request types:** document, stylesheet, script, fetch, image, and other. Requests covered the 200 Water GLB, local HDRI, local city GLTF/BIN/textures, equipment popup images, app modules, and local Three.js 0.170.0 modules.
- **Blob URL:** MeshoptDecoder creates a browser-local Blob worker for decoding. It is not a third-party host or a remote request.
- **Cookies:** `document.cookie` empty.
- **localStorage / sessionStorage:** zero entries.
- **Analytics, telemetry, forms, maps, external images/fonts, external APIs:** no app integrations or requests found in this runtime capture/source review.
- **Impact cards:** hidden with the default-off approval flag.
- **Legal/notices link:** points to the deployed `THIRD-PARTY-NOTICES.txt` file.

This is a local production-build capture, not a capture from RUHL's final production host. Actual host/CDN request logs, TLS, and deployed paths remain unknown pending provider selection and RUHL review.

The associated production interaction pass is reproducible with `node docs/production-runtime-qa.mjs` and found the city loaded, two exhaust plumes visible in the Exhaust step, all six steps completed three times, keyboard navigation/pause/resume/restart/Previous/Next/finish/Escape working, the equipment dialog keyboard-close working, reduced-motion camera transitions disabled, and rendering paused/resumed on tab switch. Renderer geometry/texture/program/draw-call/triangle counts remained identical across the three cycle samples. Heap samples varied from 190,237,972 to 214,261,512 to 211,561,256 bytes, so the short run cannot establish heap stability or absence of leaks. No console errors were recorded.
