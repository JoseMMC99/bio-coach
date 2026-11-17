-- ==============================================================================
-- BioCoach AI: Full Apple Health Biometric Schema Expansion
-- Expands daily_recovery to capture ALL Apple Watch / HealthKit metrics:
-- Sleep Architecture, Cardiovascular, Respiratory/Immune, Activity, Mobility & Events
-- ==============================================================================

ALTER TABLE daily_recovery
  -- Widen wrist_temp_deviation to NUMERIC(5,2) to prevent overflow even on >100°F readings
  ALTER COLUMN wrist_temp_deviation TYPE NUMERIC(5,2),

  -- Complete Sleep Architecture
  ADD COLUMN IF NOT EXISTS core_sleep_hours NUMERIC(4,2),
  ADD COLUMN IF NOT EXISTS awake_sleep_hours NUMERIC(4,2),

  -- Respiratory, Oxygen & Sleep Apnea / Immune Vitals
  ADD COLUMN IF NOT EXISTS spo2_pct NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS breathing_disturbances NUMERIC(5,2),

  -- Complete Cardiovascular Telemetry
  ADD COLUMN IF NOT EXISTS avg_hr NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS min_hr NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS max_hr NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS walking_hr_avg NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS vo2_max NUMERIC(5,2),

  -- Activity, Energy & Environment
  ADD COLUMN IF NOT EXISTS steps INT,
  ADD COLUMN IF NOT EXISTS active_calories INT,
  ADD COLUMN IF NOT EXISTS basal_calories INT,
  ADD COLUMN IF NOT EXISTS exercise_minutes INT,
  ADD COLUMN IF NOT EXISTS stand_hours INT,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS flights_climbed INT,
  ADD COLUMN IF NOT EXISTS audio_exposure_db NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS body_mass_kg NUMERIC(5,2),

  -- Flexible JSONB for all remaining mobility, gait, cycling, effort & clinical alert events
  ADD COLUMN IF NOT EXISTS extra_metrics JSONB DEFAULT '{}'::jsonb;
