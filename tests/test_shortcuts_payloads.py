"""
Unit tests and edge cases for Apple Shortcuts payloads and data validation.
Tests strict type coercion (strings to float, comma decimals), missing fields, and sanitization.
"""
import unittest
from backend.payload_validator import (
    ShortcutPayloadValidator,
    ValidationError
)

class TestShortcutPayloadValidator(unittest.TestCase):

    def setUp(self):
        self.validator = ShortcutPayloadValidator()

    # --------------------------------------------------------------------------
    # 1. MORNING RECOVERY PAYLOAD
    # --------------------------------------------------------------------------
    def test_valid_morning_payload_numeric(self):
        """Morning recovery payload with standard numeric floats."""
        raw = {
            "sleep_hours": 7.5,
            "deep_sleep_hours": 1.5,
            "rem_sleep_hours": 1.8,
            "resting_hr": 54.0,
            "hrv_ms": 62.0,
            "respiratory_rate": 14.5
        }
        cleaned = self.validator.validate_morning_payload(raw)
        self.assertEqual(cleaned.sleep_hours, 7.5)
        self.assertEqual(cleaned.resting_hr, 54.0)
        self.assertEqual(cleaned.hrv_ms, 62.0)

    def test_edge_case_string_and_comma_decimals(self):
        """Apple Shortcuts in Spanish locale sends string numbers with commas ('7,5' instead of 7.5)."""
        raw = {
            "sleep_hours": "7,5",
            "deep_sleep_hours": "1,4",
            "resting_hr": "52",
            "hrv_ms": "65,5"
        }
        cleaned = self.validator.validate_morning_payload(raw)
        self.assertEqual(cleaned.sleep_hours, 7.5)
        self.assertEqual(cleaned.deep_sleep_hours, 1.4)
        self.assertEqual(cleaned.resting_hr, 52.0)
        self.assertEqual(cleaned.hrv_ms, 65.5)

    def test_edge_case_empty_strings_from_shortcuts(self):
        """Shortcuts sends empty string '' when HealthKit sample is absent."""
        raw = {
            "sleep_hours": "7.0",
            "resting_hr": "55",
            "hrv_ms": "", # Absent sample
            "respiratory_rate": ""
        }
        cleaned = self.validator.validate_morning_payload(raw)
        self.assertEqual(cleaned.sleep_hours, 7.0)
        self.assertIsNone(cleaned.hrv_ms)
        self.assertIsNone(cleaned.respiratory_rate)

    def test_edge_case_empty_or_malformed_payload(self):
        """Empty or non-dictionary payload must raise ValidationError."""
        with self.assertRaises(ValidationError):
            self.validator.validate_morning_payload({})

        with self.assertRaises(ValidationError):
            self.validator.validate_morning_payload("not_a_dict")

    # --------------------------------------------------------------------------
    # 2. POST-WORKOUT PAYLOAD
    # --------------------------------------------------------------------------
    def test_valid_workout_payload(self):
        """Valid workout session payload."""
        raw = {
            "workout_type": "Fuerza Tradicional",
            "duration_minutes": "52",
            "active_calories": "420",
            "avg_hr": "138",
            "max_hr": "165",
            "recovery_hr_1min": "22"
        }
        cleaned = self.validator.validate_workout_payload(raw)
        self.assertEqual(cleaned["workout_type"], "fuerza tradicional")
        self.assertEqual(cleaned["duration_minutes"], 52.0)
        self.assertEqual(cleaned["active_calories"], 420)
        self.assertEqual(cleaned["recovery_hr_1min"], 22)

    def test_workout_duration_outlier_clamping(self):
        """Excessive workout duration (e.g. forgot to stop watch, 850m) must be clamped."""
        raw = {
            "workout_type": "Carrera",
            "duration_minutes": 850.0,
            "active_calories": 500,
            "avg_hr": 150,
            "max_hr": 175
        }
        cleaned = self.validator.validate_workout_payload(raw)
        self.assertLessEqual(cleaned["duration_minutes"], 360.0) # Capped at 6 hours

    def test_workout_missing_required_fields(self):
        """Missing mandatory workout_type or heart rate fields."""
        raw = {"duration_minutes": 45}
        with self.assertRaises(ValidationError):
            self.validator.validate_workout_payload(raw)

    # --------------------------------------------------------------------------
    # 3. ON-DEMAND PULSE / PALPITATIONS CHECK
    # --------------------------------------------------------------------------
    def test_valid_instant_hr_payload(self):
        """Valid on-demand heart rate check payload."""
        raw = {
            "current_hr": "78",
            "user_sensation": "Me siento un poco agitado en el trabajo"
        }
        cleaned = self.validator.validate_instant_hr_payload(raw)
        self.assertEqual(cleaned["current_hr"], 78)
        self.assertIn("agitado", cleaned["user_sensation"])

    def test_instant_hr_invalid_pulse(self):
        """Zero or negative pulse must fail validation."""
        with self.assertRaises(ValidationError):
            self.validator.validate_instant_hr_payload({"current_hr": 0})

        with self.assertRaises(ValidationError):
            self.validator.validate_instant_hr_payload({"current_hr": -15})

    # --------------------------------------------------------------------------
    # 4. NUTRITION VOICE / TEXT LOGGING
    # --------------------------------------------------------------------------
    def test_valid_nutrition_payload(self):
        """Valid nutrition meal entry."""
        raw = {
            "raw_text": "Almorcé 200g de pechuga con puré de papa y ensalada verde",
            "meal_type": "almuerzo"
        }
        cleaned = self.validator.validate_nutrition_payload(raw)
        self.assertIn("pechuga", cleaned["raw_text"])
        self.assertEqual(cleaned["meal_type"], "almuerzo")

    def test_nutrition_empty_text(self):
        """Empty text from failed Siri voice dictation must raise error."""
        with self.assertRaises(ValidationError):
            self.validator.validate_nutrition_payload({"raw_text": "   "})

if __name__ == "__main__":
    unittest.main()
