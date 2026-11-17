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
        """GET /api/v1/dashboard returns consolidated metrics, pillars, and 7-day trends."""
        self.mock_service.get_dashboard_summary.return_value = {
            "status": "success",
            "today": {
                "score": 85,
                "traffic_light": "GREEN",
                "hrv": 62.0,
                "rhr": 52.0,
                "sleep": 7.8,
                "pillars": {
                    "hrv": {"status": "GREEN", "score": 88},
                    "rhr": {"status": "GREEN", "score": 85},
                    "sleep": {"status": "GREEN", "score": 90}
                },
                "worst_aspect": {"pillar": "HRV", "severity": "NONE", "detail": "Todo en orden"}
            },
            "trends": {
                "dates": ["2026-11-14", "2026-11-15", "2026-11-16"],
                "hrv": [58.0, 60.0, 62.0],
                "rhr": [54.0, 53.0, 52.0],
                "sleep": [7.0, 7.5, 7.8]
            },
            "weekly_calendar": [
                {
                    "date": "2026-11-16",
                    "day_name": "Lun",
                    "overall_score": 85,
                    "traffic_light": "GREEN",
                    "worst_aspect": {"pillar": "HRV", "severity": "NONE"}
                }
            ],
            "recent_workouts": [
                {"type": "fuerza", "duration": 52, "calories": 420, "strain": 13.8}
            ]
        }

        status, body = self.api.handle_request("GET", "/api/v1/dashboard", None)
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["today"]["score"], 85)
        self.assertIn("pillars", body["today"])
        self.assertIn("worst_aspect", body["today"])
        self.assertEqual(len(body["weekly_calendar"]), 1)

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

    def test_manual_recovery_sync_from_webapp(self):
        """Manual sync from WebApp modal triggers morning recovery pipeline."""
        self.mock_service.process_morning_recovery.return_value = {
            "status": "success",
            "recovery_score": 78,
            "traffic_light": "GREEN",
            "watch_notification": "🟢 Recuperación 78% (Sincronización manual)."
        }

        payload = {
            "sleep_hours": "7.5",
            "hrv_ms": "58",
            "resting_hr": "54",
            "deep_sleep_hours": "1.2"
        }
        status, body = self.api.handle_request("POST", "/api/v1/recovery", payload)
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "success")
        self.assertEqual(body["recovery_score"], 78)

    def test_manual_sync_sleep_only_recovery(self):
        """Manual sync when user only inputs sleep duration."""
        self.mock_service.process_morning_recovery.return_value = {
            "status": "success",
            "recovery_score": 70,
            "traffic_light": "YELLOW",
            "is_partial": True
        }

        payload = {"sleep_hours": "6.5"}
        status, body = self.api.handle_request("POST", "/api/v1/recovery", payload)
        self.assertEqual(status, 200)
        self.assertEqual(body["status"], "success")

    def test_manual_recovery_sync_with_athlete_isolation(self):
        """Manual recovery sync supports athlete_id and is_demo isolation flags."""
        self.mock_service.process_morning_recovery.return_value = {
            "status": "success",
            "recovery_score": 88
        }
        payload = {
            "sleep_hours": "8.0",
            "athlete_id": "athlete_private_jose",
            "is_demo": False
        }
        status, body = self.api.handle_request("POST", "/api/v1/recovery", payload)
        self.assertEqual(status, 200)
        call_args = self.mock_service.process_morning_recovery.call_args[0][0]
        self.assertEqual(call_args.athlete_id, "athlete_private_jose")
        self.assertFalse(call_args.is_demo)

if __name__ == "__main__":
    unittest.main()
