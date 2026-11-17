"""
Orquestador de Inteligencia Artificial con Google Gemini para BioCoach AI.
Inyecta contexto biométrico, maneja prompts estructurados y provee fallbacks deterministas.
"""
import json
import urllib.request
import urllib.error
from dataclasses import dataclass
from typing import Optional, List
from backend.physiology import RecoveryResult, BaselineProfile, DailyMetrics

@dataclass
class OrchestratorContext:
    recovery: RecoveryResult
    metrics: DailyMetrics
    profile: BaselineProfile
    sleep_debt_hours: float = 0.0
    user_goals: str = "Salud general, recomposición corporal y rendimiento"
    recent_workouts_summary: Optional[str] = None

@dataclass
class MorningVerdict:
    watch_summary: str # Mensaje ultra-conciso para el Apple Watch (máx 300 caracteres)
    detailed_report: str # Reporte extendido para la WebApp
    traffic_light: str
    is_fallback: bool = False

class GeminiOrchestrator:
    """Orquesta llamadas a Gemini Flash con contexto biométrico precalculado."""

    API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"

    def __init__(self, api_key: str):
        self.api_key = api_key

    def build_morning_prompt(self, ctx: OrchestratorContext) -> str:
        """Construye el prompt con contexto clínico y fisiológico masticado."""
        provisional_note = (
            "NOTA: Es el primer día de uso o línea base PROVISIONAL. Calibra tus respuestas."
            if ctx.recovery.is_provisional else
            "Línea base consolidada."
        )

        return f"""
Actúa como un fisiólogo del ejercicio y entrenador de rendimiento de élite para BioCoach AI.
Analiza el siguiente reporte matutino precalculado:

ESTADO CALCULADO:
- Puntuación de Recuperación: {ctx.recovery.score}/100 ({ctx.recovery.traffic_light})
- Estado del SNA: {ctx.recovery.ans_state}
- Deuda de Sueño Acumulada: {ctx.sleep_debt_hours} horas
- Diagnóstico Algorítmico: {ctx.recovery.summary}
{provisional_note}

MÉTRICAS DEL DÍA:
- Sueño Total: {ctx.metrics.sleep_hours}h (Profundo: {ctx.metrics.deep_sleep_hours}h, REM: {ctx.metrics.rem_sleep_hours}h)
- Frecuencia Cardíaca en Reposo: {ctx.metrics.resting_hr} bpm (Línea base: {ctx.profile.resting_hr} bpm)
- Variabilidad Cardíaca (HRV): {ctx.metrics.hrv_ms} ms (Línea base: {ctx.profile.hrv_ms} ms)
- Frecuencia Respiratoria: {ctx.metrics.respiratory_rate} rpm

OBJETIVOS DEL ATLETA:
{ctx.user_goals}

REGLAS DE RESPUESTA:
Entrega exactamente 3 secciones cortas, separadas por salto de línea:
1. [Icono del semáforo] Semáforo y porcentaje de recuperación.
2. Recomendación de entrenamiento de hoy (Intensidad alta/moderada/descanso activo).
3. Consejo de nutrición o hábito clave para el día.
Máximo 250 caracteres en total. Sé directo, enérgico y sin relleno.
"""

    def generate_morning_verdict(self, ctx: OrchestratorContext) -> MorningVerdict:
        """Genera el veredicto para el reloj. Si la API falla, usa fallback local determinista."""
        prompt = self.build_morning_prompt(ctx)

        try:
            raw_response = self._call_gemini_api(prompt)
            # Asegurar formato limpio para el reloj
            clean_summary = raw_response.strip()
            if len(clean_summary) > 300:
                clean_summary = clean_summary[:297] + "..."

            return MorningVerdict(
                watch_summary=clean_summary,
                detailed_report=raw_response,
                traffic_light=ctx.recovery.traffic_light,
                is_fallback=False
            )
        except Exception as e:
            # Fallback determinista local en caso de estar offline o error de API
            return self._generate_local_fallback(ctx, str(e))

    def _call_gemini_api(self, prompt: str) -> str:
        """Llamada HTTP directa al endpoint de Google Gemini."""
        if not self.api_key or self.api_key == "test_mock_key":
            raise ValueError("API Key no configurada o mock.")

        url = f"{self.API_ENDPOINT}?key={self.api_key}"
        headers = {"Content-Type": "application/json"}
        payload = {
            "contents": [
                {
                    "parts": [{"text": prompt}]
                }
            ],
            "generationConfig": {
                "temperature": 0.4,
                "maxOutputTokens": 200
            }
        }

        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")

        with urllib.request.urlopen(req, timeout=8) as response:
            res_json = json.loads(response.read().decode("utf-8"))
            return res_json["candidates"][0]["content"]["parts"][0]["text"]

    def _generate_local_fallback(self, ctx: OrchestratorContext, error_reason: str) -> MorningVerdict:
        """Generador local que nunca deja la muñeca del usuario en blanco."""
        score = ctx.recovery.score
        color = ctx.recovery.traffic_light

        if color == "GREEN":
            icon = "🟢"
            advice = "Sistema óptimo. Día excelente para sesión intensa de pesas o intervalos."
        elif color == "YELLOW":
            icon = "🟡"
            advice = "Recuperación moderada. Recomendado cardio en Zona 2 o entrenamiento suave."
        else:
            icon = "🔴"
            advice = "Fatiga acumulada alta. Prioriza caminata ligera, hidratación y descanso."

        watch_summary = f"{icon} Recuperación: {score}%\n{advice}\n(Modo sin conexión)"

        return MorningVerdict(
            watch_summary=watch_summary,
            detailed_report=f"Reporte generado localmente. Razón: {error_reason}",
            traffic_light=color,
            is_fallback=True
        )
