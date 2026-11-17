"""
Unit tests and edge cases for the Metabolism and Caloric Expenditure Engine.
Validates Mifflin-St Jeor BMR, TDEE, macro distributions, and Apple Watch active calorie integration.
"""
import unittest
from backend.metabolism import (
    MetabolismEngine,
    UserProfile,
    CaloriePlan
)

class TestMetabolismEngine(unittest.TestCase):

    def setUp(self):
        self.engine = MetabolismEngine()
        self.male_user = UserProfile(
            weight_kg=78.0,
            height_cm=175.0,
            age=26,
            gender="male",
            activity_level="moderate",
            goal="cut" # 400 kcal deficit
        )
        self.female_user = UserProfile(
            weight_kg=62.0,
            height_cm=165.0,
            age=28,
            gender="female",
            activity_level="light",
            goal="maintain"
        )

    def test_bmr_calculation_male_mifflin(self):
        """Mifflin-St Jeor BMR calculation for male user."""
        # 10*78 + 6.25*175 - 5*26 + 5 = 780 + 1093.75 - 130 + 5 = 1748.75
        bmr = self.engine.calculate_bmr(self.male_user)
        self.assertAlmostEqual(bmr, 1748.75, delta=1.0)

    def test_bmr_calculation_female_mifflin(self):
        """Mifflin-St Jeor BMR calculation for female user."""
        # 10*62 + 6.25*165 - 5*28 - 161 = 620 + 1031.25 - 140 - 161 = 1350.25
        bmr = self.engine.calculate_bmr(self.female_user)
        self.assertAlmostEqual(bmr, 1350.25, delta=1.0)

    def test_tdee_with_activity_multiplier(self):
        """TDEE with standard activity factor (moderate = 1.55)."""
        plan = self.engine.calculate_plan(self.male_user)
        # 1749 * 1.55 = ~2710 kcal
        self.assertAlmostEqual(plan.tdee, 2710, delta=20.0)
        # Cut goal subtracts ~400 kcal
        self.assertAlmostEqual(plan.target_calories, plan.tdee - 400, delta=5.0)

    def test_dynamic_tdee_with_apple_watch_calories(self):
        """Dynamic TDEE adding exact active calories logged by Apple Watch."""
        # If Apple Watch recorded 580 active calories:
        # Dynamic TDEE = BMR * 1.15 (NEAT base) + 580
        plan = self.engine.calculate_plan(self.male_user, apple_watch_active_kcal=580)
        self.assertGreater(plan.tdee, plan.bmr)
        self.assertEqual(plan.active_calories_source, "APPLE_WATCH")

    def test_macro_distribution_cut(self):
        """Macronutrient breakdown allocates adequate protein during caloric deficit."""
        plan = self.engine.calculate_plan(self.male_user)
        # At 78kg, protein should be ~2.0-2.2g/kg -> ~156-172g
        self.assertGreaterEqual(plan.protein_g, 150.0)
        self.assertGreaterEqual(plan.fat_g, 50.0)
        self.assertGreater(plan.carbs_g, 100.0)
        # Total macro calories should equal target calories within 15 kcal rounding
        total_macro_kcal = (plan.protein_g * 4) + (plan.carbs_g * 4) + (plan.fat_g * 9)
        self.assertAlmostEqual(total_macro_kcal, plan.target_calories, delta=15.0)

    def test_edge_case_invalid_weight_or_height(self):
        """Invalid or impossible biometric values must raise ValueError."""
        invalid_user = UserProfile(weight_kg=-70, height_cm=175, age=25, gender="male")
        with self.assertRaises(ValueError):
            self.engine.calculate_bmr(invalid_user)

        zero_height = UserProfile(weight_kg=70, height_cm=0, age=25, gender="male")
        with self.assertRaises(ValueError):
            self.engine.calculate_bmr(zero_height)

if __name__ == "__main__":
    unittest.main()
