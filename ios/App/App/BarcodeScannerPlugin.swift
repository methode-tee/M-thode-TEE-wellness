import Foundation
import UIKit
import AVFoundation
import Capacitor

// UI and permission state belong to the main queue. Capture configuration,
// start and stop all belong to one serial queue owned by MTBarcodeCapture.
@objc(BarcodeScannerPlugin)
public final class BarcodeScannerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BarcodeScannerPlugin"
    public let jsName = "BarcodeScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise)
    ]
    private var pendingCall: CAPPluginCall?
    private var scanner: MTBarcodeScannerViewController?

    @objc func scan(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else {
                call.reject("Scanner indisponible.", "SCANNER_UNAVAILABLE")
                return
            }
            guard self.pendingCall == nil else {
                call.reject("Un scan est déjà en cours.", "SCANNER_BUSY")
                return
            }
            // A missing privacy key would terminate the process before Swift
            // can catch an error. Fail safely before asking AVFoundation.
            let usage = Bundle.main.object(forInfoDictionaryKey: "NSCameraUsageDescription") as? String
            guard let usage = usage, !usage.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                call.reject("Le scanner nécessite une mise à jour de l’app. Tu peux saisir le code-barres.", "CAMERA_CONFIGURATION")
                return
            }
            self.pendingCall = call
            switch AVCaptureDevice.authorizationStatus(for: .video) {
            case .authorized:
                self.presentScanner()
            case .notDetermined:
                AVCaptureDevice.requestAccess(for: .video) { [weak self] granted in
                    DispatchQueue.main.async {
                        guard let self = self else { return }
                        if granted { self.presentScanner() }
                        else { self.complete(.failure("Autorise la caméra dans Réglages, ou saisis le code-barres.", "CAMERA_DENIED")) }
                    }
                }
            case .denied, .restricted:
                self.complete(.failure("Autorise la caméra dans Réglages, ou saisis le code-barres.", "CAMERA_DENIED"))
            @unknown default:
                self.complete(.failure("La caméra n’est pas disponible. Tu peux saisir le code-barres.", "CAMERA_UNAVAILABLE"))
            }
        }
    }

    private func presentScanner() {
        dispatchPrecondition(condition: .onQueue(.main))
        guard pendingCall != nil else { return }
        guard let host = bridge?.viewController,
              host.viewIfLoaded?.window != nil,
              host.presentedViewController == nil,
              !host.isBeingDismissed else {
            complete(.failure("Reviens au Carnet puis réessaie de scanner.", "SCANNER_UNAVAILABLE"))
            return
        }
        let controller = MTBarcodeScannerViewController()
        controller.onFinish = { [weak self] result in self?.complete(result) }
        controller.modalPresentationStyle = .fullScreen
        scanner = controller
        host.present(controller, animated: true)
    }

    private func complete(_ result: MTBarcodeScanResult) {
        dispatchPrecondition(condition: .onQueue(.main))
        guard let call = pendingCall else { return }
        // Keep the lock until dismissal has completed, but detach the callback
        // now so metadata/runtime notifications cannot resolve the call twice.
        let controller = scanner
        controller?.onFinish = nil
        let resolve = { [weak self] in
            self?.scanner = nil
            self?.pendingCall = nil
            switch result {
            case .code(let code): call.resolve(["code": code])
            case .manual: call.resolve(["manual": true])
            case .cancelled: call.resolve(["cancelled": true])
            case .failure(let message, let code): call.reject(message, code)
            }
        }
        if controller?.presentingViewController != nil {
            controller?.dismiss(animated: true, completion: resolve)
        } else {
            resolve()
        }
    }
}

private enum MTBarcodeScanResult {
    case code(String)
    case manual
    case cancelled
    case failure(String, String)
}

// Keep capture work outside UIViewController's main-actor isolation. UIKit is
// touched only by the view controller; this object owns the serial AV session.
private final class MTBarcodeCapture: NSObject, AVCaptureMetadataOutputObjectsDelegate {
    let session = AVCaptureSession()
    private let sessionQueue = DispatchQueue(label: "com.methodetee.barcode.capture", qos: .userInitiated)
    private var configured = false
    private var closed = false
    private var failed = false
    private var metadata: AVCaptureMetadataOutput?
    // Installed and invoked on the main queue.
    var onReady: (() -> Void)?
    var onCode: ((String) -> Void)?
    var onFailure: ((String, String) -> Void)?

    func setWanted(_ wanted: Bool) {
        sessionQueue.async { [weak self] in
            guard let self = self else { return }
            if !wanted {
                if self.session.isRunning { self.session.stopRunning() }
                return
            }
            guard !self.closed, !self.failed else { return }
            if !self.configured, !self.configureCamera() { return }
            if !self.session.isRunning { self.session.startRunning() }
            if self.session.isRunning {
                DispatchQueue.main.async { [weak self] in self?.onReady?() }
            } else {
                self.reportFailure("La caméra n’a pas pu démarrer. Tu peux saisir le code-barres.", "CAMERA_UNAVAILABLE")
            }
        }
    }

    private func configureCamera() -> Bool {
        dispatchPrecondition(condition: .onQueue(sessionQueue))
        guard let device = AVCaptureDevice.default(.builtInWideAngleCamera, for: .video, position: .back)
                ?? AVCaptureDevice.default(for: .video) else {
            reportFailure("Aucune caméra disponible. Tu peux saisir le code-barres.", "CAMERA_UNAVAILABLE")
            return false
        }
        do {
            let input = try AVCaptureDeviceInput(device: device)
            let output = AVCaptureMetadataOutput()
            session.beginConfiguration()
            if session.canSetSessionPreset(.high) { session.sessionPreset = .high }
            guard session.canAddInput(input) else {
                session.commitConfiguration()
                reportFailure("La caméra est indisponible pour le moment.", "CAMERA_UNAVAILABLE")
                return false
            }
            session.addInput(input)
            guard session.canAddOutput(output) else {
                session.removeInput(input)
                session.commitConfiguration()
                reportFailure("Le scanner est indisponible sur cet appareil.", "SCANNER_UNAVAILABLE")
                return false
            }
            session.addOutput(output)
            session.commitConfiguration()
            // Unsupported types raise an Objective-C exception, not a Swift
            // Error. Assign only the intersection supported by this session.
            let requested: [AVMetadataObject.ObjectType] = [.ean8, .ean13, .upce, .code128, .itf14, .interleaved2of5]
            let supported = requested.filter { output.availableMetadataObjectTypes.contains($0) }
            guard !supported.isEmpty else {
                reportFailure("Le scan n’est pas disponible. Tu peux saisir le code-barres.", "SCANNER_UNSUPPORTED")
                return false
            }
            output.setMetadataObjectsDelegate(self, queue: .main)
            output.metadataObjectTypes = supported
            metadata = output
            configured = true
            return true
        } catch {
            reportFailure("Impossible d’ouvrir la caméra. Tu peux saisir le code-barres.", "CAMERA_UNAVAILABLE")
            return false
        }
    }

    func setScanRegion(_ rect: CGRect) {
        sessionQueue.async { [weak self] in
            guard let self = self, !self.closed else { return }
            self.metadata?.rectOfInterest = rect
        }
    }

    private func reportFailure(_ message: String, _ code: String) {
        failed = true
        DispatchQueue.main.async { [weak self] in self?.onFailure?(message, code) }
    }

    func close(completion: @escaping () -> Void) {
        sessionQueue.async { [self] in
            closed = true
            if session.isRunning { session.stopRunning() }
            metadata?.setMetadataObjectsDelegate(nil, queue: nil)
            DispatchQueue.main.async(execute: completion)
        }
    }

    func metadataOutput(_ output: AVCaptureMetadataOutput, didOutput metadataObjects: [AVMetadataObject], from connection: AVCaptureConnection) {
        let codes = metadataObjects.compactMap { ($0 as? AVMetadataMachineReadableCodeObject)?.stringValue }
        guard let code = codes.first(where: { $0.range(of: "^[0-9]{8,14}$", options: .regularExpression) != nil }) else { return }
        DispatchQueue.main.async { [weak self] in self?.onCode?(code) }
    }
}

private final class MTBarcodeScannerViewController: UIViewController {
    var onFinish: ((MTBarcodeScanResult) -> Void)?
    private let capture = MTBarcodeCapture()
    private var preview: AVCaptureVideoPreviewLayer?
    // UI state is read/written only on the main queue.
    private var finished = false
    private var visible = false
    private let scanFrame = UIView()
    private let shade = CAShapeLayer()
    private let subtitle = UILabel()
    private let spinner = UIActivityIndicatorView(style: .large)
    private var observers: [NSObjectProtocol] = []

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 0.06, green: 0.18, blue: 0.12, alpha: 1)
        let layer = AVCaptureVideoPreviewLayer(session: capture.session)
        layer.videoGravity = .resizeAspectFill
        view.layer.addSublayer(layer)
        preview = layer
        configureOverlay()
        capture.onReady = { [weak self] in
            guard let self = self, !self.finished else { return }
            self.spinner.stopAnimating()
            self.subtitle.text = "Place le code-barres dans le cadre"
            self.view.setNeedsLayout()
        }
        capture.onFailure = { [weak self] message, code in self?.finish(.failure(message, code)) }
        capture.onCode = { [weak self] code in
            guard let self = self, !self.finished else { return }
            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
            self.finish(.code(code))
        }
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            self?.setCaptureWanted(false)
        })
        observers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self = self, self.visible, !self.finished else { return }
            self.setCaptureWanted(true)
        })
        observers.append(center.addObserver(forName: AVCaptureSession.runtimeErrorNotification, object: capture.session, queue: .main) { [weak self] _ in
            self?.finish(.failure("La caméra s’est interrompue. Tu peux réessayer ou saisir le code-barres.", "CAMERA_INTERRUPTED"))
        })
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        visible = true
        setCaptureWanted(true)
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        visible = false
        setCaptureWanted(false)
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        preview?.frame = view.bounds
        let path = UIBezierPath(rect: view.bounds)
        path.append(UIBezierPath(roundedRect: scanFrame.frame, cornerRadius: 22))
        shade.frame = view.bounds
        shade.path = path.cgPath
        if let connection = preview?.connection, connection.isVideoOrientationSupported {
            switch view.window?.windowScene?.interfaceOrientation {
            case .landscapeLeft: connection.videoOrientation = .landscapeLeft
            case .landscapeRight: connection.videoOrientation = .landscapeRight
            case .portraitUpsideDown: connection.videoOrientation = .portraitUpsideDown
            default: connection.videoOrientation = .portrait
            }
        }
        updateScanRegion()
    }

    private func setCaptureWanted(_ wanted: Bool) {
        capture.setWanted(wanted && !finished)
    }

    private func updateScanRegion() {
        guard let preview = preview, !scanFrame.frame.isEmpty else { return }
        capture.setScanRegion(preview.metadataOutputRectConverted(fromLayerRect: scanFrame.frame))
    }

    private func configureOverlay() {
        shade.fillRule = .evenOdd
        shade.fillColor = UIColor.black.withAlphaComponent(0.55).cgColor
        view.layer.addSublayer(shade)
        let title = UILabel()
        title.text = "Scanner un produit"
        title.textColor = .white
        title.font = UIFont(name: "Georgia", size: 29) ?? .systemFont(ofSize: 29, weight: .semibold)
        title.textAlignment = .center
        title.adjustsFontSizeToFitWidth = true
        subtitle.text = "Ouverture de la caméra…"
        subtitle.textColor = UIColor.white.withAlphaComponent(0.9)
        subtitle.font = .systemFont(ofSize: 15)
        subtitle.textAlignment = .center
        subtitle.numberOfLines = 2
        subtitle.accessibilityTraits = .updatesFrequently
        scanFrame.layer.borderWidth = 2
        scanFrame.layer.borderColor = UIColor(red: 0.82, green: 0.68, blue: 0.36, alpha: 1).cgColor
        scanFrame.layer.cornerRadius = 22
        scanFrame.isUserInteractionEnabled = false
        spinner.color = .white
        spinner.hidesWhenStopped = true
        spinner.startAnimating()
        let manual = UIButton(type: .system)
        manual.setTitle("Saisir le code-barres", for: .normal)
        manual.setTitleColor(.white, for: .normal)
        manual.titleLabel?.font = .systemFont(ofSize: 16, weight: .semibold)
        manual.addTarget(self, action: #selector(useManual), for: .touchUpInside)
        let close = UIButton(type: .system)
        close.setTitle("Fermer", for: .normal)
        close.setTitleColor(.white, for: .normal)
        close.titleLabel?.font = .systemFont(ofSize: 16)
        close.accessibilityLabel = "Fermer le scanner"
        close.addTarget(self, action: #selector(cancel), for: .touchUpInside)
        let controls: [UIView] = [title, subtitle, scanFrame, spinner, manual, close]
        controls.forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        NSLayoutConstraint.activate([
            title.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 28),
            title.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            title.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20),
            subtitle.topAnchor.constraint(equalTo: title.bottomAnchor, constant: 12),
            subtitle.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            subtitle.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            scanFrame.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            scanFrame.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            scanFrame.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.78),
            scanFrame.heightAnchor.constraint(equalTo: view.heightAnchor, multiplier: 0.23),
            spinner.centerXAnchor.constraint(equalTo: scanFrame.centerXAnchor),
            spinner.centerYAnchor.constraint(equalTo: scanFrame.centerYAnchor),
            close.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -18),
            close.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            close.heightAnchor.constraint(greaterThanOrEqualToConstant: 44),
            manual.bottomAnchor.constraint(equalTo: close.topAnchor, constant: -4),
            manual.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            manual.heightAnchor.constraint(greaterThanOrEqualToConstant: 44)
        ])
    }

    @objc private func cancel() { finish(.cancelled) }
    @objc private func useManual() { finish(.manual) }

    private func finish(_ result: MTBarcodeScanResult) {
        dispatchPrecondition(condition: .onQueue(.main))
        guard !finished else { return }
        finished = true
        observers.forEach { NotificationCenter.default.removeObserver($0) }
        observers.removeAll()
        // Release the camera before resolving the JS promise or presenting
        // another sheet. Configuration/start/stop cannot overlap.
        capture.close { [weak self] in self?.onFinish?(result) }
    }

    deinit {
        observers.forEach { NotificationCenter.default.removeObserver($0) }
    }
}
