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
        """Pipeline completo: lee 3 días previos, calcula línea base móvil y emite veredicto."""
        # Simular 3 días previos de historial en Supabase
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
        """Pipeline cuando no hay historial (Día 1): usa defaults poblacionales."""
        mock_history.return_value = [] # Cero registros previos
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
        """Pipeline de chequeo de palpitaciones: compara pulso contra reposo de 54 bpm."""
        mock_save.return_value = {"id": 5}

        # Caso: Pulso a 65 bpm con reposo de 55 bpm (Sensación subjetiva / no taquicardia)
        normal_check = self.service.process_instant_hr_check(
            current_hr=65,
            baseline_rhr=55.0,
            user_sensation="Siento el corazón acelerado"
        )
        self.assertIn("normal", normal_check["watch_guidance"].lower())
        self.assertEqual(normal_check["stress_category"], "LOW")

        # Caso: Pulso a 118 bpm sentado en reposo (Estrés real agudo)
        high_check = self.service.process_instant_hr_check(
            current_hr=118,
            baseline_rhr=55.0,
            user_sensation="Palpitaciones en el pecho"
        )
        self.assertIn("respiración", high_check["watch_guidance"].lower())
        self.assertIn(high_check["stress_category"], ["HIGH", "SEVERE"])

if __name__ == "__main__":
    unittest.main()
