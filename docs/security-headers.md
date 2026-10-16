# Production Security Headers

Apply these as host response headers; they are recommendations, not active configuration. The showroom makes same-origin asset requests and no third-party runtime requests. Test against the deployed host before enforcement.

```text
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-PhTME/NL+YLOgMGJpj6qFAbtI6hGjxjxvUFxpQwMDcM='; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'; worker-src 'self' blob:
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
```

The inline import map in the current `dist/index.html` hashes to the CSP value above. Recompute after changing its contents. `frame-ancestors` is effective only as a response header. Serve GLB, GLTF, BIN, PNG, WebP, HDR, CSS, and JS with correct media types from the same origin. Cross-origin asset hosting is not required; if introduced later, configure CORS narrowly and update CSP. Serve over HTTPS. Enable HSTS only after HTTPS is confirmed for the production host and all required subdomains.
