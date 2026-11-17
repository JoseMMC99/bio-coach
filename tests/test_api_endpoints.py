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
        """GET /health returns 200 and healthy status."""
        status_code, body = self.api.handle_request("GET", "/health", None)
        self.assertEqual(status_code, 200)
        self.assertEqual(body["status"], "healthy")

    def test_recovery_endpoint_success(self):
        """POST /api/v1/recovery executes pipeline and returns watch notification."""
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
        """POST /api/v1/workout processes workout completion payload."""
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
        """POST /api/v1/hr-check processes instant pulse check."""
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
        """POST request without body or non-dictionary body returns 400 Bad Request."""
        status_code, body = self.api.handle_request("POST", "/api/v1/recovery", None)
        self.assertEqual(status_code, 400)
        self.assertIn("error", body)

    def test_validation_error_returns_422(self):
        """Payload with inconsistent types returns 422 Unprocessable Entity."""
        payload = {"sleep_hours": "invalid_number", "resting_hr": "55"}
        status_code, body = self.api.handle_request("POST", "/api/v1/recovery", payload)
        self.assertEqual(status_code, 422)
        self.assertIn("validation_error", body)

    def test_metabolism_endpoint_success(self):
        """POST /api/v1/metabolism returns nutrition and macro plan."""
        self.mock_service.calculate_nutrition_plan.return_value = {
            "status": "success",
            "bmr": 1750,
            "tdee": 2450,
            "target_calories": 2150,
            "goal": "cut",
            "macros": {"protein_g": 160, "carbs_g": 210, "fat_g": 65}
        }
        payload = {
            "weight_kg": 75,
            "height_cm": 175,
            "age": 26,
            "gender": "male",
            "activity_level": "moderate",
            "goal": "cut"
        }
        status_code, body = self.api.handle_request("POST", "/api/v1/metabolism", payload)
        self.assertEqual(status_code, 200)
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["target_calories"], 2150)

    def test_route_not_found_returns_404(self):
        """Unknown route returns 404 Not Found."""
        status_code, body = self.api.handle_request("POST", "/api/v1/non_existent", {})
        self.assertEqual(status_code, 404)

if __name__ == "__main__":
    unittest.main()
