-- V356 — Mon Équilibre : historique compact des 3 jauges
-- À exécuter une seule fois dans Supabase > SQL Editor AVANT d'uploader le patch.
-- Aucun nouveau flux Realtime, aucune table média, aucune lecture au démarrage.

alter table public.daily_activity
  add column if not exists tee_balance_snapshot jsonb null;

comment on column public.daily_activity.tee_balance_snapshot is
'Résumé compact de Mon Équilibre pour la journée : Vitalité, Équilibre intérieur, Régularité et état général. Utilisé uniquement à la demande pour revoir les jours précédents.';

-- L'index user/date existe déjà depuis V166 et couvre les requêtes d'historique :
-- daily_activity_user_date_idx on (user_id, activity_date)
