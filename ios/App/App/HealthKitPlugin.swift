import Foundation
import Capacitor
import HealthKit

@objc(HealthKitPlugin)
public final class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "authorizationRequestStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readDailySummary", returnType: CAPPluginReturnPromise)
    ]

    private let healthStore = HKHealthStore()
    private let isoFormatter = ISO8601DateFormatter()

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve([
            "available": HKHealthStore.isHealthDataAvailable(),
            "readOnly": true,
            "platform": "ios"
        ])
    }

    @objc func requestAuthorization(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false, "requested": false])
            return
        }

        let categories = normalizedCategories(call.getArray("categories", String.self) ?? [])
        let readTypes = healthTypes(for: categories)
        guard !readTypes.isEmpty else {
            call.reject("Aucune catégorie Apple Santé sélectionnée.", "NO_HEALTH_TYPES")
            return
        }

        healthStore.requestAuthorization(toShare: [], read: readTypes) { success, error in
            if let error {
                DispatchQueue.main.async {
                    let nsError = error as NSError
                    call.reject(nsError.localizedDescription, "HEALTHKIT_AUTHORIZATION_ERROR", nsError)
                }
                return
            }
            DispatchQueue.main.async {
                call.resolve([
                    "available": true,
                    "requested": success,
                    "categories": Array(categories).sorted(),
                    "readOnly": true
                ])
            }
        }
    }

    @objc func authorizationRequestStatus(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false, "status": "unavailable"])
            return
        }
        let categories = normalizedCategories(call.getArray("categories", String.self) ?? [])
        let readTypes = healthTypes(for: categories)
        healthStore.getRequestStatusForAuthorization(toShare: [], read: readTypes) { status, error in
            if let error {
                DispatchQueue.main.async {
                    let nsError = error as NSError
                    call.reject(nsError.localizedDescription, "HEALTHKIT_STATUS_ERROR", nsError)
                }
                return
            }
            let label: String
            switch status {
            case .shouldRequest: label = "shouldRequest"
            case .unnecessary: label = "unnecessary"
            case .unknown: fallthrough
            @unknown default: label = "unknown"
            }
            DispatchQueue.main.async {
                call.resolve(["available": true, "status": label])
            }
        }
    }

    @objc func readDailySummary(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.resolve(["available": false])
            return
        }
        guard let dateString = call.getString("date"), let dayStart = localStartOfDay(dateString) else {
            call.reject("Date invalide. Format attendu : AAAA-MM-JJ.", "INVALID_DATE")
            return
        }

        let categories = normalizedCategories(call.getArray("categories", String.self) ?? [])
        let calendar = Calendar.current
        guard let dayEnd = calendar.date(byAdding: .day, value: 1, to: dayStart),
              let sleepStart = calendar.date(byAdding: .hour, value: -6, to: dayStart),
              let sleepEnd = calendar.date(byAdding: .hour, value: 18, to: dayStart) else {
            call.reject("Impossible de préparer la période demandée.", "DATE_RANGE_ERROR")
            return
        }

        let group = DispatchGroup()
        let lock = NSLock()
        var payload: [String: Any] = [
            "available": true,
            "date": dateString,
            "readOnly": true
        ]

        if categories.contains("sleep") {
            group.enter()
            readSleep(start: sleepStart, end: sleepEnd) { result in
                lock.lock(); payload["sleep"] = result; lock.unlock()
                group.leave()
            }
        }

        if categories.contains("activity") {
            group.enter()
            readActivity(start: dayStart, end: dayEnd) { result in
                lock.lock(); payload["activity"] = result; lock.unlock()
                group.leave()
            }
        }

        if categories.contains("body") {
            group.enter()
            readBody(asOf: dayEnd) { result in
                lock.lock(); payload["body"] = result; lock.unlock()
                group.leave()
            }
        }

        group.notify(queue: .main) {
            payload["readAt"] = self.isoFormatter.string(from: Date())
            call.resolve(payload)
        }
    }

    // MARK: - Health types

    private func normalizedCategories(_ raw: [String]) -> Set<String> {
        let allowed: Set<String> = ["sleep", "activity", "body"]
        let selected = Set(raw.map { $0.lowercased() }).intersection(allowed)
        return selected.isEmpty ? allowed : selected
    }

    private func healthTypes(for categories: Set<String>) -> Set<HKObjectType> {
        var types = Set<HKObjectType>()
        if categories.contains("sleep"), let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) {
            types.insert(type)
        }
        if categories.contains("activity") {
            if let type = HKObjectType.quantityType(forIdentifier: .stepCount) { types.insert(type) }
            if let type = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) { types.insert(type) }
            if let type = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) { types.insert(type) }
            types.insert(HKObjectType.workoutType())
        }
        if categories.contains("body") {
            if let type = HKObjectType.quantityType(forIdentifier: .bodyMass) { types.insert(type) }
            if let type = HKObjectType.quantityType(forIdentifier: .bodyFatPercentage) { types.insert(type) }
            if let type = HKObjectType.quantityType(forIdentifier: .leanBodyMass) { types.insert(type) }
            if let type = HKObjectType.quantityType(forIdentifier: .waistCircumference) { types.insert(type) }
        }
        return types
    }

    // MARK: - Sleep

    private func readSleep(start: Date, end: Date, completion: @escaping ([String: Any]) -> Void) {
        guard let type = HKObjectType.categoryType(forIdentifier: .sleepAnalysis) else {
            completion(["hasData": false]); return
        }
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { [weak self] _, samples, _ in
            guard let self else { completion(["hasData": false]); return }
            let categorySamples = (samples as? [HKCategorySample]) ?? []
            if categorySamples.isEmpty { completion(["hasData": false]); return }

            var asleep: [DateInterval] = []
            var inBed: [DateInterval] = []
            var awake: [DateInterval] = []
            var core: [DateInterval] = []
            var deep: [DateInterval] = []
            var rem: [DateInterval] = []
            var sources = Set<String>()

            for sample in categorySamples {
                let interval = DateInterval(start: sample.startDate, end: sample.endDate)
                sources.insert(sample.sourceRevision.source.name)
                let value = sample.value

                if value == HKCategoryValueSleepAnalysis.inBed.rawValue {
                    inBed.append(interval)
                }
                if value == HKCategoryValueSleepAnalysis.awake.rawValue {
                    awake.append(interval)
                }

                var isAsleep = value == HKCategoryValueSleepAnalysis.asleep.rawValue
                if #available(iOS 16.0, *) {
                    if value == HKCategoryValueSleepAnalysis.asleepCore.rawValue {
                        core.append(interval); isAsleep = true
                    } else if value == HKCategoryValueSleepAnalysis.asleepDeep.rawValue {
                        deep.append(interval); isAsleep = true
                    } else if value == HKCategoryValueSleepAnalysis.asleepREM.rawValue {
                        rem.append(interval); isAsleep = true
                    } else if value == HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue {
                        isAsleep = true
                    }
                }
                if isAsleep { asleep.append(interval) }
            }

            let mergedAsleep = self.mergeIntervals(asleep)
            guard let first = mergedAsleep.first, let last = mergedAsleep.last else {
                completion(["hasData": false, "sources": Array(sources).sorted()]); return
            }
            let mergedAwake = self.mergeIntervals(awake.filter { $0.end > first.start && $0.start < last.end })
            var out: [String: Any] = [
                "hasData": true,
                "sleepStart": self.isoFormatter.string(from: first.start),
                "sleepEnd": self.isoFormatter.string(from: last.end),
                "durationMinutes": Int(round(self.totalMinutes(mergedAsleep))),
                "awakenings": mergedAwake.filter { $0.duration >= 60 }.count,
                "awakeMinutes": Int(round(self.totalMinutes(mergedAwake))),
                "sources": Array(sources).sorted()
            ]
            let inBedMinutes = Int(round(self.totalMinutes(self.mergeIntervals(inBed))))
            if inBedMinutes > 0 { out["inBedMinutes"] = inBedMinutes }
            let coreMinutes = Int(round(self.totalMinutes(self.mergeIntervals(core))))
            let deepMinutes = Int(round(self.totalMinutes(self.mergeIntervals(deep))))
            let remMinutes = Int(round(self.totalMinutes(self.mergeIntervals(rem))))
            if coreMinutes > 0 { out["coreMinutes"] = coreMinutes }
            if deepMinutes > 0 { out["deepMinutes"] = deepMinutes }
            if remMinutes > 0 { out["remMinutes"] = remMinutes }
            completion(out)
        }
        healthStore.execute(query)
    }

    // MARK: - Activity

    private func readActivity(start: Date, end: Date, completion: @escaping ([String: Any]) -> Void) {
        let group = DispatchGroup()
        let lock = NSLock()
        var steps: Double?
        var distanceKm: Double?
        var activeEnergyKcal: Double?
        var workoutsPayload: [[String: Any]] = []

        if let type = HKObjectType.quantityType(forIdentifier: .stepCount) {
            group.enter()
            cumulativeSum(type: type, unit: .count(), start: start, end: end) { value in
                lock.lock(); steps = value; lock.unlock(); group.leave()
            }
        }
        if let type = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning) {
            group.enter()
            cumulativeSum(type: type, unit: .meter(), start: start, end: end) { value in
                lock.lock(); distanceKm = value.map { $0 / 1000.0 }; lock.unlock(); group.leave()
            }
        }
        if let type = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) {
            group.enter()
            cumulativeSum(type: type, unit: .kilocalorie(), start: start, end: end) { value in
                lock.lock(); activeEnergyKcal = value; lock.unlock(); group.leave()
            }
        }

        group.enter()
        let workoutType = HKObjectType.workoutType()
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)
        let query = HKSampleQuery(sampleType: workoutType, predicate: predicate, limit: HKObjectQueryNoLimit, sortDescriptors: [sort]) { [weak self] _, samples, _ in
            guard let self else { group.leave(); return }
            let workouts = (samples as? [HKWorkout]) ?? []
            let mapped = workouts.map { workout -> [String: Any] in
                var item: [String: Any] = [
                    "activity": self.workoutName(workout.workoutActivityType),
                    "start": self.isoFormatter.string(from: workout.startDate),
                    "end": self.isoFormatter.string(from: workout.endDate),
                    "durationMinutes": Int(round(workout.duration / 60.0)),
                    "source": workout.sourceRevision.source.name
                ]
                if let energy = workout.totalEnergyBurned?.doubleValue(for: .kilocalorie()) {
                    item["energyKcal"] = self.round1(energy)
                }
                if let distance = workout.totalDistance?.doubleValue(for: .meter()) {
                    item["distanceKm"] = self.round2(distance / 1000.0)
                }
                return item
            }
            lock.lock(); workoutsPayload = mapped; lock.unlock(); group.leave()
        }
        healthStore.execute(query)

        group.notify(queue: .global(qos: .userInitiated)) {
            let workoutMinutes = workoutsPayload.reduce(0) { $0 + (($1["durationMinutes"] as? Int) ?? 0) }
            var out: [String: Any] = [
                "hasData": steps != nil || distanceKm != nil || activeEnergyKcal != nil || !workoutsPayload.isEmpty,
                "workoutCount": workoutsPayload.count,
                "workoutMinutes": workoutMinutes,
                "workouts": workoutsPayload
            ]
            if let steps { out["steps"] = Int(round(steps)) }
            if let distanceKm { out["distanceKm"] = self.round2(distanceKm) }
            if let activeEnergyKcal { out["activeEnergyKcal"] = self.round1(activeEnergyKcal) }
            completion(out)
        }
    }

    private func cumulativeSum(type: HKQuantityType, unit: HKUnit, start: Date, end: Date, completion: @escaping (Double?) -> Void) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let query = HKStatisticsQuery(quantityType: type, quantitySamplePredicate: predicate, options: .cumulativeSum) { _, statistics, _ in
            completion(statistics?.sumQuantity()?.doubleValue(for: unit))
        }
        healthStore.execute(query)
    }

    // MARK: - Body

    private func readBody(asOf end: Date, completion: @escaping ([String: Any]) -> Void) {
        let group = DispatchGroup()
        let lock = NSLock()
        var out: [String: Any] = ["hasData": false]
        let calendar = Calendar.current
        let start = calendar.date(byAdding: .year, value: -5, to: end) ?? Date(timeIntervalSince1970: 0)

        let specs: [(String, HKQuantityTypeIdentifier, HKUnit, (Double) -> Double)] = [
            ("weightKg", .bodyMass, .gramUnit(with: .kilo), { $0 }),
            ("bodyFatPercentage", .bodyFatPercentage, .percent(), { $0 * 100.0 }),
            ("leanBodyMassKg", .leanBodyMass, .gramUnit(with: .kilo), { $0 }),
            ("waistCm", .waistCircumference, .meter(), { $0 * 100.0 })
        ]

        for (key, identifier, unit, transform) in specs {
            guard let type = HKObjectType.quantityType(forIdentifier: identifier) else { continue }
            group.enter()
            latestQuantity(type: type, unit: unit, start: start, end: end) { [weak self] sample in
                defer { group.leave() }
                guard let self, let sample else { return }
                let raw = sample.quantity.doubleValue(for: unit)
                let value = transform(raw)
                let item: [String: Any] = [
                    "value": self.round1(value),
                    "date": self.isoFormatter.string(from: sample.endDate),
                    "source": sample.sourceRevision.source.name
                ]
                lock.lock(); out[key] = item; out["hasData"] = true; lock.unlock()
            }
        }

        group.notify(queue: .global(qos: .userInitiated)) {
            completion(out)
        }
    }

    private func latestQuantity(type: HKQuantityType, unit: HKUnit, start: Date, end: Date, completion: @escaping (HKQuantitySample?) -> Void) {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let sort = NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)
        let query = HKSampleQuery(sampleType: type, predicate: predicate, limit: 1, sortDescriptors: [sort]) { _, samples, _ in
            completion((samples as? [HKQuantitySample])?.first)
        }
        healthStore.execute(query)
    }

    // MARK: - Helpers

    private func localStartOfDay(_ isoDate: String) -> Date? {
        let parts = isoDate.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    private func mergeIntervals(_ intervals: [DateInterval]) -> [DateInterval] {
        let sorted = intervals.filter { $0.duration > 0 }.sorted { $0.start < $1.start }
        guard var current = sorted.first else { return [] }
        var result: [DateInterval] = []
        for interval in sorted.dropFirst() {
            if interval.start <= current.end {
                current = DateInterval(start: current.start, end: max(current.end, interval.end))
            } else {
                result.append(current)
                current = interval
            }
        }
        result.append(current)
        return result
    }

    private func totalMinutes(_ intervals: [DateInterval]) -> Double {
        intervals.reduce(0) { $0 + $1.duration / 60.0 }
    }

    private func round1(_ value: Double) -> Double { (value * 10.0).rounded() / 10.0 }
    private func round2(_ value: Double) -> Double { (value * 100.0).rounded() / 100.0 }

    private func workoutName(_ type: HKWorkoutActivityType) -> String {
        switch type {
        case .walking: return "Marche"
        case .running: return "Course"
        case .cycling: return "Cyclisme"
        case .swimming: return "Natation"
        case .traditionalStrengthTraining: return "Musculation"
        case .functionalStrengthTraining: return "Renforcement"
        case .yoga: return "Yoga"
        case .pilates: return "Pilates"
        case .dance: return "Danse"
        case .soccer: return "Football"
        case .basketball: return "Basketball"
        case .tennis: return "Tennis"
        case .boxing: return "Boxe"
        case .hiking: return "Randonnée"
        case .highIntensityIntervalTraining: return "HIIT"
        case .mixedCardio: return "Cardio"
        case .coreTraining: return "Gainage / tronc"
        case .flexibility: return "Mobilité / stretching"
        default: return "Entraînement"
        }
    }
}
