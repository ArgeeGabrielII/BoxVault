# Web Experience, SEO, Accessibility & Compliance Requirements

Version 0.1 • Source: 17-item project source checklist (2026-11-11) • Status: proposed requirements, **not implemented**

## Purpose and applicability

This document translates the source checklist into testable BoxVault requirements. It applies to the **React web application** and its public-facing pages, with additional authenticated-portal and native-iOS considerations where relevant. Preserve the existing security-first, privacy-by-default, tenant-scoped architecture in [security-first-standard.md](../security/security-first-standard.md) and [product-requirements.md](../product/product-requirements.md).

**Page classes**
- **Public marketing**: landing, features, FAQ, contact, publicly approved plan-information pages, privacy, terms, confirmation pages where safe.
- **Authenticated customer**: dashboard, boxes, items, locations, media, family memberships/invitations, credits and payment requests.
- **Operator/admin**: private administrative workflows and billing verification.
- **Transactional**: sign-in, password reset, email verification, invitation acceptance, post-form confirmation.

Public pages may be discoverable. All authenticated/customer/operator/transactional pages must be **noindex** and must not reveal personal, inventory, token, receipt or session information in metadata, crawled URLs, search results or social previews. Public sitemaps include only approved canonical public URLs.

## Source checklist mapped to feature requirements

| ID | Original source detail | BoxVault implementation / acceptance criteria | Priority |
|---|---|---|---|
| WEBX-01 | Create a custom 404 Page | Branded not-found route with accessible heading, safe navigation to home/dashboard and no disclosure of whether private resources exist. Unauthorized resources follow the API's indistinguishable 403/404 policy where applicable. | MVP |
| WEBX-02 | Meta Title per Page | Unique, descriptive `<title>` for every public page; non-sensitive generic titles for authenticated pages. Client-side route changes update metadata or use framework-supported metadata rendering. | MVP |
| WEBX-03 | Meta Description per Page | Unique descriptions for indexable public pages; no user-provided box names, items, members, invitations, financial identifiers, tokens or other secrets in metadata. | MVP |
| WEBX-04 | Open Graph Image | Public branded OG image with `og:title`, `og:description`, `og:image` and canonical URL; no private media used as preview. Private routes have generic previews or no social metadata. | MVP |
| WEBX-05 | Favicon Set | SVG favicon plus standard PNG/apple-touch icons and manifest references, delivered from shared brand assets; ensure cross-browser/mobile display. | MVP |
| WEBX-06 | robots.txt | Publish `/robots.txt` with public crawling policy and sitemap reference. Disallow likely private routes as defense-in-depth only; never rely on robots.txt for access control. Enforce auth and `noindex` separately. | MVP |
| WEBX-07 | sitemap.xml | Generate `/sitemap.xml` containing **only** canonical, indexable public routes; exclude user dashboards, inventory, label URLs, invites, bank-payment records, admin pages and token-bearing URLs. | MVP |
| WEBX-08 | Alt text on every image | Every meaningful image has contextual alt text; decorative images use empty alt text. Customer-authored alt text stays tenant-protected, never exposed through SEO/analytics. Include checks for images and icon-only controls. | MVP |
| WEBX-09 | mobile breakpoints | Test responsive layout at representative narrow/mobile/tablet/desktop widths (e.g. 320, 375, 768, 1024, 1440 CSS px), including zoom and landscape, without sideways scrolling on primary flows. | MVP |
| WEBX-10 | loading states | Provide skeleton/progress/disabled-submit states for page fetches, scan resolution, media processing, invitation, redemption and receipt upload; prevent duplicate submissions and expose accessible status announcements. | MVP |
| WEBX-11 | form error states | Required-field and format validation; inline errors associated with fields; summary where appropriate; server error recovery without leaking internals; preserve nonsensitive user input. Never expose account existence in auth recovery flows. | MVP |
| WEBX-12 | thank-you page | Provide success/confirmation pages or states after supported public forms (e.g. contact) and relevant account flows; avoid exposing personal data in URLs, third-party pixels or indexable success pages. Mark transactional confirmations `noindex`. | MVP |
| WEBX-13 | privacy policy page | Public, versioned privacy notice including collection, purposes, media/inventory handling, payment proofs, processors, retention, rights/contact and policy update date; legal review required before launch. | Launch gate |
| WEBX-14 | terms page | Public, versioned terms addressing subscription duration, family seats, credits, payment verification, renewals, cancellations, user content, access and dispute handling; legal review required before launch. | Launch gate |
| WEBX-15 | cookie banner | If nonessential cookies/trackers are used, provide a clear consent interface with accept/reject and settings, block nonessential tracking until required consent, persist choices appropriately and allow later changes. Essential-only implementation may instead provide a concise disclosure where lawful. | Launch gate |
| WEBX-16 | analytics installed | Privacy-preserving event analytics for public funnels and approved app behavior; consent-gate nonessential collection; do **not** send box/item names, photos, file URLs, QR/NFC tokens, invite tokens, receipt details, user email or financial references. Document retention, vendor and opt-out. | MVP |
| WEBX-17 | CTA above the fold | On primary public landing page, place a clear product-value statement and primary CTA in the initial viewport at common mobile/desktop sizes; CTA directs to legitimate onboarding/sign-in. Do not imply that iOS in-app purchasing is supported. | MVP |

*The 17 original details above were supplied as short checklist items. Page segmentation, acceptance criteria, priority and technical controls are BoxVault-specific elaborations, not claims from the source.*

## Engineering integration

### Web application and centralized assets
- Implement public page shell, error boundary and authenticated route shell separately.
- Store approved logos, favicon assets, default OG images and illustrations in the monorepo's centralized asset package or existing shared-assets directory; use versioned, sanitized assets.
- Configure metadata centrally through typed route definitions to avoid duplicate titles, absent descriptions or accidental indexability.
- Prefer server-rendered or pre-rendered public metadata/sitemap if search crawler compatibility requires it; do not assume SPA-only runtime metadata is always discoverable.
- Add per-route `X-Robots-Tag: noindex, nofollow` and/or equivalent meta tags for authenticated and transactional pages, including error/redirect states.
- Ensure sensitive responses use appropriate cache controls and avoid exposing tokenized deep-link paths to third-party analytics/referrers.

### Legal/privacy and security
- Draft privacy policy and terms with qualified Philippine legal/privacy review; maintain policy version and effective date; record acceptance if required.
- Avoid third-party trackers on sensitive account, inventory, family, media or payment-proof pages unless expressly approved and technically verified not to receive sensitive data.
- Analytics events should be allowlisted (e.g. `landing_view`, `signup_started`, `box_created` with no IDs or content, `scan_succeeded`, `upload_failed` with safe error codes). Never transmit arbitrary route paths with sensitive identifiers or query strings.
- A cookie banner is not a substitute for valid consent, and analytics installation does not authorize tracking before required consent.
- A robots directive is not a security boundary. Keep authorization, RLS, media access and admin segregation mandatory.

### QA / release tests

- [ ] Custom 404 reachable and accessible; private-resource errors reveal no existence metadata.
- [ ] Each public route has unique non-sensitive title and meta description.
- [ ] Public OG previews and favicon files resolve; no private media preview.
- [ ] Robots and sitemap are valid and list no protected or token-bearing routes.
- [ ] Private pages and transactional pages have noindex protection in rendered response and headers as applicable.
- [ ] Images have appropriate descriptive or empty alt attributes; accessibility automated and manual checks pass.
- [ ] Main flows work on mobile/tablet/desktop, keyboard and enlarged text.
- [ ] Every network-dependent screen has loading/empty/error/success behavior.
- [ ] Forms provide validation, accessible error feedback and safe retry handling.
- [ ] Confirmation/thank-you pages cannot disclose private data through URLs, previews or analytics.
- [ ] Published privacy policy and terms are approved, linked, dated and versioned.
- [ ] Cookie consent rejects/blocks nonessential tracking where required; preference changes work.
- [ ] Analytics event allowlist and network payload inspection show no sensitive inventory, family, QR/NFC, receipt or identity data.
- [ ] Public landing-page CTA is visible without initial scrolling on agreed responsive viewport baselines.

## Related documents
- [product-requirements.md](../product/product-requirements.md)
- [security-and-privacy.md](../security/security-and-privacy.md)
- [security-first-standard.md](../security/security-first-standard.md)
- [security-release-checklist.md](../security/security-release-checklist.md)
- [delivery-roadmap.md](../planning/delivery-roadmap.md)

## Pending product/legal decisions

1. Exact public marketing sitemap and which contact/signup forms warrant separate thank-you pages.
2. Analytics provider, data-residency needs, event-retention limits and consent implementation.
3. Final legal policy wording, contact details, effective dates and approval process.
4. Confirmed brand marks, OG artwork, favicon exports and page copy.
