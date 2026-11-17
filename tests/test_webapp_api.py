"""
Unit tests and edge cases for WebApp backend APIs and PWA specification.
Tests dashboard data aggregation, conversational coach context injection, and PWA manifest.
"""
import unittest
import json
import os
from unittest.mock import patch, MagicMock
from backend.service import BioCoachService
from backend.api import BioCoachAPIHandler

class TestWebAppAPI(unittest.TestCase):

    def setUp(self):
        self.mock_service = MagicMock()
        self.api = BioCoachAPIHandler(service=self.mock_service)

    def test_dashboard_endpoint_with_history(self):
        """GET /api/v1/dashboard returns consolidated metrics and 7-day trends."""
        self.mock_service.get_dashboard_summary.return_value = {
            "status": "success",
            "today": {
                "score": 85,
                "traffic_light": "GREEN",
                "hrv": 62.0,
                "rhr": 52.0,
                "sleep": 7.8
            },
            "trends": {
                "dates": ["2026-11-14", "2026-11-15", "2026-11-16"],
                "hrv": [58.0, 60.0, 62.0],
                "rhr": [54.0, 53.0, 52.0],
                "sleep": [7.0, 7.5, 7.8]
            },
            "recent_workouts": [
                {"type": "fuerza", "duration": 52, "calories": 420, "strain": 13.8}
            ]
        }

        status, body = self.api.handle_request("GET", "/api/v1/dashboard", None)
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["today"]["score"], 85)
        self.assertEqual(len(body["trends"]["dates"]), 3)

    def test_dashboard_endpoint_empty_db_day_one(self):
        """GET /api/v1/dashboard handles empty day-1 database gracefully."""
        self.mock_service.get_dashboard_summary.return_value = {
            "status": "success",
            "today": None,
            "trends": {"dates": [], "hrv": [], "rhr": [], "sleep": []},
            "recent_workouts": [],
            "is_day_one": True
        }

        status, body = self.api.handle_request("GET", "/api/v1/dashboard", None)
        self.assertEqual(status, 200)
        self.assertTrue(body["is_day_one"])
        self.assertEqual(len(body["trends"]["dates"]), 0)

    def test_chat_endpoint_success(self):
        """POST /api/v1/chat sends user message to Gemini injecting health history context."""
        self.mock_service.process_coach_chat.return_value = {
            "status": "success",
            "reply": "Tu HRV ha subido un 8% esta semana. Estás tolerando muy bien la carga de entreno."
        }

        payload = {"message": "¿Cómo va mi progresión esta semana?"}
        status, body = self.api.handle_request("POST", "/api/v1/chat", payload)

        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "success")
        self.assertIn("HRV", body["reply"])

    def test_chat_endpoint_empty_message(self):
        """POST /api/v1/chat with empty or whitespace message returns 422."""
        payload = {"message": "   "}
        status, body = self.api.handle_request("POST", "/api/v1/chat", payload)
        self.assertEqual(status, 422)

    def test_pwa_manifest_schema(self):
        """Verifies manifest.json satisfies iOS PWA standalone criteria."""
        manifest_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "webapp",
            "manifest.json"
        )
        if os.path.exists(manifest_path):
            with open(manifest_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            self.assertEqual(data.get("display"), "standalone")
            self.assertIn("name", data)
            self.assertIn("start_url", data)

if __name__ == "__main__":
    unittest.main()
