import Foundation
import Capacitor
import StoreKit
import UIKit

@objc(ExternalPurchaseLinkPlugin)
public final class ExternalPurchaseLinkPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "ExternalPurchaseLinkPlugin"
    public let jsName = "ExternalPurchaseLink"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "canOpen", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func canOpen(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard SKPaymentQueue.canMakePayments() else {
                call.resolve(["value": false, "reason": "payments_disabled"])
                return
            }

            let eligible = await ExternalPurchaseCustomLink.isEligible
            call.resolve(["value": eligible])
        }
    }

    @objc func open(_ call: CAPPluginCall) {
        let rawURL = call.getString("url")?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        guard let checkoutURL = URL(string: rawURL),
              checkoutURL.scheme?.lowercased() == "https",
              checkoutURL.host?.lowercased() == "methodetee.app" else {
            call.reject(
                "Invalid external purchase URL.",
                "INVALID_EXTERNAL_PURCHASE_URL"
            )
            return
        }

        Task { @MainActor in
            do {
                guard SKPaymentQueue.canMakePayments() else {
                    call.reject(
                        "Payments are disabled on this device.",
                        "PAYMENTS_DISABLED"
                    )
                    return
                }

                guard await ExternalPurchaseCustomLink.isEligible else {
                    call.reject(
                        "External purchase custom links are unavailable for this storefront or account.",
                        "EXTERNAL_PURCHASE_NOT_ELIGIBLE"
                    )
                    return
                }

                let result = try await ExternalPurchaseCustomLink.showNotice(type: .browser)

                switch result {
                case .continued:
                    let opened = await UIApplication.shared.open(checkoutURL)
                    guard opened else {
                        call.reject(
                            "The external checkout URL could not be opened.",
                            "EXTERNAL_PURCHASE_BROWSER_OPEN_FAILED"
                        )
                        return
                    }
                    call.resolve(["opened": true])

                case .cancelled:
                    call.resolve(["opened": false, "cancelled": true])

                @unknown default:
                    call.reject(
                        "Unknown StoreKit external purchase result.",
                        "UNKNOWN_EXTERNAL_PURCHASE_RESULT"
                    )
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
