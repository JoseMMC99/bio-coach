"""
Integration and pipeline tests for the BioCoach Service layer.
Tests database queries, rolling baseline extraction, and payload generation.
"""
import unittest
from unittest.mock import patch, MagicMock
from backend.service import BioCoachService
from backend.physiology import DailyMetrics

class TestBioCoachService(unittest.TestCase):

    def setUp(self):
        self.service = BioCoachService(
            supabase_url="https://mock.supabase.co",
            supabase_key="mock_key",
            gemini_key="mock_gemini_key"
        )

    @patch("backend.service.BioCoachService._fetch_recent_history")
    @patch("backend.service.BioCoachService._save_recovery_record")
    @patch("backend.orchestrator.GeminiOrchestrator.generate_morning_verdict")
    def test_pipeline_morning_recovery_with_history(self, mock_gemini, mock_save, mock_history):
        """End-to-end morning pipeline: fetches 3 prior days, computes baseline and outputs verdict."""
        # Mock 3 prior days of historical records in Supabase
        mock_history.return_value = [
            {"recorded_date": "2026-11-15", "hrv_ms": 60.0, "resting_hr": 54.0, "sleep_hours": 7.5},
            {"recorded_date": "2026-11-14", "hrv_ms": 58.0, "resting_hr": 55.0, "sleep_hours": 7.0},
            {"recorded_date": "2026-11-13", "hrv_ms": 62.0, "resting_hr": 53.0, "sleep_hours": 8.0},
        ]
        mock_save.return_value = {"id": 10}

        mock_verdict = MagicMock()
        mock_verdict.watch_summary = "🟢 Recuperación 85%. Excelente día para entrenar."
        mock_verdict.traffic_light = "GREEN"
        mock_verdict.is_fallback = False
        mock_gemini.return_value = mock_verdict

        today_metrics = DailyMetrics(
            sleep_hours=8.0,
            resting_hr=52.0,
            hrv_ms=64.0
        )

        response = self.service.process_morning_recovery(today_metrics, target_date="2026-11-16")

        self.assertEqual(response["status"], "success")
        self.assertEqual(response["traffic_light"], "GREEN")
        self.assertIn("85%", response["watch_notification"])
        self.assertEqual(response["rolling_days_used"], 3)
        self.assertFalse(response["is_provisional"])

    @patch("backend.service.BioCoachService._fetch_recent_history")
    @patch("backend.service.BioCoachService._save_recovery_record")
    @patch("backend.orchestrator.GeminiOrchestrator.generate_morning_verdict")
    def test_pipeline_morning_recovery_day_one(self, mock_gemini, mock_save, mock_history):
        """Pipeline behavior on Day 1 without historical database records."""
        mock_history.return_value = [] # Zero prior records
        mock_save.return_value = {"id": 1}

        mock_verdict = MagicMock()
        mock_verdict.watch_summary = "🟡 Recuperación 70% (Provisional)."
        mock_verdict.traffic_light = "YELLOW"
        mock_gemini.return_value = mock_verdict

        today_metrics = DailyMetrics(
            sleep_hours=7.0,
            resting_hr=60.0,
            hrv_ms=50.0
        )

        response = self.service.process_morning_recovery(today_metrics, target_date="2026-11-16")

        self.assertEqual(response["status"], "success")
        self.assertTrue(response["is_provisional"])
        self.assertEqual(response["rolling_days_used"], 0)

    @patch("backend.service.BioCoachService._save_hr_checkin")
    def test_pipeline_instant_hr_check_anxiety_vs_real(self, mock_save):
        """On-demand pulse check: discriminates safe pulse vs acute tachycardia."""
        mock_save.return_value = {"id": 5}

        # Case 1: Pulse 65 bpm with baseline 55 bpm (Subjective sensation / safe rhythm)
        normal_check = self.service.process_instant_hr_check(
            current_hr=65,
            baseline_rhr=55.0,
            user_sensation="Siento el corazón acelerado"
        )
        self.assertIn("normal", normal_check["watch_guidance"].lower())
        self.assertEqual(normal_check["stress_category"], "LOW")

        # Case 2: Pulse 118 bpm sedentary at rest (Acute real tachycardia)
        high_check = self.service.process_instant_hr_check(
            current_hr=118,
            baseline_rhr=55.0,
            user_sensation="Palpitaciones en el pecho"
        )
        self.assertIn("respiración", high_check["watch_guidance"].lower())
        self.assertIn(high_check["stress_category"], ["HIGH", "SEVERE"])

    @patch("backend.service.BioCoachService._fetch_recent_workouts")
    @patch("backend.service.BioCoachService._fetch_recent_history")
    def test_dashboard_summary_includes_weekly_calendar_and_worst_pillar(self, mock_hist, mock_wk):
        """Dashboard summary generates 7-day calendar matrix and highlights worst pillar."""
        mock_hist.return_value = [
            {"recorded_date": "2026-11-16", "hrv_ms": 25.0, "resting_hr": 65.0, "sleep_hours": 5.5, "recovery_score": 42},
            {"recorded_date": "2026-11-15", "hrv_ms": 60.0, "resting_hr": 53.0, "sleep_hours": 8.0, "recovery_score": 88}
        ]
        mock_wk.return_value = []

        summary = self.service.get_dashboard_summary(days=7)
        self.assertEqual(summary["status"], "success")
        self.assertFalse(summary["is_day_one"])
        self.assertEqual(len(summary["weekly_calendar"]), 2)

        # Check worst aspect of latest bad day (2026-11-16)
        today = summary["today"]
        self.assertEqual(today["worst_aspect"]["pillar"], "HRV")
        self.assertIn(today["worst_aspect"]["severity"], ["HIGH", "CRITICAL"])
        self.assertIn("variabilidad", today["worst_aspect"]["detail"].lower())

    def test_calculate_nutrition_plan_service(self):
        """Service layer calculates complete metabolic and macro target."""
        payload = {
            "weight_kg": 70,
            "height_cm": 172,
            "age": 28,
            "gender": "male",
            "activity_level": "moderate",
            "goal": "cut"
        }
        res = self.service.calculate_nutrition_plan(payload)
        self.assertEqual(res["status"], "success")
        self.assertGreater(res["bmr"], 1400)
        self.assertGreater(res["tdee"], res["bmr"])
        self.assertEqual(res["target_calories"], res["tdee"] - 400)
        self.assertGreater(res["macros"]["protein_g"], 130)

if __name__ == "__main__":
    unittest.main()
