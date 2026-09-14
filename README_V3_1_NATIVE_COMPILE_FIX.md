# TEE Photo Vision V3.1 — Native compile fix

This patch replaces ONLY:
- ios/App/App/FoodVisionPlugin.swift

Purpose:
- break complex Swift collection chains into simple imperative steps so Xcode can type-check them reliably;
- keep the V3 behavior unchanged;
- keep VNClassifyImageRequest without imageCropAndScaleOption;
- preserve local Apple Vision + saliency + OCR + library parity.

After upload:
1. git pull --rebase origin main
2. npx cap sync ios
3. npx cap open ios
4. Product > Clean Build Folder if needed, then Build/Run.

The HealthKitPlugin immutable `self` warning is unrelated and non-blocking.
