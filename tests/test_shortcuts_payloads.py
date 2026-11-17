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
    # 1. REPORTE MATUTINO (Morning Recovery)
    # --------------------------------------------------------------------------
    def test_valid_morning_payload_numeric(self):
        """Payload matutino con tipos numéricos estándar."""
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
        """Apple Shortcuts en español suele enviar strings con comas ('7,5' en lugar de 7.5)."""
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
        """Atajos envía '' cuando una muestra de Salud está ausente."""
        raw = {
            "sleep_hours": "7.0",
            "resting_hr": "55",
            "hrv_ms": "", # Muestra ausente
            "respiratory_rate": ""
        }
        cleaned = self.validator.validate_morning_payload(raw)
        self.assertEqual(cleaned.sleep_hours, 7.0)
        self.assertIsNone(cleaned.hrv_ms)
        self.assertIsNone(cleaned.respiratory_rate)

    def test_edge_case_empty_or_malformed_payload(self):
        """Payload totalmente vacío o no diccionario debe lanzar ValidationError."""
        with self.assertRaises(ValidationError):
            self.validator.validate_morning_payload({})

        with self.assertRaises(ValidationError):
            self.validator.validate_morning_payload("not_a_dict")

    # --------------------------------------------------------------------------
    # 2. POST-ENTRENAMIENTO (Workout)
    # --------------------------------------------------------------------------
    def test_valid_workout_payload(self):
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
        """Si el usuario olvidó detener el entreno (ej. 800 minutos), se clampea."""
        raw = {
            "workout_type": "Carrera",
            "duration_minutes": 850.0,
            "active_calories": 500,
            "avg_hr": 150,
            "max_hr": 175
        }
        cleaned = self.validator.validate_workout_payload(raw)
        self.assertLessEqual(cleaned["duration_minutes"], 360.0) # Máx 6 horas

    def test_workout_missing_required_fields(self):
        """Falta workout_type o pulsaciones."""
        raw = {"duration_minutes": 45}
        with self.assertRaises(ValidationError):
            self.validator.validate_workout_payload(raw)

    # --------------------------------------------------------------------------
    # 3. CHEQUEO DE PULSO / PALPITACIONES (Instant HR)
    # --------------------------------------------------------------------------
    def test_valid_instant_hr_payload(self):
        raw = {
            "current_hr": "78",
            "user_sensation": "Me siento un poco agitado en el trabajo"
        }
        cleaned = self.validator.validate_instant_hr_payload(raw)
        self.assertEqual(cleaned["current_hr"], 78)
        self.assertIn("agitado", cleaned["user_sensation"])

    def test_instant_hr_invalid_pulse(self):
        """Pulso 0 o negativo debe fallar."""
        with self.assertRaises(ValidationError):
            self.validator.validate_instant_hr_payload({"current_hr": 0})

        with self.assertRaises(ValidationError):
            self.validator.validate_instant_hr_payload({"current_hr": -15})

    # --------------------------------------------------------------------------
    # 4. NUTRICIÓN / DICTADO POR VOZ (Nutrition Log)
    # --------------------------------------------------------------------------
    def test_valid_nutrition_payload(self):
        raw = {
            "raw_text": "Almorcé 200g de pechuga con puré de papa y ensalada verde",
            "meal_type": "almuerzo"
        }
        cleaned = self.validator.validate_nutrition_payload(raw)
        self.assertIn("pechuga", cleaned["raw_text"])
        self.assertEqual(cleaned["meal_type"], "almuerzo")

    def test_nutrition_empty_text(self):
        """Texto vacío por fallo en dictado de Siri."""
        with self.assertRaises(ValidationError):
            self.validator.validate_nutrition_payload({"raw_text": "   "})

if __name__ == "__main__":
    unittest.main()
