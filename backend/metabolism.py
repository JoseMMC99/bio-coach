"""
Metabolic rate, TDEE, and macronutrient distribution engine for BioCoach AI.
Implements Mifflin-St Jeor equation, dynamic Apple Watch expenditure, and goal programming.
"""
from dataclasses import dataclass
from typing import Optional

@dataclass
class UserProfile:
    weight_kg: float
    height_cm: float
    age: int
    gender: str = "male" # 'male' or 'female'
    activity_level: str = "moderate" # 'sedentary', 'light', 'moderate', 'active', 'very_active'
    goal: str = "maintain" # 'cut', 'maintain', 'bulk'

@dataclass
class CaloriePlan:
    bmr: float
    tdee: float
    target_calories: int
    goal_adjustment: int
    protein_g: float
    carbs_g: float
    fat_g: float
    active_calories_source: str # 'ESTIMATED_ACTIVITY' or 'APPLE_WATCH'
    summary: str

class MetabolismEngine:
    """Computes Basal Metabolic Rate (BMR) and macro planning."""

    ACTIVITY_MULTIPLIERS = {
        "sedentary": 1.20,     # Desk job, minimal walking
        "light": 1.375,        # 1-3 days/week exercise
        "moderate": 1.55,      # 3-5 days/week training
        "active": 1.725,       # 6-7 days/week hard exercise
        "very_active": 1.90    # Physical labor or two-a-days
    }

    GOAL_OFFSETS = {
        "cut": -400,           # Sustainable fat-loss deficit
        "maintain": 0,
        "bulk": 300            # Lean hypertrophy surplus
    }

    def calculate_bmr(self, user: UserProfile) -> float:
        """
        Calculates Basal Metabolic Rate (BMR) using Mifflin-St Jeor formula.
        Men:   (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5
        Women: (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161
        """
        if user.weight_kg <= 0 or user.height_cm <= 0 or user.age <= 0:
            raise ValueError("Weight, height, and age must be strictly positive values.")

        base = (10.0 * user.weight_kg) + (6.25 * user.height_cm) - (5.0 * user.age)
        if user.gender.lower() == "female":
            return round(base - 161.0, 2)
        return round(base + 5.0, 2)

    def calculate_plan(self, user: UserProfile, apple_watch_active_kcal: Optional[int] = None) -> CaloriePlan:
        """
        Calculates daily caloric target and macronutrient distribution.
        Integrates dynamic Apple Watch active expenditure when available.
        """
        bmr = self.calculate_bmr(user)
        act_key = user.activity_level.lower()

        if apple_watch_active_kcal is not None and apple_watch_active_kcal > 0:
            # Dynamic TDEE: Non-Exercise Activity Thermogenesis (NEAT ~1.15) + Measured Watch burn
            tdee = round((bmr * 1.15) + apple_watch_active_kcal, 1)
            source = "APPLE_WATCH"
        else:
            multiplier = self.ACTIVITY_MULTIPLIERS.get(act_key, 1.55)
            tdee = round(bmr * multiplier, 1)
            source = "ESTIMATED_ACTIVITY"

        offset = self.GOAL_OFFSETS.get(user.goal.lower(), 0)
        target_kcal = int(round(max(1200.0, tdee + offset)))

        # Macronutrient distribution tailored for athletes / body recomposition:
        # Protein: 2.0g to 2.2g per kg bodyweight
        # Fat: 0.8g per kg bodyweight (hormonal baseline)
        # Carbs: Remainder of caloric allocation
        protein_g = round(user.weight_kg * 2.05, 1)
        fat_g = round(user.weight_kg * 0.82, 1)

        protein_kcal = protein_g * 4.0
        fat_kcal = fat_g * 9.0
        remaining_kcal = max(200.0, float(target_kcal) - protein_kcal - fat_kcal)
        carbs_g = round(remaining_kcal / 4.0, 1)

        summary = (
            f"BMR: {int(bmr)} kcal | TDEE: {int(tdee)} kcal | Objetivo ({user.goal.upper()}): {target_kcal} kcal/día "
            f"(Proteína: {int(protein_g)}g, Carbos: {int(carbs_g)}g, Grasas: {int(fat_g)}g)."
        )

        return CaloriePlan(
            bmr=bmr,
            tdee=tdee,
            target_calories=target_kcal,
            goal_adjustment=offset,
            protein_g=protein_g,
            carbs_g=carbs_g,
            fat_g=fat_g,
            active_calories_source=source,
            summary=summary
        )

    def evaluate_calorie_balance(
        self,
        consumed_kcal: int,
        target_kcal: int,
        tdee: int,
        goal: str = "cut"
    ) -> dict:
        """
        Evaluates daily caloric balance against user's specific target and TDEE.
        Returns traffic light (GREEN, YELLOW, RED), delta kcal, and physiological feedback.
        """
        delta = consumed_kcal - target_kcal
        goal_lower = goal.lower()

        if goal_lower == "cut":
            # In a cut, staying near or under target deficit is GREEN.
            # Consuming up to maintenance (TDEE) is YELLOW (maintenance, 0 deficit).
            # Consuming above TDEE is RED (caloric surplus breaking the cut).
            if consumed_kcal <= target_kcal + 75:
                status = "GREEN"
                verdict = f"Déficit cumplido ({delta:+d} kcal). Óptimo para pérdida de grasa."
            elif consumed_kcal <= tdee + 50:
                status = "YELLOW"
                verdict = f"Calorías en rango de mantenimiento ({delta:+d} kcal vs meta). Sin déficit hoy."
            else:
                status = "RED"
                verdict = f"Superávit calórico ({consumed_kcal - tdee:+d} kcal sobre TDEE). Exceso calórico."
        elif goal_lower == "bulk":
            # In a bulk, achieving the planned surplus is GREEN.
            # Near maintenance is YELLOW (insufficient surplus for hypertrophy).
            # In deficit is RED (failing bulk).
            if target_kcal - 100 <= consumed_kcal <= target_kcal + 250:
                status = "GREEN"
                verdict = f"Superávit óptimo ({delta:+d} kcal). Estimula hipertrofia magra."
            elif tdee - 50 <= consumed_kcal < target_kcal - 100:
                status = "YELLOW"
                verdict = "Calorías cerca de mantenimiento. Superávit tímido."
            elif consumed_kcal < tdee - 50:
                status = "RED"
                verdict = f"Déficit calórico ({consumed_kcal - tdee:+d} kcal). Impide ganancia muscular."
            else:
                status = "YELLOW"
                verdict = f"Superávit elevado ({delta:+d} kcal). Vigila ganancia de grasa."
        else:
            diff = abs(consumed_kcal - target_kcal)
            if diff <= 150:
                status = "GREEN"
                verdict = f"Balance neutro ({delta:+d} kcal). Peso estable."
            elif diff <= 300:
                status = "YELLOW"
                verdict = f"Ligera desviación ({delta:+d} kcal)."
            else:
                status = "RED"
                verdict = f"Desviación calórica significativa ({delta:+d} kcal)."

        return {
            "consumed_kcal": consumed_kcal,
            "target_kcal": target_kcal,
            "tdee": tdee,
            "delta_kcal": delta,
            "traffic_light": status,
            "verdict": verdict
        }
