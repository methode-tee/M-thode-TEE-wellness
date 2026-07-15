import Foundation
import Capacitor
import StoreKit

@objc(ExternalPurchaseLinkPlugin)
public final class ExternalPurchaseLinkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ExternalPurchaseLinkPlugin"
    public let jsName = "ExternalPurchaseLink"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "canOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func canOpen(_ call: CAPPluginCall) {
        guard #available(iOS 15.4, *) else {
            call.resolve(["value": false, "reason": "unsupported_ios_version"])
            return
        }

        Task { @MainActor in
            let available = await ExternalPurchaseLink.canOpen
            call.resolve(["value": available])
        }
    }

    @objc func open(_ call: CAPPluginCall) {
        guard #available(iOS 15.4, *) else {
            call.reject(
                "StoreKit External Purchase Link requires iOS 15.4 or later.",
                "UNSUPPORTED_IOS_VERSION"
            )
            return
        }

        let rawURL = call.getString("url")?.trimmingCharacters(in: .whitespacesAndNewlines)

        Task { @MainActor in
            do {
                if let rawURL, !rawURL.isEmpty {
                    guard let checkoutURL = URL(string: rawURL),
                          checkoutURL.scheme == "https",
                          checkoutURL.host == "methodetee.app" else {
                        call.reject(
                            "Invalid external purchase URL.",
                            "INVALID_EXTERNAL_PURCHASE_URL"
                        )
                        return
                    }

                    if #available(iOS 17.5, *) {
                        try await self.openDynamicLink(checkoutURL)
                    } else {
                        try await ExternalPurchaseLink.open()
                    }
                } else {
                    try await ExternalPurchaseLink.open()
                }

                call.resolve(["opened": true])
            } catch {
                let nsError = error as NSError
                call.reject(
                    nsError.localizedDescription,
                    "STOREKIT_EXTERNAL_PURCHASE_LINK_ERROR",
                    nsError
                )
            }
        }
    }

    @available(iOS 17.5, *)
    @MainActor
    private func openDynamicLink(_ url: URL) async throws {
        try await ExternalPurchaseLink.open(url: url)
    }
}
