/* Vue archives de la page unique : lit archives.xml, dedoublonne par lien,
   le filtre a la demande et l'affiche sous forme de frise et de liste
   (timeline.js).
   Le rendu d'un item est celui du flux (buildItemElement) pour que les deux
   vues soient identiques ; les helpers viennent de script.js. */
var archiveItems = [];
var archiveLoaded = false;

/* Case "Chaînes" de la zone de recherche : quand elle est cochee, la saisie
   ne porte plus que sur le nom de la chaine (l'auteur du flux), pas sur le
   titre ni sur le lien. */
var archiveChannelsOnly = false;

/* Premier jour (de veille) conserve : les entrees plus anciennes sont
   ignorees au chargement, ni recherchees ni affichees. La frise demarre a
   cette date. */
var ARCHIVE_START = { y: 2026, m: 9, d: 1 };

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
      pubDate: getTagText(node, "pubDate")
    };

    /* Precalcule une fois par entree ce que la recherche reclame : le texte
       normalise (sans accents) et les deux vues de la date. item.date reste
       sur le calendrier normal (dates saisies explicitement) ; item.day suit
       la journee de veille a frontiere de 6 h (aujourd'hui / hier). La frappe
       ne fait alors plus que comparer, sur les 10000 entrees possibles. */
    pub = parseDate(item.pubDate);
    item.searchBase = sansAccent(item.title + " " + item.author + " " + item.link);
    item.authorBase = sansAccent(item.author);
    item.date = pub ? dateParts(pub) : null;
    item.day = pub ? broadcastDayParts(pub) : null;

    /* Sans date, une entree ne peut pas se placer sur la frise ; avant
       ARCHIVE_START, elle est hors periode. */
    if (!item.day || isBeforeArchiveStart(item.day)) continue;

    result.push(item);
  }

  /* Tri partage avec le flux (compareByDateDesc) : plus recent d'abord. */
  result.sort(compareByDateDesc);

  return result;
}

/* Vrai si le jour de veille {y, m, d} precede ARCHIVE_START. */
function isBeforeArchiveStart(day) {
  var a = day.y * 10000 + day.m * 100 + day.d;
  var b = ARCHIVE_START.y * 10000 + ARCHIVE_START.m * 100 + ARCHIVE_START.d;

  return a < b;
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
   les accents des deux cotes : taper "melenchon" trouve "Mélenchon". Avec la
   case "Chaînes", seul le nom de la chaine est compare. */
function matchesFilter(item, tokens) {
  var haystack = archiveChannelsOnly ? item.authorBase : item.searchBase;
  var i, t;

  if (!tokens.length) return true;

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

/* Le rendu (frise, familles et liste des resultats) est dans timeline.js. */
function renderArchive() {
  renderTimeline();
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
  var box = document.getElementById("archiveChannels");
  var refresh;

  if (!input) return;

  refresh = function() {
    if (!archiveLoaded) return;
    tlResetNavigation();
    renderArchive();
  };

  /* oninput reagit aussi au collage et aux claviers mobiles, que onkeyup
     laisse passer : coller un terme sans presser de touche ne mettait
     rien a jour. */
  if ("oninput" in input) input.oninput = refresh;
  else input.onkeyup = refresh;

  /* La case "Chaînes" restreint la saisie aux noms de chaines ; l'invite du
     champ suit le mode choisi. */
  if (box) {
    archiveChannelsOnly = !!box.checked;
    box.onchange = function() {
      archiveChannelsOnly = !!box.checked;
      input.placeholder = archiveChannelsOnly ? "Rechercher une chaîne." : "Rechercher dans les archives.";
      refresh();
    };
  }
}

/* Place le curseur dans le champ : a l'arrivee sur la page (vue archives par
   defaut) comme au clic sur l'onglet, pour pouvoir chercher tout de suite. */
function focusArchiveFilter() {
  var input = document.getElementById("archiveFilter");

  if (input && input.focus) input.focus();
}

initArchiveFilter();