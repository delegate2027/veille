/* JavaScript volontairement compatible avec la syntaxe/ecosysteme des annees 1990-2000. */
var renderedLinks = {};
var lastModifiedSeen = null;
var currentView = "feed";
var POLL_INTERVAL = 60000;
var FEED_LIMIT = 25;

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

function replaceUrlsWithPlaceholder(text) {
  var re = /(https?:\/\/[^\s]+|www\.[^\s]+|[A-Za-z0-9.-]+\.[A-Za-z]{2,}(?:\/[^\s]*)?)/gi;
  return String(text || "").replace(re, "url");
}

function removeExcessiveRepeats(str) {
  return String(str || "").replace(/(.)\1{3,}/g, "$1");
}

function capitalizeWords(str) {
  var parts = String(str || "").split(" "), i, word, result = [];
  for (i = 0; i < parts.length; i++) {
    word = parts[i];
    if (word.length) result.push(word.charAt(0).toUpperCase() + word.substr(1).toLowerCase());
  }
  return result.join(" ");
}

/* Format unique pour le flux, les archives et la date de mise a jour :
   l'annee est necessaire car les archives couvrent plusieurs mois. */
function formatDate(dateText) {
  var d = new Date(dateText), day, month, year, hour, minute;
  if (isNaN(d.getTime())) return "";
  day = d.getDate();
  month = d.getMonth() + 1;
  year = d.getFullYear();
  hour = d.getHours();
  minute = d.getMinutes();
  return (day < 10 ? "0" : "") + day + "/" +
         (month < 10 ? "0" : "") + month + "/" + year + " " +
         (hour < 10 ? "0" : "") + hour + ":" +
         (minute < 10 ? "0" : "") + minute;
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
  var nodes = xml.getElementsByTagName("item"), result = [], i, node;
  for (i = 0; i < nodes.length; i++) {
    node = nodes[i];
    result.push({
      node: node,
      title: getTagText(node, "title"),
      link: getTagText(node, "link"),
      author: getTagText(node, "author"),
      description: getTagText(node, "description"),
      pubDate: getTagText(node, "pubDate")
    });
  }
  result.sort(compareByDateDesc);
  return result;
}

function sourceClass(author) {
  var a = lower(author);
  if (a === "meeting") return "meeting";
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
      a.indexOf("npa") !== -1 || a.indexOf("anticapitaliste") !== -1) return "pcf";
  return "meeting";
}

function buildItemElement(item) {
  var title = removeExcessiveRepeats(removeEmojis(item.title));
  var link = item.link || "#";
  var author = trimString(item.author || "Auteur");
  var description = removeExcessiveRepeats(removeEmojis(replaceUrlsWithPlaceholder(item.description || "")));
  var displayAuthor = capitalizeWords(author);
  var videoId = extractVideoId(link);
  var div = document.createElement("div");
  var html;

  div.className = "item item-left " + sourceClass(author);
  div.setAttribute("data-author", author);
  div.setAttribute("data-pubdate", item.pubDate || "");

  html = '<div class="top">' +
           '<span class="author ' + sourceClass(author) + '">' + escapeHtml(displayAuthor) + '</span>' +
           '<span class="date">' + escapeHtml(formatDate(item.pubDate)) + '</span>' +
         '</div>' +
         '<div class="title"><a href="' + escapeHtml(link) + '" class="video-link">' + escapeHtml(title) + '</a></div>' +
         '<div class="desc">' + escapeHtml(description.replace(/[\r\n]+/g, " ")) + '</div>';

  div.innerHTML = html;

  var videoLink = div.getElementsByTagName("a")[0];

  if (videoId) {
    div.setAttribute("data-video-id", videoId);
    div.setAttribute("data-title", title);
    videoLink.onclick = function() {
      var existing = findChildByClass(div, "youtube-player");
      var players = document.getElementsByTagName("div");
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
      div.appendChild(createPlayer(videoId, title));
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

/* Onglet Flux seul : developpe le player du premier item affiche, sans lecture
   automatique (l'embed sans parametre autoplay reste en pause). */
function openFirstItemPlayer() {
  var feed = document.getElementById("feed");
  var items = getItemElements(feed);
  var first, videoId;

  if (!items.length) return;
  first = items[0];
  videoId = first.getAttribute("data-video-id");
  if (!videoId || findChildByClass(first, "youtube-player")) return;

  first.appendChild(createPlayer(videoId, first.getAttribute("data-title") || ""));
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
    callback(null, { items: items, lastModified: lastModified });
  });
}

function updateStatus(lastModified, animate) {
  var update = document.getElementById("lastUpdate");
  var formatted, timeEl;

  if (!lastModified) return;

  lastModifiedSeen = lastModified;
  formatted = formatDate(lastModified);

  /* L'heure (HH:MM) est isolee dans un span pour porter seule l'animation :
     la date et le libelle restent fixes pendant que l'heure s'eclaire. */
  if (formatted.length > 5) {
    update.innerHTML = "Dernière mise à jour : " +
      escapeHtml(formatted.substr(0, formatted.length - 5)) +
      '<span class="status-time">' + escapeHtml(formatted.substr(formatted.length - 5)) + "</span>";
    if (animate) {
      timeEl = update.getElementsByTagName("span")[0];
      pulseElement(timeEl);
    }
  } else {
    update.innerHTML = "Dernière mise à jour : " + escapeHtml(formatted);
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
   deja affiches et s'arrete une fois FEED_LIMIT items affiches. insertFn
   choisit l'ordre d'insertion (appendItem au chargement, insertItemInOrder au
   rafraichissement) ; les nouvelles entrees poussent alors les plus anciennes
   hors de la limite, retirees par trimFeedToLimit. */
function renderFeedItems(items, insertFn) {
  var feed = document.getElementById("feed");
  var shown = getItemElements(feed).length;
  var i, item, link;

  for (i = 0; i < items.length && shown < FEED_LIMIT; i++) {
    item = items[i];
    if (isShort(item.title, item.link, item.description)) continue;
    link = item.link || "#";
    if (renderedLinks[link]) continue;
    renderedLinks[link] = true;
    insertFn(buildItemElement(item));
    shown++;
  }

  trimFeedToLimit();
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
    feedRevision++;
    feed = document.getElementById("feed");
    feed.innerHTML = "";
    renderFeedItems(data.items, appendItem);
    openFirstItemPlayer();
  }, null);
}

function pollRSS() {
  fetchAndParseRSS(function(err, data) {
    if (err || data.notModified) return;
    if (data.lastModified && data.lastModified === lastModifiedSeen) return;
    updateStatus(data.lastModified, true);
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

  setView(lower(window.location.hash || "") === "#archives" ? "archives" : "feed");
}

initViewNav();
loadRSS();
window.setInterval(pollRSS, POLL_INTERVAL);
