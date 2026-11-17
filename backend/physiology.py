"""
Motor Fisiológico y Algoritmos de Rendimiento para BioCoach AI.
Calcula Recuperación, Balance del Sistema Nervioso Autónomo, Deuda de Sueño y Carga.
"""
from dataclasses import dataclass
from typing import Optional, List

@dataclass
class DailyMetrics:
    sleep_hours: Optional[float] = None
    deep_sleep_hours: Optional[float] = None
    rem_sleep_hours: Optional[float] = None
    resting_hr: Optional[float] = None
    hrv_ms: Optional[float] = None
    respiratory_rate: Optional[float] = None
    wrist_temp_deviation: Optional[float] = None

@dataclass
class BaselineProfile:
    resting_hr: Optional[float] = 55.0
    hrv_ms: Optional[float] = 55.0
    target_sleep_hours: float = 8.0

@dataclass
class RecoveryResult:
    score: int # 0 a 100
    traffic_light: str # 'GREEN', 'YELLOW', 'RED'
    ans_state: str # 'PARASYMPATHETIC_DOMINANT', 'SYMPATHETIC_DOMINANT', 'BALANCED'
    summary: str
    is_provisional: bool = False
    is_partial: bool = False

@dataclass
class StressResult:
    score: int # 0 a 100
    category: str # 'LOW', 'MODERATE', 'HIGH', 'SEVERE'
    summary: str

@dataclass
class WorkoutAnalysis:
    strain_score: float # 0.0 a 21.0
    recommended_recovery_hours: int
    summary: str

class PhysiologyEngine:
    """Motor central de cálculo biométrico y modelado fisiológico."""

    # Constantes poblacionales por defecto para usuarios sin historial (Día 1)
    DEFAULT_RHR = 60.0
    DEFAULT_HRV = 50.0
    DEFAULT_TARGET_SLEEP = 8.0

    def calculate_recovery(self, metrics: DailyMetrics, profile: BaselineProfile) -> RecoveryResult:
        """
        Calcula la puntuación de recuperación diaria (0-100) ponderando:
        - Variabilidad Cardíaca (HRV): 45%
        - Frecuencia en reposo (RHR): 25%
        - Duración y fases de sueño: 30%
        """
        is_provisional = False
        is_partial = False

        # 1. Resolver líneas base (Manejo de Día 1 / Historial vacío)
        base_rhr = profile.resting_hr if profile.resting_hr is not None else self.DEFAULT_RHR
        base_hrv = profile.hrv_ms if profile.hrv_ms is not None else self.DEFAULT_HRV
        target_sleep = profile.target_sleep_hours if profile.target_sleep_hours else self.DEFAULT_TARGET_SLEEP

        if profile.resting_hr is None or profile.hrv_ms is None:
            is_provisional = True

        # 2. Filtrado y clampeo de outliers (Artefactos de sensores)
        hrv = self._clamp(metrics.hrv_ms, 5.0, 200.0) if metrics.hrv_ms is not None else None
        rhr = self._clamp(metrics.resting_hr, 35.0, 140.0) if metrics.resting_hr is not None else None
        sleep = self._clamp(metrics.sleep_hours, 0.0, 16.0) if metrics.sleep_hours is not None else None

        # 3. Puntuación de componentes individuales
        weights = {}

        # Componente HRV (45 puntos)
        if hrv is not None and base_hrv > 0:
            hrv_ratio = hrv / base_hrv
            # Ratio 1.0 = 80 pts. >1.2 = 100 pts. <0.7 = 30 pts.
            hrv_score = self._clamp(hrv_ratio * 80.0, 10.0, 100.0)
            weights["hrv"] = (hrv_score, 0.45)
        else:
            is_partial = True

        # Componente Frecuencia en Reposo (25 puntos)
        if rhr is not None and base_rhr > 0:
            # Si RHR es más bajo que la base = mejor. Si es más alto = peor.
            delta_rhr = rhr - base_rhr
            rhr_score = self._clamp(80.0 - (delta_rhr * 4.0), 10.0, 100.0)
            weights["rhr"] = (rhr_score, 0.25)
        else:
            is_partial = True

        # Componente Sueño (30 puntos)
        if sleep is not None and target_sleep > 0:
            sleep_ratio = sleep / target_sleep
            sleep_score = self._clamp(sleep_ratio * 80.0, 10.0, 100.0)
            # Bonus por fases profundas y REM si están presentes
            if metrics.deep_sleep_hours and metrics.deep_sleep_hours >= 1.2:
                sleep_score = min(100.0, sleep_score + 5.0)
            if metrics.rem_sleep_hours and metrics.rem_sleep_hours >= 1.5:
                sleep_score = min(100.0, sleep_score + 5.0)
            weights["sleep"] = (sleep_score, 0.30)
        else:
            is_partial = True

        # 4. Cálculo final normalizado
        if not weights:
            # Fallback extremo: ningún sensor entregó datos válidos
            return RecoveryResult(
                score=50,
                traffic_light="YELLOW",
                ans_state="BALANCED",
                summary="Datos insuficientes para evaluación completa.",
                is_provisional=True,
                is_partial=True
            )

        total_weight = sum(w for _, w in weights.values())
        final_score = int(round(sum(score * w for score, w in weights.values()) / total_weight))
        final_score = self._clamp(final_score, 0, 100)

        # 5. Determinación de Semáforo
        if final_score >= 75:
            traffic_light = "GREEN"
        elif final_score >= 50:
            traffic_light = "YELLOW"
        else:
            traffic_light = "RED"

        # 6. Determinación de Estado del Sistema Nervioso Autónomo (SNA)
        effective_hrv = hrv if hrv is not None else base_hrv
        effective_rhr = rhr if rhr is not None else base_rhr

        if effective_hrv > (base_hrv * 1.05) and effective_rhr <= base_rhr:
            ans_state = "PARASYMPATHETIC_DOMINANT"
        elif effective_hrv < (base_hrv * 0.85) or effective_rhr >= (base_rhr + 5.0):
            ans_state = "SYMPATHETIC_DOMINANT"
        else:
            ans_state = "BALANCED"

        summary_parts = []
        if is_provisional:
            summary_parts.append("Evaluación provisional (calibrando línea base).")
        if traffic_light == "GREEN":
            summary_parts.append("Recuperación óptima del sistema nervioso.")
        elif traffic_light == "YELLOW":
            summary_parts.append("Recuperación moderada. Fatiga residual.")
        else:
            summary_parts.append("Recuperación baja. Fatiga aguda o estrés elevado.")

        return RecoveryResult(
            score=final_score,
            traffic_light=traffic_light,
            ans_state=ans_state,
            summary=" ".join(summary_parts),
            is_provisional=is_provisional,
            is_partial=is_partial
        )

    def calculate_sleep_debt(self, sleep_history_hours: List[float], target_hours: float = 8.0) -> float:
        """Calcula el déficit acumulado de horas de sueño."""
        if not sleep_history_hours:
            return 0.0
        total_debt = sum(max(0.0, target_hours - h) for h in sleep_history_hours)
        return round(total_debt, 2)

    def calculate_stress_index(
        self,
        current_hr: int,
        baseline_hr: float,
        current_hrv: Optional[float] = None,
        baseline_hrv: Optional[float] = None
    ) -> StressResult:
        """
        Calcula el índice de estrés biológico instantáneo (0 a 100).
        Basado en la elevación del pulso sobre reposo y la supresión de HRV.
        """
        base_hr = max(30.0, baseline_hr)
        hr_elevation = max(0.0, float(current_hr) - base_hr)

        # Componente frecuencia cardíaca (0 a 60 pts)
        # 30 bpm sobre reposo = 50 pts
        hr_component = min(60.0, (hr_elevation / 35.0) * 50.0)

        # Componente HRV (0 a 40 pts)
        hrv_component = 15.0
        if current_hrv and baseline_hrv and baseline_hrv > 0:
            suppression = max(0.0, baseline_hrv - current_hrv) / baseline_hrv
            hrv_component = min(40.0, suppression * 35.0)

        total_stress = int(round(min(100.0, max(0.0, hr_component + hrv_component))))

        if total_stress < 30:
            category = "LOW"
            summary = "Estrés biológico bajo. Sistema en calma."
        elif total_stress < 65:
            category = "MODERATE"
            summary = "Estrés moderado o actividad sedentaria ligera."
        elif total_stress < 85:
            category = "HIGH"
            summary = "Estrés elevado. Activación simpática detectable."
        else:
            category = "SEVERE"
            summary = "Estrés agudo severo. Se sugiere pausa y respiración profunda."

        return StressResult(score=total_stress, category=category, summary=summary)

    def analyze_workout(
        self,
        duration_minutes: float,
        avg_hr: int,
        max_hr: int,
        active_calories: int,
        recovery_hr_1min: Optional[int] = None
    ) -> WorkoutAnalysis:
        """
        Calcula la carga del entrenamiento (*strain* de 0 a 21) y tiempo de recuperación recomendado.
        Utiliza el concepto de reserva de frecuencia cardíaca y volumen calórico.
        """
        # Estimación fisiológica de intensidad sobre reposo típico (60 bpm)
        resting_ref = 60.0
        max_ref = max(150.0, float(max_hr))
        
        # Fracción de reserva cardíaca (0.0 a 1.0)
        hr_reserve_fraction = max(0.0, (avg_hr - resting_ref) / (max_ref - resting_ref))
        duration_hours = duration_minutes / 60.0

        # Carga acumulada basada en intensidad exponencial (escala Banister / TRIMP simplificada)
        intensity_strain = (hr_reserve_fraction ** 1.5) * 15.0
        duration_strain = min(4.0, duration_hours * 2.0)
        caloric_strain = min(3.0, active_calories / 400.0)

        strain = round(min(21.0, max(1.0, intensity_strain + duration_strain + caloric_strain)), 1)

        # Tiempo de recuperación base
        if strain >= 14.0:
            rec_hours = 36
        elif strain >= 8.5:
            rec_hours = 24
        else:
            rec_hours = 12

        # Ajuste según recuperación cardíaca en 1 minuto
        if recovery_hr_1min is not None:
            if recovery_hr_1min < 15: # Bajó muy poco: sistema cardiovascular exhausto
                rec_hours += 8
            elif recovery_hr_1min > 28: # Excelente reactivación vagal
                rec_hours = max(8, rec_hours - 6)

        return WorkoutAnalysis(
            strain_score=strain,
            recommended_recovery_hours=rec_hours,
            summary=f"Carga estimada: {strain}/21. Recuperación recomendada: ~{rec_hours} horas."
        )

    def _clamp(self, val: float, min_val: float, max_val: float) -> float:
        return max(min_val, min(max_val, val))
