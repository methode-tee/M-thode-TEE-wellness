# V489.2.1 — Rotation, culture, formats et CIQUAL renforcés

Cette version remplace V489.2. **Ne pas appliquer V489.2 avant celle-ci.**

## Ce que V489.2.1 corrige

- un seul `stableHash32()` : les UUID des assiettes CIQUAL utilisent réellement 4 seeds différents ;
- maximum **1 plat culturel spécifique** par semaine = contrainte dure ;
- rotation immédiate locale + historique Supabase conservés ;
- **2 assiettes CIQUAL réservées seulement si elles franchissent un seuil culinaire de 0,72** et sont réellement faisables dans le budget ;
- séparation stricte entre **fraîcheur du format magasin (365 j)** et **fraîcheur du prix (120 j)** ;
- un prix paquet >120 j n'est jamais utilisé ; si le format reste valable, TEE cherche un prix exact frais ou retombe sur le coût consommé ;
- `package_coverage_pct` reflète désormais le **format documenté**, même si le prix du paquet est trop ancien ;
- preflight complet avec les RPC CIQUAL V489.1.

## Ordre d'application

### 1. Backend uniquement

Exécuter dans Supabase :

`supabase/V48921_ROTATION_CULTURE_FORMATS_CIQUAL_RENFORCE.sql`

Puis envoyer le JSON `v48921_result`.

### 2. Frontend seulement après validation du JSON

Remplacer :

- `tee-next.html`
- `www/tee-next.html`
- `scripts/tee-next.js`
- `www/scripts/tee-next.js`

Tester d'abord `methodetee.app` en navigation privée avant Xcode.

## Tests attendus

- `max_specific_cultural_per_week_frontend = 1`
- `minimum_ciqual_assemblies_when_feasible = 2`
- `ciqual_assembly_quality_threshold = 0.72`
- `format_max_age_days = 365`
- `price_max_age_days = 120`
- `stale_package_price_allowed = false`
- `ciqual_universe_v1 = true`
- `ciqual_price_batch_v1 = true`

Le QA local fourni vérifie aussi la rotation et 10 000 UUID CIQUAL distincts sans collision.
