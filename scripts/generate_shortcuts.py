"""
Apple Shortcuts (.shortcut) Binary Plist Generator.
Generates native Apple iOS Shortcuts files for 1-click import into iOS Shortcuts app.
Produces individual .shortcut files and a consolidated ZIP bundle.
"""
import os
import plistlib
import zipfile
from typing import List, Dict, Any, Optional

# Default cloud credentials for 24/7 serverless operation on Supabase
DEFAULT_SUPABASE_URL = "https://elizdnhmmhjrcdfmxxlg.supabase.co"
DEFAULT_SUPABASE_KEY = "sb_publishable_52J4Pni9JZK-iNcaoznbEg_YHbxCEi5"

def generate_shortcut_plist(
    name: str,
    glyph: int,
    color: int,
    endpoint: str,
    sample_types: Optional[List[str]] = None,
    supabase_table: Optional[str] = None
) -> Dict[str, Any]:
    """
    Builds the dictionary representation of an Apple Shortcut workflow plist.
    
    Args:
        name: User-facing shortcut name in Spanish.
        glyph: Apple SF Symbol glyph integer identifier.
        color: Apple 32-bit RGBA color representation.
        endpoint: BioCoach API path (e.g. /api/v1/recovery).
        sample_types: HealthKit metrics captured by this shortcut.
        supabase_table: Target Supabase table for autonomous 24/7 cloud logging.
    
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

    # Resolve target URL: defaults to direct 24/7 cloud Supabase endpoint if table provided
    target_url = (
        f"{DEFAULT_SUPABASE_URL}/rest/v1/{supabase_table}"
        if supabase_table else f"http://localhost:8080{endpoint}"
    )

    # 2. Text action with target URL
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.gettext",
        "WFWorkflowActionParameters": {
            "WFTextActionText": target_url
        }
    })

    # 3. HTTP Network Request action (POST payload to Supabase or BioCoach gateway)
    http_headers = {
        "Content-Type": "application/json"
    }
    if supabase_table:
        http_headers["apikey"] = DEFAULT_SUPABASE_KEY
        http_headers["Authorization"] = f"Bearer {DEFAULT_SUPABASE_KEY}"
        http_headers["Prefer"] = "return=representation"
        http_headers["x-athlete-token"] = "atleta_privado"

    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.downloadurl",
        "WFWorkflowActionParameters": {
            "WFHTTPMethod": "POST",
            "WFHTTPHeaders": http_headers,
            "WFHTTPBodyType": "JSON"
        }
    })

    # 4. Display Notification / Watch Feedback
    actions.append({
        "WFWorkflowActionIdentifier": "is.workflow.actions.notification",
        "WFWorkflowActionParameters": {
            "WFNotificationActionTitle": f"BioCoach - {name}",
            "WFNotificationActionBody": "Telemetría sincronizada con éxito en BioCoach Cloud."
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
                "Text": f"Servidor de destino para {name} (Nube Supabase 24/7 o IP local):",
                "DefaultValue": target_url
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
            "supabase_table": "daily_recovery",
            "sample_types": ["SleepAnalysis", "RestingHeartRate", "HeartRateVariabilitySDNN"]
        },
        {
            "filename": "02_Fin_Entrenamiento.shortcut",
            "name": "Fin de Entrenamiento",
            "glyph": 59539,  # Flame / Workout
            "color": 4282601983,  # Orange / Red
            "endpoint": "/api/v1/workout",
            "supabase_table": "workouts",
            "sample_types": ["ActiveEnergyBurned", "HeartRate"]
        },
        {
            "filename": "03_Check_Cardiaco.shortcut",
            "name": "Check Cardíaco",
            "glyph": 59544,  # Heartbeat
            "color": 3490713343,  # Purple
            "endpoint": "/api/v1/hr-check",
            "supabase_table": "hr_checkins",
            "sample_types": ["HeartRate"]
        },
        {
            "filename": "04_Registro_Voz_Nutricion.shortcut",
            "name": "Registro de Nutrición por Voz",
            "glyph": 59610,  # Apple / Food
            "color": 1446700031,  # Green
            "endpoint": "/api/v1/nutrition",
            "supabase_table": "nutrition_logs",
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
            sample_types=spec["sample_types"],
            supabase_table=spec.get("supabase_table")
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

    # Mirror to webapp/shortcuts/downloads for static GitHub Pages hosting
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    webapp_dir = os.path.join(project_root, "webapp", "shortcuts", "downloads")
    if output_dir != webapp_dir:
        os.makedirs(webapp_dir, exist_ok=True)
        import shutil
        for p in generated_paths + [zip_path]:
            shutil.copy2(p, os.path.join(webapp_dir, os.path.basename(p)))

    return generated_paths


if __name__ == "__main__":
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    target_dir = os.path.join(base_dir, "shortcuts", "downloads")
    results = create_all_shortcuts(target_dir)
    print(f"✅ Generated {len(results)} shortcuts in {target_dir}")
