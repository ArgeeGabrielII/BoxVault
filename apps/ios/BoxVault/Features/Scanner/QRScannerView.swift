import AVFoundation
import SwiftUI

struct QRScannerView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var scannedValue: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                QRScannerRepresentable { value in
                    scannedValue = value
                }
                .frame(maxHeight: 360)
                .clipShape(RoundedRectangle(cornerRadius: 16))

                if let scannedValue {
                    Text("Scanned label")
                        .font(.headline)
                    Text(scannedValue)
                        .font(.footnote)
                        .textSelection(.enabled)
                    Text("This starter does not fetch inventory until authentication is implemented.")
                        .foregroundStyle(.secondary)
                } else {
                    Text("Point your camera at a container QR label.")
                        .foregroundStyle(.secondary)
                }
            }
            .padding()
            .navigationTitle("QR Scanner")
            .toolbar { Button("Done") { dismiss() } }
        }
    }
}

private struct QRScannerRepresentable: UIViewControllerRepresentable {
    let onScanned: (String) -> Void

    func makeUIViewController(context: Context) -> ScannerController {
        let controller = ScannerController()
        controller.onScanned = onScanned
        return controller
    }

    func updateUIViewController(_ uiViewController: ScannerController, context: Context) {}
}

final class ScannerController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onScanned: ((String) -> Void)?
    private let session = AVCaptureSession()
    private var preview: AVCaptureVideoPreviewLayer?
    private var didScan = false

    override func viewDidLoad() {
        super.viewDidLoad()
        AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
            guard granted else { return }
            DispatchQueue.main.async { self?.configure() }
        }
    }

    private func configure() {
        guard let camera = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: camera),
              session.canAddInput(input) else { return }
        session.addInput(input)

        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { return }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.qr]

        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill
        layer.frame = view.bounds
        view.layer.addSublayer(layer)
        preview = layer
        DispatchQueue.global(qos: .userInitiated).async { self.session.startRunning() }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if session.isRunning {
            DispatchQueue.global(qos: .userInitiated).async { self.session.stopRunning() }
        }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput,
                        didOutput metadataObjects: [AVMetadataObject],
                        from connection: AVCaptureConnection) {
        guard !didScan,
              let code = metadataObjects.first as? AVMetadataMachineReadableCodeObject,
              let value = code.stringValue else { return }
        didScan = true
        onScanned?(value)
    }
}
