# Native BoxVault for iPhone

Requires macOS, Xcode, XcodeGen and iOS 17+. Generate an Xcode project with:

```sh
cd apps/ios
xcodegen generate
open BoxVault.xcodeproj
```

The generated Xcode project is intentionally not committed. Select a valid Apple development team and unique bundle ID before device deployment.

Includes a basic SwiftUI screen, API health probe, and QR camera scanner. The scanner currently displays the raw label only; a future authenticated resolver must verify tenant authorization before revealing inventory. Add Core NFC entitlement/session and Universal Links with Associated Domains when implementing NFC. No payment or external checkout functionality belongs in this iOS companion.
