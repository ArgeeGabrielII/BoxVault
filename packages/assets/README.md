# Central assets

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../../docs/architecture/aws-platform-decision.md) and [daily rotation policy](../../docs/deployment/secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

Use this folder for **application-owned, non-sensitive** shared media: logos, brand illustrations, fonts (where licensed), and icon source files.

- Web: import from @boxvault/assets/logo.svg.
- iOS: copy or generate images into apps/ios/BoxVault/Resources/Assets.xcassets as part of its build workflow.
- API: reference assets when generating static communications.

Never commit customers' inventory photographs, payment proofs, banking QR images with private account data, API credentials, or user uploads to Git.
