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
            call.reject("StoreKit External Purchase Link requires iOS 15.4 or later.", "UNSUPPORTED_IOS_VERSION")
            return
        }

        Task { @MainActor in
            do {
                // Apple requires this API to be called directly following a deliberate
                // user action. StoreKit presents Apple's continuation sheet and opens
                // the storefront-specific URL configured in Info.plist.
                try await ExternalPurchaseLink.open()
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
}
