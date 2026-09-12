-- MÉTHODE TEE — V4896594 — backfill buckets 6 et 7
begin;
update public.mt_food_culinary_profiles_v1 p
set profile=jsonb_set(
      coalesce(p.profile,'{}'::jsonb),
      '{deterministic}',
      public.mt_food_deterministic_sheet_v1(
        p.display_name,p.roles,p.fill_roles,p.families,p.pairing_mode,p.pairing_complete
      ),
      true
    ),
    updated_at=now()
where mod(abs(hashtext(coalesce(p.profile_key,p.dictionary_id::text,p.ciqual_code::text,p.display_name,''))::bigint),8) in (6,7);
commit;
