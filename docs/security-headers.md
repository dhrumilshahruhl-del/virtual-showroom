# Production security headers

Headers are active deployment configuration generated into dist/_headers by scripts/build-production.mjs and consumed by Cloudflare Workers static assets. Tested with Wrangler 4.151.2 on 2026-10-19. Deploy using wrangler.jsonc.

```text
Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval' 'sha256-PhTME/NL+YLOgMGJpj6qFAbtI6hGjxjxvUFxpQwMDcM='; style-src 'self'; img-src 'self' data: blob:; connect-src 'self' blob:; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; worker-src 'self' blob:
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Strict-Transport-Security: max-age=31536000
Cache-Control: public, max-age=0, must-revalidate
```

The import-map hash is recomputed every build. No unsafe-inline, general unsafe-eval, wildcard source, or third-party host is allowed. Meshopt uses WebAssembly and a Blob worker; embedded GLB textures are fetched through local Blob URLs, requiring connect-src blob: as well as img-src blob:. DOM style property updates work with style-src self. HSTS applies to the HTTPS production hostname only; includeSubDomains and preload are absent. Browsers ignore it on local HTTP previews.

The exact HDR route adds Content-Type: application/octet-stream. Other MIME types come from Cloudflare's handler. Same-origin module/model/image requests need no CORS/CORP headers. Verify production headers after deployment; local preview cannot verify HTTPS or dashboard overrides.

Reference: [Cloudflare header behavior](https://developers.cloudflare.com/workers/static-assets/headers/).
