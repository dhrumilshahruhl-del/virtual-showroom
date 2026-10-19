# Production deployment

Selected method: Cloudflare Workers static assets, with no Worker script or Pages deployment. The repository previously had no provider configuration. Its static allowlist build supports this method directly. wrangler.jsonc points exclusively to ./dist. HTML handling serves / normally; not_found_handling: none returns 404 for unknown paths, with no SPA fallback.

Build: npm.cmd run build on Windows (npm run build elsewhere). Validate with npm.cmd run check and node scripts/scan-production.mjs. Preview the actual Cloudflare asset handler with npx wrangler@4.151.2 dev --local --port 4175. Publish the reviewed artifact with npx wrangler@4.151.2 deploy after final launch approval. No deployment was performed during this audit; no production URL or account settings were supplied.

The build recreates dist/ from an explicit allowlist, generates CSP from exact import-map bytes, and writes _headers. The 71-file inventory includes _headers as deployment metadata; Cloudflare consumes it rather than serving it. No docs, scripts, source-kit inputs, unused model exports, reference images, source maps, .git, or .env are included. Runtime JavaScript under /src/ is intentionally public because this app uses native modules. production-files.json contains relative deployed paths only.

Local Cloudflare evidence: cloudflare-response-evidence.json records MIME/cache checks. final-launch-evidence.json records excluded-path 404 tests and browser QA. HDR has an explicit application/octet-stream rule because automatic detection omitted its type. No CORS/CORP allowances are needed for same-origin assets. No cross-origin isolation is enabled.

All names are unversioned, so responses use Cache-Control: public, max-age=0, must-revalidate. This permits storage with revalidation, including GLB/HDR, without immutable stale-deployment risk. Apply long immutable caching only if content-hashed paths are introduced later.

At the final HTTPS URL, rerun response/exclusion/browser checks and confirm custom domain, TLS, privacy-policy linkage, and account features. Keep Web Analytics, Zaraz, and injected analytics disabled unless separately intended and reviewed. Local Wrangler cannot establish production account configuration or edge behavior.

References: [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/), [headers](https://developers.cloudflare.com/workers/static-assets/headers/), [HTML routing](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).

Asset-size review: largest file is canary_wharf_4k.hdr at 26,173,896 bytes, below the 25 MiB (26,214,400 byte) per-asset limit. All 70 public inventory paths returned 200 in the local handler; _headers is separately confirmed unavailable. See [Cloudflare asset limits](https://developers.cloudflare.com/workers/platform/limits/).

Wrangler 4.151.2 deploy --dry-run passed without publishing. The CLI's anonymous development-tool telemetry notice concerns Wrangler itself, not visitor runtime analytics in the app.
