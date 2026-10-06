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
  var i, node, link;

  for (i = 0; i < nodes.length; i++) {
    node = nodes[i];
    link = getTagText(node, "link");

    /* Deduplication par lien : la meme video ne peut apparaitre qu'une fois. */
    if (!link || seen[link]) continue;
    seen[link] = true;

    result.push({
      title: getTagText(node, "title"),
      link: link,
      author: getTagText(node, "author"),
      description: getTagText(node, "description"),
      pubDate: getTagText(node, "pubDate")
    });
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

/* Comparaison d'un terme avec la date d'une entree. Les separateurs saisis
   n'ont pas d'importance : 2026-10-02, 02/10/2026 et 2.10.2026 sont equivalents.
   Les dates sont lues en heure locale, comme au rendu (formatDate). */
function matchesDate(dateText, token) {
  var d = new Date(dateText);
  var y, m, jour, num, mois;

  if (isNaN(d.getTime())) return false;

  y = d.getFullYear();
  m = d.getMonth() + 1;
  jour = d.getDate();
  num = token.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);

  if (num) return +num[1] === y && +num[2] === m && +num[3] === jour;

  num = token.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);

  if (num) return +num[3] === y && +num[2] === m && +num[1] === jour;

  num = token.match(/^(\d{1,2})[-/.](\d{1,2})$/);

  if (num) return +num[2] === m && +num[1] === jour;

  if (/^\d{4}$/.test(token)) return +token === y;

  mois = monthIndex(token);

  return mois !== 0 && mois === m;
}

/* La recherche porte sur le titre, l'auteur, le lien et la date, et ignore
   les accents des deux cotes : taper "melenchon" trouve "Mélenchon".
   La description n'est cherche que si la case est cochee : generee par
   les flux, elle est trop bavarde et remontait des entrees sans rapport
   avec le terme. */
function matchesFilter(item, needle) {
  var tokens, haystack, i, texte;

  if (!needle) return true;

  tokens = splitQuery(needle);
  haystack = sansAccent(item.title + " " + item.author + " " + item.link);
  if (archiveSearchDesc) haystack += " " + item.description;

  for (i = 0; i < tokens.length; i++) {
    if (matchesDate(item.pubDate, tokens[i])) continue;
    texte = sansAccent(tokens[i]);
    if (haystack.indexOf(texte) !== -1) continue;
    return false;
  }

  return true;
}

function getVisibleArchiveItems(needle) {
  var visible = [];
  var i;

  for (i = 0; i < archiveItems.length; i++) {
    if (matchesFilter(archiveItems[i], needle)) visible.push(archiveItems[i]);
  }

  /* L'ordre est regaranti ici : quel que soit l'ordre de stockage des
     entrees, les resultats restent du plus recent au plus ancien. */
  visible.sort(compareByDateDesc);

  return visible;
}

/* Aucune liste n'est affichee au repos : seules les entrees correspondant
   a une recherche saisie sont montrees. Sans terme saisi, la zone reste vide,
   l'invite a chercher tenant lieu de message dans le champ lui-meme. */
function renderArchive() {
  var container = document.getElementById("archive");
  var input = document.getElementById("archiveFilter");
  var needle = lower(trimString(input ? input.value : ""));
  var visible;
  var i;

  container.innerHTML = "";

  if (!needle) {
    updateArchiveCount();
    return;
  }

  visible = getVisibleArchiveItems(needle);

  if (!visible.length) {
    container.innerHTML = '<div class="error">Aucune entrée ne correspond à cette recherche.</div>';
    updateArchiveCount(0);
    return;
  }

  /* buildItemElement : rendu identique a celui du flux (pastille de source,
     titre nettoye, description, lecture video au clic). */
  for (i = 0; i < visible.length; i++) {
    container.appendChild(buildItemElement(visible[i]));
  }

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
       jusqu'au prochain changement de flux. */
    if (err) {
      container.innerHTML = '<div class="error">Impossible de charger les archives (' + escapeHtml(err.message) + ').</div>';
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

/* Charge l'archive seulement si necessaire : le fichier pese ~207 Ko et
   grossit jusqu'au plafond de 2000 entrees. Le rechargement est declenche par
   un signal, jamais par une horloge : sans changement, aucune requete de plus. */
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

/* Place le curseur dans le champ a l'ouverture de l'onglet : rien n'est liste
   tant qu'un terme n'est pas saisi, autant proposer directement le clavier.
   Appele au clic uniquement, pour ne pas ouvrir le clavier sur mobile au
   chargement d'une URL contenant #archives. */
function focusArchiveFilter() {
  var input = document.getElementById("archiveFilter");

  if (input && input.focus) input.focus();
}

initArchiveFilter();