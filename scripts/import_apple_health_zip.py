"""
Apple Health export.zip Full Biometric Importer for BioCoach AI.
Streams export.xml and upserts ALL Apple Watch metrics (Sleep stages, Cardiovascular,
Respiratory, SpO2, Breathing Disturbances, Wrist Temp, Activity, Mobility & Clinical Events)
into Supabase daily_recovery.
"""
import argparse
import json
import os
import urllib.error
import urllib.request
import zipfile
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple


DEFAULT_SUPABASE_URL = "https://elizdnhmmhjrcdfmxxlg.supabase.co"
DEFAULT_SUPABASE_KEY = "sb_publishable_52J4Pni9JZK-iNcaoznbEg_YHbxCEi5"


def parse_dt(s: str) -> datetime:
    return datetime.strptime(s[:19], "%Y-%m-%d %H:%M:%S")


def merged_hours(intervals: List[Tuple[datetime, datetime]]) -> Optional[float]:
    if not intervals:
        return None
    intervals.sort(key=lambda x: x[0])
    merged = [list(intervals[0])]
    for s, e in intervals[1:]:
        if s <= merged[-1][1]:
            if e > merged[-1][1]:
                merged[-1][1] = e
        else:
            merged.append([s, e])
    hours = round(sum((e - s).total_seconds() for s, e in merged) / 3600.0, 2)
    return hours if hours > 0 else None


def avg_or_none(vals: List[float], ndigits: int = 2) -> Optional[float]:
    if not vals:
        return None
    return round(sum(vals) / len(vals), ndigits)


def parse_apple_health_zip(zip_path: str, days_back: int = 30, athlete_id: str = "atleta_privado") -> List[Dict[str, Any]]:
    """Extracts up to `days_back` daily records containing ALL Apple Watch metrics."""
    days = defaultdict(lambda: {
        "sleep_all": [], "sleep_deep": [], "sleep_rem": [], "sleep_core": [], "sleep_awake": [],
        "rhr": [], "hrv": [], "hr": [], "walk_hr": [], "vo2": [],
        "resp": [], "spo2": [], "breath_disturb": [], "temp": [],
        "steps": 0, "active_cal": 0.0, "basal_cal": 0.0, "exercise_min": 0.0,
        "stand_hours": set(), "stand_min": 0.0, "distance_km": 0.0, "cycling_km": 0.0,
        "flights": 0, "daylight": 0.0, "audio_db": [], "body_mass": [],
        "walk_speed": [], "step_len": [], "double_supp": [], "asymmetry": [],
        "steadiness": [], "stair_up": [], "stair_down": [], "effort": [], "six_min_m": [],
        "hypertension_events": 0, "sleep_apnea_events": 0, "audio_events": 0,
    })

    # First pass / cutoff: determine date window relative to today
    today = datetime.now().date()
    cutoff_str = (today - timedelta(days=days_back - 1)).strftime("%Y-%m-%d")
    today_str = today.strftime("%Y-%m-%d")

    with zipfile.ZipFile(zip_path, "r") as z:
        xml_candidates = [n for n in z.namelist() if n.endswith("export.xml")]
        if not xml_candidates:
            raise FileNotFoundError("export.xml not found inside zip archive")
        xml_name = xml_candidates[0]

        with z.open(xml_name) as f:
            for _, elem in ET.iterparse(f, events=("end",)):
                if elem.tag == "Record":
                    end_s = elem.attrib.get("endDate", "")
                    day = end_s[:10]
                    if cutoff_str <= day <= today_str:
                        rtype = elem.attrib.get("type", "")
                        start_s = elem.attrib.get("startDate", "")
                        val = elem.attrib.get("value", "")
                        d = days[day]

                        if rtype == "HKCategoryTypeIdentifierSleepAnalysis":
                            sdt, edt = parse_dt(start_s), parse_dt(end_s)
                            if "AsleepCore" in val:
                                d["sleep_all"].append((sdt, edt))
                                d["sleep_core"].append((sdt, edt))
                            elif "AsleepDeep" in val:
                                d["sleep_all"].append((sdt, edt))
                                d["sleep_deep"].append((sdt, edt))
                            elif "AsleepREM" in val:
                                d["sleep_all"].append((sdt, edt))
                                d["sleep_rem"].append((sdt, edt))
                            elif "AsleepUnspecified" in val:
                                d["sleep_all"].append((sdt, edt))
                            elif "Awake" in val:
                                d["sleep_awake"].append((sdt, edt))
                        elif rtype == "HKCategoryTypeIdentifierAppleStandHour":
                            if "Stood" in val:
                                d["stand_hours"].add(start_s[:13])
                        elif rtype == "HKCategoryTypeIdentifierHypertensionEvent":
                            d["hypertension_events"] += 1
                        elif rtype == "HKCategoryTypeIdentifierSleepApneaEvent":
                            d["sleep_apnea_events"] += 1
                        elif rtype == "HKCategoryTypeIdentifierAudioExposureEvent":
                            d["audio_events"] += 1
                        else:
                            try:
                                fval = float(val)
                            except (ValueError, TypeError):
                                fval = None

                            if fval is not None:
                                if rtype == "HKQuantityTypeIdentifierRestingHeartRate":
                                    d["rhr"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
                                    d["hrv"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierHeartRate":
                                    d["hr"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierWalkingHeartRateAverage":
                                    d["walk_hr"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierVO2Max":
                                    d["vo2"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierRespiratoryRate":
                                    d["resp"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierOxygenSaturation":
                                    d["spo2"].append(fval * 100.0 if fval <= 1.0 else fval)
                                elif rtype == "HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances":
                                    d["breath_disturb"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierAppleSleepingWristTemperature":
                                    unit = elem.attrib.get("unit", "")
                                    c_val = (fval - 32.0) * 5.0 / 9.0 if ("degF" in unit or fval > 50.0) else fval
                                    d["temp"].append(c_val)
                                elif rtype == "HKQuantityTypeIdentifierStepCount":
                                    d["steps"] += int(round(fval))
                                elif rtype == "HKQuantityTypeIdentifierActiveEnergyBurned":
                                    d["active_cal"] += fval
                                elif rtype == "HKQuantityTypeIdentifierBasalEnergyBurned":
                                    d["basal_cal"] += fval
                                elif rtype == "HKQuantityTypeIdentifierAppleExerciseTime":
                                    d["exercise_min"] += fval
                                elif rtype == "HKQuantityTypeIdentifierAppleStandTime":
                                    d["stand_min"] += fval
                                elif rtype == "HKQuantityTypeIdentifierDistanceWalkingRunning":
                                    d["distance_km"] += fval
                                elif rtype == "HKQuantityTypeIdentifierDistanceCycling":
                                    d["cycling_km"] += fval
                                elif rtype == "HKQuantityTypeIdentifierFlightsClimbed":
                                    d["flights"] += int(round(fval))
                                elif rtype == "HKQuantityTypeIdentifierTimeInDaylight":
                                    d["daylight"] += fval
                                elif rtype == "HKQuantityTypeIdentifierEnvironmentalAudioExposure":
                                    d["audio_db"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierBodyMass":
                                    d["body_mass"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierWalkingSpeed":
                                    d["walk_speed"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierWalkingStepLength":
                                    d["step_len"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierWalkingDoubleSupportPercentage":
                                    d["double_supp"].append(fval * 100.0 if fval <= 1.0 else fval)
                                elif rtype == "HKQuantityTypeIdentifierWalkingAsymmetryPercentage":
                                    d["asymmetry"].append(fval * 100.0 if fval <= 1.0 else fval)
                                elif rtype == "HKQuantityTypeIdentifierAppleWalkingSteadiness":
                                    d["steadiness"].append(fval * 100.0 if fval <= 1.0 else fval)
                                elif rtype == "HKQuantityTypeIdentifierStairAscentSpeed":
                                    d["stair_up"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierStairDescentSpeed":
                                    d["stair_down"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierPhysicalEffort":
                                    d["effort"].append(fval)
                                elif rtype == "HKQuantityTypeIdentifierSixMinuteWalkTestDistance":
                                    d["six_min_m"].append(fval)
                    elem.clear()

    rows: List[Dict[str, Any]] = []
    for day in sorted(days.keys()):
        d = days[day]
        extra: Dict[str, Any] = {}
        if d["stand_min"] > 0:
            extra["stand_minutes"] = int(round(d["stand_min"]))
        if d["cycling_km"] > 0:
            extra["cycling_km"] = round(d["cycling_km"], 2)
        if d["walk_speed"]:
            extra["walking_speed_kmh"] = avg_or_none(d["walk_speed"])
        if d["step_len"]:
            extra["walking_step_length_cm"] = avg_or_none(d["step_len"])
        if d["double_supp"]:
            extra["walking_double_support_pct"] = avg_or_none(d["double_supp"])
        if d["asymmetry"]:
            extra["walking_asymmetry_pct"] = avg_or_none(d["asymmetry"])
        if d["steadiness"]:
            extra["walking_steadiness_pct"] = avg_or_none(d["steadiness"])
        if d["stair_up"]:
            extra["stair_ascent_speed"] = avg_or_none(d["stair_up"])
        if d["stair_down"]:
            extra["stair_descent_speed"] = avg_or_none(d["stair_down"])
        if d["effort"]:
            extra["physical_effort"] = avg_or_none(d["effort"])
        if d["six_min_m"]:
            extra["six_min_walk_m"] = avg_or_none(d["six_min_m"])
        if d["hypertension_events"] > 0:
            extra["hypertension_events"] = d["hypertension_events"]
        if d["sleep_apnea_events"] > 0:
            extra["sleep_apnea_events"] = d["sleep_apnea_events"]
        if d["audio_events"] > 0:
            extra["audio_exposure_events"] = d["audio_events"]

        row = {
            "recorded_date": day,
            "sleep_hours": merged_hours(d["sleep_all"]),
            "deep_sleep_hours": merged_hours(d["sleep_deep"]),
            "rem_sleep_hours": merged_hours(d["sleep_rem"]),
            "core_sleep_hours": merged_hours(d["sleep_core"]),
            "awake_sleep_hours": merged_hours(d["sleep_awake"]),
            "resting_hr": avg_or_none(d["rhr"]),
            "hrv_ms": avg_or_none(d["hrv"]),
            "avg_hr": avg_or_none(d["hr"]),
            "min_hr": round(min(d["hr"]), 2) if d["hr"] else None,
            "max_hr": round(max(d["hr"]), 2) if d["hr"] else None,
            "walking_hr_avg": avg_or_none(d["walk_hr"]),
            "vo2_max": avg_or_none(d["vo2"]),
            "respiratory_rate": avg_or_none(d["resp"]),
            "spo2_pct": avg_or_none(d["spo2"]),
            "breathing_disturbances": avg_or_none(d["breath_disturb"]),
            "wrist_temp_deviation": avg_or_none(d["temp"]),
            "daylight_minutes": int(round(d["daylight"])) if d["daylight"] > 0 else None,
            "steps": d["steps"] if d["steps"] > 0 else None,
            "active_calories": int(round(d["active_cal"])) if d["active_cal"] > 0 else None,
            "basal_calories": int(round(d["basal_cal"])) if d["basal_cal"] > 0 else None,
            "exercise_minutes": int(round(d["exercise_min"])) if d["exercise_min"] > 0 else None,
            "stand_hours": len(d["stand_hours"]) if d["stand_hours"] else None,
            "distance_km": round(d["distance_km"], 2) if d["distance_km"] > 0 else None,
            "flights_climbed": d["flights"] if d["flights"] > 0 else None,
            "audio_exposure_db": avg_or_none(d["audio_db"]),
            "body_mass_kg": avg_or_none(d["body_mass"]),
            "extra_metrics": extra,
            "athlete_id": athlete_id,
            "is_demo": False,
        }
        rows.append(row)

    return rows


def upload_to_supabase(rows: List[Dict[str, Any]], athlete_id: str, url: str = DEFAULT_SUPABASE_URL, api_key: str = DEFAULT_SUPABASE_KEY) -> int:
    endpoint = f"{url.rstrip('/')}/rest/v1/daily_recovery?on_conflict=recorded_date"
    headers = {
        "Content-Type": "application/json",
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Prefer": "resolution=merge-duplicates,return=representation",
        "x-athlete-token": athlete_id,
    }
    req = urllib.request.Request(endpoint, data=json.dumps(rows).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req) as resp:
        res_data = json.loads(resp.read().decode())
        return len(res_data)


def main() -> None:
    parser = argparse.ArgumentParser(description="Import all Apple Health export.zip metrics into BioCoach Supabase.")
    parser.add_argument("--zip", required=True, help="Path to Apple Health export.zip")
    parser.add_argument("--days", type=int, default=30, help="Number of recent days to import (default: 30)")
    parser.add_argument("--athlete-id", required=True, help="Private athlete PIN / token")
    args = parser.parse_args()

    rows = parse_apple_health_zip(args.zip, days_back=args.days, athlete_id=args.athlete_id)
    count = upload_to_supabase(
        rows,
        athlete_id=args.athlete_id,
        url=os.getenv("SUPABASE_URL", DEFAULT_SUPABASE_URL),
        api_key=os.getenv("SUPABASE_PUBLISHABLE_KEY", DEFAULT_SUPABASE_KEY),
    )
    print(f"Uploaded {count} full-telemetry daily records ({rows[0]['recorded_date']} to {rows[-1]['recorded_date']}).")


if __name__ == "__main__":
    main()
