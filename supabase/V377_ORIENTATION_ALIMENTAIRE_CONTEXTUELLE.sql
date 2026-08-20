-- V377 — Orientation alimentaire contextuelle
-- À exécuter après V376. Idempotent.

-- Les bols sucrés sont reconnus même sans moment de repas explicitement choisi.
update public.food_dictionary
set adapter_profile=coalesce(adapter_profile,'{}'::jsonb)||jsonb_build_object(
  'adapter_family','sweet_bowl',
  'sweet_breakfast',true,
  'do_not_auto_suggest_vegetables',true
)
where normalized_name in (
  public.food_normalize('Muesli'),
  public.food_normalize('Flocons d''avoine'),
  public.food_normalize('Lakh'),
  public.food_normalize('Msemen'),
  public.food_normalize('Mango sticky rice')
);

-- Ces éléments sont principalement des bases féculentes : le moteur doit
-- demander la sauce/protéine plutôt que juger l'aliment isolément.
update public.food_dictionary
set adapter_profile=coalesce(adapter_profile,'{}'::jsonb)||jsonb_build_object(
  'adapter_family','starch_side',
  'requires_accompaniment',true,
  'do_not_auto_suggest_vegetables',true
)
where normalized_name in (
  public.food_normalize('Achu'),
  public.food_normalize('Foutou banane'),
  public.food_normalize('Foutou igname'),
  public.food_normalize('Placali'),
  public.food_normalize('Pounded yam'),
  public.food_normalize('Eba'),
  public.food_normalize('Amala'),
  public.food_normalize('Banku'),
  public.food_normalize('Kenkey')
);

update public.food_dictionary
set adapter_profile=coalesce(adapter_profile,'{}'::jsonb)||jsonb_build_object(
  'adapter_family','soup',
  'soup',true,
  'composition_variable',true
)
where normalized_name in (
  public.food_normalize('Harira'),
  public.food_normalize('Ramen'),
  public.food_normalize('Chorba frik'),
  public.food_normalize('Bissara'),
  public.food_normalize('Lablabi'),
  public.food_normalize('Tom yum')
);

-- Tous les autres plats composés variables connus utilisent la question
-- contextuelle lorsque leur version réelle n'est pas assez décrite.
update public.food_dictionary
set adapter_profile=coalesce(adapter_profile,'{}'::jsonb)||jsonb_build_object(
  'adapter_family','variable_composite'
)
where coalesce((adapter_profile->>'composition_variable')::boolean,false)=true
  and coalesce(adapter_profile->>'adapter_family','')='';

notify pgrst,'reload schema';
