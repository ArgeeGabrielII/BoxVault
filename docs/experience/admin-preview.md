# Admin console UI preview

Implemented on 2026-11-13. Open `/#/admin/overview`, or use **Explore admin preview** in the customer demo sidebar.

The console follows the existing light/dark/system theme and uses fictional account and billing fixtures from `apps/web/src/admin/mockData.ts`.

## Screens and interactions

- **Overview:** active subscription metrics, cash collected, pending reviews, credits issued, an illustrative collection chart, subscription mix, review queue and recent activity.
- **Accounts:** name/email/ID search, status filters and read-only account metadata details.
- **Payment reviews:** status tabs, search, synthetic payment details, duplicate-reference detection, mandatory acknowledgement, two-step approval/rejection and required rejection reasons. Approvals update demo balances, credit issuance and activity; rejections do not issue credits.
- **Plans & credits:** approved annual Personal/Family prices and member limits, sample credit ledger, and explicit distinction between cash collected, credit issuance and earned revenue.
- **Activity log:** session decisions, synthetic operational events, search and category filters.
- **Settings:** shared theme preferences, confirmation before resetting sample data and the intended operator access boundaries.

## Data and access boundary

This is a publicly accessible frontend prototype, not an authenticated admin console. Hash routes switch the UI only. All records and references are synthetic; no customer inventory, photos, notes, bank receipts or live account permissions are exposed. Account balances include fictional opening credits. Collection-chart values are illustrative and are labeled accordingly.

Mock mutations live in React memory and reset on refresh or leaving the admin preview. Only appearance preference persists locally. The existing Hosting CSP blocks backend connections; the artifact verifier checks all frontend TypeScript source for network integrations. A connected admin console will require independently reviewed server-side authentication, role separation, MFA, financial authorization and durable audit controls.

## Verification

Local typecheck/build and Hosting artifact audit passed. Browser checks covered approval, rejection with a reason, duplicate-reference approval blocking, new activity entries, account search, light/dark layouts and mobile navigation. At 375px, tables scroll inside their containers without widening the page; the closed navigation is removed from keyboard/accessibility navigation and the open drawer moves focus to its close control. Review dialogs use the browser's native modal behavior.
