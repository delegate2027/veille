/* Vue archives de la page unique : lit archives.xml, dedoublonne par lien,
   affiche une liste simple et la filtre a la demande.
   Le rendu d'un item est celui du flux (buildItemElement) pour que les deux
   vues soient identiques ; les helpers viennent de script.js. */
var archiveItems = [];
var archiveLoaded = false;

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

  result.sort(function(a, b) {
    return parseTime(b.pubDate) - parseTime(a.pubDate);
  });

  return result;
}

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

  return visible;
}

/* Aucune liste n'est affichee au repos : seules les entrees correspondant
   a une recherche saisie sont montrees. */
function renderArchive() {
  var container = document.getElementById("archive");
  var input = document.getElementById("archiveFilter");
  var needle = lower(trimString(input ? input.value : ""));
  var visible;
  var i;

  container.innerHTML = "";

  if (!needle) {
    container.innerHTML = '<div class="archive-hint">Saisissez un terme pour rechercher dans les archives.</div>';
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
    updateArchiveCount();
    renderArchive();
  };

  xhr.send(null);
}

/* Charge l'archive seulement si necessaire : le fichier pese ~240 Ko. */
function ensureArchiveLoaded(force) {
  if (!archiveLoaded || force) loadArchive();
}

function initArchiveFilter() {
  var input = document.getElementById("archiveFilter");

  if (!input) return;

  input.onkeyup = function() {
    if (!archiveLoaded) return;
    renderArchive();
  };
}

initArchiveFilter();