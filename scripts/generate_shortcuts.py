"""
Apple Shortcuts (.shortcut) Binary Plist Generator.
Generates native Apple iOS Shortcuts files for 1-click import into iOS Shortcuts app.
Produces individual .shortcut files and a consolidated ZIP bundle.
"""
import os
import plistlib
import zipfile
from typing import List, Dict, Any, Optional

def generate_shortcut_plist(
    name: str,
    glyph: int,
    color: int,
    endpoint: str,
    sample_types: Optional[List[str]] = None
) -> Dict[str, Any]:
    """
    Builds the dictionary representation of an Apple Shortcut workflow plist.
    
    Args:
        name: User-facing shortcut name in Spanish.
        glyph: Apple SF Symbol glyph integer identifier.
        color: Apple 32-bit RGBA color representation.
        endpoint: BioCoach API path (e.g. /api/v1/recovery).
        sample_types: HealthKit metrics captured by this shortcut.
    
    Returns:
        Dictionary conforming to Apple Workflow specification.
    """
    actions = []

    # 1. HealthKit query actions if applicable
    if sample_types:
        for st in sample_types:
            actions.append({
                "WFWorkflowActionIdentifier": "is.workflow.actions.health.quantity.sample",
                "WFWorkflowActionParameters": {
                    "WFHKSampleType": st,
                    "WFHKQuantityTypeSampleGrouping": "Latest",
                    "WFHKQuantityTypeSampleLimit": 1
                }
            })

    # 2. Text action with BioCoach Server URL
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
        "WFWorkflowActionParameters": {
            "WFTextActionText": f"http://localhost:8000{endpoint}"
        }
    })

    # 3. HTTP Network Request action (POST payload to BioCoach server)
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
        "WFWorkflowActionParameters": {
            "WFHTTPMethod": "POST",
            "WFHTTPHeaders": {
                "Content-Type": "application/json"
            },
            "WFHTTPBodyType": "JSON"
        }
    })

    # 4. Display Notification / Watch Feedback
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.notification",
        "WFWorkflowActionParameters": {
            "WFNotificationActionTitle": f"BioCoach - {name}",
            "WFNotificationActionBody": "Telemetría procesada por BioCoach AI."
        }
    })

    shortcut_dict: Dict[str, Any] = {
        "WFWorkflowMinimumClientVersion": 900,
        "WFWorkflowClientVersion": "2607.0.2",
        "WFWorkflowIcon": {
            "WFWorkflowIconGlyphNumber": glyph,
            "WFWorkflowIconStartColor": color
        },
        "WFWorkflowImportQuestions": [
            {
                "ActionIndex": len(actions) - 3,
                "Category": "Parameter",
                "ParameterKey": "WFTextActionText",
                "Text": f"Ingresa la dirección IP o dominio de tu servidor BioCoach para {name}:",
                "DefaultValue": f"http://192.168.1.50:8000{endpoint}"
            }
        ],
        "WFWorkflowActions": actions
    }

    return shortcut_dict


def create_all_shortcuts(output_dir: str) -> List[str]:
    """
    Generates the four core BioCoach shortcuts into the specified directory as binary plists.
    Also creates a consolidated ZIP archive for 1-click batch download.
    """
    os.makedirs(output_dir, exist_ok=True)

    shortcuts_specs = [
        {
            "filename": "01_Recuperacion_Matutina.shortcut",
            "name": "Recuperación Matutina",
            "glyph": 59511,  # Bed / Moon
            "color": 431817727,  # Emerald / Teal
            "endpoint": "/api/v1/recovery",
            "sample_types": ["SleepAnalysis", "RestingHeartRate", "HeartRateVariabilitySDNN"]
        },
        {
            "filename": "02_Fin_Entrenamiento.shortcut",
            "name": "Fin de Entrenamiento",
            "glyph": 59539,  # Flame / Workout
            "color": 4282601983,  # Orange / Red
            "endpoint": "/api/v1/workout",
            "sample_types": ["ActiveEnergyBurned", "HeartRate"]
        },
        {
            "filename": "03_Check_Cardiaco.shortcut",
            "name": "Check Cardíaco",
            "glyph": 59544,  # Heartbeat
            "color": 3490713343,  # Purple
            "endpoint": "/api/v1/hr-check",
            "sample_types": ["HeartRate"]
        },
        {
            "filename": "04_Registro_Voz_Nutricion.shortcut",
            "name": "Registro de Nutrición por Voz",
            "glyph": 59610,  # Apple / Food
            "color": 1446700031,  # Green
            "endpoint": "/api/v1/nutrition",
            "sample_types": None
        }
    ]

    generated_paths = []
    for spec in shortcuts_specs:
        plist_data = generate_shortcut_plist(
            name=spec["name"],
            glyph=spec["glyph"],
            color=spec["color"],
            endpoint=spec["endpoint"],
            sample_types=spec["sample_types"]
        )
        file_path = os.path.join(output_dir, spec["filename"])
        with open(file_path, "wb") as f:
            plistlib.dump(plist_data, f, fmt=plistlib.FMT_BINARY)
        generated_paths.append(file_path)

    # Generate consolidated ZIP archive
    zip_path = os.path.join(output_dir, "BioCoach_Atajos_iOS.zip")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for p in generated_paths:
            zipf.write(p, arcname=os.path.basename(p))

    return generated_paths


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_dir = os.path.join(base_dir, "shortcuts", "downloads")
    results = create_all_shortcuts(target_dir)
    print(f"✅ Generated {len(results)} shortcuts in {target_dir}")
