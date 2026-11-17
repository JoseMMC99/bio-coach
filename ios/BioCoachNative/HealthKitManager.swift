import Foundation
import HealthKit

struct DailyHealthSummary: Identifiable {
    let id: String
    let date: Date
    let dateLabel: String
    var totalSleepHours: Double?
    var deepSleepHours: Double?
    var remSleepHours: Double?
    var restingHR: Double?
    var hrvMs: Double?
    var respiratoryRate: Double?
    var wristTempC: Double?
    var daylightMinutes: Int?
}

@MainActor
final class HealthKitManager: ObservableObject {
    private let healthStore = HKHealthStore()

    @Published var isLoading = false
    @Published var statusText = "Listo para probar conexión directa con Apple Salud."
    @Published var errorMessage: String?
    @Published var dailySummaries: [DailyHealthSummary] = []

    private var readTypes: Set<HKObjectType> {
        var types: Set<HKObjectType> = [
            HKCategoryType(.sleepAnalysis),
            HKQuantityType(.restingHeartRate),
            HKQuantityType(.heartRateVariabilitySDNN),
            HKQuantityType(.respiratoryRate),
            HKQuantityType(.appleSleepingWristTemperature),
            HKQuantityType(.timeInDaylight)
        ]
        return types
    }

    func requestAccessAndLoad() async {
        errorMessage = nil
        guard HKHealthStore.isHealthDataAvailable() else {
            errorMessage = "HealthKit no está disponible en este dispositivo."
            statusText = "Dispositivo no compatible."
            return
        }

        isLoading = true
        statusText = "Solicitando permiso de Apple Salud..."

        do {
            try await healthStore.requestAuthorization(toShare: [], read: readTypes)
            statusText = "Permiso concedido. Leyendo últimos 7 días..."
            let summaries = try await fetchLast7Days()
            self.dailySummaries = summaries
            let daysWithData = summaries.filter {
                $0.totalSleepHours != nil || $0.restingHR != nil || $0.hrvMs != nil || $0.wristTempC != nil
            }.count
            if daysWithData > 0 {
                statusText = "✅ ¡Éxito! HealthKit nativo leyó \(daysWithData) días reales directo del iPhone."
            } else {
                statusText = "⚠️ Permiso aceptado, pero no se encontraron muestras en los últimos 7 días (revisa permisos en Salud → Apps → BioCoach)."
            }
        } catch {
            errorMessage = "Error de HealthKit: \(error.localizedDescription)"
            statusText = "❌ Falló la autorización de HealthKit (posible restricción de firma/entitlement)."
        }

        isLoading = false
    }

    private func fetchLast7Days() async throws -> [DailyHealthSummary] {
        let calendar = Calendar.current
        let todayStart = calendar.startOfDay(for: Date())
        guard let startDate = calendar.date(byAdding: .day, value: -6, to: todayStart),
              let endDate = calendar.date(byAdding: .day, value: 1, to: todayStart) else {
            return []
        }

        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd"
        let displayFormatter = DateFormatter()
        displayFormatter.locale = Locale(identifier: "es_CO")
        displayFormatter.dateFormat = "EEE d MMM"

        var byDayKey: [String: DailyHealthSummary] = [:]
        var orderedKeys: [String] = []

        for offset in stride(from: 6, through: 0, by: -1) {
            if let day = calendar.date(byAdding: .day, value: -offset, to: todayStart) {
                let key = formatter.string(from: day)
                orderedKeys.append(key)
                byDayKey[key] = DailyHealthSummary(
                    id: key,
                    date: day,
                    dateLabel: displayFormatter.string(from: day).capitalized
                )
            }
        }

        // Fetch all metrics concurrently
        async let sleepMap = fetchSleepByDay(from: startDate, to: endDate, calendar: calendar, formatter: formatter)
        async let rhrMap = fetchDailyAverage(identifier: .restingHeartRate, unit: HKUnit.count().unitDivided(by: .minute()), from: startDate, to: endDate, calendar: calendar, formatter: formatter)
        async let hrvMap = fetchDailyAverage(identifier: .heartRateVariabilitySDNN, unit: HKUnit.secondUnit(with: .milli), from: startDate, to: endDate, calendar: calendar, formatter: formatter)
        async let respMap = fetchDailyAverage(identifier: .respiratoryRate, unit: HKUnit.count().unitDivided(by: .minute()), from: startDate, to: endDate, calendar: calendar, formatter: formatter)
        async let tempMap = fetchWristTemperatureByDay(from: startDate, to: endDate, calendar: calendar, formatter: formatter)
        async let daylightMap = fetchDailySum(identifier: .timeInDaylight, unit: HKUnit.minute(), from: startDate, to: endDate, calendar: calendar, formatter: formatter)

        let sleep = await sleepMap
        let rhr = await rhrMap
        let hrv = await hrvMap
        let resp = await respMap
        let temp = await tempMap
        let daylight = await daylightMap

        for key in orderedKeys {
            if let s = sleep[key] {
                byDayKey[key]?.totalSleepHours = s.total
                byDayKey[key]?.deepSleepHours = s.deep > 0 ? s.deep : nil
                byDayKey[key]?.remSleepHours = s.rem > 0 ? s.rem : nil
            }
            byDayKey[key]?.restingHR = rhr[key]
            byDayKey[key]?.hrvMs = hrv[key]
            byDayKey[key]?.respiratoryRate = resp[key]
            byDayKey[key]?.wristTempC = temp[key]
            if let mins = daylight[key] {
                byDayKey[key]?.daylightMinutes = Int(mins.rounded())
            }
        }

        // Return newest day first
        return orderedKeys.reversed().compactMap { byDayKey[$0] }
    }

    private func fetchDailyAverage(
        identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        from startDate: Date,
        to endDate: Date,
        calendar: Calendar,
        formatter: DateFormatter
    ) async -> [String: Double] {
        let type = HKQuantityType(identifier)
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        let anchorDate = calendar.startOfDay(for: startDate)
        let interval = DateComponents(day: 1)

        return await withCheckedContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .discreteAverage,
                anchorDate: anchorDate,
                intervalComponents: interval
            )
            query.initialResultsHandler = { _, results, _ in
                var map: [String: Double] = [:]
                results?.enumerateStatistics(from: startDate, to: endDate) { stats, _ in
                    if let avg = stats.averageQuantity()?.doubleValue(for: unit) {
                        let key = formatter.string(from: stats.startDate)
                        map[key] = avg
                    }
                }
                continuation.resume(returning: map)
            }
            healthStore.execute(query)
        }
    }

    private func fetchDailySum(
        identifier: HKQuantityTypeIdentifier,
        unit: HKUnit,
        from startDate: Date,
        to endDate: Date,
        calendar: Calendar,
        formatter: DateFormatter
    ) async -> [String: Double] {
        let type = HKQuantityType(identifier)
        let predicate = HKQuery.predicateForSamples(withStart: startDate, end: endDate, options: .strictStartDate)
        let anchorDate = calendar.startOfDay(for: startDate)
        let interval = DateComponents(day: 1)

        return await withCheckedContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: type,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: anchorDate,
                intervalComponents: interval
            )
            query.initialResultsHandler = { _, results, _ in
                var map: [String: Double] = [:]
                results?.enumerateStatistics(from: startDate, to: endDate) { stats, _ in
                    if let sum = stats.sumQuantity()?.doubleValue(for: unit) {
                        let key = formatter.string(from: stats.startDate)
                        map[key] = sum
                    }
                }
                continuation.resume(returning: map)
            }
            healthStore.execute(query)
        }
    }

    private func fetchWristTemperatureByDay(
        from startDate: Date,
        to endDate: Date,
        calendar: Calendar,
        formatter: DateFormatter
    ) async -> [String: Double] {
        let type = HKQuantityType(.appleSleepingWristTemperature)
        // Look back 12 extra hours so nights starting before midnight still land on waking morning endDate
        let lookbackStart = calendar.date(byAdding: .hour, value: -12, to: startDate) ?? startDate
        let predicate = HKQuery.predicateForSamples(withStart: lookbackStart, end: endDate, options: [])

        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: true)]
            ) { _, samples, _ in
                var grouped: [String: [Double]] = [:]
                if let quantitySamples = samples as? [HKQuantitySample] {
                    for sample in quantitySamples {
                        let dayKey = formatter.string(from: calendar.startOfDay(for: sample.endDate))
                        let celsius = sample.quantity.doubleValue(for: .degreeCelsius())
                        grouped[dayKey, default: []].append(celsius)
                    }
                }
                var map: [String: Double] = [:]
                for (key, values) in grouped where !values.isEmpty {
                    map[key] = values.reduce(0, +) / Double(values.count)
                }
                continuation.resume(returning: map)
            }
            healthStore.execute(query)
        }
    }

    private func fetchSleepByDay(
        from startDate: Date,
        to endDate: Date,
        calendar: Calendar,
        formatter: DateFormatter
    ) async -> [String: (total: Double, deep: Double, rem: Double)] {
        let type = HKCategoryType(.sleepAnalysis)
        // Look back 12 extra hours so sleep starting before midnight attributes cleanly to waking morning
        let lookbackStart = calendar.date(byAdding: .hour, value: -12, to: startDate) ?? startDate
        let predicate = HKQuery.predicateForSamples(withStart: lookbackStart, end: endDate, options: [])

        return await withCheckedContinuation { continuation in
            let query = HKSampleQuery(
                sampleType: type,
                predicate: predicate,
                limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: true)]
            ) { _, samples, _ in
                var totalIntervals: [String: [(Date, Date)]] = [:]
                var deepIntervals: [String: [(Date, Date)]] = [:]
                var remIntervals: [String: [(Date, Date)]] = [:]

                if let categorySamples = samples as? [HKCategorySample] {
                    for sample in categorySamples {
                        guard let stage = HKCategoryValueSleepAnalysis(rawValue: sample.value) else { continue }
                        let dayKey = formatter.string(from: calendar.startOfDay(for: sample.endDate))
                        let interval = (sample.startDate, sample.endDate)

                        switch stage {
                        case .asleepCore, .asleepUnspecified:
                            totalIntervals[dayKey, default: []].append(interval)
                        case .asleepDeep:
                            totalIntervals[dayKey, default: []].append(interval)
                            deepIntervals[dayKey, default: []].append(interval)
                        case .asleepREM:
                            totalIntervals[dayKey, default: []].append(interval)
                            remIntervals[dayKey, default: []].append(interval)
                        default:
                            // Exclude .inBed and .awake
                            break
                        }
                    }
                }

                var result: [String: (total: Double, deep: Double, rem: Double)] = [:]
                for (key, intervals) in totalIntervals {
                    let totalH = Self.mergedHours(intervals)
                    let deepH = Self.mergedHours(deepIntervals[key] ?? [])
                    let remH = Self.mergedHours(remIntervals[key] ?? [])
                    if totalH > 0 {
                        result[key] = (totalH, deepH, remH)
                    }
                }
                continuation.resume(returning: result)
            }
            healthStore.execute(query)
        }
    }

    /// Merges overlapping time intervals to prevent double-counting when multiple sources log sleep.
    private static func mergedHours(_ intervals: [(Date, Date)]) -> Double {
        guard !intervals.isEmpty else { return 0 }
        let sorted = intervals.sorted { $0.0 < $1.0 }
        var merged: [(Date, Date)] = [sorted[0]]
        for current in sorted.dropFirst() {
            let lastIndex = merged.count - 1
            if current.0 <= merged[lastIndex].1 {
                merged[lastIndex].1 = max(merged[lastIndex].1, current.1)
            } else {
                merged.append(current)
            }
        }
        let totalSeconds = merged.reduce(0.0) { $0 + $1.1.timeIntervalSince($1.0) }
        return totalSeconds / 3600.0
    }
}
