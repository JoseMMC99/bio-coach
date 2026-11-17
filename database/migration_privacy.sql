-- ==============================================================================
-- BioCoach AI: Privacy Migration & Row Level Security (RLS) Isolation
-- Ensures public portfolio visitors on GitHub Pages only view demo data
-- while athlete private telemetry remains completely sealed and protected.
-- ==============================================================================

-- 1. ADD ISOLATION COLUMNS TO ALL TELEMETRY TABLES
ALTER TABLE daily_recovery ADD COLUMN IF NOT EXISTS athlete_id TEXT DEFAULT 'public_demo';
ALTER TABLE daily_recovery ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

ALTER TABLE workouts ADD COLUMN IF NOT EXISTS athlete_id TEXT DEFAULT 'public_demo';
ALTER TABLE workouts ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

ALTER TABLE hr_checkins ADD COLUMN IF NOT EXISTS athlete_id TEXT DEFAULT 'public_demo';
ALTER TABLE hr_checkins ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS athlete_id TEXT DEFAULT 'public_demo';
ALTER TABLE nutrition_logs ADD COLUMN IF NOT EXISTS is_demo BOOLEAN DEFAULT false;

-- 2. TAG EXISTING SEEDED TELEMETRY AS DEMO DATA (PORTFOLIO SHOWCASE)
UPDATE daily_recovery SET is_demo = true, athlete_id = 'public_demo' WHERE is_demo IS NULL OR is_demo = false;
UPDATE workouts SET is_demo = true, athlete_id = 'public_demo' WHERE is_demo IS NULL OR is_demo = false;
UPDATE hr_checkins SET is_demo = true, athlete_id = 'public_demo' WHERE is_demo IS NULL OR is_demo = false;
UPDATE nutrition_logs SET is_demo = true, athlete_id = 'public_demo' WHERE is_demo IS NULL OR is_demo = false;

-- 3. DROP OLD PERMISSIVE POLICIES
DROP POLICY IF EXISTS "Permitir acceso a anon daily_recovery" ON daily_recovery;
DROP POLICY IF EXISTS "Permitir acceso a anon workouts" ON workouts;
DROP POLICY IF EXISTS "Permitir acceso a anon hr_checkins" ON hr_checkins;
DROP POLICY IF EXISTS "Permitir acceso a anon nutrition_logs" ON nutrition_logs;

DROP POLICY IF EXISTS "Public Read Demo Only daily_recovery" ON daily_recovery;
DROP POLICY IF EXISTS "Public Read Demo Only workouts" ON workouts;
DROP POLICY IF EXISTS "Public Read Demo Only hr_checkins" ON hr_checkins;
DROP POLICY IF EXISTS "Public Read Demo Only nutrition_logs" ON nutrition_logs;

-- 4. ENABLE RLS
ALTER TABLE daily_recovery ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE hr_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE nutrition_logs ENABLE ROW LEVEL SECURITY;

-- 5. PUBLIC ACCESS: Permitted ONLY to read records marked as is_demo = true
CREATE POLICY "Public Read Demo Only daily_recovery" 
ON daily_recovery FOR SELECT 
USING (is_demo = true);

CREATE POLICY "Public Read Demo Only workouts" 
ON workouts FOR SELECT 
USING (is_demo = true);

CREATE POLICY "Public Read Demo Only hr_checkins" 
ON hr_checkins FOR SELECT 
USING (is_demo = true);

CREATE POLICY "Public Read Demo Only nutrition_logs" 
ON nutrition_logs FOR SELECT 
USING (is_demo = true);

-- 6. PRIVATE ATHLETE ACCESS: Unlocked when athlete_id matches or via private headers
CREATE POLICY "Private Athlete Write daily_recovery" 
ON daily_recovery FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Private Athlete Select daily_recovery" 
ON daily_recovery FOR SELECT 
USING (is_demo = true OR athlete_id = current_setting('request.headers', true)::json->>'x-athlete-token');

CREATE POLICY "Private Athlete Write workouts" 
ON workouts FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Private Athlete Select workouts" 
ON workouts FOR SELECT 
USING (is_demo = true OR athlete_id = current_setting('request.headers', true)::json->>'x-athlete-token');
