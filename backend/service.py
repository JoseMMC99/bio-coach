"""
Capa de Servicio de BioCoach AI.
Conecta los datos de Supabase, el motor fisiológico y el orquestador de Gemini.
"""
import os
import json
import urllib.request
import urllib.error
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from backend.physiology import (
    PhysiologyEngine,
    DailyMetrics,
    BaselineProfile,
    RecoveryResult,
    StressResult,
    WorkoutAnalysis
)
from backend.orchestrator import GeminiOrchestrator, OrchestratorContext, MorningVerdict

class BioCoachService:
    """Orquestador integral del backend BioCoach."""

    def __init__(self, supabase_url: str, supabase_key: str, gemini_key: str):
        self.supabase_url = supabase_url.rstrip("/")
        self.supabase_key = supabase_key
        self.engine = PhysiologyEngine()
        self.orchestrator = GeminiOrchestrator(api_key=gemini_key)

    def process_morning_recovery(self, metrics: DailyMetrics, target_date: Optional[str] = None) -> Dict[str, Any]:
        """
        Pipeline matutino:
        1. Consulta los últimos 7 días de historial en Supabase.
        2. Calcula la línea base móvil (rolling average) y deuda de sueño.
        3. Evalúa la recuperación de hoy con el motor fisiológico.
        4. Llama a Gemini para generar el veredicto optimizado para el reloj.
        5. Persiste el resultado en Supabase.
        """
        rec_date = target_date or date.today().isoformat()

        # 1. Obtener historial previo para calcular línea base
        history = self._fetch_recent_history(days=7)
        profile, sleep_history = self._compute_rolling_baseline(history)

        # 2. Deuda de sueño acumulada
        sleep_debt = self.engine.calculate_sleep_debt(sleep_history, target_hours=profile.target_sleep_hours)

        # 3. Cálculo fisiológico
        recovery = self.engine.calculate_recovery(metrics, profile)

        # 4. Orquestación con Gemini
        ctx = OrchestratorContext(
            recovery=recovery,
            metrics=metrics,
            profile=profile,
            sleep_debt_hours=sleep_debt
        )
        verdict = self.orchestrator.generate_morning_verdict(ctx)

        # 5. Guardar en Supabase
        db_payload = {
            "recorded_date": rec_date,
            "sleep_hours": metrics.sleep_hours,
            "deep_sleep_hours": metrics.deep_sleep_hours,
            "rem_sleep_hours": metrics.rem_sleep_hours,
            "respiratory_rate": metrics.respiratory_rate,
            "wrist_temp_deviation": metrics.wrist_temp_deviation,
            "resting_hr": metrics.resting_hr,
            "hrv_ms": metrics.hrv_ms,
            "recovery_score": recovery.score,
            "gemini_verdict": verdict.watch_summary
        }
        saved_record = self._save_recovery_record(db_payload)

        return {
            "status": "success",
            "date": rec_date,
            "recovery_score": recovery.score,
            "traffic_light": recovery.traffic_light,
            "watch_notification": verdict.watch_summary,
            "detailed_report": verdict.detailed_report,
            "is_provisional": recovery.is_provisional,
            "rolling_days_used": len(history),
            "record_id": saved_record.get("id") if saved_record else None
        }

    def process_instant_hr_check(
        self,
        current_hr: int,
        baseline_rhr: Optional[float] = None,
        current_hrv: Optional[float] = None,
        user_sensation: str = "rutina"
    ) -> Dict[str, Any]:
        """
        Pipeline de chequeo de palpitaciones o estrés a demanda.
        Discrimina objetivamente si las pulsaciones están dentro del rango seguro.
        """
        # Si no se provee baseline, usar la almacenada o default
        base_hr = baseline_rhr or 58.0
        stress = self.engine.calculate_stress_index(
            current_hr=current_hr,
            baseline_hr=base_hr,
            current_hrv=current_hrv
        )

        diff = current_hr - base_hr
        if diff <= 12 and stress.category == "LOW":
            guidance = (
                f"💓 Pulso: {current_hr} bpm (Normal para tu reposo de ~{int(base_hr)} bpm).\n"
                "Tu corazón está en ritmo seguro. La sensación probablemente es fatiga o estrés mental."
            )
        elif diff <= 25 and stress.category in ["LOW", "MODERATE"]:
            guidance = (
                f"💓 Pulso: {current_hr} bpm (+{int(diff)} sobre reposo).\n"
                "Ligera activación simpática. Toma un vaso con agua y mantén la calma."
            )
        else:
            guidance = (
                f"⚠️ Pulso elevado: {current_hr} bpm (+{int(diff)} bpm).\n"
                "Inicia respiración: inhala profundo 4s, sostén 4s, exhala en 4s."
            )

        # Guardar en base de datos
        db_payload = {
            "current_hr": current_hr,
            "stress_level": stress.score,
            "user_sensation": user_sensation,
            "gemini_guidance": guidance
        }
        self._save_hr_checkin(db_payload)

        return {
            "status": "success",
            "current_hr": current_hr,
            "stress_score": stress.score,
            "stress_category": stress.category,
            "watch_guidance": guidance
        }

    def process_workout_completion(
        self,
        workout_type: str,
        duration_minutes: float,
        active_calories: int,
        avg_hr: int,
        max_hr: int,
        recovery_hr_1min: Optional[int] = None
    ) -> Dict[str, Any]:
        """Pipeline post-entrenamiento: calcula carga y horas de recuperación."""
        analysis = self.engine.analyze_workout(
            duration_minutes=duration_minutes,
            avg_hr=avg_hr,
            max_hr=max_hr,
            active_calories=active_calories,
            recovery_hr_1min=recovery_hr_1min
        )

        feedback = (
            f"🏋️ {workout_type.capitalize()} ({int(duration_minutes)}m | {active_calories} kcal).\n"
            f"Impacto: {analysis.strain_score}/21. Recuperación estimada: ~{analysis.recommended_recovery_hours}h.\n"
            "Consume 30g de proteína e hidrata en los próximos 45 min."
        )

        db_payload = {
            "workout_type": workout_type,
            "duration_minutes": duration_minutes,
            "active_calories": active_calories,
            "avg_hr": avg_hr,
            "max_hr": max_hr,
            "recovery_hr_1min": recovery_hr_1min,
            "gemini_feedback": feedback
        }
        self._save_workout_record(db_payload)

        return {
            "status": "success",
            "workout_type": workout_type,
            "strain_score": analysis.strain_score,
            "recommended_recovery_hours": analysis.recommended_recovery_hours,
            "watch_feedback": feedback
        }

    def get_dashboard_summary(self, days: int = 7) -> Dict[str, Any]:
        """Agrega métricas consolidadas para el Dashboard de la WebApp."""
        history = self._fetch_recent_history(days=days)
        workouts = self._fetch_recent_workouts(limit=5)
        today_iso = date.today().isoformat()

        if not history:
            return {
                "status": "success",
                "is_day_one": True,
                "today": None,
                "trends": {"dates": [], "hrv": [], "rhr": [], "sleep": []},
                "recent_workouts": []
            }

        # Invertir para orden cronológico en gráficas
        chronological = list(reversed(history))
        latest = history[0]

        trends = {
            "dates": [r.get("recorded_date", "") for r in chronological],
            "hrv": [float(r.get("hrv_ms") or 0.0) for r in chronological],
            "rhr": [float(r.get("resting_hr") or 0.0) for r in chronological],
            "sleep": [float(r.get("sleep_hours") or 0.0) for r in chronological]
        }

        today_data = {
            "date": latest.get("recorded_date"),
            "score": latest.get("recovery_score", 50),
            "traffic_light": "GREEN" if (latest.get("recovery_score") or 0) >= 75 else ("YELLOW" if (latest.get("recovery_score") or 0) >= 50 else "RED"),
            "hrv": latest.get("hrv_ms"),
            "rhr": latest.get("resting_hr"),
            "sleep": latest.get("sleep_hours"),
            "verdict": latest.get("gemini_verdict", "")
        }

        return {
            "status": "success",
            "is_day_one": False,
            "today": today_data,
            "trends": trends,
            "recent_workouts": [
                {
                    "type": w.get("workout_type", "entreno"),
                    "duration": w.get("duration_minutes", 0),
                    "calories": w.get("active_calories", 0),
                    "strain": w.get("active_calories", 0) / 40.0 if w.get("active_calories") else 10.0,
                    "date": w.get("created_at", "")[:10]
                }
                for w in workouts
            ]
        }

    def process_coach_chat(self, user_message: str) -> Dict[str, Any]:
        """Procesa una consulta libre en el chat inyectando el contexto de salud."""
        if not user_message or not user_message.strip():
            return {"status": "error", "message": "El mensaje no puede estar vacío."}

        history = self._fetch_recent_history(days=7)
        profile, sleep_history = self._compute_rolling_baseline(history)

        context_summary = []
        if history:
            latest = history[0]
            context_summary.append(f"- Última recuperación registrada: {latest.get('recovery_score')}% el {latest.get('recorded_date')}")
            context_summary.append(f"- HRV reciente: {latest.get('hrv_ms')} ms (Media 7 días: {profile.hrv_ms} ms)")
            context_summary.append(f"- Pulso en reposo: {latest.get('resting_hr')} bpm (Media 7 días: {profile.resting_hr} bpm)")
            context_summary.append(f"- Último sueño: {latest.get('sleep_hours')}h")
        else:
            context_summary.append("- Usuario en día 1 (sin historial previo consolidado).")

        full_prompt = f"""
Actúa como BioCoach AI, un fisiólogo deportivo y coach de salud personal.
El usuario te está haciendo una pregunta desde su WebApp móvil.

CONTEXTO CLÍNICO RECIENTE DEL USUARIO:
{"\n".join(context_summary)}

PREGUNTA DEL USUARIO:
"{user_message.strip()}"

INSTRUCCIONES:
Responde de manera empática, científica y accionable. Relaciona tus consejos directamente con sus datos biométricos si es relevante. Mantén la respuesta conversacional y clara.
"""
        try:
            reply = self.orchestrator._call_gemini_api(full_prompt)
        except Exception:
            reply = (
                "Entiendo tu consulta. Basándome en tus métricas recientes, lo más importante hoy es "
                "mantener un buen balance entre tu recuperación y el esfuerzo físico. "
                "(Nota: respuesta generada en modo local provisional)."
            )

        return {
            "status": "success",
            "reply": reply.strip()
        }

    def _fetch_recent_workouts(self, limit: int = 5) -> List[Dict[str, Any]]:
        """Consulta los últimos entrenamientos registrados."""
        endpoint = f"{self.supabase_url}/rest/v1/workouts?order=created_at.desc&limit={limit}"
        headers = self._get_headers()
        req = urllib.request.Request(endpoint, headers=headers, method="GET")

        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            return []

    # --------------------------------------------------------------------------
    # MÉTODOS AUXILIARES Y ACCESO A SUPABASE (PostgREST)
    # --------------------------------------------------------------------------
    def _compute_rolling_baseline(self, history: List[Dict[str, Any]]) -> (BaselineProfile, List[float]):
        """Calcula promedios móviles a partir de los registros previos."""
        if not history:
            return BaselineProfile(resting_hr=None, hrv_ms=None), []

        valid_rhr = [r["resting_hr"] for r in history if r.get("resting_hr")]
        valid_hrv = [r["hrv_ms"] for r in history if r.get("hrv_ms")]
        sleep_hours = [r["sleep_hours"] for r in history if r.get("sleep_hours")]

        avg_rhr = sum(valid_rhr) / len(valid_rhr) if valid_rhr else None
        avg_hrv = sum(valid_hrv) / len(valid_hrv) if valid_hrv else None

        profile = BaselineProfile(
            resting_hr=round(avg_rhr, 1) if avg_rhr else None,
            hrv_ms=round(avg_hrv, 1) if avg_hrv else None,
            target_sleep_hours=8.0
        )
        return profile, sleep_hours

    def _fetch_recent_history(self, days: int = 7) -> List[Dict[str, Any]]:
        """Consulta los últimos N registros ordenados cronológicamente."""
        endpoint = f"{self.supabase_url}/rest/v1/daily_recovery?order=recorded_date.desc&limit={days}"
        headers = self._get_headers()
        req = urllib.request.Request(endpoint, headers=headers, method="GET")

        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except Exception:
            return []

    def _save_recovery_record(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Inserta o actualiza un registro en daily_recovery."""
        endpoint = f"{self.supabase_url}/rest/v1/daily_recovery"
        headers = self._get_headers(prefer="return=representation")
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                return res[0] if isinstance(res, list) and res else {}
        except Exception:
            return {}

    def _save_hr_checkin(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        endpoint = f"{self.supabase_url}/rest/v1/hr_checkins"
        headers = self._get_headers(prefer="return=representation")
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                return res[0] if isinstance(res, list) and res else {}
        except Exception:
            return {}

    def _save_workout_record(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        endpoint = f"{self.supabase_url}/rest/v1/workouts"
        headers = self._get_headers(prefer="return=representation")
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(endpoint, data=data, headers=headers, method="POST")

        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                res = json.loads(resp.read().decode("utf-8"))
                return res[0] if isinstance(res, list) and res else {}
        except Exception:
            return {}

    def _get_headers(self, prefer: Optional[str] = None) -> Dict[str, str]:
        headers = {
            "apikey": self.supabase_key,
            "Authorization": f"Bearer {self.supabase_key}",
            "Content-Type": "application/json"
        }
        if prefer:
            headers["Prefer"] = prefer
        return headers
