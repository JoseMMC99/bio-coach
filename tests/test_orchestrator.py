"""
Unit tests and edge case validation for the Gemini Orchestrator.
Tests prompt generation, rolling context injection, response formatting, and offline fallbacks.
"""
import unittest
from unittest.mock import patch, MagicMock
from backend.orchestrator import GeminiOrchestrator, OrchestratorContext
from backend.physiology import RecoveryResult, BaselineProfile, DailyMetrics

class TestGeminiOrchestrator(unittest.TestCase):

    def setUp(self):
        self.orchestrator = GeminiOrchestrator(api_key="test_mock_key")
        self.sample_metrics = DailyMetrics(
            sleep_hours=7.5,
            deep_sleep_hours=1.5,
            rem_sleep_hours=1.8,
            resting_hr=54.0,
            hrv_ms=62.0
        )
        self.sample_recovery = RecoveryResult(
            score=82,
            traffic_light="GREEN",
            ans_state="PARASYMPATHETIC_DOMINANT",
            summary="Recuperación óptima.",
            is_provisional=False,
            is_partial=False
        )
        self.sample_profile = BaselineProfile(
            resting_hr=54.0,
            hrv_ms=60.0,
            target_sleep_hours=8.0
        )

    def test_build_morning_prompt_contains_metrics(self):
        """El prompt debe contener los números calculados de forma clara."""
        ctx = OrchestratorContext(
            recovery=self.sample_recovery,
            metrics=self.sample_metrics,
            profile=self.sample_profile,
            sleep_debt_hours=1.2,
            user_goals="Hipertrofia y rendimiento cardiovascular"
        )
        prompt = self.orchestrator.build_morning_prompt(ctx)

        self.assertIn("82", prompt) # Score
        self.assertIn("GREEN", prompt)
        self.assertIn("62.0", prompt) # HRV
        self.assertIn("1.2", prompt) # Sleep debt
        self.assertIn("Hipertrofia", prompt)

    def test_day_one_prompt_flags_provisional(self):
        """Cuando es el día 1, el prompt debe avisarle a Gemini que no hay historial previo."""
        provisional_recovery = RecoveryResult(
            score=70,
            traffic_light="YELLOW",
            ans_state="BALANCED",
            summary="Línea base provisional.",
            is_provisional=True,
            is_partial=False
        )
        ctx = OrchestratorContext(
            recovery=provisional_recovery,
            metrics=self.sample_metrics,
            profile=BaselineProfile(resting_hr=None, hrv_ms=None),
            sleep_debt_hours=0.0
        )
        prompt = self.orchestrator.build_morning_prompt(ctx)

        self.assertIn("provisional", prompt.lower())

    @patch("backend.orchestrator.GeminiOrchestrator._call_gemini_api")
    def test_generate_morning_verdict_success(self, mock_api):
        """Verifica que el orquestador formatea correctamente la respuesta de Gemini."""
        mock_api.return_value = (
            "🟢 Sistema en verde (Recuperación 82%).\n"
            "Hoy: Día excelente para sesión pesada de piernas o series de velocidad.\n"
            "Consejo: Prioriza hidratación con electrolitos por la mañana."
        )

        ctx = OrchestratorContext(
            recovery=self.sample_recovery,
            metrics=self.sample_metrics,
            profile=self.sample_profile,
            sleep_debt_hours=0.0
        )
        verdict = self.orchestrator.generate_morning_verdict(ctx)

        self.assertIn("82%", verdict.watch_summary)
        self.assertTrue(len(verdict.watch_summary) <= 300) # Adecuado para pantalla de reloj
        self.assertEqual(verdict.traffic_light, "GREEN")

    @patch("backend.orchestrator.GeminiOrchestrator._call_gemini_api")
    def test_offline_fallback_on_api_error(self, mock_api):
        """Si Gemini falla o la red cae, el orquestador debe dar un veredicto algorítmico local."""
        mock_api.side_effect = Exception("HTTP 503 Service Unavailable")

        ctx = OrchestratorContext(
            recovery=self.sample_recovery,
            metrics=self.sample_metrics,
            profile=self.sample_profile,
            sleep_debt_hours=0.0
        )
        verdict = self.orchestrator.generate_morning_verdict(ctx)

        self.assertIsNotNone(verdict)
        self.assertIn("82", verdict.watch_summary)
        self.assertTrue(verdict.is_fallback)

if __name__ == "__main__":
    unittest.main()
