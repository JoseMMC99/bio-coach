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
    # 1. OPTIMAL RECOVERY SCENARIO
    # --------------------------------------------------------------------------
    def test_optimal_recovery_green(self):
        """User slept well, HRV above baseline average, low resting heart rate."""
        metrics = DailyMetrics(
            sleep_hours=8.0,
            deep_sleep_hours=1.8,
            rem_sleep_hours=2.0,
            resting_hr=52.0,
            hrv_ms=68.0, # +13% above baseline
            respiratory_rate=14.0
        )
        result = self.engine.calculate_recovery(metrics, self.default_profile)

        self.assertGreaterEqual(result.score, 80)
        self.assertEqual(result.traffic_light, "GREEN")
        self.assertEqual(result.ans_state, "PARASYMPATHETIC_DOMINANT")
        self.assertIn("óptim", result.summary.lower())

    # --------------------------------------------------------------------------
    # 2. HIGH FATIGUE / ELEVATED STRESS SCENARIO
    # --------------------------------------------------------------------------
    def test_poor_recovery_red(self):
        """Insufficient sleep, severe HRV drop (-46%), elevated resting heart rate."""
        metrics = DailyMetrics(
            sleep_hours=4.5,
            deep_sleep_hours=0.4,
            rem_sleep_hours=0.6,
            resting_hr=66.0, # +12 bpm above baseline
            hrv_ms=32.0,     # -46% below baseline
            respiratory_rate=17.5 # Elevated nocturnal respiration
        )
        result = self.engine.calculate_recovery(metrics, self.default_profile)

        self.assertLessEqual(result.score, 45)
        self.assertEqual(result.traffic_light, "RED")
        self.assertEqual(result.ans_state, "SYMPATHETIC_DOMINANT")

    # --------------------------------------------------------------------------
    # 3. EDGE CASE: DAY 1 (No prior database history)
    # --------------------------------------------------------------------------
    def test_day_one_empty_history(self):
        """No historical baseline profile. Must not crash or divide by zero."""
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
    # 4. EDGE CASE: PARTIAL OR NULL METRICS (Sensor missed HRV or sleep)
    # --------------------------------------------------------------------------
    def test_missing_hrv_metric(self):
        """Watch failed to capture HRV sample during sleep."""
        metrics = DailyMetrics(
            sleep_hours=7.5,
            resting_hr=55.0,
            hrv_ms=None
        )
        result = self.engine.calculate_recovery(metrics, self.default_profile)

        self.assertIsNotNone(result.score)
        self.assertTrue(0 <= result.score <= 100)
        self.assertTrue(result.is_partial)

    def test_missing_sleep_metric(self):
        """User slept without watch but measured pulse and HRV upon waking."""
        metrics = DailyMetrics(
            sleep_hours=None,
            resting_hr=54.0,
            hrv_ms=62.0
        )
        result = self.engine.calculate_recovery(metrics, self.default_profile)

        self.assertIsNotNone(result.score)
        self.assertTrue(result.is_partial)

    # --------------------------------------------------------------------------
    # 5. EDGE CASE: OUTLIERS AND EXTREME VALUES (Sensor artifacts)
    # --------------------------------------------------------------------------
    def test_extreme_outlier_filtering(self):
        """Biologically impossible values must be safely clamped without breaking calculation."""
        metrics = DailyMetrics(
            sleep_hours=26.0, # Over 24h
            resting_hr=240.0, # Impossible resting pulse
            hrv_ms=450.0      # Ectopic beat artifact
        )
        result = self.engine.calculate_recovery(metrics, self.default_profile)

        self.assertTrue(0 <= result.score <= 100)
        self.assertIsNotNone(result.traffic_light)

    # --------------------------------------------------------------------------
    # 6. ROLLING SLEEP DEBT ACCUMULATION
    # --------------------------------------------------------------------------
    def test_sleep_debt_accumulation(self):
        """Calculates accumulated sleep deficit against target."""
        history = [6.0, 6.5, 5.0]
        debt = self.engine.calculate_sleep_debt(history, target_hours=8.0)
        self.assertAlmostEqual(debt, 6.5, places=2)

    def test_sleep_debt_no_history(self):
        """Empty history returns zero debt safely."""
        debt = self.engine.calculate_sleep_debt([], target_hours=8.0)
        self.assertEqual(debt, 0.0)

    # --------------------------------------------------------------------------
    # 7. INSTANTANEOUS BIOLOGICAL STRESS INDEX (0 to 100)
    # --------------------------------------------------------------------------
    def test_stress_index_sedentary_spike(self):
        """Sedentary pulse at 115 bpm with suppressed HRV (20 ms) indicates high acute stress."""
        stress = self.engine.calculate_stress_index(
            current_hr=115,
            baseline_hr=54.0,
            current_hrv=20.0,
            baseline_hrv=60.0
        )
        self.assertGreaterEqual(stress.score, 70)
        self.assertIn(stress.category, ["HIGH", "SEVERE"])

    def test_stress_index_calm(self):
        """Normal resting pulse (56 bpm) and healthy HRV (65 ms) indicates low stress."""
        stress = self.engine.calculate_stress_index(
            current_hr=56,
            baseline_hr=54.0,
            current_hrv=65.0,
            baseline_hrv=60.0
        )
        self.assertLessEqual(stress.score, 30)
        self.assertEqual(stress.category, "LOW")

    # --------------------------------------------------------------------------
    # 8. WORKOUT STRAIN AND RECOVERY MODELING
    # --------------------------------------------------------------------------
    def test_intense_workout_strain(self):
        """Heavy 60-minute session with high heart rate and sluggish cardio recovery."""
        analysis = self.engine.analyze_workout(
            duration_minutes=60.0,
            avg_hr=158,
            max_hr=182,
            active_calories=650,
            recovery_hr_1min=12 # Dropped only 12 bpm (severe autonomic fatigue)
        )
        self.assertGreaterEqual(analysis.strain_score, 14.0)
        self.assertGreaterEqual(analysis.recommended_recovery_hours, 36)

    def test_light_workout_strain(self):
        """Gentle 30-minute recovery walk."""
        analysis = self.engine.analyze_workout(
            duration_minutes=30.0,
            avg_hr=92,
            max_hr=105,
            active_calories=120,
            recovery_hr_1min=32 # Rapid 32 bpm drop (strong vagal reactivation)
        )
        self.assertLessEqual(analysis.strain_score, 7.0)
        self.assertLessEqual(analysis.recommended_recovery_hours, 12)

    # --------------------------------------------------------------------------
    # 9. DAILY PILLARS BREAKDOWN AND WORST-METRIC IDENTIFICATION
    # --------------------------------------------------------------------------
    def test_pillars_bad_day_hrv_worst(self):
        """Bad day overall (RED) where HRV is the most severely impaired pillar."""
        metrics = DailyMetrics(
            sleep_hours=5.2,     # Insufficient
            resting_hr=64.0,     # Elevated (+10 bpm from baseline 54)
            hrv_ms=22.0          # Critical red (-63% drop from 60ms baseline)
        )
        pillars = self.engine.evaluate_daily_pillars(metrics, self.default_profile)

        self.assertEqual(pillars["overall_traffic_light"], "RED")
        self.assertEqual(pillars["pillars"]["hrv"]["status"], "RED")
        self.assertEqual(pillars["worst_aspect"]["pillar"], "HRV")
        self.assertIn(pillars["worst_aspect"]["severity"], ["HIGH", "CRITICAL"])
        self.assertIn("variabilidad", pillars["worst_aspect"]["detail"].lower())

    def test_pillars_bad_day_sleep_worst(self):
        """Day where Sleep is the worst metric pulling the score down."""
        metrics = DailyMetrics(
            sleep_hours=3.8,     # Red (severe deprivation)
            resting_hr=55.0,     # Green (baseline 54)
            hrv_ms=58.0          # Green (baseline 60)
        )
        pillars = self.engine.evaluate_daily_pillars(metrics, self.default_profile)

        self.assertEqual(pillars["pillars"]["sleep"]["status"], "RED")
        self.assertEqual(pillars["worst_aspect"]["pillar"], "SLEEP")
        self.assertIn("sueño", pillars["worst_aspect"]["detail"].lower())

    def test_pillars_optimal_day_all_green(self):
        """Optimal recovery day where all pillars perform within green thresholds."""
        metrics = DailyMetrics(
            sleep_hours=8.2,
            resting_hr=51.0,
            hrv_ms=68.0
        )
        pillars = self.engine.evaluate_daily_pillars(metrics, self.default_profile)

        self.assertEqual(pillars["overall_traffic_light"], "GREEN")
        self.assertEqual(pillars["pillars"]["hrv"]["status"], "GREEN")
        self.assertEqual(pillars["pillars"]["rhr"]["status"], "GREEN")
        self.assertEqual(pillars["pillars"]["sleep"]["status"], "GREEN")
        self.assertEqual(pillars["worst_aspect"]["severity"], "NONE")

if __name__ == "__main__":
    unittest.main()
