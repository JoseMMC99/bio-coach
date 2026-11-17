import SwiftUI

struct ContentView: View {
    @StateObject private var healthManager = HealthKitManager()

    var body: some View {
        NavigationStack {
            ZStack {
                Color(red: 0.04, green: 0.06, blue: 0.11).ignoresSafeArea()

                ScrollView {
                    VStack(spacing: 16) {
                        // Header Status Card
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Image(systemName: "heart.text.square.fill")
                                    .font(.title2)
                                    .foregroundStyle(.cyan)
                                Text("BioCoach Nativo (PoC HealthKit)")
                                    .font(.headline)
                                    .foregroundStyle(.white)
                            }

                            Text(healthManager.statusText)
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            if let err = healthManager.errorMessage {
                                Text(err)
                                    .font(.caption)
                                    .padding(10)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                                    .background(Color.red.opacity(0.18))
                                    .foregroundStyle(.red)
                                    .clipShape(RoundedRectangle(cornerRadius: 10))
                            }

                            Button {
                                Task {
                                    await healthManager.requestAccessAndLoad()
                                }
                            } label: {
                                HStack {
                                    if healthManager.isLoading {
                                        ProgressView()
                                            .tint(.black)
                                    } else {
                                        Image(systemName: "arrow.triangle.2.circlepath")
                                    }
                                    Text(healthManager.isLoading ? "Leyendo Apple Salud..." : "Conectar y Leer Apple Health (7 días)")
                                        .fontWeight(.bold)
                                }
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 12)
                                .background(Color.cyan)
                                .foregroundStyle(.black)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                            .disabled(healthManager.isLoading)
                        }
                        .padding(16)
                        .background(Color.white.opacity(0.06))
                        .clipShape(RoundedRectangle(cornerRadius: 18))
                        .overlay(
                            RoundedRectangle(cornerRadius: 18)
                                .stroke(Color.white.opacity(0.1), lineWidth: 1)
                        )

                        // Daily Cards
                        ForEach(healthManager.dailySummaries) { day in
                            DayCardView(day: day)
                        }
                    }
                    .padding()
                }
            }
            .navigationTitle("BioCoach AI")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct DayCardView: View {
    let day: DailyHealthSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text(day.dateLabel)
                    .font(.headline)
                    .foregroundStyle(.white)
                Spacer()
                Text(day.id)
                    .font(.caption.monospaced())
                    .foregroundStyle(.secondary)
            }

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 10) {
                MetricTile(
                    title: "Sueño",
                    value: day.totalSleepHours.map { String(format: "%.2f h", $0) } ?? "--",
                    subtitle: sleepBreakdown(day),
                    color: .indigo
                )
                MetricTile(
                    title: "FC Reposo",
                    value: day.restingHR.map { String(format: "%.0f lpm", $0) } ?? "--",
                    subtitle: "Promedio",
                    color: .pink
                )
                MetricTile(
                    title: "VFC (HRV)",
                    value: day.hrvMs.map { String(format: "%.1f ms", $0) } ?? "--",
                    subtitle: "SDNN",
                    color: .green
                )
                MetricTile(
                    title: "Respiración",
                    value: day.respiratoryRate.map { String(format: "%.1f rpm", $0) } ?? "--",
                    subtitle: "Promedio",
                    color: .teal
                )
                MetricTile(
                    title: "Temp. Muñeca",
                    value: day.wristTempC.map { String(format: "%.2f °C", $0) } ?? "--",
                    subtitle: "Celsius real",
                    color: .orange
                )
                MetricTile(
                    title: "Luz Solar",
                    value: day.daylightMinutes.map { "\($0) min" } ?? "--",
                    subtitle: "Diario",
                    color: .yellow
                )
            }
        }
        .padding(14)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
    }

    private func sleepBreakdown(_ day: DailyHealthSummary) -> String {
        let d = day.deepSleepHours.map { String(format: "P:%.1f", $0) }
        let r = day.remSleepHours.map { String(format: "R:%.1f", $0) }
        let parts = [d, r].compactMap { $0 }
        return parts.isEmpty ? "Asleep" : parts.joined(separator: " ")
    }
}

struct MetricTile: View {
    let title: String
    let value: String
    let subtitle: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline.bold())
                .foregroundStyle(value == "--" ? .secondary : color)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(.gray)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(Color.black.opacity(0.25))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }
}
