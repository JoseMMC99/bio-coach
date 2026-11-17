"""
Validator and sanitizer for Apple Shortcuts payloads.
Handles type coercion (e.g. Spanish comma decimals '7,5'), missing metrics, and physiological bounds.
"""
from typing import Any, Dict, Optional
from backend.physiology import DailyMetrics

class ValidationError(ValueError):
    """Raised when an incoming shortcut payload fails validation criteria."""
    pass

class ShortcutPayloadValidator:
    """Validates, sanitizes and coerces data received from Apple HealthKit and Shortcuts."""

    def validate_morning_payload(self, raw: Any) -> DailyMetrics:
        """Validates and cleans the morning recovery payload."""
        if not isinstance(raw, dict) or not raw:
            raise ValidationError("El payload matutino debe ser un diccionario no vacío.")

        sleep = self._coerce_float(raw.get("sleep_hours"))
        deep = self._coerce_float(raw.get("deep_sleep_hours"))
        rem = self._coerce_float(raw.get("rem_sleep_hours"))
        rhr = self._coerce_float(raw.get("resting_hr"))
        hrv = self._coerce_float(raw.get("hrv_ms"))
        resp = self._coerce_float(raw.get("respiratory_rate"))
        temp = self._coerce_float(raw.get("wrist_temp_deviation"))

        # Require at least one key biometric indicator to be present
        if all(v is None for v in [sleep, rhr, hrv]):
            raise ValidationError("Se requiere al menos una métrica clave: sueño, pulso en reposo o HRV.")

        return DailyMetrics(
            sleep_hours=sleep,
            deep_sleep_hours=deep,
            rem_sleep_hours=rem,
            resting_hr=rhr,
            hrv_ms=hrv,
            respiratory_rate=resp,
            wrist_temp_deviation=temp
        )

    def validate_workout_payload(self, raw: Any) -> Dict[str, Any]:
        """Validates and cleans the post-workout payload."""
        if not isinstance(raw, dict) or not raw:
            raise ValidationError("El payload de entrenamiento debe ser un diccionario no vacío.")

        workout_type = raw.get("workout_type")
        if not workout_type or not str(workout_type).strip():
            raise ValidationError("El campo 'workout_type' es obligatorio.")

        duration = self._coerce_float(raw.get("duration_minutes"))
        if duration is None or duration <= 0:
            raise ValidationError("'duration_minutes' debe ser un número positivo.")

        # Clamp max duration to 6 hours in case user forgot to stop the session
        duration = min(360.0, duration)

        avg_hr = self._coerce_int(raw.get("avg_hr"))
        if avg_hr is None or avg_hr <= 0:
            raise ValidationError("'avg_hr' es obligatorio y debe ser positivo.")

        max_hr = self._coerce_int(raw.get("max_hr")) or avg_hr
        max_hr = max(avg_hr, max_hr) # Max HR cannot be lower than average HR

        calories = self._coerce_int(raw.get("active_calories")) or 0
        rec_hr = self._coerce_int(raw.get("recovery_hr_1min"))

        return {
            "workout_type": str(workout_type).strip().lower(),
            "duration_minutes": duration,
            "active_calories": calories,
            "avg_hr": avg_hr,
            "max_hr": max_hr,
            "recovery_hr_1min": rec_hr
        }

    def validate_instant_hr_payload(self, raw: Any) -> Dict[str, Any]:
        """Validates on-demand pulse check payload."""
        if not isinstance(raw, dict) or not raw:
            raise ValidationError("El payload de pulso debe ser un diccionario no vacío.")

        current_hr = self._coerce_int(raw.get("current_hr"))
        if current_hr is None or current_hr <= 30 or current_hr >= 250:
            raise ValidationError("'current_hr' debe ser un valor fisiológico válido (30-250 bpm).")

        sensation = str(raw.get("user_sensation", "rutina")).strip()
        hrv = self._coerce_float(raw.get("current_hrv"))

        return {
            "current_hr": current_hr,
            "current_hrv": hrv,
            "user_sensation": sensation
        }

    def validate_nutrition_payload(self, raw: Any) -> Dict[str, Any]:
        """Validates nutrition meal voice/text entry."""
        if not isinstance(raw, dict) or not raw:
            raise ValidationError("El payload de nutrición debe ser un diccionario no vacío.")

        raw_text = raw.get("raw_text")
        if not raw_text or not str(raw_text).strip():
            raise ValidationError("El campo 'raw_text' no puede estar vacío.")

        meal_type = str(raw.get("meal_type", "comida")).strip().lower()

        return {
            "raw_text": str(raw_text).strip(),
            "meal_type": meal_type
        }

    def _coerce_float(self, val: Any) -> Optional[float]:
        """Safely coerces string, numeric, or comma-delimited decimals to float."""
        if val is None:
            return None
        if isinstance(val, (int, float)):
            return float(val)
        val_str = str(val).strip()
        if not val_str:
            return None
        # Replace regional comma with standard period (Spanish iOS formatting)
        val_str = val_str.replace(",", ".")
        try:
            return float(val_str)
        except ValueError:
            raise ValidationError(f"No se pudo convertir '{val}' a número decimal.")

    def _coerce_int(self, val: Any) -> Optional[int]:
        """Safely coerces input to integer."""
        f_val = self._coerce_float(val)
        return int(round(f_val)) if f_val is not None else None
