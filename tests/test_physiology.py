"""
Unit tests and edge case validation for the Physiology & Biometrics Engine.
Follows strict TDD: tests edge cases, missing data, day-1 conditions, and outliers.
"""
import unittest
from backend.physiology import (
    PhysiologyEngine,
    DailyMetrics,
    BaselineProfile,
    RecoveryResult,
    StressResult,
    WorkoutAnalysis
)

class TestPhysiologyEngine(unittest.TestCase):

    def setUp(self):
        self.engine = PhysiologyEngine()
        self.default_profile = BaselineProfile(
            resting_hr=54.0,
            hrv_ms=60.0,
            target_sleep_hours=8.0
        )

    # --------------------------------------------------------------------------
    # 1. ESCENARIO NORMAL Y ÓPTIMO
    # --------------------------------------------------------------------------
    def test_optimal_recovery_green(self):
        """Usuario durmió bien, HRV por encima de la media, FC en reposo baja."""
        metrics = DailyMetrics(
            sleep_hours=8.0,
            deep_sleep_hours=1.8,
            rem_sleep_hours=2.0,
            resting_hr=52.0,
            hrv_ms=68.0, # +13% sobre su base de 60
            respiratory_rate=14.0
        )
        result = self.engine.calculate_recovery(metrics, self.default_profile)

        self.assertGreaterEqual(result.score, 80)
        self.assertEqual(result.traffic_light, "GREEN")
        self.assertEqual(result.ans_state, "PARASYMPATHETIC_DOMINANT")
        self.assertIn("óptim", result.summary.lower())

    # --------------------------------------------------------------------------
    # 2. ESCENARIO DE FATIGA / ESTRÉS ELEVADO
    # --------------------------------------------------------------------------
    def test_poor_recovery_red(self):
        """Sueño insuficiente, caída severa de HRV (-40%), pulso en reposo elevado."""
        metrics = DailyMetrics(
            sleep_hours=4.5,
            deep_sleep_hours=0.4,
            rem_sleep_hours=0.6,
            resting_hr=66.0, # +12 bpm sobre su base
            hrv_ms=32.0,     # -46% bajo su base
            respiratory_rate=17.5 # Respiración nocturna elevada
        )
        result = self.engine.calculate_recovery(metrics, self.default_profile)

        self.assertLessEqual(result.score, 45)
        self.assertEqual(result.traffic_light, "RED")
        self.assertEqual(result.ans_state, "SYMPATHETIC_DOMINANT")

    # --------------------------------------------------------------------------
    # 3. EDGE CASE: DÍA 1 (Sin historial previo en base de datos)
    # --------------------------------------------------------------------------
    def test_day_one_empty_history(self):
        """Sin datos históricos (perfil sin baseline personalizada). No debe crashear ni dividir por cero."""
        empty_profile = BaselineProfile(
            resting_hr=None,
            hrv_ms=None,
            target_sleep_hours=8.0
        )
        metrics = DailyMetrics(
            sleep_hours=7.0,
            deep_sleep_hours=1.2,
            rem_sleep_hours=1.5,
            resting_hr=60.0,
            hrv_ms=50.0
        )
        result = self.engine.calculate_recovery(metrics, empty_profile)

        self.assertIsNotNone(result.score)
        self.assertTrue(0 <= result.score <= 100)
        self.assertTrue(result.is_provisional)
        self.assertIn("provisional", result.summary.lower())

    # --------------------------------------------------------------------------
    # 4. EDGE CASE: DATOS PARCIALES O NULOS (El reloj no midió HRV o sueño)
    # --------------------------------------------------------------------------
    def test_missing_hrv_metric(self):
        """El reloj no tomó muestra de HRV durante la noche."""
        metrics = DailyMetrics(
            sleep_hours=7.5,
            resting_hr=55.0,
            hrv_ms=None # Falta HRV
        )
        result = self.engine.calculate_recovery(metrics, self.default_profile)

        self.assertIsNotNone(result.score)
        self.assertTrue(0 <= result.score <= 100)
        self.assertTrue(result.is_partial)

    def test_missing_sleep_metric(self):
        """Usuario durmió sin reloj pero se midió pulso y HRV al despertar."""
        metrics = DailyMetrics(
            sleep_hours=None,
            resting_hr=54.0,
            hrv_ms=62.0
        )
        result = self.engine.calculate_recovery(metrics, self.default_profile)

        self.assertIsNotNone(result.score)
        self.assertTrue(result.is_partial)

    # --------------------------------------------------------------------------
    # 5. EDGE CASE: OUTLIERS Y VALORES EXTREMOS (Artefactos del sensor)
    # --------------------------------------------------------------------------
    def test_extreme_outlier_filtering(self):
        """Valores biológicamente aberrantes deben ser clampeados sin quebrar el cálculo."""
        metrics = DailyMetrics(
            sleep_hours=26.0, # Más de 24h
            resting_hr=240.0, # Pulso imposible en reposo
            hrv_ms=450.0      # Artefacto de latido ectópico
        )
        result = self.engine.calculate_recovery(metrics, self.default_profile)

        self.assertTrue(0 <= result.score <= 100)
        self.assertIsNotNone(result.traffic_light)

    # --------------------------------------------------------------------------
    # 6. CÁLCULO DE DEUDA DE SUEÑO (Rolling Sleep Debt)
    # --------------------------------------------------------------------------
    def test_sleep_debt_accumulation(self):
        """Calcula déficit acumulado de sueño respecto al objetivo."""
        # Meta: 8h. Últimos 3 días durmió 6h, 6.5h, 5h -> Déficit: 2h + 1.5h + 3h = 6.5h
        history = [6.0, 6.5, 5.0]
        debt = self.engine.calculate_sleep_debt(history, target_hours=8.0)
        self.assertAlmostEqual(debt, 6.5, places=2)

    def test_sleep_debt_no_history(self):
        """Historial vacío no acumula deuda errónea."""
        debt = self.engine.calculate_sleep_debt([], target_hours=8.0)
        self.assertEqual(debt, 0.0)

    # --------------------------------------------------------------------------
    # 7. ÍNDICE DE ESTRÉS BIOLÓGICO INSTANTÁNEO (0 a 100)
    # --------------------------------------------------------------------------
    def test_stress_index_sedentary_spike(self):
        """Pulso a 115 bpm sentado en reposo con HRV de 20 ms -> Estrés muy alto."""
        stress = self.engine.calculate_stress_index(
            current_hr=115,
            baseline_hr=54.0,
            current_hrv=20.0,
            baseline_hrv=60.0
        )
        self.assertGreaterEqual(stress.score, 70)
        self.assertEqual(stress.category, "HIGH")

    def test_stress_index_calm(self):
        """Pulso normal (56 bpm) y buen HRV (65 ms) -> Estrés bajo."""
        stress = self.engine.calculate_stress_index(
            current_hr=56,
            baseline_hr=54.0,
            current_hrv=65.0,
            baseline_hrv=60.0
        )
        self.assertLessEqual(stress.score, 30)
        self.assertEqual(stress.category, "LOW")

    # --------------------------------------------------------------------------
    # 8. ANÁLISIS DE ENTRENAMIENTO (Strain y Horas de Recuperación)
    # --------------------------------------------------------------------------
    def test_intense_workout_strain(self):
        """Sesión pesada de 60m con pulso medio alto y recuperación cardíaca lenta."""
        analysis = self.engine.analyze_workout(
            duration_minutes=60.0,
            avg_hr=158,
            max_hr=182,
            active_calories=650,
            recovery_hr_1min=12 # Solo bajó 12 bpm (fatiga severa)
        )
        self.assertGreaterEqual(analysis.strain_score, 14.0) # Escala Borg/Whoop tipo 0-21
        self.assertGreaterEqual(analysis.recommended_recovery_hours, 36)

    def test_light_workout_strain(self):
        """Caminata suave de 30m."""
        analysis = self.engine.analyze_workout(
            duration_minutes=30.0,
            avg_hr=92,
            max_hr=105,
            active_calories=120,
            recovery_hr_1min=32 # Bajó 32 bpm (excelente reactivación vagal)
        )
        self.assertLessEqual(analysis.strain_score, 7.0)
        self.assertLessEqual(analysis.recommended_recovery_hours, 12)

if __name__ == "__main__":
    unittest.main()
