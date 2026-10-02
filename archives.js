/* Page d'archives : lit archives.xml, dedoublonne par lien et affiche une liste simple. */
var archiveItems = [];
var archiveFilterText = "";

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

function parseTime(value) {
  var time = new Date(value || "").getTime();
  return isNaN(time) ? 0 : time;
}

function formatDate(dateText) {
  var d = new Date(dateText), day, month, year, hour, minute;
  if (isNaN(d.getTime())) return "";
  day = d.getDate();
  month = d.getMonth() + 1;
  year = d.getFullYear();
  hour = d.getHours();
  minute = d.getMinutes();
  return (day < 10 ? "0" : "") + day + "/" +
         (month < 10 ? "0" : "") + month + "/" + year +
         " " +
         (hour < 10 ? "0" : "") + hour + ":" +
         (minute < 10 ? "0" : "") + minute;
}

function getTagText(node, tagName) {
  var nodes = node.getElementsByTagName(tagName);
  if (!nodes || !nodes.length) return "";
  return trimString(nodes[0].textContent || nodes[0].innerText || "");
}

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
      pubDate: getTagText(node, "pubDate")
    });
  }

  result.sort(function(a, b) {
    return parseTime(b.pubDate) - parseTime(a.pubDate);
  });

  return result;
}

function matchesFilter(item) {
  var needle = lower(archiveFilterText);
  var haystack;

  if (!needle) return true;

  haystack = lower(item.title + " " + item.author + " " + item.link);
  return haystack.indexOf(needle) !== -1;
}

function buildRow(item) {
  var div = document.createElement("div");
  var author = trimString(item.author);
  var html;

  div.className = "item item-left archive-item";
  div.setAttribute("data-author", author);
  div.setAttribute("data-pubdate", item.pubDate || "");

  html = '<div class="top">' +
           '<span class="author">' + escapeHtml(author || "Auteur") + '</span>' +
           '<span class="date">' + escapeHtml(formatDate(item.pubDate)) + '</span>' +
         '</div>' +
         '<div class="title"><a href="' + escapeHtml(item.link) + '" target="_blank">' + escapeHtml(item.title) + '</a></div>';

  div.innerHTML = html;
  return div;
}

function renderArchive() {
  var container = document.getElementById("archive");
  var visible = [];
  var i, item;

  for (i = 0; i < archiveItems.length; i++) {
    if (matchesFilter(archiveItems[i])) visible.push(archiveItems[i]);
  }

  container.innerHTML = "";

  if (!visible.length) {
    container.innerHTML = '<div class="error">Aucune entrée ne correspond à ce filtre.</div>';
    return;
  }

  for (i = 0; i < visible.length; i++) {
    container.appendChild(buildRow(visible[i]));
  }
}

function updateCount(visible) {
  var counter = document.getElementById("archiveCount");
  var total = archiveItems.length;

  if (typeof visible === "undefined") {
    counter.innerHTML = total + (total > 1 ? " entrées archivées" : " entrée archivée");
    return;
  }

  counter.innerHTML = visible + " / " + total + " entrées";
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
      return;
    }

    try {
      xml = new DOMParser().parseFromString(xhr.responseText, "text/xml");
    } catch (e) {
      container.innerHTML = '<div class="error">Impossible de lire le fichier d’archives.</div>';
      return;
    }

    archiveItems = parseArchive(xml);
    updateCount();
    renderArchive();
  };

  xhr.send(null);
}

function initFilter() {
  var input = document.getElementById("archiveFilter");

  input.onkeyup = function() {
    archiveFilterText = lower(trimString(input.value));
    renderArchive();
    updateCount(getVisibleCount());
  };
}

function getVisibleCount() {
  var container = document.getElementById("archive");
  var items = container.getElementsByTagName("div");
  var count = 0;
  var i;

  for (i = 0; i < items.length; i++) {
    if ((" " + items[i].className + " ").indexOf(" item ") !== -1) count++;
  }

  return count;
}

initFilter();
loadArchive();