"""
Unit tests and edge cases for the BioCoach HTTP Gateway / Endpoints.
Tests HTTP request parsing, status codes, error handling, and response payloads.
"""
import unittest
from unittest.mock import patch, MagicMock
from backend.api import BioCoachAPIHandler

class TestBioCoachAPIHandler(unittest.TestCase):

    def setUp(self):
        self.mock_service = MagicMock()
        self.api = BioCoachAPIHandler(service=self.mock_service)

    def test_health_check_endpoint(self):
        """GET /health devuelve 200 y status ok."""
        status_code, body = self.api.handle_request("GET", "/health", None)
        self.assertEqual(status_code, 200)
        self.assertEqual(body["status"], "healthy")

    def test_recovery_endpoint_success(self):
        """POST /api/v1/recovery ejecuta pipeline y devuelve veredicto."""
        self.mock_service.process_morning_recovery.return_value = {
            "status": "success",
            "recovery_score": 85,
            "traffic_light": "GREEN",
            "watch_notification": "🟢 Recuperación 85%."
        }

        payload = {
            "sleep_hours": "7.8",
            "resting_hr": "53",
            "hrv_ms": "64"
        }
        status_code, body = self.api.handle_request("POST", "/api/v1/recovery", payload)

        self.assertEqual(status_code, 200)
        self.assertEqual(body["status"], "success")
        self.assertIn("watch_notification", body)

    def test_workout_endpoint_success(self):
        """POST /api/v1/workout procesa fin de entrenamiento."""
        self.mock_service.process_workout_completion.return_value = {
            "status": "success",
            "strain_score": 14.2,
            "watch_feedback": "🏋️ Entrenamiento completado."
        }

        payload = {
            "workout_type": "Fuerza",
            "duration_minutes": 55,
            "active_calories": 480,
            "avg_hr": 142,
            "max_hr": 168
        }
        status_code, body = self.api.handle_request("POST", "/api/v1/workout", payload)

        self.assertEqual(status_code, 200)
        self.assertEqual(body["status"], "success")

    def test_hr_check_endpoint_success(self):
        """POST /api/v1/hr-check procesa chequeo de palpitaciones."""
        self.mock_service.process_instant_hr_check.return_value = {
            "status": "success",
            "current_hr": 72,
            "watch_guidance": "💓 Pulso normal."
        }

        payload = {"current_hr": 72}
        status_code, body = self.api.handle_request("POST", "/api/v1/hr-check", payload)

        self.assertEqual(status_code, 200)
        self.assertEqual(body["status"], "success")

    def test_invalid_json_or_empty_body(self):
        """Petición POST sin body o con body no diccionario devuelve 400 Bad Request."""
        status_code, body = self.api.handle_request("POST", "/api/v1/recovery", None)
        self.assertEqual(status_code, 400)
        self.assertIn("error", body)

    def test_validation_error_returns_422(self):
        """Payload con datos inconsistentes devuelve 422 Unprocessable Entity."""
        payload = {"sleep_hours": "invalid_number", "resting_hr": "55"}
        status_code, body = self.api.handle_request("POST", "/api/v1/recovery", payload)
        self.assertEqual(status_code, 422)
        self.assertIn("validation_error", body)

    def test_route_not_found_returns_404(self):
        """Ruta desconocida devuelve 404 Not Found."""
        status_code, body = self.api.handle_request("POST", "/api/v1/non_existent", {})
        self.assertEqual(status_code, 404)

if __name__ == "__main__":
    unittest.main()
