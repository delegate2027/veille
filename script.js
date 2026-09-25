/* JavaScript volontairement compatible avec la syntaxe/ecosysteme des annees 1990-2000. */
var renderedLinks = {};
var lastModifiedSeen = null;
var POLL_INTERVAL = 60000;
var MIN_FEED_SIZE = 100 * 1024;

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

function formatDate(dateText) {
  var d = new Date(dateText), day, month, hour, minute;
  if (isNaN(d.getTime())) return "";
  day = d.getDate();
  month = d.getMonth() + 1;
  hour = d.getHours();
  minute = d.getMinutes();
  return (day < 10 ? "0" : "") + day + "/" +
         (month < 10 ? "0" : "") + month + " " +
         (hour < 10 ? "0" : "") + hour + ":" +
         (minute < 10 ? "0" : "") + minute;
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
  result.sort(function(a, b) {
    return new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime();
  });
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
      a.indexOf("saintoul") !== -1 || a.indexOf("trouvé") !== -1 || a.indexOf("trouve") !== -1) return "lfi";
  if (a.indexOf("écologistes") !== -1 || a.indexOf("ecologistes") !== -1 || a.indexOf("rousseau") !== -1) return "eelv";
  if (a.indexOf("parti socialiste") !== -1 || a.indexOf("autain") !== -1 || a.indexOf("corbière") !== -1 ||
      a.indexOf("corbiere") !== -1 || a.indexOf("l'après") !== -1 || a.indexOf("glucksmann") !== -1 ||
      a.indexOf("ruffin") !== -1 || a.indexOf("vallaud") !== -1 || a.indexOf("guedj") !== -1) return "ps";
  if (a.indexOf("horizons") !== -1 || a.indexOf("modem") !== -1 || a.indexOf("attal") !== -1 || a.indexOf("bergé") !== -1 || a.indexOf("berge") !== -1) return "centre";
  if (a.indexOf("renaissance") !== -1 || a.indexOf("wauquiez") !== -1 || a.indexOf("retailleau") !== -1 ||
      a.indexOf("bellamy") !== -1 || a.indexOf("lisnard") !== -1) return "lr";
  if (a.indexOf("zemmour") !== -1 || a.indexOf("knafo") !== -1 || a.indexOf("le pen") !== -1 ||
      a.indexOf("bardella") !== -1 || a.indexOf("rassemblement national") !== -1) return "ed";
  if (a.indexOf("communiste") !== -1 || a.indexOf("pcf") !== -1) return "pcf";
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

  html = '<div class="top">' +
           '<span class="author ' + sourceClass(author) + '">' + escapeHtml(displayAuthor) + '</span>' +
           '<span class="date">' + escapeHtml(formatDate(item.pubDate)) + '</span>' +
         '</div>' +
         '<div class="title"><a href="' + escapeHtml(link) + '" class="video-link">' + escapeHtml(title) + '</a></div>' +
         '<div class="desc">' + escapeHtml(description.replace(/[\r\n]+/g, " ")) + '</div>';

  div.innerHTML = html;

  if (videoId) {
    var videoLink = div.getElementsByTagName("a")[0];
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

function getResponseSize(xhr) {
  if (xhr.responseText) return xhr.responseText.length;

  var contentLength = xhr.getResponseHeader("Content-Length");
  var size = parseInt(contentLength, 10);
  return !isNaN(size) ? size : 0;
}

function updateFeedWarning(size) {
  var warning = document.getElementById("feedWarning");
  if (!warning) return;
  warning.style.display = size < MIN_FEED_SIZE ? "block" : "none";
}

function fetchAndParseRSS(callback, headers) {
  var xhr = getXmlHttp();
  if (!xhr) {
    callback(new Error("Ce navigateur ne prend pas en charge les requêtes HTTP nécessaires."));
    return;
  }

  xhr.open("GET", "flux.xml", true);
  xhr.setRequestHeader("Cache-Control", "no-cache");
  if (headers && headers["If-Modified-Since"]) xhr.setRequestHeader("If-Modified-Since", headers["If-Modified-Since"]);

  xhr.onreadystatechange = function() {
    var xml, items, lastModified, responseSize;
    if (xhr.readyState !== 4) return;

    if (xhr.status === 304) {
      callback(null, { notModified: true });
      return;
    }
    if (xhr.status !== 200 && xhr.status !== 0) {
      callback(new Error("HTTP " + xhr.status));
      return;
    }

    try {
      xml = xhr.responseXML;
      if (!xml || !xml.getElementsByTagName) {
        callback(new Error("Impossible de lire le flux XML."));
        return;
      }
      responseSize = getResponseSize(xhr);
      items = getItemsFromXml(xml);
      lastModified = xhr.getResponseHeader("Last-Modified");
      callback(null, { items: items, lastModified: lastModified, size: responseSize });
    } catch (e) {
      callback(e);
    }
  };
  xhr.send(null);
}

function updateStatus(lastModified) {
  var update = document.getElementById("lastUpdate");
  if (lastModified) {
    lastModifiedSeen = lastModified;
    update.innerHTML = "Dernière mise à jour : " + escapeHtml(formatDate(lastModified));
  }
}

function appendItem(div, first) {
  var feed = document.getElementById("feed");
  if (first && feed.firstChild) feed.insertBefore(div, feed.firstChild);
  else feed.appendChild(div);
}

function loadRSS() {
  fetchAndParseRSS(function(err, data) {
    var i, item, link, div, feed;
    if (err) {
      feed = document.getElementById("feed");
      if (!feed.getElementsByTagName(".item").length) feed.innerHTML = '<div class="error">Impossible de charger le flux : ' + escapeHtml(err.message) + '</div>';
      return;
    }
    if (data.notModified) return;
    updateFeedWarning(data.size);
    updateStatus(data.lastModified);
    feed = document.getElementById("feed");
    feed.innerHTML = "";
    for (i = 0; i < data.items.length && i < 100; i++) {
      item = data.items[i];
      if (isShort(item.title, item.link, item.description)) continue;
      link = item.link || "#";
      if (renderedLinks[link]) continue;
      renderedLinks[link] = true;
      div = buildItemElement(item);
      appendItem(div, false);
    }
  }, null);
}

function pollRSS() {
  fetchAndParseRSS(function(err, data) {
    var i, item, link;
    if (err || data.notModified) return;
    updateFeedWarning(data.size);
    if (data.lastModified && data.lastModified === lastModifiedSeen) return;
    updateStatus(data.lastModified);
    for (i = 0; i < data.items.length && i < 100; i++) {
      item = data.items[i];
      if (isShort(item.title, item.link, item.description)) continue;
      link = item.link || "#";
      if (renderedLinks[link]) continue;
      renderedLinks[link] = true;
      appendItem(buildItemElement(item), true);
    }
  }, lastModifiedSeen ? { "If-Modified-Since": lastModifiedSeen } : null);
}

loadRSS();
window.setInterval(pollRSS, POLL_INTERVAL);
