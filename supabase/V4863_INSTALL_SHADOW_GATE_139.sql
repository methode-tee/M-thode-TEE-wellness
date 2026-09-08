-- MÉTHODE TEE — V486.3 · SHADOW GATE SUR LE CORPUS V485
-- Installe un évaluateur parallèle qui exécute LES MÊMES 139 attentes critiques
-- contre resolve_food_speech_phrase_v7_json, sans modifier le gate V485.3 historique.

begin;

do $preflight$
begin
  if to_regclass('public.food_speech_regression_cases') is null then
    raise exception 'V486.3 shadow gate nécessite le corpus V485';
  end if;
  if to_regprocedure('public.resolve_food_speech_phrase_v7_json(text,jsonb,integer)') is null then
    raise exception 'V486.3 shadow gate nécessite le resolver V5';
  end if;
end
$preflight$;

create or replace function public.food_speech_regression_eval_v4863(p_case_id bigint)
returns jsonb
language plpgsql
volatile
security invoker
set search_path=public
as $v485_eval$
declare
  c public.food_speech_regression_cases%rowtype;
  v_payload jsonb;
  v_items jsonb;
  v_failures jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  v_expected jsonb;
  v_actual jsonb;
  v_display text;
  v_food_norm text;
  v_status text;
  v_source text;
  v_actual_count integer := 0;
  v_expected_len integer := 0;
  v_i integer;
  v_final_grams numeric;
  v_expected_grams numeric;
  v_tol numeric;
  v_q numeric;
  v_expected_q numeric;
  v_alt_count integer;
  v_started timestamptz;
  v_duration_ms numeric;
begin
  select * into c
  from public.food_speech_regression_cases
  where id=p_case_id and enabled;

  if not found then
    raise exception 'Cas de régression % introuvable ou désactivé',p_case_id;
  end if;

  v_started := clock_timestamp();
  v_payload := public.resolve_food_speech_phrase_v7_json(c.phrase,c.choices,12);
  v_duration_ms := round((extract(epoch from (clock_timestamp()-v_started))*1000)::numeric,3);

  if jsonb_typeof(v_payload) <> 'object' then
    v_failures := v_failures || jsonb_build_array(
      jsonb_build_object('code','payload_not_object','actual_type',jsonb_typeof(v_payload))
    );
    v_items := '[]'::jsonb;
  elsif jsonb_typeof(v_payload->'items') <> 'array' then
    v_failures := v_failures || jsonb_build_array(
      jsonb_build_object('code','items_not_array','actual_type',jsonb_typeof(v_payload->'items'))
    );
    v_items := '[]'::jsonb;
  else
    v_items := v_payload->'items';
  end if;

  v_actual_count := jsonb_array_length(v_items);

  if v_actual_count <> c.expected_count then
    v_failures := v_failures || jsonb_build_array(
      jsonb_build_object(
        'code','item_count',
        'expected',c.expected_count,
        'actual',v_actual_count
      )
    );
  end if;

  -- -------------------------------------------------------------------------
  -- 3a. Invariants GLOBAUX : valables pour chaque cas, même sans attente précise.
  -- -------------------------------------------------------------------------
  if v_actual_count > 0 then
    for v_i in 0..v_actual_count-1 loop
      v_actual := v_items->v_i;
      v_food_norm := public.food_normalize(coalesce(v_actual->>'food_text',''));

      if v_food_norm = any(array[
        '','mange','de','d','du','des','de la','de l','peu de','un peu de',
        'j ai mange','jai mange'
      ]) then
        v_failures := v_failures || jsonb_build_array(
          jsonb_build_object('code','phantom_segment','item',v_i+1,'food_text',v_actual->>'food_text')
        );
      end if;

      if coalesce((v_actual->>'item_index')::integer,-1) <> v_i+1 then
        v_failures := v_failures || jsonb_build_array(
          jsonb_build_object(
            'code','item_index_not_sequential',
            'item',v_i+1,
            'actual',v_actual->>'item_index'
          )
        );
      end if;

      if coalesce(v_actual->>'final_grams','') ~ '^[0-9]+([.][0-9]+)?$' then
        v_final_grams := (v_actual->>'final_grams')::numeric;
        if v_final_grams < 0 or v_final_grams > 5000 then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','implausible_grams','item',v_i+1,'grams',v_final_grams)
          );
        end if;
      else
        v_final_grams := null;
      end if;

      -- Ne jamais être prêt à écrire si l'item n'est pas explicitement confirmé.
      if coalesce((v_actual->>'ready_to_add')::boolean,false)
         and not coalesce((v_actual->>'confirmed')::boolean,false) then
        v_failures := v_failures || jsonb_build_array(
          jsonb_build_object('code','ready_without_confirmation','item',v_i+1)
        );
      end if;

      v_source := v_actual->'portion'->>'source';

      -- Contrat V484 : une portion naturelle est TOUJOURS une estimation confirmable.
      if v_source='speech_natural_portion' then
        if coalesce((v_actual->'portion'->>'estimated')::boolean,false) is not true
           or coalesce((v_actual->'portion'->>'verified')::boolean,true) is not false
           or coalesce((v_actual->'portion'->>'requires_confirmation')::boolean,false) is not true then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','natural_portion_safety_contract','item',v_i+1,'portion',v_actual->'portion')
          );
        end if;
      end if;

      -- Contrat métrique : "150 g" doit rester 150 g exact, jamais estimé.
      if v_source='spoken_metric' then
        if coalesce((v_actual->'portion'->>'estimated')::boolean,true) is not false
           or coalesce((v_actual->'portion'->>'verified')::boolean,false) is not true then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','spoken_metric_not_exact','item',v_i+1,'portion',v_actual->'portion')
          );
        end if;

        if public.food_normalize(coalesce(v_actual->'heard_quantity'->>'base_unit',''))='g'
           and coalesce(v_actual->'heard_quantity'->>'base_value','') ~ '^[0-9]+([.][0-9]+)?$'
           and v_final_grams is not null
           and abs(v_final_grams-(v_actual->'heard_quantity'->>'base_value')::numeric) > 0.01 then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object(
              'code','spoken_grams_changed',
              'item',v_i+1,
              'heard',v_actual->'heard_quantity'->>'base_value',
              'final',v_final_grams
            )
          );
        end if;
      end if;
    end loop;
  end if;

  -- -------------------------------------------------------------------------
  -- 3b. Attentes POSITIONNELLES du corpus.
  -- Les champs absents dans expected_items sont des jokers.
  -- -------------------------------------------------------------------------
  v_expected_len := jsonb_array_length(c.expected_items);

  if v_expected_len > 0 then
    for v_i in 0..v_expected_len-1 loop
      v_expected := c.expected_items->v_i;

      if v_i >= v_actual_count then
        v_failures := v_failures || jsonb_build_array(
          jsonb_build_object('code','missing_expected_item','item',v_i+1)
        );
        continue;
      end if;

      v_actual := v_items->v_i;
      v_display := coalesce(
        v_actual->'final_food'->>'display_name',
        v_actual->'original_resolution'->>'display_name',
        ''
      );
      v_status := coalesce(v_actual->>'status','');

      if v_expected ? 'display_contains' then
        if position(
          public.food_normalize(v_expected->>'display_contains')
          in public.food_normalize(v_display)
        ) = 0 then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object(
              'code','display',
              'item',v_i+1,
              'expected_contains',v_expected->>'display_contains',
              'actual',v_display
            )
          );
        end if;
      end if;

      if v_expected ? 'status_in' then
        if not coalesce((v_expected->'status_in') ? v_status,false) then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object(
              'code','status',
              'item',v_i+1,
              'expected_in',v_expected->'status_in',
              'actual',v_status
            )
          );
        end if;
      end if;

      if v_expected ? 'grams' then
        v_expected_grams := (v_expected->>'grams')::numeric;
        v_tol := coalesce(nullif(v_expected->>'grams_tolerance','')::numeric,0.01);
        if coalesce(v_actual->>'final_grams','') !~ '^[0-9]+([.][0-9]+)?$' then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','grams_missing','item',v_i+1,'expected',v_expected_grams)
          );
        elsif abs((v_actual->>'final_grams')::numeric-v_expected_grams) > v_tol then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object(
              'code','grams',
              'item',v_i+1,
              'expected',v_expected_grams,
              'actual',(v_actual->>'final_grams')::numeric,
              'tolerance',v_tol
            )
          );
        end if;
      end if;

      if v_expected ? 'source' then
        if coalesce(v_actual->'portion'->>'source','') <> v_expected->>'source' then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object(
              'code','portion_source',
              'item',v_i+1,
              'expected',v_expected->>'source',
              'actual',v_actual->'portion'->>'source'
            )
          );
        end if;
      end if;

      if v_expected ? 'alternatives_min' then
        v_alt_count := case
          when jsonb_typeof(v_actual->'alternatives')='array'
          then jsonb_array_length(v_actual->'alternatives')
          else 0
        end;
        if v_alt_count < (v_expected->>'alternatives_min')::integer then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object(
              'code','alternatives_min',
              'item',v_i+1,
              'expected_min',(v_expected->>'alternatives_min')::integer,
              'actual',v_alt_count
            )
          );
        end if;
      end if;

      if v_expected ? 'final_food_null' then
        if (v_expected->>'final_food_null')::boolean
           and coalesce(jsonb_typeof(v_actual->'final_food'),'null') <> 'null' then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','final_food_should_be_null','item',v_i+1,'actual',v_actual->'final_food')
          );
        end if;
      end if;

      if v_expected ? 'unit_code' then
        if coalesce(v_actual->'heard_quantity'->>'unit_code','') <> coalesce(v_expected->>'unit_code','') then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object(
              'code','unit_code',
              'item',v_i+1,
              'expected',v_expected->>'unit_code',
              'actual',v_actual->'heard_quantity'->>'unit_code'
            )
          );
        end if;
      end if;

      if v_expected ? 'quantity_value' then
        v_expected_q := (v_expected->>'quantity_value')::numeric;
        if coalesce(v_actual->'heard_quantity'->>'value','') !~ '^[0-9]+([.][0-9]+)?$' then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','quantity_missing','item',v_i+1,'expected',v_expected_q)
          );
        else
          v_q := (v_actual->'heard_quantity'->>'value')::numeric;
          if abs(v_q-v_expected_q)>0.0001 then
            v_failures := v_failures || jsonb_build_array(
              jsonb_build_object('code','quantity_value','item',v_i+1,'expected',v_expected_q,'actual',v_q)
            );
          end if;
        end if;
      end if;

      if v_expected ? 'estimated' then
        if coalesce((v_actual->'portion'->>'estimated')::boolean,false)
           is distinct from (v_expected->>'estimated')::boolean then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','estimated_flag','item',v_i+1,'actual',v_actual->'portion'->>'estimated')
          );
        end if;
      end if;

      if v_expected ? 'verified' then
        if coalesce((v_actual->'portion'->>'verified')::boolean,false)
           is distinct from (v_expected->>'verified')::boolean then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','verified_flag','item',v_i+1,'actual',v_actual->'portion'->>'verified')
          );
        end if;
      end if;

      if v_expected ? 'requires_confirmation' then
        if coalesce((v_actual->'portion'->>'requires_confirmation')::boolean,false)
           is distinct from (v_expected->>'requires_confirmation')::boolean then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','requires_confirmation','item',v_i+1,'actual',v_actual->'portion'->>'requires_confirmation')
          );
        end if;
      end if;

      if v_expected ? 'ready_for_confirmation' then
        if coalesce((v_actual->>'ready_for_confirmation')::boolean,false)
           is distinct from (v_expected->>'ready_for_confirmation')::boolean then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','ready_for_confirmation','item',v_i+1,'actual',v_actual->>'ready_for_confirmation')
          );
        end if;
      end if;

      if v_expected ? 'ready_to_add' then
        if coalesce((v_actual->>'ready_to_add')::boolean,false)
           is distinct from (v_expected->>'ready_to_add')::boolean then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object('code','ready_to_add','item',v_i+1,'actual',v_actual->>'ready_to_add')
          );
        end if;
      end if;

      if v_expected ? 'quantity_mode' then
        if coalesce(v_actual->>'quantity_mode','') <> v_expected->>'quantity_mode' then
          v_failures := v_failures || jsonb_build_array(
            jsonb_build_object(
              'code','quantity_mode',
              'item',v_i+1,
              'expected',v_expected->>'quantity_mode',
              'actual',v_actual->>'quantity_mode'
            )
          );
        end if;
      end if;
    end loop;
  end if;

  -- La performance est observée, pas bloquante : environnement SQL variable.
  if v_duration_ms > 1000 then
    v_warnings := v_warnings || jsonb_build_array(
      jsonb_build_object('code','slow_case','duration_ms',v_duration_ms)
    );
  end if;

  return jsonb_build_object(
    'case_id',c.id,
    'label',c.label,
    'category',c.category,
    'critical',c.critical,
    'phrase',c.phrase,
    'pass',jsonb_array_length(v_failures)=0,
    'failure_count',jsonb_array_length(v_failures),
    'failures',v_failures,
    'warnings',v_warnings,
    'expected_count',c.expected_count,
    'actual_count',v_actual_count,
    'duration_ms',v_duration_ms,
    'payload',v_payload
  );
end
$v485_eval$;

-- ---------------------------------------------------------------------------
-- 4. RUNNER DU CORPUS
-- ---------------------------------------------------------------------------
create or replace function public.food_speech_regression_run_v4863(
  p_category text default null,
  p_critical_only boolean default false
)
returns table(
  case_id bigint,
  label text,
  category text,
  critical boolean,
  pass boolean,
  failure_count integer,
  failures jsonb,
  warnings jsonb,
  duration_ms numeric,
  payload jsonb
)
language plpgsql
volatile
security invoker
set search_path=public
as $v485_run$
declare
  c record;
  e jsonb;
begin
  for c in
    select rc.id
    from public.food_speech_regression_cases rc
    where rc.enabled
      and (p_category is null or rc.category=p_category)
      and (not p_critical_only or rc.critical)
    order by rc.critical desc,rc.category,rc.id
  loop
    e := public.food_speech_regression_eval_v4863(c.id);
    case_id := (e->>'case_id')::bigint;
    label := e->>'label';
    category := e->>'category';
    critical := (e->>'critical')::boolean;
    pass := (e->>'pass')::boolean;
    failure_count := (e->>'failure_count')::integer;
    failures := e->'failures';
    warnings := e->'warnings';
    duration_ms := (e->>'duration_ms')::numeric;
    payload := e->'payload';
    return next;
  end loop;
end
$v485_run$;

-- ---------------------------------------------------------------------------
-- 5. GATE CRITIQUE : résumé compact à utiliser avant/après chaque patch moteur
-- ---------------------------------------------------------------------------
create or replace function public.food_speech_regression_gate_v4863()
returns jsonb
language sql
volatile
security invoker
set search_path=public
as $v485_gate$
  with r as materialized (
    select * from public.food_speech_regression_run_v4863(null,true)
  ), cat as (
    select category,
           count(*) total,
           count(*) filter(where pass) passed,
           count(*) filter(where not pass) failed
    from r
    group by category
  )
  select jsonb_build_object(
    'baseline','V485.3',
    'corpus_version','V485 + V486.3 shadow',
    'critical_cases',count(*),
    'passed',count(*) filter(where pass),
    'failed',count(*) filter(where not pass),
    'gate_pass',coalesce(bool_and(pass),false),
    'total_duration_ms',round(coalesce(sum(duration_ms),0),2),
    'max_case_ms',round(coalesce(max(duration_ms),0),2),
    'by_category',coalesce((
      select jsonb_object_agg(
        category,
        jsonb_build_object('total',total,'passed',passed,'failed',failed)
        order by category
      )
      from cat
    ),'{}'::jsonb)
  )
  from r;
$v485_gate$;

-- ---------------------------------------------------------------------------
-- 6. ASSERT OPTIONNEL : pour CI / pré-déploiement. Échoue si une régression critique existe.
-- ---------------------------------------------------------------------------
create or replace function public.food_speech_regression_assert_v4863()
returns jsonb
language plpgsql
volatile
security invoker
set search_path=public
as $v485_assert$
declare
  g jsonb;
begin
  g := public.food_speech_regression_gate_v4863();
  if not coalesce((g->>'gate_pass')::boolean,false) then
    raise exception 'Bébé TEE regression gate FAILED: %',g::text;
  end if;
  return g;
end
$v485_assert$;

-- Test harness non exposé aux clients.
revoke all on function public.food_speech_regression_eval_v4863(bigint) from anon, authenticated;
revoke all on function public.food_speech_regression_run_v4863(text,boolean) from anon, authenticated;
revoke all on function public.food_speech_regression_gate_v4863() from anon, authenticated;
revoke all on function public.food_speech_regression_assert_v4863() from anon, authenticated;


commit;
