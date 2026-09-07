import Foundation
import Capacitor
import Speech
import AVFoundation

@objc(SpeechRecognitionPlugin)
public final class SpeechRecognitionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SpeechRecognitionPlugin"
    public let jsName = "SpeechRecognition"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancel", returnType: CAPPluginReturnPromise)
    ]

    private let audioEngine = AVAudioEngine()
    private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
    private var recognitionTask: SFSpeechRecognitionTask?
    private var tapInstalled = false
    private var lastTranscript = ""
    private var finalWasEmitted = false
    private var stopFallback: DispatchWorkItem?

    @objc func isAvailable(_ call: CAPPluginCall) {
        let localeIdentifier = call.getString("locale") ?? "fr-FR"
        let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeIdentifier))
        let onDeviceSupported: Bool
        if #available(iOS 13.0, *) {
            onDeviceSupported = recognizer?.supportsOnDeviceRecognition ?? false
        } else {
            onDeviceSupported = false
        }
        call.resolve([
            "available": recognizer != nil,
            "recognizerAvailable": recognizer?.isAvailable ?? false,
            "onDeviceSupported": onDeviceSupported,
            "speechAuthorization": speechAuthorizationLabel(SFSpeechRecognizer.authorizationStatus()),
            "microphoneAuthorization": microphoneAuthorizationLabel(AVAudioSession.sharedInstance().recordPermission),
            "platform": "ios"
        ])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        let group = DispatchGroup()
        let lock = NSLock()
        var speechStatus = SFSpeechRecognizer.authorizationStatus()
        var microphoneGranted = AVAudioSession.sharedInstance().recordPermission == .granted

        if speechStatus == .notDetermined {
            group.enter()
            SFSpeechRecognizer.requestAuthorization { status in
                lock.lock(); speechStatus = status; lock.unlock()
                group.leave()
            }
        }

        if AVAudioSession.sharedInstance().recordPermission == .undetermined {
            group.enter()
            AVAudioSession.sharedInstance().requestRecordPermission { granted in
                lock.lock(); microphoneGranted = granted; lock.unlock()
                group.leave()
            }
        }

        group.notify(queue: .main) {
            let speechGranted = speechStatus == .authorized
            if AVAudioSession.sharedInstance().recordPermission == .granted {
                microphoneGranted = true
            }
            call.resolve([
                "granted": speechGranted && microphoneGranted,
                "speechGranted": speechGranted,
                "microphoneGranted": microphoneGranted,
                "speechAuthorization": self.speechAuthorizationLabel(speechStatus),
                "microphoneAuthorization": self.microphoneAuthorizationLabel(AVAudioSession.sharedInstance().recordPermission)
            ])
        }
    }

    @objc func start(_ call: CAPPluginCall) {
        let localeIdentifier = call.getString("locale") ?? "fr-FR"
        let onDeviceOnly = call.getBool("onDeviceOnly") ?? true

        guard SFSpeechRecognizer.authorizationStatus() == .authorized else {
            call.reject("Autorise la reconnaissance vocale avant de parler.", "SPEECH_PERMISSION_REQUIRED")
            return
        }
        guard AVAudioSession.sharedInstance().recordPermission == .granted else {
            call.reject("Autorise le microphone avant de parler.", "MICROPHONE_PERMISSION_REQUIRED")
            return
        }
        guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: localeIdentifier)) else {
            call.reject("La reconnaissance vocale n’est pas disponible pour cette langue.", "SPEECH_UNAVAILABLE")
            return
        }
        guard recognizer.isAvailable else {
            call.reject("La reconnaissance vocale est momentanément indisponible.", "SPEECH_TEMPORARILY_UNAVAILABLE")
            return
        }
        if onDeviceOnly {
            if #available(iOS 13.0, *) {
                guard recognizer.supportsOnDeviceRecognition else {
                    call.reject("La reconnaissance locale n’est pas disponible sur cet iPhone.", "ON_DEVICE_UNAVAILABLE")
                    return
                }
            } else {
                call.reject("La reconnaissance locale nécessite une version plus récente d’iOS.", "ON_DEVICE_UNAVAILABLE")
                return
            }
        }

        cleanup(cancelTask: true, deactivateAudio: false)
        finalWasEmitted = false
        lastTranscript = ""

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.taskHint = .dictation
        if #available(iOS 13.0, *), onDeviceOnly {
            request.requiresOnDeviceRecognition = true
        }
        if #available(iOS 16.0, *) {
            request.addsPunctuation = true
        }
        recognitionRequest = request

        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: [])
            try session.setActive(true, options: .notifyOthersOnDeactivation)

            let inputNode = audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            inputNode.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
                self?.recognitionRequest?.append(buffer)
            }
            tapInstalled = true
            audioEngine.prepare()
            try audioEngine.start()
        } catch {
            cleanup(cancelTask: true)
            let nsError = error as NSError
            call.reject(nsError.localizedDescription, "AUDIO_START_ERROR", nsError)
            return
        }

        recognitionTask = recognizer.recognitionTask(with: request) { [weak self] result, error in
            guard let self else { return }
            if let result {
                let text = result.bestTranscription.formattedString.trimmingCharacters(in: .whitespacesAndNewlines)
                if !text.isEmpty {
                    self.lastTranscript = text
                    DispatchQueue.main.async {
                        self.notifyListeners("speechPartial", data: ["text": text])
                    }
                }
                if result.isFinal {
                    DispatchQueue.main.async {
                        self.emitFinalIfNeeded()
                        self.cleanup(cancelTask: false)
                    }
                    return
                }
            }
            if let error {
                DispatchQueue.main.async {
                    let nsError = error as NSError
                    // Une annulation explicite ne doit pas apparaître comme une erreur utilisateur.
                    if nsError.domain == "kAFAssistantErrorDomain" && nsError.code == 216 {
                        self.cleanup(cancelTask: false)
                        return
                    }
                    self.notifyListeners("speechError", data: [
                        "message": nsError.localizedDescription,
                        "code": String(nsError.code)
                    ])
                    self.cleanup(cancelTask: false)
                }
            }
        }

        call.resolve([
            "started": true,
            "locale": localeIdentifier,
            "onDeviceOnly": onDeviceOnly
        ])
    }

    @objc func stop(_ call: CAPPluginCall) {
        stopFallback?.cancel()
        if audioEngine.isRunning { audioEngine.stop() }
        removeTapIfNeeded()
        recognitionRequest?.endAudio()

        let fallback = DispatchWorkItem { [weak self] in
            guard let self else { return }
            self.emitFinalIfNeeded()
            self.cleanup(cancelTask: false)
        }
        stopFallback = fallback
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0, execute: fallback)
        call.resolve(["stopped": true])
    }

    @objc func cancel(_ call: CAPPluginCall) {
        cleanup(cancelTask: true)
        notifyListeners("speechCancelled", data: [:])
        call.resolve(["cancelled": true])
    }

    private func emitFinalIfNeeded() {
        guard !finalWasEmitted else { return }
        finalWasEmitted = true
        stopFallback?.cancel()
        stopFallback = nil
        let text = lastTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        notifyListeners("speechFinal", data: ["text": text])
    }

    private func removeTapIfNeeded() {
        if tapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            tapInstalled = false
        }
    }

    private func cleanup(cancelTask: Bool, deactivateAudio: Bool = true) {
        stopFallback?.cancel()
        stopFallback = nil
        if audioEngine.isRunning { audioEngine.stop() }
        removeTapIfNeeded()
        recognitionRequest?.endAudio()
        if cancelTask { recognitionTask?.cancel() }
        recognitionTask = nil
        recognitionRequest = nil
        if deactivateAudio {
            try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
        }
    }

    private func speechAuthorizationLabel(_ status: SFSpeechRecognizerAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .restricted: return "restricted"
        case .notDetermined: return "notDetermined"
        @unknown default: return "unknown"
        }
    }

    private func microphoneAuthorizationLabel(_ permission: AVAudioSession.RecordPermission) -> String {
        switch permission {
        case .granted: return "granted"
        case .denied: return "denied"
        case .undetermined: return "undetermined"
        @unknown default: return "unknown"
        }
    }
}
