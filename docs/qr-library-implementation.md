# BoxVault QR library + mock QR Lab — Phase 1 implementation record

**Date:** 2026-11-13  
**Status:** Implemented in isolated feature branch; CI build / QR regression tests / mock Lab typecheck and standalone Vite bundle passed on 2026-11-13 (GitHub Actions run 43353136902); pending independent decoder, browser, physical-scan and security approval  
**Branch:** `feat/qr-library-mock-lab` (derived from docs architecture branch; does not modify PR #4 or PR #6)

## What is implemented

- `packages/qr` internal `@boxvault/qr` TypeScript package, using a vendored Project Nayuki TypeScript encoder with its original MIT license header and source blob provenance.
- API: `encodeQr`, `renderQrSvg`, `getQrStatistics`; separate browser PNG renderer and printable-label SVG renderer.
- Supported options: arbitrary input text, ECC L/M/Q/H, QR versions 1–40, automatic/manual mask, ECC boost, border >=4 modules, scale, colors, basic manual segments including UTF-8 ECI 26.
- `apps/playground/qr` stand-alone React/Vite developer UI, accessed from the centralized VaultBox Developer Playground via `pnpm dev:playground` on port **5174**. The companion dashboard mock is under `apps/playground/ui`. Mock-only, separate HTML entry point; not included in main `apps/web` build, and not linked to production routing.
- Preview controls match the functionality shown by the Project Nayuki live QR input demo: text, ECC, bitmap/vector export, border, scale, foreground/background colors, version range, mask, ECC boost and statistics. Adds storage-label layout preview, manual segment experiment and light/dark display.
- Node regression tests for encoder options, deterministic SVG, manual segmentation and XML label escaping.

## Explicitly NOT implemented

- No user registration, APIs, authentication, storage permissions or database access.
- No real token generation, live QR label issuance/resolution, working deep link, QR scanner or NFC writing.
- No backend NestJS controllers, no production label SSR HTTP handlers, no server-side user data rendering and no production UI integration.
- No Google ads, forced advertising countdown or promotional interstitial implementation.
- No PDF label sheets, validated physical printer dimensions, custom logo QR or automated production-grade scanner conformance suite.
- No claim of production readiness; security requirements from PR #4 remain mandatory.

## Server-side rendering design

`@boxvault/qr` core has no DOM, canvas, React or HTTP dependency. Node.js can call `encodeQr` and `renderQrSvg` and return the SVG through an authenticated NestJS endpoint **later**. Avoid Canvas in SSR; use separate browser PNG adapter only for this local demo. Backend must issue CSPRNG opaque labels, authorize caller/tenant/container, and return `image/svg+xml` with `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, and an appropriate CSP. Do not log label URLs, leak tokens into public pages or allow arbitrary redirect destinations.

The demo intentionally performs all QR encoding in the browser; **production must use server-side token issuance/authorized rendering**. The server-side renderer capability does not itself provide auth or secure token issuance.

## Verification and acceptance remaining

1. **CI verified (2026-11-13):** main app typecheck and build, QR library build and Node regression tests, QR Lab typecheck and standalone Vite build (run 43353136902). Local interactive browser testing, keyboard/mobile inspection and screenshot review remain open.
2. Compare matrices and rendered exports with an independent QR decoder for numeric, UTF-8 and long URLs, all ECC levels and version boundaries; add test vectors before release.
3. Browser checks: Safari iOS, Chrome Android, Firefox, Edge; bitmap integer scaling; SVG print, quiet zone and accessible input/error feedback.
4. Security checks: no public serving of this Lab, no production deployment and no third-party app receiving QR payloads; validate maximum payload/raster output sizes and unsafe SVG.
5. Test physical labels on multiple printers, paper sizes and cameras and choose a production label spec separately.
6. Independent code review, license review and SSR integration plan; no merge to main until gates pass.

## Local run (without touching the existing backend checkout)

```sh
git fetch origin
git worktree add ../BoxVault-QR feat/qr-library-mock-lab
cd ../BoxVault-QR
pnpm install --no-frozen-lockfile
pnpm dev:playground
```

Open http://localhost:5174/ for the catalog, http://localhost:5174/qr/ for QR Lab, and http://localhost:5174/ui/ for the dashboard mock. If the branch is not known locally, use `git branch --track feat/qr-library-mock-lab origin/feat/qr-library-mock-lab` before adding the worktree.

## Reference

- https://www.nayuki.io/page/qr-code-generator-library
- https://github.com/nayuki/QR-Code-generator
- [QR architecture ADR](qr-library-architecture.md)
