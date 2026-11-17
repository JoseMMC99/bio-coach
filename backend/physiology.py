"""
Physiological modeling and biometric engine for BioCoach AI.
Calculates Daily Recovery, Autonomic Nervous System (ANS) Balance, Sleep Debt, and Workout Strain.
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
    score: int # 0 to 100
    traffic_light: str # 'GREEN', 'YELLOW', 'RED'
    ans_state: str # 'PARASYMPATHETIC_DOMINANT', 'SYMPATHETIC_DOMINANT', 'BALANCED'
    summary: str # User-facing summary in Spanish
    is_provisional: bool = False
    is_partial: bool = False

@dataclass
class StressResult:
    score: int # 0 to 100
    category: str # 'LOW', 'MODERATE', 'HIGH', 'SEVERE'
    summary: str # User-facing summary in Spanish

@dataclass
class WorkoutAnalysis:
    strain_score: float # 0.0 to 21.0
    recommended_recovery_hours: int
    summary: str # User-facing summary in Spanish

class PhysiologyEngine:
    """Core physiological computation and biomarker analysis engine."""

    # Population defaults for day-1 users with no baseline history
    DEFAULT_RHR = 60.0
    DEFAULT_HRV = 50.0
    DEFAULT_TARGET_SLEEP = 8.0

    def calculate_recovery(self, metrics: DailyMetrics, profile: BaselineProfile) -> RecoveryResult:
        """
        Calculates daily recovery score (0-100) weighting:
        - Heart Rate Variability (HRV): 45%
        - Resting Heart Rate (RHR): 25%
        - Sleep duration and architecture: 30%
        """
        is_provisional = False
        is_partial = False

        # 1. Resolve baselines (Day-1 / empty historical profile handling)
        base_rhr = profile.resting_hr if profile.resting_hr is not None else self.DEFAULT_RHR
        base_hrv = profile.hrv_ms if profile.hrv_ms is not None else self.DEFAULT_HRV
        target_sleep = profile.target_sleep_hours if profile.target_sleep_hours else self.DEFAULT_TARGET_SLEEP

        if profile.resting_hr is None or profile.hrv_ms is None:
            is_provisional = True

        # 2. Sensor outlier filtering and clamping
        hrv = self._clamp(metrics.hrv_ms, 5.0, 200.0) if metrics.hrv_ms is not None else None
        rhr = self._clamp(metrics.resting_hr, 35.0, 140.0) if metrics.resting_hr is not None else None
        sleep = self._clamp(metrics.sleep_hours, 0.0, 16.0) if metrics.sleep_hours is not None else None

        # 3. Individual component scoring
        weights = {}

        # HRV component (45 points)
        if hrv is not None and base_hrv > 0:
            hrv_ratio = hrv / base_hrv
            hrv_score = self._clamp(hrv_ratio * 80.0, 10.0, 100.0)
            weights["hrv"] = (hrv_score, 0.45)
        else:
            is_partial = True

        # Resting Heart Rate component (25 points)
        if rhr is not None and base_rhr > 0:
            delta_rhr = rhr - base_rhr
            rhr_score = self._clamp(80.0 - (delta_rhr * 4.0), 10.0, 100.0)
            weights["rhr"] = (rhr_score, 0.25)
        else:
            is_partial = True

        # Sleep component (30 points)
        if sleep is not None and target_sleep > 0:
            sleep_ratio = sleep / target_sleep
            sleep_score = self._clamp(sleep_ratio * 80.0, 10.0, 100.0)
            # Bonus for deep and REM sleep stages if present
            if metrics.deep_sleep_hours and metrics.deep_sleep_hours >= 1.2:
                sleep_score = min(100.0, sleep_score + 5.0)
            if metrics.rem_sleep_hours and metrics.rem_sleep_hours >= 1.5:
                sleep_score = min(100.0, sleep_score + 5.0)
            weights["sleep"] = (sleep_score, 0.30)
        else:
            is_partial = True

        # 4. Normalized weighted calculation
        if not weights:
            # Extreme fallback: no valid sensors delivered data
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

        # 5. Traffic light classification
        if final_score >= 75:
            traffic_light = "GREEN"
        elif final_score >= 50:
            traffic_light = "YELLOW"
        else:
            traffic_light = "RED"

        # 6. Autonomic Nervous System (ANS) tone determination
        effective_hrv = hrv if hrv is not None else base_hrv
        effective_rhr = rhr if rhr is not None else base_rhr

        if effective_hrv > (base_hrv * 1.05) and effective_rhr <= base_rhr:
            ans_state = "PARASYMPATHETIC_DOMINANT"
        elif effective_hrv < (base_hrv * 0.85) or effective_rhr >= (base_rhr + 5.0):
            ans_state = "SYMPATHETIC_DOMINANT"
        else:
            ans_state = "BALANCED"

        # User-facing summary in Spanish
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
        """Calculates accumulated sleep deficit against target hours."""
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
        Calculates instantaneous biological stress index (0 to 100).
        Derived from heart rate elevation above baseline and HRV suppression.
        """
        base_hr = max(30.0, baseline_hr)
        hr_elevation = max(0.0, float(current_hr) - base_hr)

        # Heart rate component (0 to 60 pts)
        hr_component = min(60.0, (hr_elevation / 35.0) * 50.0)

        # HRV component (0 to 40 pts)
        hrv_component = 15.0
        if current_hrv and baseline_hrv and baseline_hrv > 0:
            suppression = max(0.0, baseline_hrv - current_hrv) / baseline_hrv
            hrv_component = min(40.0, suppression * 35.0)

        total_stress = int(round(min(100.0, max(0.0, hr_component + hrv_component))))

        # User-facing categories and descriptions in Spanish
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
        Calculates cardiovascular strain score (0 to 21) and recommended recovery time.
        Uses Heart Rate Reserve (HRR) and caloric expenditure modeling.
        """
        resting_ref = 60.0
        max_ref = max(150.0, float(max_hr))

        # Heart rate reserve fraction (0.0 to 1.0)
        hr_reserve_fraction = max(0.0, (avg_hr - resting_ref) / (max_ref - resting_ref))
        duration_hours = duration_minutes / 60.0

        # Non-linear cumulative strain (Banister TRIMP adaptation)
        intensity_strain = (hr_reserve_fraction ** 1.5) * 15.0
        duration_strain = min(4.0, duration_hours * 2.0)
        caloric_strain = min(3.0, active_calories / 400.0)

        strain = round(min(21.0, max(1.0, intensity_strain + duration_strain + caloric_strain)), 1)

        # Base recovery hours
        if strain >= 14.0:
            rec_hours = 36
        elif strain >= 8.5:
            rec_hours = 24
        else:
            rec_hours = 12

        # Vagal reactivation adjustment based on 1-min post-exercise cardio recovery
        if recovery_hr_1min is not None:
            if recovery_hr_1min < 15: # Sluggish drop indicates autonomic exhaustion
                rec_hours += 8
            elif recovery_hr_1min > 28: # Strong vagal tone reactivation
                rec_hours = max(8, rec_hours - 6)

        return WorkoutAnalysis(
            strain_score=strain,
            recommended_recovery_hours=rec_hours,
            summary=f"Carga estimada: {strain}/21. Recuperación recomendada: ~{rec_hours} horas."
        )

    def evaluate_daily_pillars(self, metrics: DailyMetrics, profile: BaselineProfile) -> Dict[str, Any]:
        """
        Evaluates the 3 core health pillars (HRV, Resting HR, Sleep) individually.
        Returns categorized traffic lights, numerical scores, and identifies the primary bottleneck.
        """
        rec_result = self.calculate_recovery(metrics, profile)
        base_rhr = profile.resting_hr or self.DEFAULT_RHR
        base_hrv = profile.hrv_ms or self.DEFAULT_HRV
        target_sleep = profile.target_sleep_hours or self.DEFAULT_TARGET_SLEEP

        pillars = {}

        # 1. HRV Pillar
        if metrics.hrv_ms is not None and base_hrv > 0:
            hrv_ratio = metrics.hrv_ms / base_hrv
            hrv_delta_pct = (hrv_ratio - 1.0) * 100.0
            if hrv_ratio >= 0.95:
                hrv_status = "GREEN"
                hrv_sev = "NONE"
                hrv_score = min(100, int(round(hrv_ratio * 85)))
            elif hrv_ratio >= 0.78:
                hrv_status = "YELLOW"
                hrv_sev = "MODERATE"
                hrv_score = int(round(hrv_ratio * 75))
            else:
                hrv_status = "RED"
                hrv_sev = "CRITICAL" if hrv_ratio < 0.65 else "HIGH"
                hrv_score = max(10, int(round(hrv_ratio * 60)))

            pillars["hrv"] = {
                "pillar": "HRV",
                "label": "Variabilidad Cardíaca (HRV)",
                "value": f"{metrics.hrv_ms:.0f} ms",
                "baseline": f"{base_hrv:.0f} ms",
                "delta": f"{hrv_delta_pct:+.0f}%",
                "status": hrv_status,
                "severity": hrv_sev,
                "score": hrv_score
            }
        else:
            pillars["hrv"] = {"pillar": "HRV", "status": "YELLOW", "score": 50, "severity": "NONE", "value": "--", "delta": "N/D"}

        # 2. Resting Heart Rate Pillar
        if metrics.resting_hr is not None and base_rhr > 0:
            rhr_diff = metrics.resting_hr - base_rhr
            if rhr_diff <= 2.0:
                rhr_status = "GREEN"
                rhr_sev = "NONE"
                rhr_score = min(100, int(round(85.0 - (rhr_diff * 4.0))))
            elif rhr_diff <= 6.0:
                rhr_status = "YELLOW"
                rhr_sev = "MODERATE"
                rhr_score = int(round(70.0 - ((rhr_diff - 2.0) * 4.0)))
            else:
                rhr_status = "RED"
                rhr_sev = "HIGH"
                rhr_score = max(15, int(round(50.0 - ((rhr_diff - 6.0) * 5.0))))

            pillars["rhr"] = {
                "pillar": "RHR",
                "label": "Frecuencia Cardíaca en Reposo",
                "value": f"{metrics.resting_hr:.0f} bpm",
                "baseline": f"{base_rhr:.0f} bpm",
                "delta": f"{rhr_diff:+.0f} bpm",
                "status": rhr_status,
                "severity": rhr_sev,
                "score": rhr_score
            }
        else:
            pillars["rhr"] = {"pillar": "RHR", "status": "YELLOW", "score": 50, "severity": "NONE", "value": "--", "delta": "N/D"}

        # 3. Sleep Architecture Pillar
        if metrics.sleep_hours is not None and target_sleep > 0:
            sleep_ratio = metrics.sleep_hours / target_sleep
            if sleep_ratio >= 0.88: # >= 7.0h on 8h target
                sleep_status = "GREEN"
                sleep_sev = "NONE"
                sleep_score = min(100, int(round(sleep_ratio * 85)))
            elif sleep_ratio >= 0.70: # 5.6h to 7.0h
                sleep_status = "YELLOW"
                sleep_sev = "MODERATE"
                sleep_score = int(round(sleep_ratio * 75))
            else:
                sleep_status = "RED"
                sleep_sev = "CRITICAL" if sleep_ratio < 0.55 else "HIGH"
                sleep_score = max(10, int(round(sleep_ratio * 55)))

            pillars["sleep"] = {
                "pillar": "SLEEP",
                "label": "Duración de Sueño",
                "value": f"{metrics.sleep_hours:.1f} h",
                "target": f"{target_sleep:.1f} h",
                "delta": f"{(metrics.sleep_hours - target_sleep):+.1f} h",
                "status": sleep_status,
                "severity": sleep_sev,
                "score": sleep_score
            }
        else:
            pillars["sleep"] = {"pillar": "SLEEP", "status": "YELLOW", "score": 50, "severity": "NONE", "value": "--", "delta": "N/D"}

        # Identify Worst Pillar / Primary Bottleneck
        sorted_pillars = sorted(pillars.values(), key=lambda p: p["score"])
        bottleneck = sorted_pillars[0]

        if bottleneck["score"] < 70 and bottleneck["status"] in ["YELLOW", "RED"]:
            worst_name = bottleneck["pillar"]
            worst_sev = bottleneck["severity"]

            if worst_name == "HRV":
                title = "Variabilidad Cardíaca deprimida"
                detail = f"Tu variabilidad cardíaca (HRV) cayó a {bottleneck['value']} ({bottleneck['delta']} vs tu media). El sistema nervioso autónomo estuvo bajo estrés fisiológico o fatiga residual."
            elif worst_name == "RHR":
                title = "Pulso en reposo elevado"
                detail = f"Tu frecuencia en reposo subió a {bottleneck['value']} ({bottleneck['delta']} sobre tu base). Puede reflejar deshidratación, digestión tardía o inflamación."
            else:
                title = "Déficit severo de sueño"
                detail = f"Tu tiempo de sueño fue de sólo {bottleneck['value']} ({bottleneck['delta']} respecto a tu meta). No alcanzaste el tiempo suficiente para regeneración física y hormonal."

            worst_aspect = {
                "pillar": worst_name,
                "title": title,
                "severity": worst_sev,
                "badge": "🔴 Crítico" if worst_sev in ["HIGH", "CRITICAL"] else "🟡 Atención",
                "detail": detail
            }
        else:
            worst_aspect = {
                "pillar": "NONE",
                "title": "Todos los pilares en rango óptimo",
                "severity": "NONE",
                "badge": "🟢 Excelente",
                "detail": "Tu sistema nervioso, descanso y ritmo cardíaco muestran balance y recuperación equilibrada."
            }

        return {
            "overall_score": rec_result.score,
            "overall_traffic_light": rec_result.traffic_light,
            "ans_state": rec_result.ans_state,
            "pillars": pillars,
            "worst_aspect": worst_aspect
        }

    def _clamp(self, val: float, min_val: float, max_val: float) -> float:
        """Utility to clamp numeric values within physiological bounds."""
        return max(min_val, min(max_val, val))
