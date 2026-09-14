import Foundation
import UIKit
import Vision
import Capacitor

@objc(FoodVisionPlugin)
public final class FoodVisionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "FoodVisionPlugin"
    public let jsName = "FoodVision"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "analyze", returnType: CAPPluginReturnPromise)
    ]

    private let visionQueue = DispatchQueue(label: "com.methodetee.foodvision", qos: .userInitiated)

    @objc func isAvailable(_ call: CAPPluginCall) {
        if #available(iOS 15.0, *) {
            call.resolve([
                "available": true,
                "platform": "ios",
                "engine": "apple_vision_v3",
                "onDevice": true,
                "cloudUsed": false,
                "classification": true,
                "saliency": true,
                "ocr": true
            ])
        } else {
            call.resolve([
                "available": false,
                "platform": "ios",
                "engine": "apple_vision_v3",
                "onDevice": true,
                "cloudUsed": false
            ])
        }
    }

    @objc func analyze(_ call: CAPPluginCall) {
        guard #available(iOS 15.0, *) else {
            call.reject("La reconnaissance photo locale nécessite iOS 15 ou une version plus récente.", "VISION_UNAVAILABLE")
            return
        }

        guard let raw = call.getString("imageBase64"), !raw.isEmpty else {
            call.reject("La photo est vide.", "VISION_IMAGE_REQUIRED")
            return
        }

        let payload = raw.contains(",") ? String(raw.split(separator: ",", maxSplits: 1).last ?? "") : raw
        guard let data = Data(base64Encoded: payload, options: .ignoreUnknownCharacters),
              let image = UIImage(data: data) else {
            call.reject("La photo n’a pas pu être lue.", "VISION_IMAGE_INVALID")
            return
        }

        let maxResults = max(12, min(call.getInt("maxResults") ?? 42, 72))
        let useSaliency = call.getBool("useSaliency") ?? true
        let useOCR = call.getBool("useOCR") ?? true

        visionQueue.async { [weak self] in
            guard let self else { return }
            do {
                let output = try self.analyzeImage(
                    image,
                    maxResults: maxResults,
                    useSaliency: useSaliency,
                    useOCR: useOCR
                )
                DispatchQueue.main.async {
                    call.resolve(output)
                }
            } catch {
                let nsError = error as NSError
                DispatchQueue.main.async {
                    call.reject(nsError.localizedDescription, "VISION_ANALYSIS_FAILED", nsError)
                }
            }
        }
    }

    @available(iOS 15.0, *)
    private func analyzeImage(
        _ image: UIImage,
        maxResults: Int,
        useSaliency: Bool,
        useOCR: Bool
    ) throws -> [String: Any] {
        guard let cgImage = normalizedCGImage(image) else {
            throw NSError(
                domain: "FoodVision",
                code: 1,
                userInfo: [NSLocalizedDescriptionKey: "La photo n’a pas pu être préparée."]
            )
        }

        var observations: [[String: Any]] = []
        observations.append(contentsOf: try classify(cgImage, source: "full", regionIndex: nil, limit: 20))

        var regionsAnalyzed = 0
        if useSaliency {
            let saliency = VNGenerateAttentionBasedSaliencyImageRequest()
            let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
            try handler.perform([saliency])

            var boxes: [CGRect] = []
            if let firstResult = saliency.results?.first,
               let salientObjects = firstResult.salientObjects {
                for object in salientObjects {
                    let box = object.boundingBox
                    let area = box.width * box.height
                    if area >= 0.02 && area <= 0.92 {
                        boxes.append(box)
                    }
                }
            }
            boxes.sort { lhs, rhs in
                let lhsArea = lhs.width * lhs.height
                let rhsArea = rhs.width * rhs.height
                return lhsArea > rhsArea
            }
            if boxes.count > 6 {
                boxes = Array(boxes.prefix(6))
            }

            for (index, box) in boxes.enumerated() {
                guard let cropped = crop(cgImage, normalizedRect: box, padding: 0.10) else { continue }
                observations.append(contentsOf: try classify(cropped, source: "region", regionIndex: index, limit: 12))
                regionsAnalyzed += 1
            }
        }

        let labels = mergeLabels(observations, maxResults: maxResults)
        let texts = useOCR ? recognizeText(cgImage, limit: 12) : []

        return [
            "available": true,
            "engine": "apple_vision_v3",
            "onDevice": true,
            "cloudUsed": false,
            "regionsAnalyzed": regionsAnalyzed,
            "labels": labels,
            "texts": texts
        ]
    }

    @available(iOS 15.0, *)
    private func classify(
        _ image: CGImage,
        source: String,
        regionIndex: Int?,
        limit: Int
    ) throws -> [[String: Any]] {
        let request = VNClassifyImageRequest()
        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        try handler.perform([request])

        var rows: [[String: Any]] = []
        let results = request.results ?? []
        for observation in results {
            guard observation.confidence >= 0.02 else { continue }
            var row: [String: Any] = [
                "label": observation.identifier,
                "confidence": Double(observation.confidence),
                "source": source
            ]
            if let regionIndex = regionIndex {
                row["regionIndex"] = regionIndex
            }
            rows.append(row)
            if rows.count >= limit { break }
        }
        return rows
    }

    @available(iOS 13.0, *)
    private func recognizeText(_ image: CGImage, limit: Int) -> [[String: Any]] {
        let request = VNRecognizeTextRequest()
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true
        request.minimumTextHeight = 0.025
        if #available(iOS 16.0, *) {
            request.recognitionLanguages = ["fr-FR", "en-US"]
            request.automaticallyDetectsLanguage = true
        } else {
            request.recognitionLanguages = ["fr-FR", "en-US"]
        }

        let handler = VNImageRequestHandler(cgImage: image, options: [:])
        do {
            try handler.perform([request])
        } catch {
            return []
        }

        var rows: [[String: Any]] = []
        let results = request.results ?? []
        for observation in results {
            guard let best = observation.topCandidates(1).first else { continue }
            let value = best.string.trimmingCharacters(in: .whitespacesAndNewlines)
            guard value.count >= 3 else { continue }
            rows.append([
                "text": value,
                "confidence": Double(best.confidence),
                "source": "ocr"
            ])
        }
        rows.sort { lhs, rhs in
            let lhsConfidence = (lhs["confidence"] as? Double) ?? 0
            let rhsConfidence = (rhs["confidence"] as? Double) ?? 0
            return lhsConfidence > rhsConfidence
        }
        if rows.count > limit {
            rows = Array(rows.prefix(limit))
        }
        return rows
    }

    private func mergeLabels(_ rows: [[String: Any]], maxResults: Int) -> [[String: Any]] {
        var merged: [String: [String: Any]] = [:]
        for row in rows {
            guard let label = row["label"] as? String,
                  let confidence = row["confidence"] as? Double else { continue }
            let key = label.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            if let previous = merged[key],
               let old = previous["confidence"] as? Double,
               old >= confidence {
                continue
            }
            merged[key] = row
        }

        var values = Array(merged.values)
        values.sort { lhs, rhs in
            let lhsConfidence = (lhs["confidence"] as? Double) ?? 0
            let rhsConfidence = (rhs["confidence"] as? Double) ?? 0
            return lhsConfidence > rhsConfidence
        }
        if values.count > maxResults {
            values = Array(values.prefix(maxResults))
        }
        return values
    }

    private func normalizedCGImage(_ image: UIImage) -> CGImage? {
        if image.imageOrientation == .up, let cg = image.cgImage {
            return cg
        }

        let size = image.size
        guard size.width > 0, size.height > 0 else { return nil }
        let format = UIGraphicsImageRendererFormat.default()
        format.scale = 1
        format.opaque = true
        let normalized = UIGraphicsImageRenderer(size: size, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: size))
        }
        return normalized.cgImage
    }

    private func crop(_ image: CGImage, normalizedRect: CGRect, padding: CGFloat) -> CGImage? {
        let width = CGFloat(image.width)
        let height = CGFloat(image.height)

        var r = normalizedRect
        let dx = r.width * padding
        let dy = r.height * padding
        r = r.insetBy(dx: -dx, dy: -dy)
        r.origin.x = max(0, min(1, r.origin.x))
        r.origin.y = max(0, min(1, r.origin.y))
        r.size.width = max(0, min(1 - r.origin.x, r.size.width))
        r.size.height = max(0, min(1 - r.origin.y, r.size.height))

        let pixelRect = CGRect(
            x: r.minX * width,
            y: (1 - r.maxY) * height,
            width: r.width * width,
            height: r.height * height
        ).integral

        guard pixelRect.width >= 24, pixelRect.height >= 24 else { return nil }
        return image.cropping(to: pixelRect)
    }
}
