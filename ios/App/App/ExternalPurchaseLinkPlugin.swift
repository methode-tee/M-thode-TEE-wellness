import Foundation
import Capacitor
import StoreKit
import WebKit
import UIKit

@objc(ExternalPurchaseLinkPlugin)
public final class ExternalPurchaseLinkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ExternalPurchaseLinkPlugin"
    public let jsName = "ExternalPurchaseLink"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "canOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "prepareTokens", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func canOpen(_ call: CAPPluginCall) {
        guard #available(iOS 18.1, *) else {
            call.resolve(["value": false, "reason": "custom_link_requires_ios_18_1"])
            return
        }

        Task { @MainActor in
            let eligible = await ExternalPurchaseCustomLink.isEligible
            call.resolve(["value": eligible])
        }
    }

    @objc func prepareTokens(_ call: CAPPluginCall) {
        guard #available(iOS 18.1, *) else {
            call.resolve(["available": false, "reason": "custom_link_requires_ios_18_1"])
            return
        }

        Task { @MainActor in
            do {
                async let acquisitionRequest = ExternalPurchaseCustomLink.token(for: "ACQUISITION")
                async let servicesRequest = ExternalPurchaseCustomLink.token(for: "SERVICES")
                let (acquisition, services) = try await (acquisitionRequest, servicesRequest)

                var payload: [String: Any] = ["available": true]
                if let acquisition { payload["acquisitionToken"] = acquisition.value }
                if let services { payload["servicesToken"] = services.value }
                call.resolve(payload)
            } catch {
                let nsError = error as NSError
                call.reject(nsError.localizedDescription, "STOREKIT_EXTERNAL_PURCHASE_TOKEN_ERROR", nsError)
            }
        }
    }

    @objc func open(_ call: CAPPluginCall) {
        guard #available(iOS 18.1, *) else {
            call.reject("External Purchase Custom Link requires iOS 18.1 or later.", "UNSUPPORTED_IOS_VERSION")
            return
        }
        guard let rawURL = call.getString("url"), let url = URL(string: rawURL), url.scheme == "https" else {
            call.reject("A valid HTTPS checkout URL is required.", "INVALID_CHECKOUT_URL")
            return
        }

        Task { @MainActor in
            do {
                guard await ExternalPurchaseCustomLink.isEligible else {
                    call.reject("External purchases are not available for this App Store account or storefront.", "EXTERNAL_PURCHASE_NOT_ELIGIBLE")
                    return
                }

                let result = try await ExternalPurchaseCustomLink.showNotice(type: .withinApp)
                guard result == .continued else {
                    call.resolve(["opened": false, "cancelled": true])
                    return
                }

                guard let presenter = self.bridge?.viewController else {
                    call.reject("Unable to present the secure checkout.", "PRESENTER_UNAVAILABLE")
                    return
                }

                let checkout = ExternalPurchaseWebViewController(url: url)
                checkout.modalPresentationStyle = .fullScreen
                presenter.present(checkout, animated: true)
                call.resolve(["opened": true, "cancelled": false])
            } catch {
                let nsError = error as NSError
                call.reject(nsError.localizedDescription, "STOREKIT_EXTERNAL_PURCHASE_CUSTOM_LINK_ERROR", nsError)
            }
        }
    }
}

private final class ExternalPurchaseWebViewController: UIViewController, WKNavigationDelegate {
    private let initialURL: URL
    private let webView = WKWebView(frame: .zero, configuration: WKWebViewConfiguration())

    init(url: URL) {
        self.initialURL = url
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) { nil }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        webView.navigationDelegate = self
        webView.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        webView.load(URLRequest(url: initialURL))
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if url.scheme?.lowercased() == "methodetee" {
            decisionHandler(.cancel)
            dismiss(animated: true) {
                UIApplication.shared.open(url)
            }
            return
        }

        decisionHandler(.allow)
    }
}
