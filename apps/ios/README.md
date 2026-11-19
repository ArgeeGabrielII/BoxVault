# Native BoxVault for iPhone

<!-- BEGIN current AWS platform -->
> **Platform policy (2026-11-19):** Follow the [accepted AWS primary-platform decision](../../docs/architecture/aws-platform-decision.md) and [daily rotation policy](../../docs/deployment/secret-rotation.md): Sydney, one API host and Single-AZ RDS; Auto Scaling/Multi-AZ deferred. This document does not by itself prove hosted deployment, live rotation or production acceptance.
<!-- END current AWS platform -->

Requires macOS, Xcode, XcodeGen and iOS 17+. Generate an Xcode project with:

```sh
cd apps/ios
xcodegen generate
open BoxVault.xcodeproj
```

The generated Xcode project is intentionally not committed. Select a valid Apple development team and unique bundle ID before device deployment.

Includes a basic SwiftUI screen, API health probe, and QR camera scanner. The scanner currently displays the raw label only; a future authenticated resolver must verify tenant authorization before revealing inventory. Add Core NFC entitlement/session and Universal Links with Associated Domains when implementing NFC. No payment or external checkout functionality belongs in this iOS companion.

## Primary hosted backend and secret rotation

The selected hosted API is the AWS NestJS service in Sydney; RDS/S3/SES remain behind the API. The app must never embed AWS, database, email or infrastructure-secret values. Daily backend credential rotation and signing-key compatibility must preserve valid client flows, with Keychain refresh sessions still subject to revocation. AWS deployment and native device/Universal Link acceptance remain pending. Keep all purchasing and external checkout calls to action outside this iOS companion.
