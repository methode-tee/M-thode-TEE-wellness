-- ============================================================================
-- MÉTHODE TEE — V489.4.3
-- CATALOGUE CULINAIRE ÉTENDU + BUDGET ÉQUILIBRÉ RENFORCÉ + UI ÉPURÉE
--
-- Backend de ce patch :
--   * conserve les 300 repas V489.4.1.2 déjà chargés ;
--   * ajoute un dictionnaire culinaire explicite pour 111 couples
--     composant/rôle, couvrant 923/937 occurrences du catalogue source ;
--   * résout uniquement ces composants par regex culinaires whitelistées ;
--   * ne baisse PAS le seuil resolved_high ;
--   * republie seulement les repas dont tous les composants obligatoires sont
--     réellement résolus_high ;
--   * les niveaux culturels 2 restent en revue manuelle ;
--   * aucune ligne CIQUAL, prix, recette, protocole, paiement ou mémoire n'est
--     modifiée.
--
-- IMPORTANT : ce SQL est INCRÉMENTAL. Il suppose V489.4.1.2 déjà appliqué.
-- ============================================================================

begin;

do $preflight$
begin
  if to_regclass('public.mt_curated_meals_v2') is null
     or to_regclass('public.mt_curated_meal_components_v2') is null
     or to_regclass('public.ciqual_foods') is null
     or to_regprocedure('public.mt_planner_curated_catalog_v2()') is null
     or to_regprocedure('public.mt_curated_catalog_audit_v2()') is null
  then
    raise exception 'V48943_PREREQUIS_MANQUANT_APPLIQUER_V489412_AVANT';
  end if;
end
$preflight$;

-- --------------------------------------------------------------------------
-- 1) DICTIONNAIRE CULINAIRE EXPLICITE
-- --------------------------------------------------------------------------
create table if not exists public.mt_curated_component_dictionary_v3(
  component_name_norm text not null,
  expected_role text not null,
  canonical_key text not null,
  include_regex text not null,
  prefer_regex text,
  exclude_regex text,
  prefer_required boolean not null default false,
  confidence numeric not null default 0.99 check(confidence>=0 and confidence<=1),
  source text not null default 'TEE_V48943_EDITORIAL',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(component_name_norm,expected_role)
);

alter table public.mt_curated_component_dictionary_v3 enable row level security;
revoke all on table public.mt_curated_component_dictionary_v3 from anon,authenticated;

with src as (
  select *
  from jsonb_to_recordset($dict$
[
  {
    "component_name_norm": "oignons",
    "expected_role": "aromatic",
    "canonical_key": "oignon",
    "include_regex": "(^| )oignon(s)?( |$)",
    "prefer_regex": "(cuit|cru)",
    "exclude_regex": "(^| )(sauce|soupe)( |$)",
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "boeuf",
    "expected_role": "protein",
    "canonical_key": "boeuf",
    "include_regex": "(^| )boeuf( |$)",
    "prefer_regex": "(cuit|viande|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "boeuf effiloche",
    "expected_role": "protein",
    "canonical_key": "boeuf",
    "include_regex": "(^| )boeuf( |$)",
    "prefer_regex": "(cuit|viande|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "boeuf emince",
    "expected_role": "protein",
    "canonical_key": "boeuf",
    "include_regex": "(^| )boeuf( |$)",
    "prefer_regex": "(cuit|viande|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "boeuf hache",
    "expected_role": "protein",
    "canonical_key": "boeuf_hache",
    "include_regex": "(^| )boeuf( |$)",
    "prefer_regex": "(hache.*cuit|cuit.*hache)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "boeuf hache cuit",
    "expected_role": "protein",
    "canonical_key": "boeuf_hache",
    "include_regex": "(^| )boeuf( |$)",
    "prefer_regex": "(hache.*cuit|cuit.*hache)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "boeuf mijote",
    "expected_role": "protein",
    "canonical_key": "boeuf",
    "include_regex": "(^| )boeuf( |$)",
    "prefer_regex": "(cuit|viande|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "cabillaud",
    "expected_role": "protein",
    "canonical_key": "cabillaud",
    "include_regex": "(^| )cabillaud( |$)",
    "prefer_regex": "(cuit|roti|four|grille)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "cabillaud au four",
    "expected_role": "protein",
    "canonical_key": "cabillaud",
    "include_regex": "(^| )cabillaud( |$)",
    "prefer_regex": "(cuit|roti|four|grille)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "cabillaud citron vert",
    "expected_role": "protein",
    "canonical_key": "cabillaud",
    "include_regex": "(^| )cabillaud( |$)",
    "prefer_regex": "(cuit|roti|four|grille)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "crevettes",
    "expected_role": "protein",
    "canonical_key": "crevette",
    "include_regex": "(^| )crevette(s)?( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "oeuf",
    "expected_role": "protein",
    "canonical_key": "oeuf_cuit",
    "include_regex": "(^| )(oeuf|oeufs)( |$)",
    "prefer_regex": "(cuit|dur)",
    "exclude_regex": "(^| )(poudre|dessert|gateau)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "oeufs",
    "expected_role": "protein",
    "canonical_key": "oeuf_cuit",
    "include_regex": "(^| )(oeuf|oeufs)( |$)",
    "prefer_regex": "(cuit|dur)",
    "exclude_regex": "(^| )(poudre|dessert|gateau)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "oeufs en omelette",
    "expected_role": "protein",
    "canonical_key": "omelette",
    "include_regex": "(^| )(oeuf|oeufs|omelette)( |$)",
    "prefer_regex": "omelette",
    "exclude_regex": "(^| )(poudre|dessert|gateau)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "omelette",
    "expected_role": "protein",
    "canonical_key": "omelette",
    "include_regex": "(^| )(oeuf|oeufs|omelette)( |$)",
    "prefer_regex": "omelette",
    "exclude_regex": "(^| )(poudre|dessert|gateau)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poisson",
    "expected_role": "protein",
    "canonical_key": "poisson_blanc",
    "include_regex": "(^| )(cabillaud|colin|merlu|lieu)( |$)",
    "prefer_regex": "(cuit|grille|four|roti)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poisson au cumin",
    "expected_role": "protein",
    "canonical_key": "poisson_blanc",
    "include_regex": "(^| )(cabillaud|colin|merlu|lieu)( |$)",
    "prefer_regex": "(cuit|grille|four|roti)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poisson au curcuma",
    "expected_role": "protein",
    "canonical_key": "poisson_blanc",
    "include_regex": "(^| )(cabillaud|colin|merlu|lieu)( |$)",
    "prefer_regex": "(cuit|grille|four|roti)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poisson blanc",
    "expected_role": "protein",
    "canonical_key": "poisson_blanc",
    "include_regex": "(^| )(cabillaud|colin|merlu|lieu)( |$)",
    "prefer_regex": "(cuit|grille|four|roti)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poisson citron vert",
    "expected_role": "protein",
    "canonical_key": "poisson_blanc",
    "include_regex": "(^| )(cabillaud|colin|merlu|lieu)( |$)",
    "prefer_regex": "(cuit|grille|four|roti)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poisson grille",
    "expected_role": "protein",
    "canonical_key": "poisson_blanc",
    "include_regex": "(^| )(cabillaud|colin|merlu|lieu)( |$)",
    "prefer_regex": "(cuit|grille|four|roti)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poisson marine",
    "expected_role": "protein",
    "canonical_key": "poisson_blanc_cru",
    "include_regex": "(^| )(cabillaud|colin|merlu|lieu)( |$)",
    "prefer_regex": "(cru|crue)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "porc",
    "expected_role": "protein",
    "canonical_key": "porc",
    "include_regex": "(^| )porc( |$)",
    "prefer_regex": "(cuit|viande)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "porc cuit",
    "expected_role": "protein",
    "canonical_key": "porc",
    "include_regex": "(^| )porc( |$)",
    "prefer_regex": "(cuit|viande)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet au curry doux",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet au gingembre",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet au thym",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet aux epices douces",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet braise",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet citronne",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet citronnelle",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet grille",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet mijote",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poulet roti",
    "expected_role": "protein",
    "canonical_key": "poulet",
    "include_regex": "(^| )poulet( |$)",
    "prefer_regex": "(cuit|roti|grille|viande|braise|mijote)",
    "exclude_regex": "((^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$))|((^| )(foie|abats|peau|aile|gesier|coeur|pied|pieds)( |$))",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "saumon",
    "expected_role": "protein",
    "canonical_key": "saumon",
    "include_regex": "(^| )saumon( |$)",
    "prefer_regex": "(cuit|grille|four|roti)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "saumon a l aneth",
    "expected_role": "protein",
    "canonical_key": "saumon",
    "include_regex": "(^| )saumon( |$)",
    "prefer_regex": "(cuit|grille|four|roti)",
    "exclude_regex": "(^| )(nugget|nuggets|croquette|croquettes|pane|panes|panee|panees|charcuterie|saucisse|saucisses|merguez|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles|burger|sandwich|pizza|quiche|gratin|sauce|bouillon)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "thon",
    "expected_role": "protein",
    "canonical_key": "thon",
    "include_regex": "(^| )thon( |$)",
    "prefer_regex": "(cuit|naturel|egoutte)",
    "exclude_regex": "(^| )mayonnaise( |$)",
    "prefer_required": false,
    "confidence": 0.98,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "thon au naturel",
    "expected_role": "protein",
    "canonical_key": "thon_naturel",
    "include_regex": "(^| )thon( |$)",
    "prefer_regex": "(naturel|conserve|egoutte)",
    "exclude_regex": "(^| )(huile|mayonnaise)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "thon frit",
    "expected_role": "protein",
    "canonical_key": "thon",
    "include_regex": "(^| )thon( |$)",
    "prefer_regex": "(cuit|naturel|egoutte)",
    "exclude_regex": "(^| )mayonnaise( |$)",
    "prefer_required": false,
    "confidence": 0.98,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "falafels",
    "expected_role": "protein_plant",
    "canonical_key": "falafel",
    "include_regex": "(^| )falafel(s)?( |$)",
    "prefer_regex": null,
    "exclude_regex": null,
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "haricots",
    "expected_role": "protein_plant",
    "canonical_key": "haricot_cornille",
    "include_regex": "(^| )(haricot(s)? cornille|niebe)( |$)",
    "prefer_regex": "(cuit|cuite)",
    "exclude_regex": "(^| )plat cuisine( |$)",
    "prefer_required": true,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "haricots blancs",
    "expected_role": "protein_plant",
    "canonical_key": "haricot_blanc",
    "include_regex": "(^| )haricot(s)? blanc(s)?( |$)",
    "prefer_regex": "(cuit|appertise)",
    "exclude_regex": "(^| )(cassoulet|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "haricots cornille",
    "expected_role": "protein_plant",
    "canonical_key": "haricot_cornille",
    "include_regex": "(^| )(haricot(s)? cornille|niebe)( |$)",
    "prefer_regex": "(cuit|cuite)",
    "exclude_regex": "(^| )plat cuisine( |$)",
    "prefer_required": true,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "haricots noirs",
    "expected_role": "protein_plant",
    "canonical_key": "haricot_noir",
    "include_regex": "(^| )haricot(s)? noir(s)?( |$)",
    "prefer_regex": "(cuit|appertise)",
    "exclude_regex": "(^| )plat cuisine( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "haricots rouges",
    "expected_role": "protein_plant",
    "canonical_key": "haricot_rouge",
    "include_regex": "(^| )haricot(s)? rouge(s)?( |$)",
    "prefer_regex": "(cuit|appertise)",
    "exclude_regex": "(^| )(chili|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "houmous",
    "expected_role": "protein_plant",
    "canonical_key": "houmous",
    "include_regex": "(^| )houmous( |$)",
    "prefer_regex": null,
    "exclude_regex": null,
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "lentilles",
    "expected_role": "protein_plant",
    "canonical_key": "lentille",
    "include_regex": "(^| )lentille(s)?( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": "(^| )(soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "lentilles corail",
    "expected_role": "protein_plant",
    "canonical_key": "lentille",
    "include_regex": "(^| )lentille(s)?( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": "(^| )(soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "lentilles epicees",
    "expected_role": "protein_plant",
    "canonical_key": "lentille",
    "include_regex": "(^| )lentille(s)?( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": "(^| )(soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "lentilles vertes",
    "expected_role": "protein_plant",
    "canonical_key": "lentille",
    "include_regex": "(^| )lentille(s)?( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": "(^| )(soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "petits pois",
    "expected_role": "protein_plant",
    "canonical_key": "petit_pois",
    "include_regex": "(^| )petit(s)? pois( |$)",
    "prefer_regex": "(cuit|appertise|surgel)",
    "exclude_regex": "(^| )(soupe|plat cuisine)( |$)",
    "prefer_required": false,
    "confidence": 0.98,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "pois chiches",
    "expected_role": "protein_plant",
    "canonical_key": "pois_chiche",
    "include_regex": "(^| )pois chiche(s)?( |$)",
    "prefer_regex": "(cuit|cuite|appertise)",
    "exclude_regex": "(^| )(houmous|falafel)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "tofu",
    "expected_role": "protein_plant",
    "canonical_key": "tofu",
    "include_regex": "(^| )tofu( |$)",
    "prefer_regex": "(nature|ferme)",
    "exclude_regex": "(^| )(fume|pane)( |$)",
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "tofu ferme",
    "expected_role": "protein_plant",
    "canonical_key": "tofu",
    "include_regex": "(^| )tofu( |$)",
    "prefer_regex": "(nature|ferme)",
    "exclude_regex": "(^| )(fume|pane)( |$)",
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "pate d arachide",
    "expected_role": "sauce_component",
    "canonical_key": "arachide_pate",
    "include_regex": "(^| )(beurre de cacahuete|pate d arachide)( |$)",
    "prefer_regex": "(sans sucre|nature)",
    "exclude_regex": null,
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "boulgour",
    "expected_role": "starch",
    "canonical_key": "boulgour",
    "include_regex": "(^| )boulgour( |$)",
    "prefer_regex": "cuit",
    "exclude_regex": null,
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "mais",
    "expected_role": "starch",
    "canonical_key": "mais_doux",
    "include_regex": "(^| )mais( |$)",
    "prefer_regex": "(doux|cuit|appertise)",
    "exclude_regex": "(^| )(farine|semoule|polenta|pop corn|huile)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "manioc",
    "expected_role": "starch",
    "canonical_key": "manioc",
    "include_regex": "(^| )manioc( |$)",
    "prefer_regex": "(cuit|bouilli)",
    "exclude_regex": "(^| )(farine|fecule|tapioca)( |$)",
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "millet",
    "expected_role": "starch",
    "canonical_key": "millet",
    "include_regex": "(^| )millet( |$)",
    "prefer_regex": "cuit",
    "exclude_regex": "(^| )farine( |$)",
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "nouilles",
    "expected_role": "starch",
    "canonical_key": "nouilles",
    "include_regex": "(^| )nouille(s)?( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": "(^| )(riz|soba)( |$)",
    "prefer_required": false,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "nouilles de ble",
    "expected_role": "starch",
    "canonical_key": "nouilles_ble",
    "include_regex": "(^| )nouille(s)?( |$)",
    "prefer_regex": "(ble|cuite|cuit)",
    "exclude_regex": "(^| )(riz|soba)( |$)",
    "prefer_required": false,
    "confidence": 0.98,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "nouilles de riz",
    "expected_role": "starch",
    "canonical_key": "nouilles_riz",
    "include_regex": "(^| )(nouille(s)? de riz|vermicelle(s)? de riz)( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": null,
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "nouilles soba",
    "expected_role": "starch",
    "canonical_key": "soba",
    "include_regex": "(^| )(soba|nouille(s)? au sarrasin)( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": null,
    "prefer_required": false,
    "confidence": 0.98,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "orge",
    "expected_role": "starch",
    "canonical_key": "orge",
    "include_regex": "(^| )orge( |$)",
    "prefer_regex": "(perle|cuit)",
    "exclude_regex": "(^| )(farine|boisson)( |$)",
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "pain complet",
    "expected_role": "starch",
    "canonical_key": "pain_complet",
    "include_regex": "(^| )pain( |$)",
    "prefer_regex": "(complet|integral)",
    "exclude_regex": "(^| )(biscotte|grille)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "pain de seigle",
    "expected_role": "starch",
    "canonical_key": "pain_seigle",
    "include_regex": "(^| )pain( |$)",
    "prefer_regex": "seigle",
    "exclude_regex": "(^| )(grille|biscotte)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "pain pita",
    "expected_role": "starch",
    "canonical_key": "pain_pita",
    "include_regex": "(^| )(pain pita|pita)( |$)",
    "prefer_regex": null,
    "exclude_regex": null,
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "patate douce",
    "expected_role": "starch",
    "canonical_key": "patate_douce",
    "include_regex": "(^| )patate(s)? douce(s)?( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": "(^| )(chips|frite|frites)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "pates",
    "expected_role": "starch",
    "canonical_key": "pates",
    "include_regex": "(^| )pate(s)?( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": "(^| )(complete|complet|fraiche|farcie|lasagne|ravioli)( |$)",
    "prefer_required": true,
    "confidence": 0.98,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "pates completes",
    "expected_role": "starch",
    "canonical_key": "pates_completes",
    "include_regex": "(^| )pate(s)?( |$)",
    "prefer_regex": "((complete|complet).*cuit|cuit.*(complete|complet))",
    "exclude_regex": "(^| )(fraiche|farcie|lasagne|ravioli)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "plantain",
    "expected_role": "starch",
    "canonical_key": "plantain",
    "include_regex": "(^| )(banane plantain|plantain)( |$)",
    "prefer_regex": "(cuite|cuit|roti)",
    "exclude_regex": "(^| )chips( |$)",
    "prefer_required": true,
    "confidence": 0.98,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "plantain frit",
    "expected_role": "starch",
    "canonical_key": "plantain_frit",
    "include_regex": "(^| )(banane plantain|plantain)( |$)",
    "prefer_regex": "(frite|frit)",
    "exclude_regex": "(^| )chips( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "plantain mur",
    "expected_role": "starch",
    "canonical_key": "plantain",
    "include_regex": "(^| )(banane plantain|plantain)( |$)",
    "prefer_regex": "(cuite|cuit|roti)",
    "exclude_regex": "(^| )chips( |$)",
    "prefer_required": true,
    "confidence": 0.98,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "plantain roti",
    "expected_role": "starch",
    "canonical_key": "plantain",
    "include_regex": "(^| )(banane plantain|plantain)( |$)",
    "prefer_regex": "(cuite|cuit|roti)",
    "exclude_regex": "(^| )chips( |$)",
    "prefer_required": true,
    "confidence": 0.98,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "polenta",
    "expected_role": "starch",
    "canonical_key": "polenta",
    "include_regex": "(^| )(polenta|semoule de mais)( |$)",
    "prefer_regex": "(cuite|cuit)",
    "exclude_regex": "(^| )farine( |$)",
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "pommes de terre",
    "expected_role": "starch",
    "canonical_key": "pomme_terre",
    "include_regex": "(^| )pomme(s)? de terre( |$)",
    "prefer_regex": "(cuite|vapeur|eau)",
    "exclude_regex": "(^| )(chips|frite|frites|croquette|puree)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "pommes de terre vapeur",
    "expected_role": "starch",
    "canonical_key": "pomme_terre",
    "include_regex": "(^| )pomme(s)? de terre( |$)",
    "prefer_regex": "(cuite|vapeur|eau)",
    "exclude_regex": "(^| )(chips|frite|frites|croquette|puree)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "puree de pommes de terre",
    "expected_role": "starch",
    "canonical_key": "puree_pomme_terre",
    "include_regex": "(^| )(puree de pomme(s)? de terre|pomme(s)? de terre)( |$)",
    "prefer_regex": "puree",
    "exclude_regex": "(^| )(chips|frite|frites|croquette)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "quinoa",
    "expected_role": "starch",
    "canonical_key": "quinoa",
    "include_regex": "(^| )quinoa( |$)",
    "prefer_regex": "cuit",
    "exclude_regex": null,
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "riz",
    "expected_role": "starch",
    "canonical_key": "riz",
    "include_regex": "(^| )riz( |$)",
    "prefer_regex": "cuit",
    "exclude_regex": "(^| )(riz au lait|dessert|souffle|galette)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "riz basmati",
    "expected_role": "starch",
    "canonical_key": "riz_basmati",
    "include_regex": "(^| )riz( |$)",
    "prefer_regex": "(basmati.*cuit|cuit.*basmati)",
    "exclude_regex": "(^| )(riz au lait|dessert|souffle|galette)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "riz pilau",
    "expected_role": "starch",
    "canonical_key": "riz",
    "include_regex": "(^| )riz( |$)",
    "prefer_regex": "cuit",
    "exclude_regex": "(^| )(riz au lait|dessert|souffle|galette)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "riz tomate",
    "expected_role": "starch",
    "canonical_key": "riz",
    "include_regex": "(^| )riz( |$)",
    "prefer_regex": "cuit",
    "exclude_regex": "(^| )(riz au lait|dessert|souffle|galette)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "sarrasin",
    "expected_role": "starch",
    "canonical_key": "sarrasin",
    "include_regex": "(^| )sarrasin( |$)",
    "prefer_regex": "(cuit|grain)",
    "exclude_regex": "(^| )(farine|galette)( |$)",
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "semoule",
    "expected_role": "starch",
    "canonical_key": "semoule_ble",
    "include_regex": "(^| )(semoule|couscous)( |$)",
    "prefer_regex": "(ble.*cuit|cuit.*ble|semoule.*cuite|couscous.*cuit)",
    "exclude_regex": "(^| )(mais|riz|dessert|lait)( |$)",
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "semoule de couscous",
    "expected_role": "starch",
    "canonical_key": "semoule_ble",
    "include_regex": "(^| )(semoule|couscous)( |$)",
    "prefer_regex": "(ble.*cuit|cuit.*ble|semoule.*cuite|couscous.*cuit)",
    "exclude_regex": "(^| )(mais|riz|dessert|lait)( |$)",
    "prefer_required": false,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "vermicelles",
    "expected_role": "starch",
    "canonical_key": "vermicelles",
    "include_regex": "(^| )vermicelle(s)?( |$)",
    "prefer_regex": "(cuit|cuite)",
    "exclude_regex": "(^| )riz( |$)",
    "prefer_required": false,
    "confidence": 0.97,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "aubergines",
    "expected_role": "vegetable",
    "canonical_key": "aubergine",
    "include_regex": "(^| )aubergine(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "betteraves",
    "expected_role": "vegetable",
    "canonical_key": "betterave",
    "include_regex": "(^| )betterave(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "brocoli",
    "expected_role": "vegetable",
    "canonical_key": "brocoli",
    "include_regex": "(^| )brocoli(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "carotte",
    "expected_role": "vegetable",
    "canonical_key": "carotte",
    "include_regex": "(^| )carotte(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "carottes",
    "expected_role": "vegetable",
    "canonical_key": "carotte",
    "include_regex": "(^| )carotte(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "champignons",
    "expected_role": "vegetable",
    "canonical_key": "champignon",
    "include_regex": "(^| )champignon(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "chou",
    "expected_role": "vegetable",
    "canonical_key": "chou",
    "include_regex": "(^| )chou( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "chou fleur",
    "expected_role": "vegetable",
    "canonical_key": "chou_fleur",
    "include_regex": "(^| )chou fleur( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "concombre",
    "expected_role": "vegetable",
    "canonical_key": "concombre",
    "include_regex": "(^| )concombre( |$)",
    "prefer_regex": "(cru|crue)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "courgette",
    "expected_role": "vegetable",
    "canonical_key": "courgette",
    "include_regex": "(^| )courgette(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "courgettes",
    "expected_role": "vegetable",
    "canonical_key": "courgette",
    "include_regex": "(^| )courgette(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "epinards",
    "expected_role": "vegetable",
    "canonical_key": "epinard",
    "include_regex": "(^| )epinard(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "gombo",
    "expected_role": "vegetable",
    "canonical_key": "gombo",
    "include_regex": "(^| )gombo( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "haricots verts",
    "expected_role": "vegetable",
    "canonical_key": "haricot_vert",
    "include_regex": "(^| )haricot(s)? vert(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "oignon",
    "expected_role": "vegetable",
    "canonical_key": "oignon",
    "include_regex": "(^| )oignon(s)?( |$)",
    "prefer_regex": "(cuit|cru)",
    "exclude_regex": "(^| )(sauce|soupe)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "petits pois",
    "expected_role": "vegetable",
    "canonical_key": "petit_pois",
    "include_regex": "(^| )petit(s)? pois( |$)",
    "prefer_regex": "(cuit|appertise|surgel)",
    "exclude_regex": "(^| )(soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.98,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poireaux",
    "expected_role": "vegetable",
    "canonical_key": "poireau",
    "include_regex": "(^| )poireau(x)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poivron",
    "expected_role": "vegetable",
    "canonical_key": "poivron",
    "include_regex": "(^| )poivron(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "poivrons",
    "expected_role": "vegetable",
    "canonical_key": "poivron",
    "include_regex": "(^| )poivron(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "pousses de soja",
    "expected_role": "vegetable",
    "canonical_key": "pousse_soja",
    "include_regex": "(^| )(pousse(s)? de soja|haricot mungo germe)( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "salade verte",
    "expected_role": "vegetable",
    "canonical_key": "salade_verte",
    "include_regex": "(^| )(laitue|salade verte)( |$)",
    "prefer_regex": "(cru|crue)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "tomate",
    "expected_role": "vegetable",
    "canonical_key": "tomate",
    "include_regex": "(^| )tomate(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  },
  {
    "component_name_norm": "tomates",
    "expected_role": "vegetable",
    "canonical_key": "tomate",
    "include_regex": "(^| )tomate(s)?( |$)",
    "prefer_regex": "(cuit|cuite|cru|crue|appertise)",
    "exclude_regex": "(^| )(sauce|soupe|plat cuisine)( |$)",
    "prefer_required": true,
    "confidence": 0.99,
    "source": "TEE_V48943_EDITORIAL"
  }
]
$dict$::jsonb) as x(
    component_name_norm text,
    expected_role text,
    canonical_key text,
    include_regex text,
    prefer_regex text,
    exclude_regex text,
    prefer_required boolean,
    confidence numeric,
    source text
  )
)
insert into public.mt_curated_component_dictionary_v3(
  component_name_norm,expected_role,canonical_key,include_regex,prefer_regex,
  exclude_regex,prefer_required,confidence,source
)
select component_name_norm,expected_role,canonical_key,include_regex,prefer_regex,
       exclude_regex,prefer_required,confidence,source
from src
on conflict(component_name_norm,expected_role) do update set
  canonical_key=excluded.canonical_key,
  include_regex=excluded.include_regex,
  prefer_regex=excluded.prefer_regex,
  exclude_regex=excluded.exclude_regex,
  prefer_required=excluded.prefer_required,
  confidence=excluded.confidence,
  source=excluded.source,
  updated_at=now();

-- Traçabilité de la résolution sans modifier les colonnes existantes.
alter table public.mt_curated_meal_components_v2
  add column if not exists resolution_source text;

-- Corrige le swap historique des lookup_terms du Yassa éditorial. Sa version
-- whole-dish stricte reste prioritaire ; cette correction garde simplement la
-- base éditoriale cohérente.
update public.mt_curated_meal_components_v2
set lookup_terms=array['oignon cuit'],updated_at=now()
where meal_code='TEE-MEAL-243' and public.food_normalize(component_name)='oignons';

update public.mt_curated_meal_components_v2
set lookup_terms=array['poivron cuit'],updated_at=now()
where meal_code='TEE-MEAL-243' and public.food_normalize(component_name)='poivrons';

-- --------------------------------------------------------------------------
-- 2) RÉSOLUTION EXPLICITE SET-BASED
--
-- On ne "devine" pas une association : un composant doit avoir une entrée
-- éditoriale dans mt_curated_component_dictionary_v3, puis une ligne CIQUAL
-- dont le NOM correspond à la regex whitelistée.
-- --------------------------------------------------------------------------
set local statement_timeout = '90s';

with
targets as materialized (
  select
    c.component_id,
    c.component_name,
    c.expected_role,
    d.canonical_key,
    d.include_regex,
    d.prefer_regex,
    d.exclude_regex,
    d.prefer_required,
    d.confidence
  from public.mt_curated_meal_components_v2 c
  join public.mt_curated_meals_v2 m using(meal_code)
  join public.mt_curated_component_dictionary_v3 d
    on d.component_name_norm=public.food_normalize(c.component_name)
   and d.expected_role=c.expected_role
  where m.dataset_version='V489.4.1'
),
candidate_rows as materialized (
  select
    t.component_id,
    t.expected_role,
    t.canonical_key,
    t.confidence,
    f.code as ciqual_code,
    f.name as resolved_name,
    public.mt_ciqual_role_v1(
      f.name,f.kcal_100g,f.protein_100g,f.fat_100g,f.carbs_100g,f.fiber_100g
    ) as detected_role,
    public.food_normalize(f.name) as nname,
    (
      100
      + case
          when t.prefer_regex is not null
           and public.food_normalize(f.name) ~ t.prefer_regex then 10
          else 0
        end
      + case
          when public.food_normalize(f.name)=t.canonical_key then 3
          else 0
        end
    )::numeric as score
  from targets t
  join public.ciqual_foods f
    on public.food_normalize(f.name) ~ t.include_regex
  where (t.exclude_regex is null or not (public.food_normalize(f.name) ~ t.exclude_regex))
    and (
      not t.prefer_required
      or t.prefer_regex is null
      or public.food_normalize(f.name) ~ t.prefer_regex
    )
    and f.kcal_100g is not null
),
ranked as (
  select
    c.*,
    row_number() over(
      partition by c.component_id
      order by c.score desc,length(c.nname) asc,c.ciqual_code asc
    ) as rn,
    lead(c.score) over(
      partition by c.component_id
      order by c.score desc,length(c.nname) asc,c.ciqual_code asc
    ) as second_score
  from candidate_rows c
),
best as (
  select *
  from ranked
  where rn=1
)
update public.mt_curated_meal_components_v2 c
set
  ciqual_code=b.ciqual_code,
  resolved_name=b.resolved_name,
  resolved_role=case
    when c.expected_role='dairy_protein' then 'dairy'
    else c.expected_role
  end,
  resolution_score=b.score,
  second_score=coalesce(b.second_score,0),
  resolution_status='resolved_high',
  resolution_source='TEE_V48943_EXPLICIT',
  updated_at=now()
from best b
where c.component_id=b.component_id;

set local statement_timeout = default;

-- --------------------------------------------------------------------------
-- 3) PUBLICATION CONSERVATRICE — MÊMES GARDES, PLUS DE COMPOSANTS RÉSOLUS
-- --------------------------------------------------------------------------
update public.mt_curated_meals_v2
set review_status=case
      when not enabled or auto_publish_policy='existing_strict_preferred' then 'disabled'
      else 'draft'
    end,
    updated_at=now()
where dataset_version='V489.4.1';

update public.mt_curated_meals_v2 m
set review_status='published',updated_at=now()
where m.dataset_version='V489.4.1'
  and m.enabled
  and m.auto_publish_policy in ('safe_plate','canonical_mainstream','canonical_accessible')
  and m.editorial_confidence>=0.86
  and (m.discovery_level<2 or m.manual_reviewed)
  and cardinality(m.source_keys)>=2
  and not exists(
    select 1
    from unnest(m.source_keys) k
    left join public.mt_curated_meal_sources_v2 s on s.source_key=k
    where s.source_key is null
  )
  and exists(
    select 1 from public.mt_curated_meal_components_v2 c
    where c.meal_code=m.meal_code and c.expected_role in ('protein','protein_plant','dairy_protein')
  )
  and exists(
    select 1 from public.mt_curated_meal_components_v2 c
    where c.meal_code=m.meal_code and c.expected_role='starch'
  )
  and exists(
    select 1 from public.mt_curated_meal_components_v2 c
    where c.meal_code=m.meal_code and c.expected_role='vegetable'
  )
  and not exists(
    select 1 from public.mt_curated_meal_components_v2 c
    where c.meal_code=m.meal_code
      and c.required
      and c.resolution_status<>'resolved_high'
  )
  and not exists(
    select 1 from public.mt_curated_meal_components_v2 c
    where c.meal_code=m.meal_code
      and public.food_normalize(c.component_name) ~
      '(^| )(nugget|nuggets|croquette|croquettes|charcuterie|charcuteries|cordon bleu|cordons bleus|saucisse|saucisses|boudin|boudins|rillette|rillettes|terrine|terrines|quenelle|quenelles)( |$)'
  );

-- --------------------------------------------------------------------------
-- 4) AUDIT V489.4.3 — INTERNE, NON AFFICHÉ AUX UTILISATEURS
-- --------------------------------------------------------------------------
create or replace function public.mt_curated_catalog_audit_v3()
returns jsonb
language sql
stable
security definer
set search_path=public
as $fn$
select jsonb_build_object(
  'version','V489.4.3',
  'meals_total',(select count(*) from public.mt_curated_meals_v2 where dataset_version='V489.4.1'),
  'published',(select count(*) from public.mt_curated_meals_v2 where dataset_version='V489.4.1' and review_status='published'),
  'draft',(select count(*) from public.mt_curated_meals_v2 where dataset_version='V489.4.1' and review_status='draft'),
  'disabled',(select count(*) from public.mt_curated_meals_v2 where dataset_version='V489.4.1' and review_status='disabled'),
  'mapping_rows',(select count(*) from public.mt_curated_component_dictionary_v3),
  'components_total',(select count(*) from public.mt_curated_meal_components_v2 c join public.mt_curated_meals_v2 m using(meal_code) where m.dataset_version='V489.4.1'),
  'components_explicit',(select count(*) from public.mt_curated_meal_components_v2 c join public.mt_curated_meals_v2 m using(meal_code) where m.dataset_version='V489.4.1' and c.resolution_source='TEE_V48943_EXPLICIT'),
  'components_high',(select count(*) from public.mt_curated_meal_components_v2 c join public.mt_curated_meals_v2 m using(meal_code) where m.dataset_version='V489.4.1' and c.resolution_status='resolved_high'),
  'components_medium',(select count(*) from public.mt_curated_meal_components_v2 c join public.mt_curated_meals_v2 m using(meal_code) where m.dataset_version='V489.4.1' and c.resolution_status='resolved_medium'),
  'components_unresolved',(select count(*) from public.mt_curated_meal_components_v2 c join public.mt_curated_meals_v2 m using(meal_code) where m.dataset_version='V489.4.1' and c.resolution_status='unresolved'),
  'manual_specific_waiting',(select count(*) from public.mt_curated_meals_v2 where dataset_version='V489.4.1' and auto_publish_policy='manual_specific' and review_status='draft')
);
$fn$;

revoke all on function public.mt_curated_catalog_audit_v3() from public,anon;
grant execute on function public.mt_curated_catalog_audit_v3() to authenticated;

commit;

select jsonb_build_object(
  'status','v48943_catalogue_etendu_budget_ui_pret',
  'counts',jsonb_build_object(
    'loaded',(select count(*) from public.mt_curated_meals_v2 where dataset_version='V489.4.1'),
    'published',(select count(*) from public.mt_curated_meals_v2 where dataset_version='V489.4.1' and review_status='published'),
    'draft',(select count(*) from public.mt_curated_meals_v2 where dataset_version='V489.4.1' and review_status='draft'),
    'disabled',(select count(*) from public.mt_curated_meals_v2 where dataset_version='V489.4.1' and review_status='disabled'),
    'mapping_rows',(select count(*) from public.mt_curated_component_dictionary_v3),
    'components_explicit',(select count(*) from public.mt_curated_meal_components_v2 c join public.mt_curated_meals_v2 m using(meal_code) where m.dataset_version='V489.4.1' and c.resolution_source='TEE_V48943_EXPLICIT'),
    'components_high',(select count(*) from public.mt_curated_meal_components_v2 c join public.mt_curated_meals_v2 m using(meal_code) where m.dataset_version='V489.4.1' and c.resolution_status='resolved_high'),
    'components_medium',(select count(*) from public.mt_curated_meal_components_v2 c join public.mt_curated_meals_v2 m using(meal_code) where m.dataset_version='V489.4.1' and c.resolution_status='resolved_medium'),
    'components_unresolved',(select count(*) from public.mt_curated_meal_components_v2 c join public.mt_curated_meals_v2 m using(meal_code) where m.dataset_version='V489.4.1' and c.resolution_status='unresolved')
  ),
  'guards',jsonb_build_object(
    'all_300_auto_published',false,
    'level_2_requires_manual_review',true,
    'strong_component_resolution_required',true,
    'explicit_component_whitelist',true,
    'free_ciqual_assembly_required',false,
    'unknown_price_becomes_zero',false,
    'ciqual_rows_modified',false,
    'external_ai',false
  ),
  'frontend',jsonb_build_object(
    'balanced_target_ratio',0.90,
    'balanced_hard_floor_if_feasible',0.78,
    'technical_debug_copy_visible_to_user',false
  ),
  'unchanged',jsonb_build_object(
    'recipes',true,'ciqual_rows',true,'food_dictionary',true,'prices',true,
    'payments',true,'protocols',true,'voice',true,'historical_recommendations',true
  ),
  'next_step','Uploader ensuite les 4 fichiers frontend V489.4.3 et tester 45 EUR en mode équilibré sur 3 générations.'
) as v48943_result;
