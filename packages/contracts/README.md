# Cross-platform API contracts

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../../docs/architecture/aws-platform-decision.md) and [daily rotation policy](../../docs/deployment/secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

NestJS is the source of truth for an OpenAPI specification. Generate a TypeScript client for the React app and a Swift client for iOS. Do not attempt to import TypeScript directly into Swift.

Initial public endpoint: GET /api/v1/health. Protected endpoints will be added after authentication and tenant authorization.
