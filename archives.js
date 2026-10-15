/* Vue archives de la page unique : lit archives.xml, dedoublonne par lien,
   affiche une liste simple et la filtre a la demande.
   Le rendu d'un item est celui du flux (buildItemElement) pour que les deux
   vues soient identiques ; les helpers viennent de script.js. */
var archiveItems = [];
var archiveLoaded = false;

/* Case "Inclure les descriptions" : la description est exclue de la
   recherche par defaut, trop bavarde pour etre utile. */
var archiveSearchDesc = false;

/* Revision du flux au moment du dernier chargement. rss.py ecrit flux.xml et
   archives.xml dans la meme execution : comparer les deux revisions suffit a
   savoir que l'archive est perimee, sans telecharger le fichier pour le savoir. */
var archiveFeedRevision = -1;

function parseArchive(xml) {
  var nodes = xml.getElementsByTagName("item");
  var result = [];
  var seen = {};
  var i, node, link, item, pub;

  for (i = 0; i < nodes.length; i++) {
    node = nodes[i];
    link = getTagText(node, "link");

    /* Deduplication par lien : la meme video ne peut apparaitre qu'une fois. */
    if (!link || seen[link]) continue;
    seen[link] = true;

    item = {
      title: getTagText(node, "title"),
      link: link,
      author: getTagText(node, "author"),
      description: getTagText(node, "description"),
      pubDate: getTagText(node, "pubDate")
    };

    /* Precalcule une fois par entree ce que la recherche reclame : le texte
       normalise (sans accents) et les deux vues de la date. item.date reste
       sur le calendrier normal (dates saisies explicitement) ; item.day suit
       la journee de veille a frontiere de 6 h (aujourd'hui / hier). La frappe
       ne fait alors plus que comparer, sur les 10000 entrees possibles. */
    pub = parseDate(item.pubDate);
    item.searchBase = sansAccent(item.title + " " + item.author + " " + item.link);
    item.date = pub ? dateParts(pub) : null;
    item.day = pub ? broadcastDayParts(pub) : null;

    result.push(item);
  }

  /* Tri partage avec le flux (compareByDateDesc) : plus recent d'abord. */
  result.sort(compareByDateDesc);

  return result;
}

/* Mois francais accepts dans une recherche, indexes 1-12.
   Les accents sont tolérés : "fevrier" comme "février". */
var MOIS_FR = {
  janvier: 1, fevrier: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, aout: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12
};

/* Les caracteres accentues sont ecrits en echappement unicode pour rester
   dans un fichier ASCII. Seul le resultat importe : taper "melencon" doit
   trouver "Mélenchon", comme l'inverse. */
function sansAccent(str) {
  return lower(str)
    .replace(/[\u00e9\u00e8\u00ea\u00eb]/g, "e")
    .replace(/[\u00e0\u00e2]/g, "a")
    .replace(/[\u00ee\u00ef]/g, "i")
    .replace(/[\u00f4\u00f6]/g, "o")
    .replace(/[\u00f9\u00fb\u00fc]/g, "u")
    .replace(/\u00e7/g, "c")
    .replace(/\u00e6/g, "ae")
    .replace(/\u0153/g, "oe")
    .replace(/\u00f1/g, "n");
}

function monthIndex(word) {
  var nom = sansAccent(word);

  return MOIS_FR[nom] === undefined ? 0 : MOIS_FR[nom];
}

/* Une saisie est une suite de filtres : chaque terme doit correspondre, dans
   les champs habituels ou dans la date. "melenchon octobre" se lit donc
   "melenchon ET octobre". */
function splitQuery(needle) {
  var words = needle.split(/\s+/);
  var tokens = [];
  var i, jour, mois;

  for (i = 0; i < words.length; i++) {
    /* "2 octobre" : un jour suivi du nom du mois ne forme qu'un seul filtre. */
    if (i + 1 < words.length) {
      jour = words[i].match(/^(\d{1,2})$/);
      mois = monthIndex(words[i + 1]);
      if (jour && mois) {
        tokens.push(jour[1] + "/" + mois);
        i++;
        continue;
      }
    }
    tokens.push(words[i]);
  }

  return tokens;
}

/* Composants annee/mois/jour d'un instant, en heure locale. */
function dateParts(dateObj) {
  return { y: dateObj.getFullYear(), m: dateObj.getMonth() + 1, d: dateObj.getDate() };
}

/* La journee de veille va de 6 h du matin a 6 h du matin : une video publiee
   a 3 h appartient encore a la veille. On decale donc l'instant de 6 heures
   avant d'en lire la date, ce qui place la frontiere a 6 h. */
var DAY_SHIFT_HOURS = 6;

function broadcastDayParts(dateObj) {
  return dateParts(new Date(dateObj.getTime() - DAY_SHIFT_HOURS * 3600000));
}

/* Instant local d'une date textuelle, ou null si illisible. */
function parseDate(dateText) {
  var d = new Date(dateText);

  return isNaN(d.getTime()) ? null : d;
}

/* Le mot "aujourd'hui" (apostrophe droite ou courbe, accents ignores) sert de
   raccourci pour la date du jour. */
function isTodayToken(token) {
  return sansAccent(token).replace(/[\u2019']/g, "") === "aujourdhui";
}

/* Le mot "hier" (accents ignores) sert de raccourci pour la date de la veille. */
function isYesterdayToken(token) {
  return sansAccent(token) === "hier";
}

/* Composants des journees du jour et de la veille (frontiere a 6 h),
   recalcules seulement quand la journee de veille change : le basculement se
   fait donc a 6 h du matin, pas a minuit. */
var todayParts = null;
var yesterdayParts = null;
var todayKey = null;

function getTodayParts() {
  var today = broadcastDayParts(new Date());
  var y;
  var key = today.y + "-" + today.m + "-" + today.d;

  if (key !== todayKey) {
    todayParts = today;
    y = new Date(today.y, today.m - 1, today.d);
    y.setDate(y.getDate() - 1);
    yesterdayParts = { y: y.getFullYear(), m: y.getMonth() + 1, d: y.getDate() };
    todayKey = key;
  }

  return todayParts;
}

function getYesterdayParts() {
  getTodayParts();
  return yesterdayParts;
}

/* Egalite de deux dates a composants annee/mois/jour. */
function sameDay(parts, day) {
  return day.y === parts.y && day.m === parts.m && day.d === parts.d;
}

/* Comparaison d'un terme avec la date d'une entree. "aujourd'hui" et "hier"
   s'appuient sur la journee de veille (frontiere a 6 h) ; les dates saisies
   explicitement restent sur le calendrier normal. Les separateurs n'ont pas
   d'importance : 2026-10-02, 02/10/2026, 2.10.2026 et 02/10/26 sont
   equivalents. L'annee sur deux chiffres est lue au XXIe siecle (26 -> 2026). */
function matchesDate(item, token) {
  var parts = item.date;
  var num, mois;

  if (isTodayToken(token)) return !!item.day && sameDay(item.day, getTodayParts());

  if (isYesterdayToken(token)) return !!item.day && sameDay(item.day, getYesterdayParts());

  if (!parts) return false;

  num = token.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);

  if (num) return +num[1] === parts.y && +num[2] === parts.m && +num[3] === parts.d;

  num = token.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (num) return +num[3] === parts.y && +num[2] === parts.m && +num[1] === parts.d;

  num = token.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2})$/);

  if (num) return (2000 + +num[3]) === parts.y && +num[2] === parts.m && +num[1] === parts.d;

  num = token.match(/^(\d{1,2})[-/.](\d{1,2})$/);

  if (num) return +num[2] === parts.m && +num[1] === parts.d;

  if (/^\d{4}$/.test(token)) return +token === parts.y;

  mois = monthIndex(token);

  return mois !== 0 && mois === parts.m;
}

/* La recherche porte sur le titre, l'auteur, le lien et la date, et ignore
   les accents des deux cotes : taper "melenchon" trouve "Mélenchon".
   La description n'est cherche que si la case est cochee : generee par
   les flux, elle est trop bavarde et remontait des entrees sans rapport
   avec le terme. Le texte avec description est construit a la demande puis
   garde sur l'entree (searchDesc), pour ne pas retarder le cas par defaut. */
function matchesFilter(item, tokens) {
  var haystack, i, t;

  if (!tokens.length) return true;

  haystack = archiveSearchDesc
    ? (item.searchDesc || (item.searchDesc = item.searchBase + " " + sansAccent(item.description)))
    : item.searchBase;

  for (i = 0; i < tokens.length; i++) {
    t = tokens[i];
    /* "aujourd'hui" et "hier" ne sont que des filtres de date : s'ils ne
       tombent pas sur la bonne date, l'entree est rejetee, meme si le mot
       figure dans son texte. */
    if (isTodayToken(t.raw) || isYesterdayToken(t.raw)) {
      if (!matchesDate(item, t.raw)) return false;
      continue;
    }
    if (matchesDate(item, t.raw)) continue;
    if (haystack.indexOf(t.norm) !== -1) continue;
    return false;
  }

  return true;
}

/* Les tokens sont prepares une fois pour toute la liste : sans cela, chaque
   entree retokenise et renormalise la meme saisie. La liste vient de
   parseArchive, deja triee du plus recent au plus ancien ; l'ordre est donc
   conserve sans nouveau tri. */
function getVisibleArchiveItems(needle) {
  var words = splitQuery(needle);
  var tokens = [];
  var visible = [];
  var i;

  for (i = 0; i < words.length; i++) {
    tokens.push({ raw: words[i], norm: sansAccent(words[i]) });
  }

  for (i = 0; i < archiveItems.length; i++) {
    if (matchesFilter(archiveItems[i], tokens)) visible.push(archiveItems[i]);
  }

  return visible;
}

/* Aucune liste n'est affichee au repos : seules les entrees correspondant
   a une recherche saisie sont montrees. Sans terme saisi, la zone reste vide,
   l'invite a chercher tenant lieu de message dans le champ lui-meme. */

/* Empreinte des resultats affiches, pour detecter un rafraichissement sans
   effet visible. */
function archiveVisibleKey(visible) {
  var parts = [];
  var i;

  for (i = 0; i < visible.length; i++) parts.push(visible[i].link || "");
  return parts.join("\n");
}

/* Indexe les items deja presents dans la liste par leur lien. */
function indexArchiveItems(container) {
  var nodes = container.childNodes;
  var map = {};
  var i, node;

  for (i = 0; i < nodes.length; i++) {
    node = nodes[i];
    if (node.nodeType === 1 && hasClass(node, "archives-item")) {
      map[node.getAttribute("data-link") || ""] = node;
    }
  }

  return map;
}

/* Retire les noeuds qui ne font pas partie des resultats courants (items
   disparus, message d'erreur, invite de chargement). */
function pruneArchiveItems(container, keep) {
  var nodes = container.childNodes;
  var i, node;

  for (i = nodes.length - 1; i >= 0; i--) {
    node = nodes[i];
    if (node.nodeType !== 1) continue;
    if (hasClass(node, "archives-item") && keep[node.getAttribute("data-link") || ""]) continue;
    container.removeChild(node);
  }
}

var archiveRenderedKey = null;

/* Rendu par reconciliation : les items deja affiches sont conserves et
   repositionnes via la propriete CSS order, les nouveaux sont ajoutes et les
   disparus retires. Le noeud qui porte un lecteur video n'est donc jamais
   deplace ni recree : la lecture en cours n'est jamais interrompue. */
function renderArchive() {
  var container = document.getElementById("archive");
  var input = document.getElementById("archiveFilter");
  var needle = lower(trimString(input ? input.value : ""));
  var existing, visible, keep, key, item, element;
  var i;

  if (!needle) {
    container.innerHTML = "";
    archiveRenderedKey = null;
    updateArchiveCount();
    return;
  }

  visible = getVisibleArchiveItems(needle);
  key = archiveVisibleKey(visible);

  /* Rafraichissement sans changement visible : rien a reconstruire. */
  if (key === archiveRenderedKey) {
    updateArchiveCount(visible.length);
    return;
  }
  archiveRenderedKey = key;

  if (!visible.length) {
    container.innerHTML = '<div class="error">Aucune entrée ne correspond à cette recherche.</div>';
    updateArchiveCount(0);
    return;
  }

  existing = indexArchiveItems(container);
  keep = {};

  /* buildItemElement(..., true) : rendu compact des archives, une ligne par
     entree, sans description, titre teinte comme sa source, lecture video au clic.
     Un item deja affiche est reutilise tel quel (order le repositionne). */
  for (i = 0; i < visible.length; i++) {
    item = visible[i];
    keep[item.link] = true;
    element = existing[item.link];
    if (!element) {
      element = buildItemElement(item, true);
      container.appendChild(element);
    }
    element.style.order = i;
  }

  pruneArchiveItems(container, keep);
  updateArchiveCount(visible.length);
}

function updateArchiveCount(visible) {
  var counter = document.getElementById("archiveCount");
  var total = archiveItems.length;
  var text;

  if (!counter) return;

  if (typeof visible === "undefined") {
    text = total + (total > 1 ? " entrées archivées" : " entrée archivée");
  } else {
    text = visible + " / " + total + " entrées";
  }

  counter.innerHTML = text;
}

function loadArchive() {
  var container = document.getElementById("archive");

  fetchXML("archives.xml", null, function(err, xml, notModified) {
    /* En cas d'erreur, archiveLoaded reste false : un nouveau passage
       sur l'onglet relancera le chargement au lieu de figer l'archive
       jusqu'au prochain changement de flux. Une liste deja affichee (et
       une lecture en cours) n'est pas effacee pour autant. */
    if (err) {
      if (!archiveLoaded) {
        container.innerHTML = '<div class="error">Impossible de charger les archives (' + escapeHtml(err.message) + ').</div>';
      }
      return;
    }

    /* 304 : le serveur confirme que la copie locale est la bonne.
       Ce n'est pas une erreur, on conserve les donnees deja chargees. */
    if (notModified) {
      archiveLoaded = true;
      archiveFeedRevision = feedRevision;
      renderArchive();
      return;
    }

    archiveItems = parseArchive(xml);
    archiveLoaded = true;
    archiveFeedRevision = feedRevision;
    updateArchiveCount();
    renderArchive();
  });
}

/* Charge l'archive seulement si necessaire : le fichier grossit jusqu'au
   plafond de 10000 entrees. Le rechargement est declenche par un signal,
   jamais par une horloge : sans changement, aucune requete de plus. */
function ensureArchiveLoaded(force) {
  if (!archiveLoaded || force) loadArchive();
}

/* Vrai des que le flux a bouge depuis le dernier chargement de l'archive. */
function isArchiveStale() {
  return archiveLoaded && archiveFeedRevision !== feedRevision;
}

function initArchiveFilter() {
  var input = document.getElementById("archiveFilter");
  var descBox = document.getElementById("archiveSearchDesc");
  var refresh;

  if (!input) return;

  /* "aujourd'hui" est pre-rempli : l'onglet s'ouvre sur les entrees du jour,
     sans saisie. Respecte une valeur deja presente.
     Pas de trimString ici : archives.js s'execute avant script.js, dont
     les helpers ne sont pas encore definis a ce moment. */
  if (!input.value) {
    input.value = "aujourd'hui";
  }

  refresh = function() {
    if (!archiveLoaded) return;
    renderArchive();
  };

  /* oninput reagit aussi au collage et aux claviers mobiles, que onkeyup
     laisse passer : coller un terme sans presser de touche ne mettait
     rien a jour. */
  if ("oninput" in input) input.oninput = refresh;
  else input.onkeyup = refresh;

  /* Cocher la case etend la recherche a la description ; la liste
     est refiltree a chaque changement. */
  if (descBox) {
    descBox.onchange = function() {
      archiveSearchDesc = descBox.checked;
      refresh();
    };
  }
}

/* Place le curseur dans le champ : a l'arrivee sur la page (vue archives par
   defaut) comme au clic sur l'onglet. Rien n'est liste tant qu'un terme n'est
   pas saisi, autant proposer directement le clavier. */
function focusArchiveFilter() {
  var input = document.getElementById("archiveFilter");

  if (input && input.focus) input.focus();
}

initArchiveFilter();