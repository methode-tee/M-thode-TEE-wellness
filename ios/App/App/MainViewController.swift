import Capacitor

final class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(InAppPurchasePlugin())
        bridge?.registerPluginInstance(HealthKitPlugin())
        bridge?.registerPluginInstance(BarcodeScannerPlugin())
    }
}
