import SwiftUI

struct ContentView: View {
    @State private var apiStatus = "Checking API…"
    @State private var showingScanner = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 18) {
                Image(systemName: "shippingbox.fill")
                    .font(.system(size: 72))
                    .foregroundStyle(.teal)
                Text("BoxVault")
                    .font(.largeTitle.bold())
                Text("Smart storage, one scan away.")
                    .foregroundStyle(.secondary)
                Text(apiStatus)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Button("Scan QR code") {
                    showingScanner = true
                }
                .buttonStyle(.borderedProminent)
                Text("Account access, NFC, inventory and family sharing are coming next.")
                    .multilineTextAlignment(.center)
                    .foregroundStyle(.secondary)
                    .padding(.horizontal)
            }
            .padding()
            .navigationTitle("Home")
            .task {
                apiStatus = await APIClient.shared.healthStatus()
            }
            .sheet(isPresented: $showingScanner) {
                QRScannerView()
            }
        }
    }
}
