import Foundation
import Capacitor
import StoreKit

@objc(InAppPurchasePlugin)
public final class InAppPurchasePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "InAppPurchasePlugin"
    public let jsName = "InAppPurchase"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "finish", returnType: CAPPluginReturnPromise)
    ]

    private var pendingTransactions: [UInt64: Transaction] = [:]

    @objc func products(_ call: CAPPluginCall) {
        let ids = call.getArray("productIds", String.self) ?? []
        Task { @MainActor in
            do {
                let products = try await Product.products(for: ids)
                call.resolve(["products": products.map { productPayload($0) }])
            } catch {
                reject(call, error, code: "STOREKIT_PRODUCTS_ERROR")
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let productId = call.getString("productId"), !productId.isEmpty else {
            call.reject("Product ID manquant.", "MISSING_PRODUCT_ID")
            return
        }
        let accountToken = call.getString("appAccountToken").flatMap(UUID.init(uuidString:))
        Task { @MainActor in
            do {
                guard let product = try await Product.products(for: [productId]).first else {
                    call.reject("Produit Apple introuvable.", "PRODUCT_NOT_FOUND")
                    return
                }
                let result: Product.PurchaseResult
                if let accountToken {
                    result = try await product.purchase(options: [.appAccountToken(accountToken)])
                } else {
                    result = try await product.purchase()
                }
                switch result {
                case .success(let verification):
                    switch verification {
                    case .verified(let transaction):
                        pendingTransactions[transaction.id] = transaction
                        call.resolve(transactionPayload(transaction, jws: verification.jwsRepresentation))
                    case .unverified(_, let error):
                        reject(call, error, code: "UNVERIFIED_TRANSACTION")
                    }
                case .pending:
                    call.resolve(["status": "pending"])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                @unknown default:
                    call.reject("Résultat d’achat inconnu.", "UNKNOWN_PURCHASE_RESULT")
                }
            } catch {
                reject(call, error, code: "STOREKIT_PURCHASE_ERROR")
            }
        }
    }

    @objc func restore(_ call: CAPPluginCall) {
        Task { @MainActor in
            do {
                try await AppStore.sync()
                var restored: [[String: Any]] = []
                for await result in Transaction.currentEntitlements {
                    guard case .verified(let transaction) = result,
                          transaction.revocationDate == nil else { continue }
                    pendingTransactions[transaction.id] = transaction
                    restored.append(transactionPayload(transaction, jws: result.jwsRepresentation))
                }
                call.resolve(["transactions": restored])
            } catch {
                reject(call, error, code: "STOREKIT_RESTORE_ERROR")
            }
        }
    }

    @objc func finish(_ call: CAPPluginCall) {
        guard let raw = call.getString("transactionId"), let id = UInt64(raw) else {
            call.reject("Transaction ID manquant.", "MISSING_TRANSACTION_ID")
            return
        }
        Task { @MainActor in
            if let transaction = pendingTransactions.removeValue(forKey: id) {
                await transaction.finish()
            }
            call.resolve(["finished": true])
        }
    }

    private func productPayload(_ product: Product) -> [String: Any] {
        [
            "id": product.id,
            "displayName": product.displayName,
            "description": product.description,
            "displayPrice": product.displayPrice,
            "price": NSDecimalNumber(decimal: product.price).doubleValue,
            "type": String(describing: product.type)
        ]
    }

    private func transactionPayload(_ transaction: Transaction, jws: String) -> [String: Any] {
        var payload: [String: Any] = [
            "status": "purchased",
            "transactionId": String(transaction.id),
            "originalTransactionId": String(transaction.originalID),
            "productId": transaction.productID,
            "purchaseDate": ISO8601DateFormatter().string(from: transaction.purchaseDate),
            "jwsRepresentation": jws
        ]
        if let token = transaction.appAccountToken { payload["appAccountToken"] = token.uuidString.lowercased() }
        if let date = transaction.revocationDate { payload["revocationDate"] = ISO8601DateFormatter().string(from: date) }
        return payload
    }

    private func reject(_ call: CAPPluginCall, _ error: Error, code: String) {
        let nsError = error as NSError
        call.reject(nsError.localizedDescription, code, nsError)
    }
}
