/* JavaScript volontairement compatible avec la syntaxe/ecosysteme des annees 1990-2000. */
var renderedLinks = {};
var lastModifiedSeen = null;
var currentView = "feed";
var POLL_INTERVAL = 60000;
var FEED_LIMIT = 20;

/* rss.py est relance toutes les 15 minutes et reecrit flux.xml et
   archives.xml dans la meme execution. Le minuteur est cale sur l'heure de
   la derniere mise a jour (Last-Modified de flux.xml) et non sur l'arrivee
   sur la page : un rafraichissement ne le remet donc pas a 15 minutes. Il
   repart de 15 minutes quand une nouvelle version du flux est vue, meme si
   aucun item n'a ete ajoute. */
var UPDATE_PERIOD = 15 * 60;
var updateSeconds = 0;
var updateDeadline = 0;   /* 0 tant que la derniere mise a jour est inconnue */

/* Incremente uniquement lorsque le flux apporte reellement du nouveau.
   rss.py ecrivant flux.xml et archives.xml dans la meme execution, ce compteur
   signale que l'archive est perimee, sans jamais telecharger le fichier. */
var feedRevision = 0;

function escapeHtml(str) {
  str = String(str || "");
  return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
}

function trimString(str) {
  return String(str || "").replace(/^\s+|\s+$/g, "");
}

function lower(str) {
  return String(str || "").toLowerCase();
}

function isShort(title, link, desc) {
  var t = lower(title), d = lower(desc), l = lower(link);
  return t.indexOf("#shorts") !== -1 ||
         t.indexOf("shorts") !== -1 ||
         d.indexOf("#shorts") !== -1 ||
         l.indexOf("/shorts/") !== -1;
}

function removeEmojis(str) {
  /* Couvre les principales plages Unicode utilisees par les emojis (symboles, pictogrammes,
     transport, drapeaux, visages/emoticones etendus, variation selectors, etc.). */
  str = String(str || "");
  str = str.replace(/[\u2600-\u27BF]/g, " ");           // symboles divers + dingbats (incl. ☀-➿)
  str = str.replace(/[\u2190-\u21FF]/g, " ");           // fleches
  str = str.replace(/[\u2300-\u23FF]/g, " ");           // symboles techniques (⌚, ⏰...)
  str = str.replace(/[\u25A0-\u25FF]/g, " ");           // formes geometriques
  str = str.replace(/[\u2B00-\u2BFF]/g, " ");           // fleches/etoiles supplementaires
  str = str.replace(/[\uD83C-\uD83E][\uDC00-\uDFFF]/g, " "); // emojis sur paire surrogate (U+1F000-U+1FFFF : visages, objets, drapeaux...)
  str = str.replace(/[\u2934\u2935\u3030\u303D\u3297\u3299]/g, " ");
  str = str.replace(/[\uFE0E\uFE0F]/g, "");             // variation selectors (texte/emoji)
  str = str.replace(/\u200D/g, "");                     // zero-width joiner (emojis composes)
  return str.replace(/[ \t]{2,}/g, " ").replace(/^\s+|\s+$/g, "");
}

function removeExcessiveRepeats(str) {
  return String(str || "").replace(/(.)\1{3,}/g, "$1");
}

/* Les url des descriptions sont longues et cassent la mise en page : on les
   remplace par un lien discret portant le mot "lien". Le texte hors url reste
   echappe, l'adresse ne servant que d'attribut href. */
var DESCRIPTION_URL = /(https?:\/\/[^\s]+|www\.[^\s]+|[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/[^\s]*)?)/gi;

function linkifyDescription(text) {
  var parts = String(text || "").split(DESCRIPTION_URL);
  var html = "", i, part, href;
  for (i = 0; i < parts.length; i++) {
    part = parts[i];
    if (!part) continue;
    if (i % 2 === 1) {
      href = /^https?:\/\//i.test(part) ? part : "http://" + part;
      html += '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener">lien</a>';
    } else {
      html += escapeHtml(part);
    }
  }
  return html;
}

function capitalizeWords(str) {
  var parts = String(str || "").split(" "), i, word, result = [];
  for (i = 0; i < parts.length; i++) {
    word = parts[i];
    if (word.length) result.push(word.charAt(0).toUpperCase() + word.substr(1).toLowerCase());
  }
  return result.join(" ");
}

/* En vue Archives, chaines au nom trop long : on les affiche sous une forme
   courte. La cle est le nom d'origine en minuscules. Le nom d'origine n'est
   jamais modifie : il sert encore au rattachement de couleur (sourceClass) et
   a la recherche. Le flux affiche le nom brut de la chaine, sans edition. */
var AUTHOR_LABELS = {
  "pcf - parti communiste français (pcf)": "PCF"
};

function displayAuthorName(author) {
  return AUTHOR_LABELS[lower(author)] || capitalizeWords(author);
}

/* Format unique pour le flux et la date de mise a jour : l'annee sur deux
   chiffres suffit, comme dans les archives. 13/10/2026 14:48 devient
   13/10/26 14:48. */
function formatDate(dateText) {
  var d = new Date(dateText), day, month, year, hour, minute;
  if (isNaN(d.getTime())) return "";
  day = d.getDate();
  month = d.getMonth() + 1;
  year = d.getFullYear() % 100;
  hour = d.getHours();
  minute = d.getMinutes();
  return (day < 10 ? "0" : "") + day + "/" +
         (month < 10 ? "0" : "") + month + "/" +
         (year < 10 ? "0" : "") + year + " " +
         (hour < 10 ? "0" : "") + hour + ":" +
         (minute < 10 ? "0" : "") + minute;
}

/* Version compacte pour la vue Archives : sans l'heure, annee sur deux
   chiffres. 28/09/2026 18:16 devient 28/09/26. */
function formatDateShort(dateText) {
  var d = new Date(dateText), day, month, year;
  if (isNaN(d.getTime())) return "";
  day = d.getDate();
  month = d.getMonth() + 1;
  year = d.getFullYear() % 100;
  return (day < 10 ? "0" : "") + day + "/" +
         (month < 10 ? "0" : "") + month + "/" +
         (year < 10 ? "0" : "") + year;
}

function parseTime(value) {
  var time = new Date(value || "").getTime();
  return isNaN(time) ? 0 : time;
}

/* Ordre unique partage par le flux et les archives : le plus recent d'abord.
   Les deux vues passent par ce comparateur, elles ne peuvent donc pas diverger. */
function compareByDateDesc(a, b) {
  return parseTime(b.pubDate) - parseTime(a.pubDate);
}

function extractVideoId(link) {
  var m;
  m = String(link || "").match(/[?&]v=([A-Za-z0-9_-]{6,})/);
  if (m) return m[1];
  m = String(link || "").match(/youtu\.be\/([A-Za-z0-9_-]{6,})/i);
  if (m) return m[1];
  return null;
}

function getTagText(parent, tagName) {
  var nodes = parent.getElementsByTagName(tagName);
  if (!nodes || !nodes.length) return "";
  return trimString(nodes[0].textContent || nodes[0].innerText || "");
}

function getItemsFromXml(xml) {
  var nodes = xml.getElementsByTagName("item"), result = [], i;
  for (i = 0; i < nodes.length; i++) {
    result.push({
      title: getTagText(nodes[i], "title"),
      link: getTagText(nodes[i], "link"),
      author: getTagText(nodes[i], "author"),
      description: getTagText(nodes[i], "description"),
      pubDate: getTagText(nodes[i], "pubDate")
    });
  }
  result.sort(compareByDateDesc);
  return result;
}

function sourceClass(author) {
  var a = lower(author);
  if (a.indexOf("coquerel") !== -1 || a.indexOf("boyard") !== -1 || a.indexOf("aubry") !== -1 ||
      a.indexOf("chikirou") !== -1 || a.indexOf("panot") !== -1 || a.indexOf("mélenchon") !== -1 ||
      a.indexOf("melenchon") !== -1 || a.indexOf("vannier") !== -1 || a.indexOf("bompard") !== -1 ||
      a.indexOf("cathala") !== -1 || a.indexOf("clouet") !== -1 || a.indexOf("léaument") !== -1 ||
      a.indexOf("leaument") !== -1 || a.indexOf("maudet") !== -1 || a.indexOf("piquemal") !== -1 ||
      a.indexOf("guiraud") !== -1 || a.indexOf("guetté") !== -1 || a.indexOf("guette") !== -1 ||
      a.indexOf("saintoul") !== -1 || a.indexOf("trouvé") !== -1 || a.indexOf("trouve") !== -1 ||
      a.indexOf("obono") !== -1 || a.indexOf("bagayoko") !== -1 || a.indexOf("bernalicis") !== -1 ||
      a.indexOf("le coq") !== -1 || a.indexOf("hassan") !== -1 || a.indexOf("rima") !== -1) return "lfi";
  if (a.indexOf("écologistes") !== -1 || a.indexOf("ecologistes") !== -1 || a.indexOf("rousseau") !== -1) return "eelv";
  if (a.indexOf("parti socialiste") !== -1 || a.indexOf("autain") !== -1 || a.indexOf("corbière") !== -1 ||
      a.indexOf("corbiere") !== -1 || a.indexOf("l'après") !== -1 || a.indexOf("glucksmann") !== -1 ||
      a.indexOf("ruffin") !== -1 || a.indexOf("vallaud") !== -1 || a.indexOf("guedj") !== -1) return "ps";
  if (a.indexOf("horizons") !== -1 || a.indexOf("modem") !== -1 || a.indexOf("attal") !== -1 ||
      a.indexOf("edouard philippe") !== -1 || a.indexOf("édouard philippe") !== -1 ||
      a.indexOf("bergé") !== -1 || a.indexOf("berge") !== -1 || a.indexOf("macron") !== -1) return "centre";
  if (a.indexOf("renaissance") !== -1 || a.indexOf("wauquiez") !== -1 || a.indexOf("retailleau") !== -1 ||
      a.indexOf("bellamy") !== -1 || a.indexOf("lisnard") !== -1) return "lr";
  if (a.indexOf("zemmour") !== -1 || a.indexOf("knafo") !== -1 || a.indexOf("le pen") !== -1 ||
      a.indexOf("bardella") !== -1 || a.indexOf("rassemblement national") !== -1 ||
      a.indexOf("udr") !== -1) return "ed";
  if (a.indexOf("communiste") !== -1 || a.indexOf("pcf") !== -1 ||
      a.indexOf("npa") !== -1 || a.indexOf("anticapitaliste") !== -1 ||
      a.indexOf("révolution permanente") !== -1 || a.indexOf("revolution permanente") !== -1) return "pcf";
  return "meeting";
}

/* Certaines chaines (YouTube) repetent le titre en premiere ligne de la
   description : on retire cet echo pour ne pas afficher deux fois le meme
   texte dans le flux. Rien n'est touche si la premiere ligne differe. */
function removeTitleEcho(title, description) {
  var head;
  if (!title || !description) return description;
  head = description.split(/\r?\n/)[0];
  if (lower(trimString(head)) !== lower(trimString(title))) return description;
  return description.substring(head.length).replace(/^\s+/, "");
}

/* compact (vue Archives) : une seule ligne, le titre portant la teinte de sa
   source. Sinon rendu complet du flux. */
function buildItemElement(item, compact) {
  var title = removeExcessiveRepeats(removeEmojis(item.title));
  var link = item.link || "#";
  var author = trimString(item.author || "Auteur");
  var description = compact ? "" : removeExcessiveRepeats(removeEmojis(item.description || ""));
  var displayAuthor = compact ? displayAuthorName(author) : author;
  var videoId = extractVideoId(link);
  var cls = sourceClass(author);
  var div = document.createElement("div");
  var html;

  div.className = "item " + cls + (compact ? " archives-item" : "");
  div.setAttribute("data-pubdate", item.pubDate || "");
  div.setAttribute("data-link", link);

  if (compact) {
    html = '<span class="author ' + cls + '">' + escapeHtml(displayAuthor) + '</span>' +
           '<a href="' + escapeHtml(link) + '" class="archive-title">' + escapeHtml(title) + '</a>';
  } else {
    description = removeTitleEcho(title, description);
    html = '<div class="top">' +
             '<span class="date">' + escapeHtml(formatDate(item.pubDate)) + '</span>' +
             '<span class="author ' + cls + '">' + escapeHtml(displayAuthor) + '</span>' +
           '</div>' +
           '<div class="title"><a href="' + escapeHtml(link) + '">' + escapeHtml(title) + '</a></div>' +
           '<div class="desc">' + linkifyDescription(description) + '</div>';
  }

  div.innerHTML = html;

  var videoLink = div.getElementsByTagName("a")[0];

  if (videoId) {
    videoLink.onclick = function() {
      var existing = findChildByClass(div, "youtube-player");
      var titleBox = findChildByClass(div, "title");
      var players = document.getElementsByTagName("div");
      var player;
      var i;
      if (existing) {
        div.removeChild(existing);
        return false;
      }
      for (i = 0; i < players.length; i++) {
        if (hasClass(players[i], "youtube-player") && players[i].parentNode) {
          players[i].parentNode.removeChild(players[i]);
        }
      }
      /* Flux : le lecteur se glisse juste sous le titre, avant la description.
         Archives : pas de bloc titre, le lecteur reste en fin de ligne. */
      player = createPlayer(videoId, title);
      if (titleBox && titleBox.parentNode) {
        titleBox.parentNode.insertBefore(player, titleBox.nextSibling);
      } else {
        div.appendChild(player);
      }
      return false;
    };
  } else {
    videoLink.target = "_blank";
  }

  return div;
}

function hasClass(el, cls) {
  return (" " + el.className + " ").indexOf(" " + cls + " ") !== -1;
}

function findChildByClass(parent, cls) {
  var divs = parent.getElementsByTagName("div"), i;
  for (i = 0; i < divs.length; i++) if (hasClass(divs[i], cls)) return divs[i];
  return null;
}

function createPlayer(videoId, title) {
  var wrap = document.createElement("div");
  var iframe = document.createElement("iframe");
  wrap.className = "youtube-player";
  iframe.src = "https://www.youtube.com/embed/" + videoId;
  iframe.title = title;
  iframe.setAttribute("frameborder", "0");
  iframe.setAttribute("allowfullscreen", "allowfullscreen");
  wrap.appendChild(iframe);
  return wrap;
}

function getXmlHttp() {
  if (window.XMLHttpRequest) return new XMLHttpRequest();
  if (window.ActiveXObject) return new ActiveXObject("Microsoft.XMLHTTP");
  return null;
}

/* Requete XML unique pour le flux et les archives : memes en-tetes,
   memes cas d'erreur (navigateur, HTTP, 304, XML malforme). Le
   gestionnaire recut (err, xml, notModified, lastModified). */
function fetchXML(url, headers, callback) {
  var xhr = getXmlHttp();

  if (!xhr) {
    callback(new Error("Ce navigateur ne prend pas en charge les requêtes HTTP nécessaires."));
    return;
  }

  xhr.open("GET", url, true);
  xhr.setRequestHeader("Cache-Control", "no-cache");
  if (headers && headers["If-Modified-Since"]) xhr.setRequestHeader("If-Modified-Since", headers["If-Modified-Since"]);

  xhr.onreadystatechange = function() {
    var xml;
    if (xhr.readyState !== 4) return;

    /* 304 : le serveur confirme que la copie locale est la bonne. */
    if (xhr.status === 304) {
      callback(null, null, true, null);
      return;
    }
    if (xhr.status !== 200 && xhr.status !== 0) {
      callback(new Error("HTTP " + xhr.status));
      return;
    }

    /* responseXML est deja parse par le navigateur. parsererror signale
       un fichier malforme (Firefox renvoie un document, Chrome null). */
    xml = xhr.responseXML;
    if (!xml || !xml.getElementsByTagName || xml.getElementsByTagName("parsererror").length) {
      callback(new Error("fichier XML illisible"));
      return;
    }

    callback(null, xml, false, xhr.getResponseHeader("Last-Modified"));
  };

  xhr.send(null);
}

/* Le point vert clignote quand un rafraichissement apporte au moins un nouvel
   item (voir renderFeedItems). Trois cycles sont imposes par la CSS ; le
   clignotement est relance a chaque ajout et se retire seul a la fin de
   l'animation (initUpdateBlinkEnd), ce qui garantit trois cycles visibles. */
function setUpdating() {
  var icon = document.getElementById("lastUpdateIcon");

  if (!icon) return;

  toggleClassName(icon, "is-updating", false);
  void icon.offsetWidth;
  toggleClassName(icon, "is-updating", true);
}

/* Fin du clignotement : le point revient a son pulse normal. Pose sur l'icone
   des le chargement, avant tout clignotement. */
function initUpdateBlinkEnd() {
  var icon = document.getElementById("lastUpdateIcon");
  var svg = icon ? icon.getElementsByTagName("svg")[0] : null;
  var handler;

  if (!svg) return;

  handler = function() {
    toggleClassName(icon, "is-updating", false);
  };

  svg.onanimationend = handler;
  svg.onwebkitanimationend = handler;
}

/* Minuteur de la prochaine mise a jour : il est cale sur l'heure de fin de la
   derniere mise a jour connue, et non sur le chargement de la page. Un
   rafraichissement reprend donc le decompte la ou il en etait. rss.py ecrit
   flux.xml et archives.xml dans la meme execution : la fin du processus est
   signalee par une nouvelle version de flux.xml, meme quand aucun item n'est
   ajoute. Le decompte s'appuie sur l'horloge, et non sur un simple decrement,
   pour ne pas deriver quand l'onglet passe en arriere-plan. */
function formatUpdateTimer(seconds) {
  var minutes = Math.floor(seconds / 60);
  var rest = seconds % 60;

  return minutes + ":" + (rest < 10 ? "0" : "") + rest;
}

function drawUpdateTimer() {
  var box = document.getElementById("updateTimer");

  if (box) box.innerHTML = updateDeadline ? formatUpdateTimer(updateSeconds) : "";
}

function syncUpdateTimer(lastUpdate) {
  var finished = parseTime(lastUpdate);
  var left;

  if (!finished) return;

  updateDeadline = finished + UPDATE_PERIOD * 1000;
  left = Math.ceil((updateDeadline - (new Date()).getTime()) / 1000);
  if (left > UPDATE_PERIOD) left = UPDATE_PERIOD;
  if (left < 0) left = 0;
  updateSeconds = left;
  drawUpdateTimer();
}

function tickUpdateTimer() {
  var left;

  if (!updateDeadline) return;

  left = Math.ceil((updateDeadline - (new Date()).getTime()) / 1000);
  if (left < 0) left = 0;
  if (left === updateSeconds) return;

  updateSeconds = left;
  drawUpdateTimer();
}

function initUpdateTimer() {
  drawUpdateTimer();
  window.setInterval(tickUpdateTimer, 1000);
}

function fetchAndParseRSS(callback, headers) {
  fetchXML("flux.xml", headers, function(err, xml, notModified, lastModified) {
    var items;

    if (err) {
      callback(err);
      return;
    }
    if (notModified) {
      callback(null, { notModified: true });
      return;
    }

    items = getItemsFromXml(xml);
    callback(null, {
      items: items,
      lastModified: lastModified,
      lastBuildDate: getTagText(xml, "lastBuildDate")
    });
  });
}

function updateStatus(lastModified, animate) {
  var update = document.getElementById("lastUpdate");
  var icon = document.getElementById("lastUpdateIcon");
  var formatted, timeEl;

  if (!lastModified) return;

  lastModifiedSeen = lastModified;
  formatted = formatDate(lastModified);

  /* L'heure (HH:MM) est isolee dans un span pour porter seule l'animation :
     la date reste fixe pendant que l'heure s'eclaire, l'icone d'horloge qui
     remplace le libelle s'eclaire en meme temps. */
  if (formatted.length > 5) {
    update.innerHTML =
      escapeHtml(formatted.substr(0, formatted.length - 5)) +
      '<span class="status-time">' + escapeHtml(formatted.substr(formatted.length - 5)) + "</span>";
    if (animate) {
      timeEl = update.getElementsByTagName("span")[0];
      pulseElement(timeEl);
      pulseElement(icon);
    }
  } else {
    update.innerHTML = escapeHtml(formatted);
    if (animate) pulseElement(icon);
  }
}

/* Rejoue l'animation CSS en retirant puis en reposant la classe. La lecture
   forcee de offsetWidth oblige le navigateur a recalculer le style : sans ce
   passage, une classe deja posee ne relancerait pas l'animation au prochain
   rafraichissement. */
function pulseElement(el) {
  if (!el) return;
  toggleClassName(el, "is-updated", false);
  void el.offsetWidth;
  toggleClassName(el, "is-updated", true);
}

function getItemElements(feed) {
  var nodes = feed.childNodes, items = [], i;
  for (i = 0; i < nodes.length; i++) {
    if (nodes[i].nodeType === 1 && hasClass(nodes[i], "item")) items.push(nodes[i]);
  }
  return items;
}

function appendItem(div) {
  document.getElementById("feed").appendChild(div);
}

function insertItemInOrder(div) {
  var feed = document.getElementById("feed");
  var existing = getItemElements(feed);
  var time = parseTime(div.getAttribute("data-pubdate"));
  var i;
  for (i = 0; i < existing.length; i++) {
    if (parseTime(existing[i].getAttribute("data-pubdate")) < time) {
      feed.insertBefore(div, existing[i]);
      return;
    }
  }
  feed.appendChild(div);
}

/* Le flux n'affiche jamais plus de FEED_LIMIT items : les entrees les plus
   anciennes sont retirees du bout de la liste, qui reste trie par date. */
function trimFeedToLimit() {
  var feed = document.getElementById("feed");
  var items = getItemElements(feed);

  while (items.length > FEED_LIMIT) feed.removeChild(items.pop());
}

/* Rendu commun a loadRSS et pollRSS : filtre les shorts, ignore les liens
   deja affiches. Au chargement initial (appendItem) on s'arrete a FEED_LIMIT
   pour ne pas construire tout l'historique ; au rafraichissement
   (insertItemInOrder) les nouvelles entrees sont inserees meme si la limite
   est atteinte, puis les plus anciennes sont retirees par trimFeedToLimit.
   Le point vert ne clignote que si un rafraichissement ajoute au moins un
   item ; au chargement initial tout le flux est nouveau, donc pas de
   clignotement. */
function renderFeedItems(items, insertFn) {
  var feed = document.getElementById("feed");
  var shown = getItemElements(feed).length;
  var adding = insertFn === insertItemInOrder;
  var added = 0;
  var i, item, link;

  for (i = 0; i < items.length; i++) {
    if (!adding && shown >= FEED_LIMIT) break;
    item = items[i];
    if (isShort(item.title, item.link, item.description)) continue;
    link = item.link || "#";
    if (renderedLinks[link]) continue;
    renderedLinks[link] = true;
    insertFn(buildItemElement(item));
    shown++;
    added++;
  }

  trimFeedToLimit();

  if (adding && added > 0) setUpdating();
}

function loadRSS() {
  fetchAndParseRSS(function(err, data) {
    var feed;
    if (err) {
      feed = document.getElementById("feed");
      if (!getItemElements(feed).length) feed.innerHTML = '<div class="error">Impossible de charger le flux : ' + escapeHtml(err.message) + '</div>';
      return;
    }
    if (data.notModified) return;
    /* Le chargement initial affiche l'heure pour la premiere fois : on l'anime
       aussi, sinon le rappel visuel ne se voit qu'au rafraichissement en fond. */
    updateStatus(data.lastModified, true);
    syncUpdateTimer(data.lastModified || data.lastBuildDate);
    feedRevision++;
    feed = document.getElementById("feed");
    feed.innerHTML = "";
    renderFeedItems(data.items, appendItem);
  }, null);
}

function pollRSS() {
  fetchAndParseRSS(function(err, data) {
    if (err || data.notModified) return;
    if (data.lastModified && data.lastModified === lastModifiedSeen) return;
    updateStatus(data.lastModified, true);
    syncUpdateTimer(data.lastModified || data.lastBuildDate);
    feedRevision++;

    /* rss.py ecrit flux.xml et archives.xml dans le meme run : l'archive est donc
       elle aussi perimee. On ne la recharge que si sa vue est ouverte ; sinon le
       passage a l'onglet declenche le rechargement (isArchiveStale). */
    if (currentView === "archives") ensureArchiveLoaded(true);

    renderFeedItems(data.items, insertItemInOrder);
  }, lastModifiedSeen ? { "If-Modified-Since": lastModifiedSeen } : null);
}

/* Bascule entre la vue Flux et la vue Archives. */

function toggleClassName(el, cls, add) {
  var current;

  if (!el) return;

  current = trimString(el.className);

  if (add && !hasClass(el, cls)) {
    el.className = trimString(current + " " + cls);
  } else if (!add && hasClass(el, cls)) {
    el.className = trimString((" " + current + " ").replace(" " + cls + " ", " "));
  }
}

function setView(name) {
  var feedView = document.getElementById("viewFeed");
  var archiveView = document.getElementById("viewArchive");
  var navFeed = document.getElementById("navFeed");
  var navArchive = document.getElementById("navArchive");
  var counter = document.getElementById("archiveCount");

  if (!feedView || !archiveView) return;

  if (name !== "archives") name = "feed";
  currentView = name;

  toggleClassName(feedView, "is-hidden", name === "archives");
  toggleClassName(archiveView, "is-hidden", name !== "archives");
  toggleClassName(navFeed, "is-active", name === "feed");
  toggleClassName(navArchive, "is-active", name === "archives");
  toggleClassName(counter, "is-hidden", name !== "archives");

  if (name === "archives") ensureArchiveLoaded(isArchiveStale());
}

function initViewNav() {
  var navFeed = document.getElementById("navFeed");
  var navArchive = document.getElementById("navArchive");

  if (navFeed) {
    navFeed.onclick = function() {
      setView("feed");
      return false;
    };
  }

  if (navArchive) {
    navArchive.onclick = function() {
      setView("archives");
      /* Le focus vient apres setView : le champ est masque tant que la vue
         archives ne porte plus is-hidden, et un element invisible ne le prend pas. */
      focusArchiveFilter();
      return false;
    };
  }

  /* Archives par defaut a l'arrivee ; "#flux" permet d'ouvrir directement le
     flux. Sur la vue archives, le focus est place dans la recherche des
     l'ouverture de la page. Le focus vient apres setView : le champ est masque
     tant que la vue archives ne porte plus is-hidden, et un element invisible
     ne le prend pas. */
  if (lower(window.location.hash || "") === "#flux") {
    setView("feed");
  } else {
    setView("archives");
    focusArchiveFilter();
  }
}

initViewNav();
initUpdateBlinkEnd();
initUpdateTimer();
loadRSS();
window.setInterval(pollRSS, POLL_INTERVAL);
