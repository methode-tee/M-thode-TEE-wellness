#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path.cwd()
swift_path = ROOT / "ios/App/App/InAppPurchasePlugin.swift"
js_path = ROOT / "scripts/app.js"

def fail(message: str) -> None:
    print(f"❌ {message}")
    sys.exit(1)

if not swift_path.exists():
    fail(f"Fichier introuvable : {swift_path}")
if not js_path.exists():
    fail(f"Fichier introuvable : {js_path}")

swift = swift_path.read_text(encoding="utf-8")
js = js_path.read_text(encoding="utf-8")

if "unfinishedTransaction" not in swift:
    marker = "    private var pendingTransactions: [UInt64: Transaction] = [:]\n"
    if marker not in swift:
        fail("Le point d’insertion Swift n’a pas été trouvé. Aucun fichier n’a été modifié.")

    listener_block = r'''
    private var transactionUpdatesTask: Task<Void, Never>?

    public override func load() {
        super.load()

        transactionUpdatesTask = Task { [weak self] in
            guard let self else { return }

            await self.publishUnfinishedTransactions()

            for await result in Transaction.updates {
                if Task.isCancelled { return }
                await self.publishRecoveryTransaction(result)
            }
        }
    }

    deinit {
        transactionUpdatesTask?.cancel()
    }
'''
    swift = swift.replace(marker, marker + listener_block, 1)

    marker2 = "    private func productPayload(_ product: Product) -> [String: Any] {\n"
    if marker2 not in swift:
        fail("Le second point d’insertion Swift n’a pas été trouvé. Aucun fichier n’a été modifié.")

    recovery_methods = r'''
    private func publishUnfinishedTransactions() async {
        for await result in Transaction.unfinished {
            if Task.isCancelled { return }
            await publishRecoveryTransaction(result)
        }
    }

    private func publishRecoveryTransaction(_ result: VerificationResult<Transaction>) async {
        switch result {
        case .verified(let transaction):
            await MainActor.run {
                self.pendingTransactions[transaction.id] = transaction
                self.notifyListeners(
                    "unfinishedTransaction",
                    data: self.transactionPayload(
                        transaction,
                        jws: result.jwsRepresentation
                    ),
                    retainUntilConsumed: true
                )
            }

        case .unverified(let transaction, let error):
            NSLog(
                "[InAppPurchase] Transaction inachevée non vérifiée %@ : %@",
                String(transaction.id),
                error.localizedDescription
            )
        }
    }

'''
    swift = swift.replace(marker2, recovery_methods + marker2, 1)
else:
    print("ℹ️ Le listener Swift est déjà présent : aucune duplication.")

if "mt_apple_iap_recovery_queue" not in js:
    marker_js = "window.mtRestoreApplePurchases = mtRestoreApplePurchases;\n"
    if marker_js not in js:
        fail("Le point d’insertion JavaScript n’a pas été trouvé. Aucun fichier n’a été modifié.")

    js_block = r'''

/* V236 — Filet de sécurité StoreKit 2 */
const MT_APPLE_IAP_RECOVERY_KEY = "mt_apple_iap_recovery_queue";
const mtAppleIAPRecoveryInFlight = new Set();

function mtReadAppleIAPRecoveryQueue(){
  try{
    const value = JSON.parse(localStorage.getItem(MT_APPLE_IAP_RECOVERY_KEY) || "[]");
    return Array.isArray(value) ? value.filter(tx => tx?.transactionId && tx?.productId) : [];
  }catch(e){
    return [];
  }
}

function mtWriteAppleIAPRecoveryQueue(queue){
  try{
    if(queue.length) localStorage.setItem(MT_APPLE_IAP_RECOVERY_KEY, JSON.stringify(queue));
    else localStorage.removeItem(MT_APPLE_IAP_RECOVERY_KEY);
  }catch(e){}
}

function mtQueueAppleIAPRecovery(tx){
  if(!tx?.transactionId || !tx?.productId) return;
  const queue = mtReadAppleIAPRecoveryQueue();
  const index = queue.findIndex(item => String(item.transactionId) === String(tx.transactionId));
  if(index >= 0) queue[index] = {...queue[index], ...tx};
  else queue.push(tx);
  mtWriteAppleIAPRecoveryQueue(queue);
}

async function mtProcessAppleIAPRecoveryQueue(){
  if(!mtIsIOSNativeApp() || !navigator.onLine) return;

  const plugin = mtNativeIAPPlugin();
  if(!plugin?.finish) return;

  const client = initSupabase && initSupabase();
  if(!client) return;

  const {data} = await client.auth.getSession();
  if(!data?.session?.user) return;

  const queue = mtReadAppleIAPRecoveryQueue();
  if(!queue.length) return;

  for(const tx of queue){
    const transactionId = String(tx.transactionId || "");
    if(!transactionId || mtAppleIAPRecoveryInFlight.has(transactionId)) continue;

    mtAppleIAPRecoveryInFlight.add(transactionId);
    try{
      const validation = await mtCallFunction("validate-apple-iap", {
        transaction_id: transactionId,
        product_id: tx.productId,
        purchase_type: "restore",
        item_id: null,
        signed_transaction: tx.jwsRepresentation || null
      });

      if(validation?.unlocked){
        await plugin.finish({transactionId}).catch(()=>{});
        const remaining = mtReadAppleIAPRecoveryQueue()
          .filter(item => String(item.transactionId) !== transactionId);
        mtWriteAppleIAPRecoveryQueue(remaining);
        localStorage.removeItem("mt_protocols_cache");
        localStorage.removeItem("mt_recipes_cache");
        try{
          window.dispatchEvent(new CustomEvent("mt:apple-iap-recovered", {
            detail: {transactionId, productId: tx.productId}
          }));
        }catch(e){}
      }
    }catch(error){
      console.warn("Transaction Apple conservée pour une nouvelle tentative", tx?.productId, error);
    }finally{
      mtAppleIAPRecoveryInFlight.delete(transactionId);
    }
  }
}

function mtInstallAppleIAPRecoveryListener(){
  if(!mtIsIOSNativeApp()) return false;
  const plugin = mtNativeIAPPlugin();
  if(!plugin?.addListener) return false;
  if(window.__MT_APPLE_IAP_RECOVERY_LISTENER__) return true;

  window.__MT_APPLE_IAP_RECOVERY_LISTENER__ = true;
  try{
    Promise.resolve(plugin.addListener("unfinishedTransaction", tx => {
      mtQueueAppleIAPRecovery(tx);
      mtProcessAppleIAPRecoveryQueue();
    })).catch(error => {
      window.__MT_APPLE_IAP_RECOVERY_LISTENER__ = false;
      console.warn("Listener Apple IAP indisponible", error);
    });
    return true;
  }catch(error){
    window.__MT_APPLE_IAP_RECOVERY_LISTENER__ = false;
    return false;
  }
}

[0, 300, 900, 1800].forEach(delay => {
  setTimeout(() => {
    mtInstallAppleIAPRecoveryListener();
    mtProcessAppleIAPRecoveryQueue();
  }, delay);
});

window.addEventListener("online", mtProcessAppleIAPRecoveryQueue, {passive:true});
window.addEventListener("mt:network-restored", mtProcessAppleIAPRecoveryQueue);
document.addEventListener("DOMContentLoaded", mtProcessAppleIAPRecoveryQueue);
'''
    js = js.replace(marker_js, marker_js + js_block, 1)
else:
    print("ℹ️ Le filet JavaScript est déjà présent : aucune duplication.")

swift_path.write_text(swift, encoding="utf-8")
js_path.write_text(js, encoding="utf-8")

print("✅ InAppPurchasePlugin.swift mis à jour")
print("✅ scripts/app.js mis à jour")
