-- ==============================================================================
-- BioCoach AI: Bulletproof Server-Side Telemetry Ingestor RPC
-- Accepts messy raw values from Apple Shortcuts (seconds/minutes/hours, °F/°C,
-- empty strings "", Spanish commas "5,5", decimals on INT fields, text units)
-- and cleanly normalizes + merges them into daily_recovery without 22P02/22003.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_biocoach(
  recorded_date text DEFAULT NULL,
  athlete_id text DEFAULT 'atleta_privado',
  sleep_hours text DEFAULT NULL,
  deep_sleep_hours text DEFAULT NULL,
  rem_sleep_hours text DEFAULT NULL,
  resting_hr text DEFAULT NULL,
  hrv_ms text DEFAULT NULL,
  respiratory_rate text DEFAULT NULL,
  spo2_pct text DEFAULT NULL,
  wrist_temp_deviation text DEFAULT NULL,
  steps text DEFAULT NULL,
  active_calories text DEFAULT NULL,
  basal_calories text DEFAULT NULL,
  exercise_minutes text DEFAULT NULL,
  distance_km text DEFAULT NULL,
  flights_climbed text DEFAULT NULL,
  daylight_minutes text DEFAULT NULL,
  walking_hr_avg text DEFAULT NULL,
  audio_exposure_db text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date DATE;
  v_athlete TEXT;
  v_sleep NUMERIC(4,2);
  v_deep NUMERIC(4,2);
  v_rem NUMERIC(4,2);
  v_rhr NUMERIC(5,2);
  v_hrv NUMERIC(5,2);
  v_resp NUMERIC(4,2);
  v_spo2 NUMERIC(5,2);
  v_temp NUMERIC(5,2);
  v_steps INT;
  v_act_cal INT;
  v_bas_cal INT;
  v_ex_min INT;
  v_dist NUMERIC(6,2);
  v_flights INT;
  v_daylight INT;
  v_walk_hr NUMERIC(5,2);
  v_audio NUMERIC(5,2);
  v_raw NUMERIC;
BEGIN
  -- 1. Resolve date (fallback to Colombia local date UTC-5)
  v_date := COALESCE(NULLIF(TRIM(recorded_date), '')::DATE, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
  v_athlete := COALESCE(NULLIF(TRIM(athlete_id), ''), 'atleta_privado');

  -- Helper inline cleaning via regex (extracts first signed decimal, handles commas & units)
  -- Sleep total (auto-converts seconds >1440 or minutes >24 to hours)
  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sleep_hours, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    v_sleep := CASE WHEN v_raw > 1440 THEN ROUND(v_raw / 3600.0, 2) WHEN v_raw > 24 THEN ROUND(v_raw / 60.0, 2) ELSE ROUND(v_raw, 2) END;
  END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(deep_sleep_hours, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    v_deep := CASE WHEN v_raw > 1440 THEN ROUND(v_raw / 3600.0, 2) WHEN v_raw > 24 THEN ROUND(v_raw / 60.0, 2) ELSE ROUND(v_raw, 2) END;
  END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(rem_sleep_hours, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    v_rem := CASE WHEN v_raw > 1440 THEN ROUND(v_raw / 3600.0, 2) WHEN v_raw > 24 THEN ROUND(v_raw / 60.0, 2) ELSE ROUND(v_raw, 2) END;
  END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(resting_hr, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 AND v_raw < 250 THEN v_rhr := ROUND(v_raw, 2); END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(hrv_ms, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 AND v_raw < 500 THEN v_hrv := ROUND(v_raw, 2); END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(respiratory_rate, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 AND v_raw < 99 THEN v_resp := ROUND(v_raw, 2); END IF;

  -- SpO2 (auto-converts 0.95 -> 95.0)
  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(spo2_pct, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    v_spo2 := CASE WHEN v_raw <= 1.5 THEN ROUND(v_raw * 100.0, 1) ELSE ROUND(v_raw, 1) END;
  END IF;

  -- Wrist Temperature (auto-converts Fahrenheit > 50 -> Celsius)
  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(wrist_temp_deviation, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    v_temp := CASE WHEN v_raw > 50 THEN ROUND((v_raw - 32.0) * 5.0 / 9.0, 2) ELSE ROUND(v_raw, 2) END;
  END IF;

  -- Integer activity metrics
  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(steps, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_steps := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(active_calories, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_act_cal := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(basal_calories, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_bas_cal := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(exercise_minutes, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_ex_min := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(distance_km, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_dist := ROUND(v_raw, 2); END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(flights_climbed, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_flights := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(daylight_minutes, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_daylight := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(walking_hr_avg, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 AND v_raw < 250 THEN v_walk_hr := ROUND(v_raw, 2); END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(audio_exposure_db, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 AND v_raw < 200 THEN v_audio := ROUND(v_raw, 2); END IF;

  -- Upsert merging ONLY non-null incoming fields so Vitales & Actividad never overwrite each other
  INSERT INTO daily_recovery (
    recorded_date, athlete_id, is_demo,
    sleep_hours, deep_sleep_hours, rem_sleep_hours,
    resting_hr, hrv_ms, respiratory_rate, spo2_pct, wrist_temp_deviation,
    steps, active_calories, basal_calories, exercise_minutes,
    distance_km, flights_climbed, daylight_minutes, walking_hr_avg, audio_exposure_db
  ) VALUES (
    v_date, v_athlete, false,
    v_sleep, v_deep, v_rem,
    v_rhr, v_hrv, v_resp, v_spo2, v_temp,
    v_steps, v_act_cal, v_bas_cal, v_ex_min,
    v_dist, v_flights, v_daylight, v_walk_hr, v_audio
  )
  ON CONFLICT (recorded_date) DO UPDATE SET
    athlete_id           = COALESCE(EXCLUDED.athlete_id, daily_recovery.athlete_id),
    sleep_hours          = COALESCE(EXCLUDED.sleep_hours, daily_recovery.sleep_hours),
    deep_sleep_hours     = COALESCE(EXCLUDED.deep_sleep_hours, daily_recovery.deep_sleep_hours),
    rem_sleep_hours      = COALESCE(EXCLUDED.rem_sleep_hours, daily_recovery.rem_sleep_hours),
    resting_hr           = COALESCE(EXCLUDED.resting_hr, daily_recovery.resting_hr),
    hrv_ms               = COALESCE(EXCLUDED.hrv_ms, daily_recovery.hrv_ms),
    respiratory_rate     = COALESCE(EXCLUDED.respiratory_rate, daily_recovery.respiratory_rate),
    spo2_pct             = COALESCE(EXCLUDED.spo2_pct, daily_recovery.spo2_pct),
    wrist_temp_deviation = COALESCE(EXCLUDED.wrist_temp_deviation, daily_recovery.wrist_temp_deviation),
    steps                = COALESCE(EXCLUDED.steps, daily_recovery.steps),
    active_calories      = COALESCE(EXCLUDED.active_calories, daily_recovery.active_calories),
    basal_calories       = COALESCE(EXCLUDED.basal_calories, daily_recovery.basal_calories),
    exercise_minutes     = COALESCE(EXCLUDED.exercise_minutes, daily_recovery.exercise_minutes),
    distance_km          = COALESCE(EXCLUDED.distance_km, daily_recovery.distance_km),
    flights_climbed      = COALESCE(EXCLUDED.flights_climbed, daily_recovery.flights_climbed),
    daylight_minutes     = COALESCE(EXCLUDED.daylight_minutes, daily_recovery.daylight_minutes),
    walking_hr_avg       = COALESCE(EXCLUDED.walking_hr_avg, daily_recovery.walking_hr_avg),
    audio_exposure_db    = COALESCE(EXCLUDED.audio_exposure_db, daily_recovery.audio_exposure_db);

  RETURN jsonb_build_object(
    'ok', true,
    'date', v_date,
    'sleep_h', v_sleep,
    'rhr', v_rhr,
    'hrv', v_hrv,
    'resp', v_resp,
    'spo2', v_spo2,
    'temp_c', v_temp,
    'steps', v_steps
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_biocoach TO anon, authenticated;
