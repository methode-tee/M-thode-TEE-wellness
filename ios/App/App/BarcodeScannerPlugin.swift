import Foundation
import UIKit
import AVFoundation
import Capacitor

@objc(BarcodeScannerPlugin)
public final class BarcodeScannerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BarcodeScannerPlugin"
    public let jsName = "BarcodeScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]

    @objc func scan(_ call: CAPPluginCall) {
        let status = AVCaptureDevice.authorizationStatus(for: .video)
        switch status {
        case .authorized:
            presentScanner(call)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                DispatchQueue.main.async {
                    if granted { self?.presentScanner(call) }
                    else { call.reject("L’accès à la caméra est nécessaire pour scanner un code-barres.", "CAMERA_DENIED") }
                }
            }
        default:
            call.reject("Autorise la caméra dans Réglages pour scanner un code-barres.", "CAMERA_DENIED")
        }
    }

    private func presentScanner(_ call: CAPPluginCall) {
        guard let host = bridge?.viewController else {
            call.reject("Scanner indisponible.", "SCANNER_UNAVAILABLE"); return
        }
        let scanner = MTBarcodeScannerViewController()
        scanner.onCode = { [weak scanner] code in
            scanner?.dismiss(animated: true) { call.resolve(["code": code]) }
        }
        scanner.onCancel = { [weak scanner] in
            scanner?.dismiss(animated: true) { call.resolve(["cancelled": true]) }
        }
        scanner.modalPresentationStyle = .fullScreen
        host.present(scanner, animated: true)
    }
}

private final class MTBarcodeScannerViewController: UIViewController, AVCaptureMetadataOutputObjectsDelegate {
    var onCode: ((String) -> Void)?
    var onCancel: (() -> Void)?
    private let session = AVCaptureSession()
    private var preview: AVCaptureVideoPreviewLayer?
    private var finished = false

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        configureCamera()
        configureOverlay()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in self?.session.startRunning() }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if session.isRunning { session.stopRunning() }
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews(); preview?.frame = view.bounds
    }

    private func configureCamera() {
        guard let device = AVCaptureDevice.default(for: .video),
              let input = try? AVCaptureDeviceInput(device: device), session.canAddInput(input) else { return }
        session.addInput(input)
        let output = AVCaptureMetadataOutput()
        guard session.canAddOutput(output) else { return }
        session.addOutput(output)
        output.setMetadataObjectsDelegate(self, queue: .main)
        output.metadataObjectTypes = [.ean8, .ean13, .upce, .code128]
        let layer = AVCaptureVideoPreviewLayer(session: session)
        layer.videoGravity = .resizeAspectFill; layer.frame = view.bounds
        view.layer.addSublayer(layer); preview = layer
    }

    private func configureOverlay() {
        let shade = UIView(); shade.translatesAutoresizingMaskIntoConstraints = false
        shade.backgroundColor = UIColor.black.withAlphaComponent(0.28); view.addSubview(shade)
        let title = UILabel(); title.translatesAutoresizingMaskIntoConstraints = false; title.text = "Scanner un produit"; title.textColor = .white; title.font = .systemFont(ofSize: 25, weight: .semibold); title.textAlignment = .center; view.addSubview(title)
        let subtitle = UILabel(); subtitle.translatesAutoresizingMaskIntoConstraints = false; subtitle.text = "Place le code-barres dans le cadre"; subtitle.textColor = UIColor.white.withAlphaComponent(0.82); subtitle.font = .systemFont(ofSize: 14); subtitle.textAlignment = .center; view.addSubview(subtitle)
        let frame = UIView(); frame.translatesAutoresizingMaskIntoConstraints = false; frame.layer.borderWidth = 2; frame.layer.borderColor = UIColor(red:0.82,green:0.68,blue:0.36,alpha:1).cgColor; frame.layer.cornerRadius = 22; view.addSubview(frame)
        let close = UIButton(type: .system); close.translatesAutoresizingMaskIntoConstraints = false; close.setTitle("Fermer", for: .normal); close.setTitleColor(.white, for: .normal); close.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold); close.addTarget(self, action: #selector(cancel), for: .touchUpInside); view.addSubview(close)
        NSLayoutConstraint.activate([
            shade.leadingAnchor.constraint(equalTo:view.leadingAnchor), shade.trailingAnchor.constraint(equalTo:view.trailingAnchor), shade.topAnchor.constraint(equalTo:view.topAnchor), shade.bottomAnchor.constraint(equalTo:view.bottomAnchor),
            title.topAnchor.constraint(equalTo:view.safeAreaLayoutGuide.topAnchor, constant:34), title.leadingAnchor.constraint(equalTo:view.leadingAnchor, constant:20), title.trailingAnchor.constraint(equalTo:view.trailingAnchor, constant:-20),
            subtitle.topAnchor.constraint(equalTo:title.bottomAnchor, constant:8), subtitle.leadingAnchor.constraint(equalTo:view.leadingAnchor, constant:20), subtitle.trailingAnchor.constraint(equalTo:view.trailingAnchor, constant:-20),
            frame.centerXAnchor.constraint(equalTo:view.centerXAnchor), frame.centerYAnchor.constraint(equalTo:view.centerYAnchor), frame.widthAnchor.constraint(equalTo:view.widthAnchor, multiplier:0.78), frame.heightAnchor.constraint(equalToConstant:190),
            close.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor, constant:-26), close.centerXAnchor.constraint(equalTo:view.centerXAnchor)
        ])
    }

    @objc private func cancel() { guard !finished else { return }; finished = true; onCancel?() }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        guard !finished, let object = metadataObjects.first as? AVMetadataMachineReadableCodeObject, let code = object.stringValue, !code.isEmpty else { return }
        finished = true; UIImpactFeedbackGenerator(style: .medium).impactOccurred(); session.stopRunning(); onCode?(code)
    }
}
