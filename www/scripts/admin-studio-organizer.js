(function(){
  'use strict';

  /*
   * V496 · Classement strict du Studio admin
   * ----------------------------------------
   * Ce fichier ne modifie aucune donnée ni aucun formulaire.
   * Il déplace uniquement les blocs .admin-block dans des dossiers visuels.
   *
   * Important : les modules sont reconnus par ID ou par couple exact
   * kicker + titre. On n'utilise plus de recherche par sous-chaîne, afin
   * d'éviter qu'un bloc finisse dans un dossier simplement parce qu'un mot
   * comme « Protocoles », « Recettes » ou « Bibliothèque » apparaît ailleurs.
   */

  const GROUPS = [
    {
      id: 'today',
      label: 'Aujourd’hui & communauté',
      hint: 'Rituels · journée ensemble',
      modules: ['dailyRitualsForm', 'communityJourneyAdmin']
    },
    {
      id: 'feed',
      label: 'Feed & publications',
      hint: 'Créer · gérer les posts',
      modules: ['postForm', 'postList']
    },
    {
      id: 'recipes',
      label: 'Recettes',
      hint: 'Créer · gérer le catalogue',
      modules: ['recipeForm', 'recipeList']
    },
    {
      id: 'protocols',
      label: 'Protocoles',
      hint: 'Créer · gérer · protocole gratuit',
      modules: ['protocolForm', 'protocolList', 'freeIntroProtocolTool']
    },
    {
      id: 'offers',
      label: 'Bibliothèque · Offert par Tee',
      hint: 'Ressources offertes uniquement',
      modules: ['libraryOfferForm', 'libraryOfferList']
    },
    {
      id: 'protocol-content',
      label: 'Contenus des protocoles',
      hint: 'PDF · routines · guides · fichiers',
      modules: ['contentForm', 'contentList', 'photoMigrationTool']
    },
    {
      id: 'food-library',
      label: 'Aliments & guidage nutritionnel',
      hint: 'Dictionnaire · profils Tee',
      modules: ['foodDictionaryForm', 'foodDictionaryList', 'foodGuidanceAdminSection', 'foodGuidanceAdminForm']
    },
    {
      id: 'adapter',
      label: 'Adapter mon repas',
      hint: 'Formules · catalogue vivant',
      modules: ['adapterFormulaAdminForm', 'adapterFormulaList', 'runtimeCatalog']
    },
    {
      id: 'botanical',
      label: 'Phytothérapie',
      hint: 'Plantes · catalogue botanique',
      modules: ['botanicalAdminForm', 'botanicalList']
    },
    {
      id: 'pages',
      label: 'Pages de l’app',
      hint: 'Créer · renommer · gérer',
      modules: ['pageForm', 'pageList']
    },
    {
      id: 'clients',
      label: 'Clients & accès',
      hint: 'Déblocages · accès · progression',
      modules: ['unlockForm', 'accessForm', 'memberLevelForm']
    },
    {
      id: 'private-experiences',
      label: 'Capsules & drops privés',
      hint: 'Ambiance · stories · drops',
      modules: ['clubSettingsForm', 'capsuleForm', 'capsuleList', 'dropForm', 'dropList']
    }
  ];

  const text = value => String(value || '').replace(/\s+/g, ' ').trim();

  function metadata(el){
    return {
      id: text(el.id),
      kicker: text(el.querySelector?.('.kicker')?.textContent),
      title: text(el.querySelector?.('h2')?.textContent)
    };
  }

  function moduleKey(el){
    const m = metadata(el);

    // IDs stables : priorité absolue.
    if (m.id) {
      const byId = new Set([
        'unlockForm','accessForm','dailyRitualsForm','communityJourneyAdmin',
        'recipeForm','postForm','pageForm','protocolForm','foodDictionaryForm',
        'foodGuidanceAdminSection','foodGuidanceAdminForm','adapterFormulaAdminForm',
        'botanicalAdminForm','libraryOfferForm','contentForm','photoMigrationTool',
        'freeIntroProtocolTool','clubSettingsForm','capsuleForm','dropForm','memberLevelForm'
      ]);
      if (byId.has(m.id)) return m.id;
    }

    // Blocs de liste sans ID : reconnaissance exacte, jamais par sous-chaîne.
    const exact = `${m.kicker}||${m.title}`;
    const map = {
      'Recettes||Liste des recettes': 'recipeList',
      'Posts publiés||Gérer les posts': 'postList',
      'Pages existantes||Liste des pages': 'pageList',
      'Protocoles||Liste des protocoles': 'protocolList',
      'Dictionnaire alimentaire||Plats et aliments connus': 'foodDictionaryList',
      'Adapter · Formules||Formules administrables': 'adapterFormulaList',
      'Après soumission App Store||Catalogue vivant · sans nouvelle build': 'runtimeCatalog',
      'Phytothérapie||Catalogue botanique': 'botanicalList',
      'Offert par Tee||Ressources offertes': 'libraryOfferList',
      'Contenus existants||Liste des fichiers': 'contentList',
      'Capsules||Liste des capsules': 'capsuleList',
      'Drops||Liste des drops privés': 'dropList'
    };
    return map[exact] || '';
  }

  function makeGroup(group, members){
    const details = document.createElement('details');
    details.className = 'admin-studio-group';
    details.id = `admin-group-${group.id}`;
    details.dataset.adminFolder = group.id;
    details.innerHTML = `
      <summary>
        <span>${group.label}</span>
        <small>${group.hint}</small>
      </summary>
      <div class="admin-studio-group-grid"></div>`;

    const grid = details.querySelector('.admin-studio-group-grid');
    members.forEach(el => grid.appendChild(el));
    return details;
  }

  function install(){
    const panel = document.getElementById('adminPanel');
    const nav = document.getElementById('adminStudioNav');
    if (!panel || panel.dataset.organized === 'v496') return;

    const blocks = [...panel.children].filter(el => el.classList?.contains('admin-block'));
    if (!blocks.length) return;

    panel.dataset.organized = 'v496';

    const blockByKey = new Map();
    blocks.forEach(el => {
      const key = moduleKey(el);
      if (key && !blockByKey.has(key)) blockByKey.set(key, el);
    });

    const assigned = new Set();
    let firstGroup = null;

    GROUPS.forEach(group => {
      const members = group.modules
        .map(key => blockByKey.get(key))
        .filter(Boolean)
        .filter(el => !assigned.has(el));

      if (!members.length) return;
      members.forEach(el => assigned.add(el));

      const details = makeGroup(group, members);
      if (!firstGroup) firstGroup = details;
      panel.appendChild(details);
    });

    // Un nouveau module futur ne sera plus noyé dans « Outils & réglages ».
    // Il reste isolé dans un dossier explicite pour être classé volontairement.
    const leftovers = blocks.filter(el => !assigned.has(el));
    if (leftovers.length) {
      const details = makeGroup({
        id: 'unclassified',
        label: 'Nouveautés à classer',
        hint: `${leftovers.length} module${leftovers.length > 1 ? 's' : ''}`
      }, leftovers);
      panel.appendChild(details);
      console.warn('[Méthode Tee Admin] Modules non classés :', leftovers.map(metadata));
    }

    // L’admin reste compact au chargement : seul le premier dossier est ouvert,
    // comme auparavant. Aucun comportement des formulaires n’est modifié.
    if (firstGroup) firstGroup.open = true;

    // Compatibilité avec les anciennes versions ayant encore le ruban sticky.
    if (nav) {
      nav.innerHTML = '';
      nav.hidden = true;
    }
  }

  document.addEventListener('DOMContentLoaded', install);
})();
