# BoxVault Web UI Redesign — isolated frontend workstream

Status: Planning baseline (2026-11-13). Branch: `feature/web-ui-redesign`. No backend integration authorized in this phase.

## Branch isolation and priorities
- Branch from `main`, not `feat/m1-auth-tenant-acl-rls` (PR #4).
- Do not modify, merge, rebase, retarget, or push to PR #4 or its head branch.
- Keep UI changes scoped to `apps/web`, approved shared frontend assets where needed, and `docs`.
- Do not add live API wiring, database access, secrets, migrations, or authentication bypasses.
- Present all features as frontend prototypes until backend integration is separately approved.
- Open a separate draft PR targeting `main` when UI implementation begins; do not merge automatically.
- Expect a deliberate integration pass once PR #4 is approved/merged. Avoid assuming its API contract or security state is finalized.

## Design direction and reference
- Visual reference provided by product owner: clean light dashboard; dark narrow top navigation; persistent desktop side navigation; blue primary buttons; generous whitespace; rounded filters; compact table and status markers.
- **Adapt concepts, not branding or irrelevant features.** BoxVault is a household inventory / storage box SaaS, not a business location-directory management product.
- Brand name: BoxVault. Maintain a distinctive visual identity and accessible text contrast.
- Responsive navigation: desktop collapsible sidebar, tablet compact navigation, mobile top bar with accessible navigation drawer or bottom navigation.
- Prefer readable container cards on phone; allow sortable/paginated tables on larger screens. Never force wide data tables to overflow the whole page.
- Make search prominent; simplify create-box/photo/QR-label and find-item journeys; show location hierarchy clearly.
- Include keyboard focus visibility, semantic controls, accessible labels, reduced motion preference, and touch targets of at least 44×44 CSS px where feasible.

## Planned user-facing screens
1. Public landing and plan information; sign-in, sign-up, verification/reset placeholders.
2. Customer dashboard (summary, recent boxes and locations, quick actions).
3. Containers/boxes (grid/table toggle, filter, search, create/edit/archive mock flows).
4. Container details (overview photo, location breadcrumbs, items, label/QR UI placeholder).
5. Locations (properties/rooms/shelves, tree/breadcrumb navigation).
6. Inventory items and search results (cards, list/detail, no real customer data).
7. Family sharing (selected members vs all family; private by default; role badges, invitation UX placeholders).
8. Account, profile, subscription state, web-only credits/payment history mock screens.
9. Separate operator/admin shell and restricted metrics/payment review mock screens: **never include inventory names, contents or photos in operator views**.
10. Error, empty, loading, success, confirmation and not-found states.

## Mock data and interactions
- Use clearly fictional, in-repository fixtures; never production data, real bank details or actual credentials.
- Client-side routes, navigation, filters, sort, pagination, modal/drawer interactions, form validation and simulated status changes may be interactive.
- Label all mutation flows as demo/prototype where no persistence exists; do not imply real auth, verified permissions, payment approvals, or durable storage.
- Local demo state must not hold real sensitive user information.
- Keep mock data behind interfaces/services so real API integration can replace it later.

## Responsive and accessibility acceptance
- Verify layouts at 320, 375, 390, 768, 1024, 1280 and 1440 CSS pixels; portrait/landscape and 200% zoom.
- No horizontal page scrolling at phone widths; long names wrap or truncate with accessible full-text affordances.
- All actionable UI is operable by keyboard; focus not hidden by drawers, headers or overlays.
- Responsive status labels must not rely on color alone; tables need meaningful headers and pagination.
- Test mobile Safari, Chrome, Firefox and Edge where available.
- Document loading, empty, error, disabled and confirmation states.

## Integration gate
Only after UI review and independent security review, plan the API integration against the then-current accepted PR #4 contracts; require authenticated server-side access control, tenant-scoped authorization, RLS, and private media checks before any real inventory data is exposed.

## Alignment with existing project docs
- [Product requirements](product-requirements.md): `WEB-01`–`WEB-05`, `INV-01`–`INV-13`, `ID-01`–`ID-05`, `ADM-01`–`ADM-08`.
- [Web experience, SEO and compliance](web-experience-seo-compliance.md): `WEBX-01`–`WEBX-17`.
- [Security first standard](security-first-standard.md): privacy by default, family ACL, customer/operator separation.
