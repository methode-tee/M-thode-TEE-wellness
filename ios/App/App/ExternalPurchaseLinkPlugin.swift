import Foundation
import Capacitor
import StoreKit
import UIKit
import WebKit

@objc(ExternalPurchaseLinkPlugin)
public final class ExternalPurchaseLinkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ExternalPurchaseLinkPlugin"
    public let jsName = "ExternalPurchaseLink"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "canOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    private let supportedEUStorefronts: Set<String> = [
        "at", "be", "bg", "hr", "cy", "cz", "dk", "ee", "fi", "fr", "de",
        "gr", "hu", "ie", "it", "lv", "lt", "lu", "mt", "nl", "pl", "pt",
        "ro", "sk", "si", "es", "se"
    ]

    @MainActor
    private func isEligibleForExternalPurchase() async -> Bool {
        guard #available(iOS 17.4, *) else { return false }

        // Apple requires this property on iOS 18.1 and later.
        if #available(iOS 18.1, *) {
            return await ExternalPurchaseCustomLink.isEligible
        }

        // Apple documents a manual eligibility check for iOS 17.4–18.0.
        guard AppStore.canMakePayments else { return false }
        guard let storefront = await Storefront.current else { return false }
        return supportedEUStorefronts.contains(storefront.countryCode.lowercased())
    }

    @objc func canOpen(_ call: CAPPluginCall) {
        Task { @MainActor in
            let eligible = await isEligibleForExternalPurchase()
            call.resolve(["value": eligible])
        }
    }

    @objc func open(_ call: CAPPluginCall) {
        guard #available(iOS 17.4, *) else {
            call.reject("StoreKit External Purchase requires iOS 17.4 or later.", "UNSUPPORTED_IOS_VERSION")
            return
        }

        guard
            let rawURL = call.getString("url"),
            let url = URL(string: rawURL),
            url.scheme?.lowercased() == "https",
            ["methodetee.app", "www.methodetee.app"].contains(url.host?.lowercased() ?? "")
        else {
            call.reject("Invalid external purchase URL.", "INVALID_EXTERNAL_PURCHASE_URL")
            return
        }

        Task { @MainActor in
            do {
                guard await isEligibleForExternalPurchase() else {
                    call.reject(
                        "External purchases are not available for this App Store account or storefront.",
                        "EXTERNAL_PURCHASE_NOT_ELIGIBLE"
                    )
                    return
                }

                // Required Apple disclosure for a destination displayed inside the app.
                let result = try await ExternalPurchaseCustomLink.showNotice(type: .withinApp)
                switch result {
                case .continued:
                    guard let presenter = bridge?.viewController else {
                        call.reject("Unable to present the secure checkout.", "PRESENTER_UNAVAILABLE")
                        return
                    }

                    let checkoutController = ExternalPurchaseWebViewController(url: url)
                    checkoutController.modalPresentationStyle = .fullScreen
                    presenter.present(checkoutController, animated: true)
                    call.resolve(["opened": true, "presentation": "withinApp"])

                case .cancelled:
                    call.resolve(["opened": false, "cancelled": true])

                @unknown default:
                    call.resolve(["opened": false, "cancelled": true])
                }
            } catch {
                let nsError = error as NSError
                call.reject(
                    nsError.localizedDescription,
                    "STOREKIT_EXTERNAL_PURCHASE_CUSTOM_LINK_ERROR",
                    nsError
                )
            }
        }
    }
}

private final class ExternalPurchaseWebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private let initialURL: URL
    private var webView: WKWebView!

    init(url: URL) {
        self.initialURL = url
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true

        webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true

        let closeButton = UIButton(type: .system)
        closeButton.translatesAutoresizingMaskIntoConstraints = false
        closeButton.setTitle("Fermer", for: .normal)
        closeButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
        closeButton.addTarget(self, action: #selector(close), for: .touchUpInside)

        let bar = UIView()
        bar.translatesAutoresizingMaskIntoConstraints = false
        bar.backgroundColor = .systemBackground
        bar.addSubview(closeButton)

        view.addSubview(bar)
        view.addSubview(webView)

        NSLayoutConstraint.activate([
            bar.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            bar.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            bar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            bar.heightAnchor.constraint(equalToConstant: 48),

            closeButton.trailingAnchor.constraint(equalTo: bar.trailingAnchor, constant: -18),
            closeButton.centerYAnchor.constraint(equalTo: bar.centerYAnchor),

            webView.topAnchor.constraint(equalTo: bar.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])

        webView.load(URLRequest(url: initialURL))
    }

    @objc private func close() {
        dismiss(animated: true)
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }

        if url.scheme?.lowercased() == "methodetee" {
            decisionHandler(.cancel)
            dismiss(animated: true) {
                UIApplication.shared.open(url)
            }
            return
        }

        let scheme = url.scheme?.lowercased() ?? ""
        if scheme != "http" && scheme != "https" && scheme != "about" {
            decisionHandler(.cancel)
            UIApplication.shared.open(url)
            return
        }

        decisionHandler(.allow)
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if navigationAction.targetFrame == nil, let requestURL = navigationAction.request.url {
            webView.load(URLRequest(url: requestURL))
        }
        return nil
    }
}
