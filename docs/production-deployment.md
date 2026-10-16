# Production Deployment

Build the reviewed static artifact with `npm run build`. The script recreates `dist/` from an explicit allowlist. It includes the showroom HTML/CSS/runtime JavaScript, the local Three.js 0.170.0 modules used by the app, required model/HDRI/equipment/city assets, the Apache project license, and the Three.js MIT notice. City GLTF buffer URIs are rewritten to local basename-only files so source-kit paths are not exposed.

`dist/production-files.json` inventories the generated paths. `docs/production-artifact-inventory.md` records their groups and exclusions. Before publishing, serve only `dist/` as the web root; do not point the provider at the repository root. After deployment, request representative excluded paths (for example `/docs/launch-legal-audit.md`, `/scripts/build-production.mjs`, and `/README.md`) and confirm they return 404, then compare the deployed file listing with `production-files.json`.

No hosting provider is configured in this repository. Host-level access logs, TLS/HSTS behavior, cache policy, and actual deployed paths therefore remain for RUHL/host review. Recommended response headers are in `security-headers.md`.
