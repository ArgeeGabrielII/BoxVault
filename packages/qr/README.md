# @boxvault/qr

Framework-neutral QR Code Model 2 generator facade for BoxVault.

**Status:** Internal preview implementation. Do **not** use to issue production container labels until independent test, security and deployment gates pass. All production token issuance, validation and ACL checks belong in NestJS, not the QR package or mock UI.

## Features

- QR versions 1–40; ECC L/M/Q/H; auto or fixed mask 0–7; ECC boost on/off.
- Automatic text segmentation or provided numeric, alphanumeric, bytes and ECI segments.
- Four-module minimum quiet zone; dark/light opaque hex colors and SVG export.
- Browser-only PNG export through `@boxvault/qr/browser`.
- First-party sample label SVG via `@boxvault/qr/labels`; not certified for specific label printers.
- Pure synchronous encoder and SVG renderer suitable for future server-side rendering in Node.js; **does not create signed label URLs or authenticate users**.

## Example: server-side SVG generation

```ts
import { encodeQr, renderQrSvg } from '@boxvault/qr';

const matrix = encodeQr({
  value: issuedAuthorizedLabelUrl, // received from future backend label service
  errorCorrection: 'M',
  quietZone: 4
});
const svg = renderQrSvg(matrix);
// NestJS should respond with image/svg+xml and private/no-store caching headers;
// never log the opaque URL or use a third-party image generator.
```

This is a design usage illustration; `issuedAuthorizedLabelUrl` is an intentionally undefined placeholder. The library does not expose an HTTP endpoint, and SSR/route integration remains future work after PR #4 security gates.

## Development

```sh
pnpm install --no-frozen-lockfile
pnpm --filter @boxvault/qr typecheck
pnpm --filter @boxvault/qr test
pnpm dev:playground
```

Open http://localhost:5174/qr/ (via http://localhost:5174/). The standalone QR Lab **is not included in the production web bundle**. No API is contacted, no URLs are registered, and no local persistence is created.

## Standards & implementation notes

- Encoding: vendored Project Nayuki TypeScript QR library, MIT licensed. Original license header is preserved in `src/vendor/qrcodegen.ts`.
- SVG and label renderers: BoxVault wrapper, limited color inputs to 6-digit RGB hex to prevent SVG injection.
- Printed QR should be scanned on target phones/printers before production. Lab allows experimenting with configurations that may be less scan-friendly; do not assume decorative colors are production-approved.
- PNG output uses browser Canvas and integer pixel-size modules, not Node.js.
- Production server must authorize access **before returning private labels**; QR possession never bypasses authentication or tenant ACL.
- This package does not contain Google Ads. Commercial AdSense placement is confined to independently approved public content surfaces, never QR redirect holds.

See `docs/qr-library-architecture.md` and `docs/qr-library-implementation.md`.
