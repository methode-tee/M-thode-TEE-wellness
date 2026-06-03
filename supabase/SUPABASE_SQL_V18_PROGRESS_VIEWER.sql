-- V18 — Progression protocole
-- Exécuter dans Supabase SQL Editor

-- 1. Ajouter total_days aux protocoles (si pas déjà présent)
ALTER TABLE protocols ADD COLUMN IF NOT EXISTS total_days integer DEFAULT NULL;

-- 2. Table de progression par utilisateur et protocole
CREATE TABLE IF NOT EXISTS protocol_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  protocol_id uuid NOT NULL REFERENCES protocols(id) ON DELETE CASCADE,
  days_current integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_check_date date,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, protocol_id)
);

-- 3. RLS
ALTER TABLE protocol_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own progress" ON protocol_progress;
CREATE POLICY "Users manage own progress" ON protocol_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- 4. Ajouter les nouveaux types dans protocol_contents (si une contrainte CHECK existe)
-- Si erreur "invalid input value for enum" : ignorer, les types sont libres en text
-- ALTER TABLE protocol_contents DROP CONSTRAINT IF EXISTS protocol_contents_type_check;

COMMENT ON TABLE protocol_progress IS 'Suivi de progression jour/streak par utilisateur et protocole';
