"""
Unit tests for the Apple Shortcuts binary generator.
Verifies that generated .shortcut files are valid Apple plists with proper actions and metadata.
"""
import os
import plistlib
import unittest
from scripts.generate_shortcuts import create_all_shortcuts, generate_shortcut_plist

class TestShortcutGenerator(unittest.TestCase):

    def test_generate_shortcut_plist_structure(self):
        """Generates a valid Apple Shortcut dictionary structure."""
        plist_data = generate_shortcut_plist(
            name="Recuperación Matutina",
            glyph=59511,
            color=431817727,
            endpoint="/api/v1/recovery",
            sample_types=["Sleep", "RestingHeartRate", "HeartRateVariabilitySDNN"]
        )

        self.assertIn("WFWorkflowActions", plist_data)
        self.assertIn("WFWorkflowClientVersion", plist_data)
        self.assertIn("WFWorkflowIcon", plist_data)
        self.assertEqual(plist_data["WFWorkflowIcon"]["WFWorkflowIconGlyphNumber"], 59511)
        self.assertGreaterEqual(len(plist_data["WFWorkflowActions"]), 3)

    def test_create_all_shortcuts_outputs_valid_files(self):
        """Generates all 4 binary .shortcut files and confirms they parse with plistlib."""
        output_dir = os.path.join(os.path.dirname(__file__), "..", "shortcuts", "downloads")
        generated_files = create_all_shortcuts(output_dir)

        self.assertEqual(len(generated_files), 4)

        for filepath in generated_files:
            self.assertTrue(os.path.exists(filepath), f"File {filepath} was not created")
            self.assertTrue(filepath.endswith(".shortcut"))
            
            # Verify file is a valid binary plist readable by plistlib
            with open(filepath, "rb") as f:
                loaded = plistlib.load(f)
                self.assertIn("WFWorkflowActions", loaded)
                self.assertIn("WFWorkflowClientVersion", loaded)

if __name__ == "__main__":
    unittest.main()
