-- ==========================================================
-- V85 - Protocol reminders at 7h
-- Méthode Tee
-- ==========================================================

BEGIN;

-- Colonnes non destructives : elles évitent d’envoyer plusieurs fois
-- le même rappel pour le même jour de protocole.
ALTER TABLE public.protocol_progress
ADD COLUMN IF NOT EXISTS last_protocol_reminder_day integer DEFAULT 0;

ALTER TABLE public.protocol_progress
ADD COLUMN IF NOT EXISTS last_protocol_reminder_at timestamptz;

COMMIT;

-- À faire ensuite dans Supabase Edge Functions > Schedules :
-- planifier la fonction send-protocol-reminders tous les jours à 7h.
-- Si Supabase demande un cron UTC :
--   heure d’hiver France : 0 6 * * *
--   heure d’été France : 0 5 * * *
-- Sinon, si l’interface permet Europe/Paris : 0 7 * * *
