# Production runtime/network audit — 2026-10-19

Target: final dist/ through Cloudflare Workers static assets, Wrangler 4.151.2, http://127.0.0.1:4175/. No production URL was supplied. This is Cloudflare local-runtime verification, not a public edge deployment capture.

Reproduce with node scripts/final-launch-qa.mjs after starting Wrangler and isolated Chrome CDP on port 9224; see accessibility-verification.md for the temporary axe scanner. final-launch-evidence.json contains requests, hosts, console/network findings, storage, step/cycle checks, renderer samples and path exclusion results. accessibility-trees.json contains raw state captures. cloudflare-response-evidence.json contains asset MIME/cache/header checks.

Coverage includes initial rooftop and progressive city loads; all six steps in three keyboard-only cycles; Previous, Next, Pause, Resume, Restart, Exit, Finish, Escape and re-entry; equipment menu/dialog and equipment callouts; approved impact cards; canvas keyboard controls; hidden-tab pause/resume; reduced motion; real browser zoom at 200%; separate 390-pixel narrow flow completion.

Earlier iterations found a favicon 404, CSP-blocked local Blob texture fetches, missing HDR MIME type, an unfocusable expanded impact scroller, and sticky controls covering text at zoom. These were fixed before the final capture. Fresh captures discard historical console entries so earlier failures are not mistaken for current runtime errors.

Renderer geometry/texture/program counts and reusable UI counts are sampled after each cycle; unchanged counts support absence of obvious growth during this short test, not proof of no leaks. No performance numbers or heap-stability claim are inferred.

App privacy and host boundary: no cookies/storage/telemetry are added by the app. Ordinary Cloudflare hosting/CDN request logging may occur. RUHL's privacy policy should cover the host appropriately. No analytics is configured in source or injected by the local runtime; Cloudflare dashboard injection settings remain unobserved until the final production URL is checked.

Final full capture: all 16 axe scans returned zero violations. Three complete keyboard cycles passed; no console exceptions/errors, failed requests or HTTP errors occurred. Request host was 127.0.0.1:4175 only (zero third-party hosts); cookie string empty and both storage counts zero. Each renderer sample: 91 geometries, 37 textures, 29 programs, one flow panel, one equipment popup; city loaded in all samples. Actual 200% zoom and 390-pixel narrow completion passed. All 70 public inventory paths returned 200; nine representative excluded paths returned 404. Subsequent CSS-only legal-link placement is checked separately in final-layout-evidence.json.
