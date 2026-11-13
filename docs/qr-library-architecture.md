# ADR-QRC-001 — BoxVault QR generation package (design review)

**Status:** Four QR-library foundational decisions approved by product owner (2026-11-13); advertisement interstitial extension remains proposed pending provider, UX and privacy review. No code implemented  
**Date:** 2026-11-13  
**Branch:** `docs/qr-library-architecture`  
**Proposed package:** `@boxvault/qr` in `packages/qr`

## Purpose and scope

Own a clean, reusable, framework-independent TypeScript QR generation API for BoxVault. Use a separately isolated, established standards-based encoder (recommended candidate: Nayuki's QR Code generator) to produce a module matrix, and implement our own SVG/raster rendering and print-label composition. This document is a proposal for review, **not an implementation** and does not permit backend security bypasses.

This design is aligned with existing `docs/product-requirements.md` (INV-03, INV-04, INV-06, INV-08, INV-09), `docs/solution-architecture.md` (§5), `docs/api-contract.md` (label creation/resolution), `docs/security-first-standard.md` (§5), and `docs/family-sharing-access-control.md`.

## Approved foundational decisions (2026-11-13)

1. Build and own `@boxvault/qr` with a separately isolated Project Nayuki TypeScript encoder adapter, after licensing/provenance verification.
2. Separate portable matrix/SVG core from browser PNG and label-print entrypoints.
3. Keep production token issuance, authorization, rotation and resolution in the backend. The QR package only encodes supplied payloads.
4. MVP print-safe high-contrast square QR symbols and labels; defer custom shapes and center logos.

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

## ADR-QRC-002 — Optional advertisement interstitial before QR destination (proposed extension)

**Status:** Provision requested and accepted for architecture planning, default OFF. Ad provider and exact scope require separate approval. This is *not* implemented; this requirement does not add advertising logic to `@boxvault/qr`.

### Separation of concerns

The QR generator always encodes an invariant, first-party HTTPS label URL such as `https://app.example.com/c/<opaque-token>`. The advertisement feature is a separately versioned **web navigation/interstitial orchestration** module controlled by a server-side runtime feature flag; it must not modify QR symbols or require reprinting when toggled.

Relevant layers:

```text
@boxvault/qr: encode supplied first-party label URL only
  -> Web route /c/:opaqueToken
  -> session/authentication check (required)
  -> authorized label resolution and per-container ACL
  -> ad eligibility decision (default false)
       OFF -> authorized container screen
       ON  -> optional first-party interstitial with immediate Continue / Skip
  -> revalidate authorized navigation after continue
  -> authorized container screen
```

Access checks MUST happen before any personalized or contextual ad decision; absent authentication enters the normal sign-in flow without revealing container existence. Recheck membership, revocation and permissions on final access. Avoid generating a free-form redirect URL or passing arbitrary `next=`/destination URL values to clients. Prefer a server-generated, short-lived, same-origin navigation state or opaque reference. Never put raw label tokens into external ad-provider requests, tracking parameters, referrers, analytics, logs, or off-domain scripts. Authenticated pages should be `noindex` and `no-store`.

For generic QR payloads pointing at arbitrary third-party URLs, **do not enable arbitrary redirect interstitials** as part of this BoxVault container-label MVP. A separate URL-shortener/redirect product would require an allowlisted destination policy, anti-phishing/abuse controls, a validated host display, redirect-loop protection and open-redirect security testing; it is out of scope until explicitly approved.

### Proposed backend/runtime configuration (NOT part of QR package)

```ts
type InterstitialConfig = {
  enabled: boolean;               // default false
  experience: 'house-promo';      // initially first-party only
  skipAllowed: true;              // no forced viewing or click
  maxPerSession: 1;               // provisional cap; review telemetry/privacy
  eligibleRoute: 'container-scan';
  adFailureBehavior: 'continue';  // bypass advertisement, NOT security checks
};
```

The production toggle must be operator-configurable and validated server-side (e.g. remotely managed configuration with audit and kill switch). Do not trust a front-end-only toggle for enforcement, and do not let configuration change raw token URL semantics or auth. An optional per-tenant/no-ads entitlement policy requires product approval and explicit documentation before implementation. The toggle controls ad presentation only; authorization and tenant isolation always fail closed.

### UX requirements

- Clear `Advertisement` or `Sponsored` label; avoid deceptive navigation and ads mistaken for the Continue action.
- Immediately accessible `Continue to box` / `Skip` control, with keyboard and screen-reader usability. No forced countdown, click-to-continue ad, pop-up, new tab or surprise autoplay.
- Frequency-cap interruptions; proposed once per browser session, not every scan. Avoid an ad for login, password reset, invited-link handling, error/denial pages or security-critical steps.
- Responsive light/dark design, 320–1440px; 200% zoom and reduced motion; safe accessible loading/fallback for slow or blocked ad content.
- If the ad fails, is blocked or times out, bypass ads and continue only to already authorized content (with normal final authorization).
- Always support Back, no redirect loops, and no hidden user state in query strings.
- First-party promotions may avoid third-party ad-data disclosure. If third-party ads are considered later, require consent/legitimate-basis, data minimization, vendor review, provider placement policy and a documented opt-out where required.
- Protect sensitive storage workflows: no third-party trackers on personal inventory, box or scan routes by default. Consider restricting ads to public marketing pages if these safeguards cannot be met.

### Provider-policy risks and limits

Google AdSense placement rules prohibit ads on pages placed solely for ads in certain contexts, redirects designed to force ad viewing before content, or automatic-redirect/refresh ad placements. **Do not assume a commercial AdSense interstitial is permissible**; obtain provider approval / choose compatible placements. Google also discourages intrusive interstitials affecting user access and search. Relevant references:
- https://support.google.com/adsense/answer/1346295?hl=en
- https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials
- https://privacy.gov.ph/wp-content/uploads/2023/11/NPC-Circular-No.-2023-04_Guidelines-on-Consent_07Nov2023.pdf

### Security and acceptance criteria

1. With flag OFF (default), authenticated authorized QR scans navigate without interstitial; no third-party ad requests.
2. With flag ON and eligible, one first-party promotional interstitial is shown at most once per session, with immediate Continue; subsequent visits in session bypass.
3. Unauthenticated or unauthorized scans never reveal box labels/details through any ad decision, content, error, URL or event.
4. Invalid/revoked/rotated/cross-tenant tokens and denied ACLs cannot be navigated through by skipping ads or changing redirect state.
5. Tampered `next`, `returnUrl`, double-encoded URLs, protocol-relative URLs and alternate hosts do not produce an open redirect.
6. Disabling the flag immediately prevents newly requested interstitials without changing encoded QR content.
7. Ad network unavailable/blocked, script failure or missing creative cannot block an authorized scan; auth still runs normally.
8. Confirm no raw tokens/box titles, tenant IDs, emails, media URLs or user data travel to external ad vendors, analytics, referrers, or logs.
9. Test CSP, referrer policy, cache-control, consent and privacy notices, accessible dismissal, reduced motion, mobile behavior, back navigation and light/dark themes.
10. No third-party ad SDK, ad placements or monetization launch until separate security/privacy/legal and provider policy reviews.

### Open decisions specific to this feature

- Are ad interstitials wanted only for first-party BoxVault QR container links, or is an unrelated external URL redirect/shortener service intended? The MVP proposal covers only first-party labels.
- First-party house promotions versus third-party ad provider monetization (recommend house promotions initially).
- Global-only flag or optional per-plan/per-tenant exemption, and owner controls.
- Final session cap and whether the user must be fully signed in and authorized (recommended yes).
- Whether native iOS deep-link navigation should bypass the web ad interstitial entirely (recommended yes; check store requirements if monetization considered).

## External references consulted

- ISO/IEC 18004:2024: https://www.iso.org/standard/83389.html
- Project Nayuki QR generator (MIT): https://www.nayuki.io/page/qr-code-generator-library
- Project Nayuki source: https://github.com/nayuki/QR-Code-generator
- Alternative considered: `qrcode` package (MIT): https://www.npmjs.com/package/qrcode

**Security notice:** This design has not been implemented or independently reviewed and confers no production release approval.
