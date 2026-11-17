-- ==============================================================================
-- BioCoach AI: Bulletproof Server-Side Telemetry Ingestor RPCs & RLS Policies
-- Accepts messy raw values from Apple Shortcuts (seconds/minutes/hours, °F/°C,
-- empty strings "", Spanish commas "5,5", decimals on INT fields, text units)
-- and cleanly normalizes + stores them in Supabase without 22P02/22003/42501.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: sync_biocoach (01A. BioCoach Vitales + 01B. BioCoach Actividad)
-- ------------------------------------------------------------------------------
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
#variable_conflict use_column
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
  v_date := COALESCE(NULLIF(TRIM(sync_biocoach.recorded_date), '')::DATE, (NOW() AT TIME ZONE 'America/Bogota')::DATE);
  v_athlete := COALESCE(NULLIF(TRIM(sync_biocoach.athlete_id), ''), 'atleta_privado');

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.sleep_hours, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    v_sleep := CASE WHEN v_raw > 1440 THEN ROUND(v_raw / 3600.0, 2) WHEN v_raw > 24 THEN ROUND(v_raw / 60.0, 2) ELSE ROUND(v_raw, 2) END;
  END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.deep_sleep_hours, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    v_deep := CASE WHEN v_raw > 1440 THEN ROUND(v_raw / 3600.0, 2) WHEN v_raw > 24 THEN ROUND(v_raw / 60.0, 2) ELSE ROUND(v_raw, 2) END;
  END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.rem_sleep_hours, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    v_rem := CASE WHEN v_raw > 1440 THEN ROUND(v_raw / 3600.0, 2) WHEN v_raw > 24 THEN ROUND(v_raw / 60.0, 2) ELSE ROUND(v_raw, 2) END;
  END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.resting_hr, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 25 AND v_raw < 250 THEN v_rhr := ROUND(v_raw, 2); END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.hrv_ms, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw >= 5 AND v_raw < 500 THEN v_hrv := ROUND(v_raw, 2); END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.respiratory_rate, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw >= 6 AND v_raw < 60 THEN v_resp := ROUND(v_raw, 2); END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.spo2_pct, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    v_raw := CASE WHEN v_raw <= 1.5 THEN ROUND(v_raw * 100.0, 1) ELSE ROUND(v_raw, 1) END;
    IF v_raw >= 75 AND v_raw <= 100 THEN v_spo2 := v_raw; END IF;
  END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.wrist_temp_deviation, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    v_temp := CASE WHEN v_raw > 50 THEN ROUND((v_raw - 32.0) * 5.0 / 9.0, 2) ELSE ROUND(v_raw, 2) END;
  END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.steps, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_steps := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.active_calories, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_act_cal := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.basal_calories, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_bas_cal := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.exercise_minutes, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_ex_min := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.distance_km, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_dist := ROUND(v_raw, 2); END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.flights_climbed, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_flights := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.daylight_minutes, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_daylight := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.walking_hr_avg, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 25 AND v_raw < 250 THEN v_walk_hr := ROUND(v_raw, 2); END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_biocoach.audio_exposure_db, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 AND v_raw < 200 THEN v_audio := ROUND(v_raw, 2); END IF;

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
    'steps', v_steps,
    'active_kcal', v_act_cal,
    'basal_kcal', v_bas_cal
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_biocoach TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 2. RPC: sync_workout (02. Fin de Entrenamiento)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_workout(
  athlete_id text DEFAULT 'atleta_privado',
  workout_type text DEFAULT 'Entrenamiento',
  duration_minutes text DEFAULT NULL,
  active_calories text DEFAULT NULL,
  avg_hr text DEFAULT NULL,
  max_hr text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
DECLARE
  v_athlete TEXT;
  v_type TEXT;
  v_dur NUMERIC(5,2);
  v_cal INT;
  v_avg_hr INT;
  v_max_hr INT;
  v_raw NUMERIC;
  v_txt TEXT;
BEGIN
  v_athlete := COALESCE(NULLIF(TRIM(sync_workout.athlete_id), ''), 'atleta_privado');
  v_type := COALESCE(NULLIF(TRIM(sync_workout.workout_type), ''), 'Entrenamiento');

  v_txt := LOWER(COALESCE(sync_workout.duration_minutes, ''));
  v_raw := NULLIF(SUBSTRING(REPLACE(v_txt, ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN
    IF v_txt LIKE '%sec%' OR v_txt LIKE '%seg%' OR v_raw > 600 THEN
      v_dur := ROUND(v_raw / 60.0, 2);
    ELSIF v_txt LIKE '%hr%' OR v_txt LIKE '%hora%' THEN
      v_dur := ROUND(v_raw * 60.0, 2);
    ELSE
      v_dur := ROUND(v_raw, 2);
    END IF;
  END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_workout.active_calories, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw > 0 THEN v_cal := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_workout.avg_hr, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw >= 30 AND v_raw <= 240 THEN v_avg_hr := ROUND(v_raw)::INT; END IF;

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_workout.max_hr, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NOT NULL AND v_raw >= 30 AND v_raw <= 240 THEN v_max_hr := ROUND(v_raw)::INT; END IF;

  INSERT INTO workouts (
    athlete_id, is_demo, workout_type, duration_minutes, active_calories, avg_hr, max_hr
  ) VALUES (
    v_athlete, false, v_type, v_dur, v_cal, v_avg_hr, v_max_hr
  );

  RETURN jsonb_build_object(
    'ok', true,
    'workout', v_type,
    'min', v_dur,
    'kcal', v_cal,
    'avg_hr', v_avg_hr,
    'max_hr', v_max_hr
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_workout TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. RPC: sync_hr_checkin (03. Check Cardíaco)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_hr_checkin(
  athlete_id text DEFAULT 'atleta_privado',
  current_hr text DEFAULT NULL,
  user_sensation text DEFAULT 'rutina'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
DECLARE
  v_athlete TEXT;
  v_hr INT;
  v_sens TEXT;
  v_raw NUMERIC;
BEGIN
  v_athlete := COALESCE(NULLIF(TRIM(sync_hr_checkin.athlete_id), ''), 'atleta_privado');
  v_sens := COALESCE(NULLIF(TRIM(sync_hr_checkin.user_sensation), ''), 'rutina');

  v_raw := NULLIF(SUBSTRING(REPLACE(COALESCE(sync_hr_checkin.current_hr, ''), ',', '.') FROM '-?[0-9]+(\.[0-9]+)?'), '')::NUMERIC;
  IF v_raw IS NULL OR v_raw < 30 OR v_raw > 240 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pulso inválido o vacío');
  END IF;
  v_hr := ROUND(v_raw)::INT;

  INSERT INTO hr_checkins (athlete_id, is_demo, current_hr, user_sensation)
  VALUES (v_athlete, false, v_hr, v_sens);

  RETURN jsonb_build_object('ok', true, 'hr', v_hr, 'sensation', v_sens);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_hr_checkin TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 4. RPC: sync_nutrition (04. BioCoach Comida por Voz)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_nutrition(
  athlete_id text DEFAULT 'atleta_privado',
  meal_type text DEFAULT 'comida',
  raw_text text DEFAULT NULL,
  logged_date text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
#variable_conflict use_column
DECLARE
  v_athlete TEXT;
  v_meal TEXT;
  v_text TEXT;
  v_date DATE;
BEGIN
  v_athlete := COALESCE(NULLIF(TRIM(sync_nutrition.athlete_id), ''), 'atleta_privado');
  v_meal := LOWER(COALESCE(NULLIF(TRIM(sync_nutrition.meal_type), ''), 'comida'));
  v_text := NULLIF(TRIM(sync_nutrition.raw_text), '');
  v_date := COALESCE(NULLIF(TRIM(sync_nutrition.logged_date), '')::DATE, (NOW() AT TIME ZONE 'America/Bogota')::DATE);

  IF v_text IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Texto de comida vacío');
  END IF;

  INSERT INTO nutrition_logs (athlete_id, is_demo, logged_date, meal_type, raw_text)
  VALUES (v_athlete, false, v_date, v_meal, v_text);

  RETURN jsonb_build_object('ok', true, 'date', v_date, 'meal', v_meal, 'text', v_text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_nutrition TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 5. Complete RLS Policies for hr_checkins & nutrition_logs (WebApp Read/Write)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Private Athlete Select hr_checkins" ON hr_checkins;
CREATE POLICY "Private Athlete Select hr_checkins"
ON hr_checkins FOR SELECT
USING (is_demo = true OR athlete_id = current_setting('request.headers', true)::json->>'x-athlete-token');

DROP POLICY IF EXISTS "Private Athlete Write hr_checkins" ON hr_checkins;
CREATE POLICY "Private Athlete Write hr_checkins"
ON hr_checkins FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Private Athlete Select nutrition_logs" ON nutrition_logs;
CREATE POLICY "Private Athlete Select nutrition_logs"
ON nutrition_logs FOR SELECT
USING (is_demo = true OR athlete_id = current_setting('request.headers', true)::json->>'x-athlete-token');

DROP POLICY IF EXISTS "Private Athlete Write nutrition_logs" ON nutrition_logs;
CREATE POLICY "Private Athlete Write nutrition_logs"
ON nutrition_logs FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Private Athlete Update nutrition_logs" ON nutrition_logs;
CREATE POLICY "Private Athlete Update nutrition_logs"
ON nutrition_logs FOR UPDATE
USING (athlete_id = current_setting('request.headers', true)::json->>'x-athlete-token');

DROP POLICY IF EXISTS "Private Athlete Delete nutrition_logs" ON nutrition_logs;
CREATE POLICY "Private Athlete Delete nutrition_logs"
ON nutrition_logs FOR DELETE
USING (athlete_id = current_setting('request.headers', true)::json->>'x-athlete-token');
