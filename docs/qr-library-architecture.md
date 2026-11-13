# ADR-QRC-001 — BoxVault QR generation package (design review)

**Status:** Proposed, not approved or implemented  
**Date:** 2026-11-13  
**Branch:** `docs/qr-library-architecture`  
**Proposed package:** `@boxvault/qr` in `packages/qr`

## Purpose and scope

Own a clean, reusable, framework-independent TypeScript QR generation API for BoxVault. Use a separately isolated, established standards-based encoder (recommended candidate: Nayuki's QR Code generator) to produce a module matrix, and implement our own SVG/raster rendering and print-label composition. This document is a proposal for review, **not an implementation** and does not permit backend security bypasses.

This design is aligned with existing `docs/product-requirements.md` (INV-03, INV-04, INV-06, INV-08, INV-09), `docs/solution-architecture.md` (§5), `docs/api-contract.md` (label creation/resolution), `docs/security-first-standard.md` (§5), and `docs/family-sharing-access-control.md`.

## Decision

- Package: `packages/qr`, exported as `@boxvault/qr`; no React, NestJS, database or DOM dependency in the core.
- QR Code Model 2, all standard versions 1–40, ECC levels L/M/Q/H. Default ECC M for plain labels, H only for validated branding designs, with final presets determined by field tests.
- Initial public output: readonly module matrix, safe SVG string, and PNG via a **separate browser adapter**. Node PNG is future optional with an explicit raster adapter.
- Source encoding candidate: Project Nayuki TypeScript source (MIT) or equivalent properly licensed/pinned dependency. Before implementation, verify upstream commit/release, supply-chain integrity, maintenance model and exact notice requirements. If vendoring, preserve original copyright and MIT notice, source attribution, pinned origin + revision and local patches; do not imply upstream code was written by BoxVault.
- Keep error-correction encoding independent from presentation. Avoid exposing the underlying encoder's types in the public API.
- Initial QR symbol styling: square modules, standard finder/timing/alignment patterns, 4-module quiet zone, dark foreground on opaque light background, no embedded center logos in the MVP. Later branding must have scannability gates.
- Treat raw QR content as **public to anyone with physical access**. A label contains only an approved HTTPS locator with an opaque random token. No identity, title, photos, internal IDs, PII or inventory metadata.
- QR generation is not the secure-token issuing or resolving service. Token issuance/rotation/revocation, tenancy, auth, membership and per-container ACL enforcement remain in backend services to be integrated separately.
- No frontend-only access assertions; QR/NFC is never an authorization credential.

## Component boundaries

```text
apps/web (UI preview) or apps/api (future authorized label service)
       -> @boxvault/qr public API
          -> payload checks / policy adapter
          -> encoder adapter (Nayuki)
          -> readonly QR matrix
          -> SVG renderer / browser PNG renderer / label composer
```

Consumers may render a QR locally from an already-issued authenticated label URL but **must never** generate live production locator tokens in frontend code. Avoid unnecessary server logs of plaintext label URL. Do not upload QR images or encoded tokens to third-party QR generators.

Future native SwiftUI app shares the versioned **label URL contract and test vectors**, not JavaScript runtime code. Core Image or another independently evaluated native encoder can render the same URL bytes, with compatibility verified by decode tests.

## Proposed public API (design sketch)

```ts
type Ecc = 'L' | 'M' | 'Q' | 'H';
type QrConfig = Readonly<{
  value: string;
  errorCorrection?: Ecc; // default M
  quietZone?: number;     // default and minimum 4 modules
  minVersion?: number;    // 1..40
  maxVersion?: number;    // 1..40
}>;
type QrMatrix = Readonly<{
  size: number;
  version: number;
  errorCorrection: Ecc;
  getModule(x: number, y: number): boolean;
}>;
type QrSvgOptions = Readonly<{
  foreground?: string; // safe RGB hex
  background?: string; // safe RGB hex; must be opaque
  moduleSize?: number; // SVG unit scaling
}>;
type QrErrorCode =
  | 'EMPTY_PAYLOAD' | 'PAYLOAD_TOO_LONG' | 'INVALID_OPTION'
  | 'CAPACITY_EXCEEDED' | 'INVALID_COLOR' | 'OUTPUT_TOO_LARGE';
function encodeQr(config: QrConfig): QrMatrix;
function renderQrSvg(matrix: QrMatrix, options?: QrSvgOptions): string;
async function renderQrPngBrowser(matrix: QrMatrix, options: {
  pixels: number;
  foreground?: string;
  background?: string;
}): Promise<Blob>;
```

Proposed label-specific API in a separate integration module, not the general QR encoder:
```ts
type BoxLabel = {
  url: string;         // from authorized backend; HTTPS and host validated
  displayName?: string; // human-readable text OUTSIDE the QR code
  reference?: string;   // safe non-secret short printed reference
};
function createLabelSvg(label: BoxLabel, layout: LabelLayout): string;
```

An ergonomic `createQR(...).toSVG()` facade can be added after deciding tree-shaking/API stability. Prefer explicit separate encode/render exports to keep the core portable.

## Payload and URL policy

- QR encoding is generic for caller-provided strings; a **BoxVault label policy** validates HTTPS, an allowlisted first-party host, expected route shape `/c/<opaque-token>`, no username/password, unsafe ports, fragments or unapproved query parameters.
- Production domain is **not yet finalized**. `https://example.com/c/demo-token` is illustrative and **must not be issued as a working label**.
- Default label payload budget proposed: 512 UTF-8 bytes; fine-tune after label sizes and scan tests. Enforce bounded input length and output pixel dimensions, reject NaN/unbounded scaling and over-capacity encoding. QR general-purpose input limits may differ from the label policy.
- The opaque token must be CSPRNG-issued server-side, >=128 bits of entropy, nonsequential and stored hashed where appropriate.
- Token URLs are sensitive locators (even though not authorization). Prevent token disclosure in app analytics, logs, referrers, screenshots of support dashboards or shared caches. Set appropriate web referrer and caching policy in future integration.
- Decoding a scanned QR only routes to login / session authorization, membership + item-level ACL and neutral denial; never expose box existence to unauthorized callers.
- Labels must support future rotation/revocation and reprinting without changing internal container identity.

## Output and print strategy

- Always render with an opaque background and 4-module minimum quiet zone. Never modify finder/timing/alignment patterns or silently crop the quiet zone.
- Default design uses solid dark modules/light paper. UI theme switching **never** inverts the actual QR symbol or modifies print colors.
- Generate deterministic SVG from an immutable matrix; escape XML text in composed labels, whitelist colors and avoid injecting unsanitized SVG/HTML.
- Raster generation preserves square pixels and integers: no antialiasing/blurring; verify output side accommodates integer module scaling including quiet zone.
- Label text and logos are separate from the QR matrix. No center logo for MVP. Print CSS uses physical dimensions (mm), avoids scaling that compromises module legibility and includes minimum-size recommendations verified through physical tests.
- Printable sheets and PDF are separate future concerns. Print/export code should not embed any customer data other than the explicitly allowed label text and URL, after authorization.
- No external fonts or QR rendering services.

## Testing and quality gates

1. **Conformance:** golden matrices and text decode roundtrips for numeric, alphanumeric, UTF-8, URL, edge capacities, all ECC levels and QR version boundaries; verify output against independent decoder, not only same encoder.
2. **SVG/raster:** deterministic snapshots, real SVG parser validation, expected matrix width/height, quiet zone count, round-trip decode for exported PNG; no clipping, blur, corrupt files or wrong pixel sizes.
3. **Security:** refuse empty/oversize/invalid option values and unsupported colors; reject malicious SVG text, unsafe label URLs, unknown hosts, query/fragment injection and false token assumptions. Verify no raw tokens in logs/errors.
4. **Physical:** test at agreed label dimensions on at least iOS and Android devices, multiple cameras/lighting conditions, inexpensive thermal and inkjet/laser printers, damaged/smudged labels and varying distances. Document pass-rate threshold before productizing.
5. **Accessibility/UX:** text description and manual lookup fallback; keyboard-accessible export buttons; no color-only meaning; UI works in light and dark, print remains high-contrast.
6. **Build/release:** TypeScript typecheck; unit/integration coverage; Node and browser import checks; browser preview remains frontend-only; SCA/license scan; pinned dependency audit; no calls to external QR APIs.
7. **Future backend-specific negatives:** invalid/rotated/revoked tokens, wrong household, wrong family ACL, missing login, guessed token, invalid URL, untrusted redirects, stale local cached images.

## Rollout gates and non-goals

- Phase A: approve design, payload/URL policy, encoder provenance, license review and test plan.
- Phase B: implement core QR encoder adapter + matrices + SVG + unit/golden/decoder tests.
- Phase C: add browser PNG and print-label composer with standardized presets.
- Phase D: integrate web UI with **fictional mock URLs only**; implement loading/errors, print UX and compatibility tests.
- Phase E: after independent review of API/security changes, integrate authorized backend label issuance/resolution, rotation/revocation, no-logging protections and per-container ACL.
- QR scanning library, NFC tag writing, live token generation, PDF engine, public QR API and custom/logo QR styling are **not** MVP package requirements.

## Open decisions for product / engineering review

1. Confirm Nayuki TypeScript source vendoring vs pinned package dependency and actual upstream revision/licensing notices.
2. Confirm package scope: core + SVG in base, browser PNG and print labels in separate entrypoints.
3. Final production domain and approved label URL route; TTL and token rotation policy remain backend design.
4. Default storage label size (e.g. 40×30 mm vs 50×30 mm), paper/printer class, and scan pass-rate acceptance.
5. Whether a human-readable non-secret box reference is printed outside QR, and privacy implications of showing customer-named containers.
6. Whether user-custom foreground color is allowed in MVP (recommend fixed print-safe palette first).
7. Version 1 testing targets and maintenance ownership / dependency update cadence.

## External references consulted

- ISO/IEC 18004:2024: https://www.iso.org/standard/83389.html
- Project Nayuki QR generator (MIT): https://www.nayuki.io/page/qr-code-generator-library
- Project Nayuki source: https://github.com/nayuki/QR-Code-generator
- Alternative considered: `qrcode` package (MIT): https://www.npmjs.com/package/qrcode

**Security notice:** This design has not been implemented or independently reviewed and confers no production release approval.
