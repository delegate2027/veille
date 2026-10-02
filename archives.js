/* Vue archives de la page unique : lit archives.xml, dedoublonne par lien,
   affiche une liste simple et la filtre a la demande.
   Le rendu d'un item est celui du flux (buildItemElement) pour que les deux
   vues soient identiques ; les helpers viennent de script.js. */
var archiveItems = [];
var archiveLoaded = false;

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

/* La recherche porte sur le titre, l'auteur et le lien seulement : la
   description generee par les flux est trop bavarde et remontait des
   entrees sans rapport avec le terme. */
function matchesFilter(item, needle) {
  var haystack;

  if (!needle) return true;

  haystack = lower(item.title + " " + item.author + " " + item.link);
  return haystack.indexOf(needle) !== -1;
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
  var xhr = new XMLHttpRequest();
  var container = document.getElementById("archive");

  xhr.open("GET", "archives.xml", true);
  xhr.setRequestHeader("Cache-Control", "no-cache");

  xhr.onreadystatechange = function() {
    var xml;
    if (xhr.readyState !== 4) return;

    /* 304 : le serveur confirme que la copie locale est la bonne.
       Ce n'est pas une erreur, on conserve les donnees deja chargees. */
    if (xhr.status === 304) {
      archiveLoaded = true;
      archiveFeedRevision = feedRevision;
      renderArchive();
      return;
    }

    if (xhr.status !== 200 && xhr.status !== 0) {
      container.innerHTML = '<div class="error">Impossible de charger les archives : HTTP ' + xhr.status + '</div>';
      archiveLoaded = true;
      return;
    }

    try {
      xml = new DOMParser().parseFromString(xhr.responseText, "text/xml");
    } catch (e) {
      container.innerHTML = '<div class="error">Impossible de lire le fichier d’archives.</div>';
      archiveLoaded = true;
      return;
    }

    archiveItems = parseArchive(xml);
    archiveLoaded = true;
    archiveFeedRevision = feedRevision;
    updateArchiveCount();
    renderArchive();
  };

  xhr.send(null);
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