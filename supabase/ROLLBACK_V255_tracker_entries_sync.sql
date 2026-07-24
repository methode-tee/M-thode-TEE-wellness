-- Rollback V255 — supprime uniquement le système de trackers dédié.
drop trigger if exists tracker_entries_set_updated_at on public.tracker_entries;
drop table if exists public.tracker_entries;
drop function if exists public.set_tracker_entry_updated_at();
