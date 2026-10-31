/* Frise de la vue Archives : une colonne par jour, semaine, mois ou annee,
   empilee par famille politique, au-dessus de la liste des resultats.
   La recherche (getVisibleArchiveItems, archives.js) et les filtres de famille
   alimentent a la fois la frise et la liste ; un clic sur une colonne (maj +
   clic pour une plage) restreint la liste a cette periode.
   Ce fichier se charge apres archives.js et script.js ; archives.js lui confie
   le rendu (renderArchive -> renderTimeline). JavaScript volontairement ES5. */

var TL_GROUPS = [
  { cls: "pcf", label: "PCF NPA RP" },
  { cls: "lfi", label: "LFI" },
  { cls: "eelv", label: "EELV" },
  { cls: "ps", label: "SOCDEM" },
  { cls: "centre", label: "REN MODEM HOR UDI" },
  { cls: "lr", label: "LR" },
  { cls: "ed", label: "RN R!" },
  { cls: "meeting", label: "Autres" }
];
var TL_MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
var TL_MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
var TL_JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
var TL_UNITS = { day: ["jour", "jours"], week: ["semaine", "semaines"], month: ["mois", "mois"], year: ["année", "années"] };

var TL_BAR_H = 56;          /* hauteur max d'une colonne, en px */
var TL_AUTO_MAX = 64;       /* nombre de seaux que l'echelle auto accepte */
var TL_MAX_COLS = 64;       /* nombre de colonnes visibles au maximum */
var TL_COL_MIN = { day: 7, week: 14, month: 26, year: 48 };  /* largeurs minimales, en px */
var TL_COL_MAX = { day: 26, week: 26, month: 40, year: 72 }; /* largeurs maximales, en px */
var TL_PAGE = 100;          /* lignes affichees par page dans la liste */
var TL_DAY_MS = 86400000;
var TL_GAP_MAX = { day: 10, week: 6, month: 4, year: 2 }; /* au-dela : coupure */

var tlGran = "day";         /* auto | day | week | month | year */
var tlGroupsOff = {};       /* famille -> true si masquee */
var tlSel = null;           /* { from, to } : cles de colonnes selectionnees */
var tlAnchor = null;        /* point de depart d'une selection par plage */
var tlLimit = TL_PAGE;
var tlToEnd = true;         /* ramene la frise sur sa fin (le plus recent) */
var tlPinEnd = true;        /* la fin reste visible tant qu'on n'a pas defile */
var tlModel = null;

/* ---------- Dates et seaux (jour / semaine / mois / annee) ---------- */

function tlCount(n, one, many) {
  return n + " " + (n > 1 ? many : one);
}

function tlClass(item) {
  if (!item.cls) item.cls = sourceClass(item.author);
  return item.cls;
}

/* Numero de jour (depuis 1970) de la journee de veille de l'entree, ou null.
   C'est la meme journee que "aujourd'hui" et "hier" dans la recherche. */
function tlDayIndex(item) {
  if (item.di === undefined) {
    item.di = item.day ? Math.round(Date.UTC(item.day.y, item.day.m - 1, item.day.d) / TL_DAY_MS) : null;
  }
  return item.di;
}

/* Premier jour de la frise : ARCHIVE_START (archives.js). */
function tlStartDay() {
  return Math.round(Date.UTC(ARCHIVE_START.y, ARCHIVE_START.m - 1, ARCHIVE_START.d) / TL_DAY_MS);
}

function tlDate(di) {
  return new Date(di * TL_DAY_MS);
}

function tlMonthIndex(di) {
  var d = tlDate(di);
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}

/* Cle de seau : jour = numero de jour ; semaine = semaine commencant le
   lundi ; mois = annee * 12 + mois ; annee = l'annee. Les cles se suivent
   sans trou. */
function tlKey(di, gran) {
  if (gran === "day") return di;
  if (gran === "week") return Math.floor((di + 3) / 7);
  if (gran === "year") return tlDate(di).getUTCFullYear();
  return tlMonthIndex(di);
}

function tlKeyStart(key, gran) {
  if (gran === "day") return key;
  if (gran === "week") return key * 7 - 3;
  if (gran === "year") return Math.round(Date.UTC(key, 0, 1) / TL_DAY_MS);
  return Math.round(Date.UTC(Math.floor(key / 12), key % 12, 1) / TL_DAY_MS);
}

function tlKeyEnd(key, gran) {
  return tlKeyStart(key + 1, gran) - 1;
}

function tlFmtDay(di, withYear) {
  var d = tlDate(di);
  return TL_JOURS[d.getUTCDay()] + " " + d.getUTCDate() + " " + TL_MOIS[d.getUTCMonth()] +
         (withYear ? " " + d.getUTCFullYear() : "");
}

function tlKeyLabel(key, gran) {
  var s = tlKeyStart(key, gran), d;
  if (gran === "day") return tlFmtDay(s, true);
  if (gran === "week") return "semaine du " + tlFmtDay(s, false) + " au " + tlFmtDay(tlKeyEnd(key, gran), true);
  if (gran === "year") return "année " + key;
  d = tlDate(s);
  return TL_MOIS_LONG[d.getUTCMonth()] + " " + d.getUTCFullYear();
}

function tlRangeLabel(sel, gran) {
  if (sel.from === sel.to) return tlKeyLabel(sel.from, gran);
  return tlFmtDay(tlKeyStart(sel.from, gran), false) + " → " + tlFmtDay(tlKeyEnd(sel.to, gran), true);
}

/* ---------- Modele : recherche + familles ---------- */

function tlCompute() {
  var input = document.getElementById("archiveFilter");
  var needle = lower(trimString(input ? input.value : ""));
  var found = getVisibleArchiveItems(needle);
  var counts = {}, vis = [], i, item, cls;

  for (i = 0; i < found.length; i++) {
    item = found[i];
    if (tlDayIndex(item) === null) continue;
    cls = tlClass(item);
    counts[cls] = (counts[cls] || 0) + 1;
    if (!tlGroupsOff[cls]) vis.push(item);
  }

  return { needle: needle, vis: vis, counts: counts, total: found.length, gran: "day", bk: null };
}

/* Echelle automatique : la plus fine qui tient dans la largeur. */
function tlPickGran(vis) {
  var days = {}, weeks = {}, nd = 0, nw = 0, i, di, w;

  for (i = 0; i < vis.length; i++) {
    di = vis[i].di;
    if (!days[di]) { days[di] = 1; nd++; }
    w = Math.floor((di + 3) / 7);
    if (!weeks[w]) { weeks[w] = 1; nw++; }
  }

  if (nd <= TL_AUTO_MAX) return "day";
  if (nw <= TL_AUTO_MAX) return "week";
  return "month";
}

function tlBuckets(vis, gran) {
  var map = {}, keys = [], i, key, b, cls;

  for (i = 0; i < vis.length; i++) {
    key = tlKey(vis[i].di, gran);
    b = map[key];
    if (!b) {
      b = map[key] = { key: key, total: 0, by: {} };
      keys.push(key);
    }
    cls = tlClass(vis[i]);
    b.total++;
    b.by[cls] = (b.by[cls] || 0) + 1;
  }

  keys.sort(function (a, b2) { return a - b2; });
  return { map: map, keys: keys };
}

/* Selection retenue : celle de l'utilisateur ; sinon, sans recherche, le
   dernier seau (les videos les plus recentes) ; sinon aucune (tous les
   resultats). */
function tlEffectiveSel() {
  var keys;
  if (tlSel) return tlSel;
  if (!tlModel || tlModel.needle || !tlModel.bk || !tlModel.bk.keys.length) return null;
  keys = tlModel.bk.keys;
  return { from: keys[keys.length - 1], to: keys[keys.length - 1] };
}

/* ---------- Rendu ---------- */

function renderTimeline() {
  var model;

  if (!document.getElementById("tlStrip")) return;

  model = tlCompute();
  tlModel = model;
  model.gran = tlGran === "auto" ? tlPickGran(model.vis) : tlGran;
  model.bk = tlBuckets(model.vis, model.gran);

  tlSyncGrans();
  tlDrawLegend(model);
  tlDrawStrip(model);
  tlDrawList(model);
  updateArchiveCount(model.vis.length);
}

function tlSyncGrans() {
  var links = document.getElementById("tlGrans").getElementsByTagName("a");
  var i;

  for (i = 0; i < links.length; i++) {
    toggleClassName(links[i], "is-active", links[i].getAttribute("data-gran") === tlGran);
  }
}

/* Pastilles de familles : legende, compteur de resultats et filtre. Le
   nombre affiche ignore les filtres de famille, pour voir ce qu'on masque.
   Seules les familles presentes dans les resultats sont proposees ; "Tous" et
   "Aucun" portent sur celles-la. "Tous" et "Aucun" partagent la ligne de
   l'echelle (barre d'outils) ; les familles occupent la ligne suivante. */
function tlDrawLegend(model) {
  var box = document.getElementById("tlLegend");
  var allBox = document.getElementById("tlAll");
  var shown = 0, off = 0, html, i, g, n;

  for (i = 0; i < TL_GROUPS.length; i++) {
    if (!model.counts[TL_GROUPS[i].cls]) continue;
    shown++;
    if (tlGroupsOff[TL_GROUPS[i].cls]) off++;
  }

  if (allBox) {
    allBox.innerHTML = '<a href="#" class="tl-chip tl-chip-all' + (shown && !off ? " is-on" : "") + '" data-g="*">Tous</a>' +
                       '<a href="#" class="tl-chip tl-chip-all' + (shown && off === shown ? " is-on" : "") + '" data-g="-">Aucun</a>';
  }

  html = '<div class="tl-line tl-line-groups">';

  for (i = 0; i < TL_GROUPS.length; i++) {
    g = TL_GROUPS[i];
    n = model.counts[g.cls] || 0;
    if (!n) continue;
    html += '<a href="#" class="tl-chip g-' + g.cls + (tlGroupsOff[g.cls] ? " is-off" : "") + '" data-g="' + g.cls + '">' +
            '<i class="tl-chip-dot"></i>' + g.label + " <em>" + n + "</em></a>";
  }

  html += "</div>";
  box.innerHTML = html;
}

function tlEmptyMessage(model) {
  return model.total ? "Aucun groupe sélectionné." : "Aucune entrée ne correspond à cette recherche.";
}

/* ---------- Frise ---------- */

function tlSegments(cell, height) {
  var html = "", used = 0, cum = 0, i, n, top, h;

  for (i = 0; i < TL_GROUPS.length; i++) {
    n = cell.by[TL_GROUPS[i].cls] || 0;
    if (!n) continue;
    cum += n;
    top = Math.round(height * cum / cell.total);
    h = top - used;
    if (h < 1) h = 1;
    used += h;
    html += '<i class="tl-seg g-' + TL_GROUPS[i].cls + '" style="height:' + h + 'px"></i>';
  }

  return html;
}

function tlColTitle(cell, gran) {
  var label = tlKeyLabel(cell.key, gran), parts = [], i, n;

  if (!cell.total) return label + " : aucune vidéo";

  for (i = 0; i < TL_GROUPS.length; i++) {
    n = cell.by[TL_GROUPS[i].cls];
    if (n) parts.push(TL_GROUPS[i].label + " " + n);
  }

  return label + " : " + tlCount(cell.total, "vidéo", "vidéos") + " (" + parts.join(" · ") + ")";
}

/* Largeur d'une colonne : le bandeau montre au plus TL_MAX_COLS colonnes.
   En dessous de ce plafond, elles se partagent la largeur disponible (bornee
   par les largeurs minimales et maximales de l'echelle) ; au-dela, la frise
   deborde et se parcourt horizontalement. */
function tlColWidth(gran, count) {
  var strip = document.getElementById("tlStrip");
  var min = TL_COL_MIN[gran] || 7;
  var max = TL_COL_MAX[gran] || 26;
  var cols = count || TL_MAX_COLS;
  var available, width;

  if (!strip) return min;

  if (cols > TL_MAX_COLS) cols = TL_MAX_COLS;
  if (cols < 1) cols = 1;

  /* Les gap de 1 px entre colonnes comptent dans la largeur occupee. */
  available = strip.clientWidth - (cols - 1);
  width = Math.floor(available / cols);

  if (width < min) width = min;
  if (width > max) width = max;
  return width > 0 ? width : 1;
}

/* Recalcule la largeur des colonnes deja affichees, sans reconstruire la
   frise : utilise au redimensionnement de la fenetre. */
function tlApplyColWidths() {
  var strip = document.getElementById("tlStrip");
  var wrap = strip ? strip.firstChild : null;
  var width, nodes, i, count = 0;

  if (!tlModel || !wrap || !wrap.childNodes) return;

  nodes = wrap.childNodes;

  for (i = 0; i < nodes.length; i++) {
    if (nodes[i].nodeType === 1 && hasClass(nodes[i], "tl-col")) count++;
  }

  width = tlColWidth(tlModel.gran, count);

  for (i = 0; i < nodes.length; i++) {
    if (nodes[i].nodeType === 1 && hasClass(nodes[i], "tl-col")) {
      nodes[i].style.width = width + "px";
    }
  }

  /* La colonne la plus recente reste visible tant que l'utilisateur n'a pas
     defile lui-meme vers le passe. */
  if (tlPinEnd) strip.scrollLeft = strip.scrollWidth;
}

/* Hauteur en racine carree : un pic (le 17 octobre) n'ecrase pas les jours
   calmes, qui restent visibles. Les segments restent proportionnels. */
function tlColHtml(cell, gran, max, tick, width) {
  var h = cell.total ? Math.max(3, Math.round(TL_BAR_H * Math.sqrt(cell.total / max))) : 0;

   return '<div class="tl-col' + (cell.total ? "" : " is-empty") + '" data-key="' + cell.key +
          '" style="width:' + width + 'px" title="' + tlKeyLabel(cell.key, gran) + '">' +
         '<div class="tl-bar">' + (h ? tlSegments(cell, h) : "") + "</div>" +
         '<div class="tl-tick">' + tick + "</div></div>";
}

function tlDrawStrip(model) {
  var strip = document.getElementById("tlStrip");
  var gran = model.gran, bk = model.bk, keys = bk.keys;
  var cells = [], html, i, j, key, gap, max = 0, cell, colW, colCount = 0;
  var prev = tlKey(tlStartDay(), gran) - 1;
  var afterBreak = true, prevYm = null, prevY = null, d, y, ym, tick;
  var oldLeft = strip.scrollLeft;
  var atEnd = strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 2;

  if (!keys.length) {
    strip.innerHTML = "";
    return;
  }

  /* La frise demarre a ARCHIVE_START, meme si les premiers jours sont vides. */
  for (i = 0; i < keys.length; i++) {
    key = keys[i];
    if (bk.map[key].total > max) max = bk.map[key].total;

    gap = key - prev - 1;
    if (gap > TL_GAP_MAX[gran]) {
      cells.push({ brk: true, units: gap });
    } else {
      for (j = 1; j <= gap; j++) cells.push({ key: prev + j, total: 0, by: {} });
    }

    cells.push(bk.map[key]);
    colCount++;
    prev = key;
  }

  html = '<div class="tl-cols tl-gran-' + gran + '">';

  colW = tlColWidth(gran, colCount);

  for (i = 0; i < cells.length; i++) {
    cell = cells[i];

    if (cell.brk) {
       html += '<div class="tl-brk"></div>';
      afterBreak = true;
      continue;
    }

    if (gran === "year") {
      tick = "<span>" + cell.key + "</span>";
    } else {
      /* Etiquette de mois (et d'annee) au premier seau de chaque mois, apres
         une coupure et au tout debut. Une semaine appartient au mois de son
         jeudi, comme dans le calendrier ISO. */
      d = tlDate(gran === "week" ? tlKeyStart(cell.key, gran) + 3 : tlKeyStart(cell.key, gran));
      y = d.getUTCFullYear();
      ym = y * 12 + d.getUTCMonth();
      tick = "";
      if (afterBreak || ym !== prevYm) {
        tick = "<span>" + TL_MOIS[d.getUTCMonth()] + "</span>";
        if (afterBreak || y !== prevY) tick += "<span>" + y + "</span>";
      }
      prevYm = ym;
      prevY = y;
    }
    afterBreak = false;

    html += tlColHtml(cell, gran, max, tick, colW);
  }

  html += "</div>";
  strip.innerHTML = html;
  tlCancelScroll();
  strip.scrollLeft = (tlToEnd || tlPinEnd || atEnd) ? strip.scrollWidth : oldLeft;
  tlToEnd = false;
  tlMarkSelection();
}

function tlMarkSelection() {
  var strip = document.getElementById("tlStrip");
  var wrap = strip ? strip.firstChild : null;
  var sel = tlEffectiveSel();
  var nodes, i, key;

  if (!wrap || !wrap.childNodes) return;
  nodes = wrap.childNodes;

  for (i = 0; i < nodes.length; i++) {
    if (nodes[i].nodeType !== 1 || !hasClass(nodes[i], "tl-col")) continue;
    key = parseInt(nodes[i].getAttribute("data-key"), 10);
    toggleClassName(nodes[i], "is-sel", !!sel && key >= sel.from && key <= sel.to);
  }
}

/* ---------- Liste ---------- */

/* Indexe par cle (attribut data-link) les noeuds deja presents : les entrees
   (lien de la video) et les intertitres de jour ("h:" + jour). */
function indexArchiveItems(container) {
  var nodes = container.childNodes;
  var map = {};
  var i, node;

  for (i = 0; i < nodes.length; i++) {
    node = nodes[i];
    if (node.nodeType === 1 && (hasClass(node, "archives-item") || hasClass(node, "tl-dayhead"))) {
      map[node.getAttribute("data-link") || ""] = node;
    }
  }

  return map;
}

/* Retire les noeuds qui ne font pas partie du rendu courant (entrees
   disparues, intertitres perimes, message d'erreur, invite de chargement). */
function pruneArchiveItems(container, keep) {
  var nodes = container.childNodes;
  var i, node;

  for (i = nodes.length - 1; i >= 0; i--) {
    node = nodes[i];
    if (node.nodeType !== 1) continue;
    if ((hasClass(node, "archives-item") || hasClass(node, "tl-dayhead")) && keep[node.getAttribute("data-link") || ""]) continue;
    container.removeChild(node);
  }
}

/* Rendu par reconciliation : les noeuds deja affiches sont conserves et
   repositionnes via la propriete CSS order, les nouveaux sont ajoutes et les
   disparus retires. Le noeud qui porte un lecteur video n'est donc jamais
   deplace ni recree : la lecture en cours n'est jamais interrompue par un
   rafraichissement du fond. */
function tlRenderList(entries) {
  var container = document.getElementById("archive");
  var existing = indexArchiveItems(container);
  var keep = {};
  var i, entry, element;

  for (i = 0; i < entries.length; i++) {
    entry = entries[i];
    keep[entry.key] = true;
    element = existing[entry.key];

    if (!element) {
      if (entry.item) {
        element = buildItemElement(entry.item, true);
      } else {
        element = document.createElement("div");
        element.className = "tl-dayhead";
        element.setAttribute("data-link", entry.key);
      }
      container.appendChild(element);
    }

    if (!entry.item) element.innerHTML = entry.text;
    element.style.order = i;
  }

  pruneArchiveItems(container, keep);
}

/* Liste sous la frise : les entrees de la selection (ou tous les resultats),
   une ligne chacune, avec des intertitres quand elle couvre plusieurs jours. */
function tlDrawList(model) {
  var container = document.getElementById("archive");
  var headBox = document.getElementById("tlDetailHead");
  var moreBox = document.getElementById("tlMore");
  var sel = tlEffectiveSel();
  var items = [], entries = [], multi, label, lastDi = null;
  var i, k, shown;

  moreBox.innerHTML = "";

  if (!model.vis.length) {
    headBox.innerHTML = "";
    tlRenderList([]);
    container.innerHTML = '<div class="error">' + tlEmptyMessage(model) + "</div>";
    return;
  }

  if (sel) {
    for (i = 0; i < model.vis.length; i++) {
      k = tlKey(model.vis[i].di, model.gran);
      if (k >= sel.from && k <= sel.to) items.push(model.vis[i]);
    }
  } else {
    items = model.vis;
  }

  multi = items.length > 0 && items[0].di !== items[items.length - 1].di;

  label = sel ? tlRangeLabel(sel, model.gran) : (model.needle ? "Tous les résultats" : "Toute la période");
  headBox.innerHTML = "<span><b>" + label + "</b> · " + tlCount(items.length, "vidéo", "vidéos") + "</span>";

  shown = items.length < tlLimit ? items.length : tlLimit;

  for (i = 0; i < shown; i++) {
    if (multi && items[i].di !== lastDi) {
      entries.push({ key: "h:" + items[i].di, text: tlFmtDay(items[i].di, true) });
      lastDi = items[i].di;
    }
    entries.push({ key: items[i].link, item: items[i] });
  }

  tlRenderList(entries);

  if (!items.length) {
    container.innerHTML = '<div class="archive-hint">Aucune vidéo pour cette sélection.</div>';
  } else if (items.length > shown) {
    moreBox.innerHTML = '<a href="#" class="tl-more">Afficher plus (' + (items.length - shown) + " restantes)</a>";
  }
}

/* ---------- Evenements ---------- */

function tlTarget(e) {
  return e.target || e.srcElement;
}

function tlClosest(el, cls, stop) {
  while (el && el !== stop) {
    if (el.nodeType === 1 && hasClass(el, cls)) return el;
    el = el.parentNode;
  }
  return null;
}

/* Nouvelle recherche ou nouvelle echelle : on repart de la fin de la frise,
   sans colonne retenue. */
function tlResetNavigation() {
  tlSel = null;
  tlAnchor = null;
  tlLimit = TL_PAGE;
  tlToEnd = true;
  tlPinEnd = true;
}

/* Etat de depart de la vue Archives : echelle par jour, toutes les familles
   affichees, aucune colonne retenue et frise ramenee sur sa fin. */
function tlResetDefaults() {
  tlGran = "day";
  tlGroupsOff = {};
  tlResetNavigation();
}

/* Clic sur une colonne : la selectionne ; maj + clic etend la plage ; un
   nouveau clic sur l'unique colonne retenue la libere. Les clics sur
   d'autres colonnes s'ajoutent a la selection existante sans la casser. */
/* Clic sur une colonne : la selectionne ; maj + clic etend la plage ; un
   nouveau clic sur l'unique colonne retenue la libere. */
function tlOnStripClick(e) {
  var ev = e || window.event;
  var strip = document.getElementById("tlStrip");
  var col = tlClosest(tlTarget(ev), "tl-col", strip);
  var eff, base, key;

  if (!col || !tlModel) return;
  key = parseInt(col.getAttribute("data-key"), 10);
  eff = tlEffectiveSel();
  base = tlAnchor !== null ? tlAnchor : (eff ? eff.from : null);

  if (ev.shiftKey && base !== null) {
    tlSel = { from: Math.min(base, key), to: Math.max(base, key) };
  } else if (tlSel && tlSel.from === key && tlSel.to === key) {
    tlSel = null;
    tlAnchor = null;
  } else {
    tlSel = { from: key, to: key };
    tlAnchor = key;
  }

  tlLimit = TL_PAGE;
  tlMarkSelection();
  tlDrawList(tlModel);
  return false;
}
function tlOnHeadClick(e) {
  var ev = e || window.event;
  var box = document.getElementById("tlDetailHead");

  tlSel = null;
  tlAnchor = null;
  tlLimit = TL_PAGE;
  tlDrawList(tlModel);
  return false;
}

function tlOnMoreClick(e) {
  var ev = e || window.event;
  var box = document.getElementById("tlMore");

  if (!tlClosest(tlTarget(ev), "tl-more", box) || !tlModel) return;

  tlLimit += TL_PAGE;
  tlDrawList(tlModel);
  return false;
}

/* "Tous" reactive toutes les familles, "Aucun" les masque toutes ; une
   pastille de famille : le premier clic selectionne cette famille et en
   masque toutes les autres ; les clics suivants sur d'autres familles les
   ajoutent a la selection sans la casser. Re-cliquer sur une famille deja
   selectionnee la retire. */
function tlOnLegendClick(e) {
  var ev = e || window.event;
  var chip = tlClosest(tlTarget(ev), "tl-chip");
  var g, i;

  if (!chip) return;
  g = chip.getAttribute("data-g");

  if (g === "*") {
    tlGroupsOff = {};
  } else if (g === "-") {
    for (i = 0; i < TL_GROUPS.length; i++) tlGroupsOff[TL_GROUPS[i].cls] = true;
  } else {
    if (tlGroupsOff[g]) {
      delete tlGroupsOff[g];
    } else {
      var allVisible = true;
      for (i = 0; i < TL_GROUPS.length; i++) {
        if (!tlModel || !tlModel.counts[TL_GROUPS[i].cls]) continue;
        if (tlGroupsOff[TL_GROUPS[i].cls]) { allVisible = false; break; }
      }
      if (allVisible) {
        tlGroupsOff = {};
        for (i = 0; i < TL_GROUPS.length; i++) {
          if (!tlModel || !tlModel.counts[TL_GROUPS[i].cls]) continue;
          if (TL_GROUPS[i].cls !== g) tlGroupsOff[TL_GROUPS[i].cls] = true;
        }
      } else {
        tlGroupsOff[g] = true;
      }
    }
  }

  renderTimeline();
  return false;
}

function tlOnGranClick(e) {
  var ev = e || window.event;
  var box = document.getElementById("tlGrans");
  var link = tlClosest(tlTarget(ev), "tl-sw", box);

  if (!link) return;

  tlGran = link.getAttribute("data-gran");
  tlResetNavigation();
  if (archiveLoaded) renderTimeline();
  else tlSyncGrans();
  return false;
}

var tlScrollTarget = null;
var tlScrollRaf = null;

/* requestAnimationFrame avec repli sur setTimeout pour les anciens
   navigateurs. */
function tlRequestFrame(callback) {
  var raf = window.requestAnimationFrame || window.webkitRequestAnimationFrame ||
            window.mozRequestAnimationFrame || window.msRequestAnimationFrame;

  if (raf) return raf.call(window, callback);
  return window.setTimeout(function() { callback(+new Date()); }, 16);
}

function tlCancelFrame(id) {
  var cancel = window.cancelAnimationFrame || window.webkitCancelAnimationFrame ||
               window.mozCancelAnimationFrame || window.msCancelAnimationFrame;

  if (cancel) cancel.call(window, id);
  else window.clearTimeout(id);
}

/* Rapproche progressivement la frise de sa position cible : la molette donne
   une impulsion, l'animation fait le reste. */
function tlScrollStep() {
  var strip = document.getElementById("tlStrip");
  var current, diff, step;

  tlScrollRaf = null;

  if (!strip || tlScrollTarget === null) return;

  current = strip.scrollLeft;
  diff = tlScrollTarget - current;

  if (Math.abs(diff) < 0.5) {
    strip.scrollLeft = tlScrollTarget;
    tlScrollTarget = null;
    return;
  }

  step = diff * 0.12;
  /* Avec le zoom CSS, scrollLeft avance par paliers : une etape trop petite
     ne ferait jamais progresser la frise. */
  if (Math.abs(step) < 1) step = diff > 0 ? 1 : -1;

  strip.scrollLeft = current + step;
  tlScrollRaf = tlRequestFrame(tlScrollStep);
}

function tlCancelScroll() {
  if (tlScrollRaf) {
    tlCancelFrame(tlScrollRaf);
    tlScrollRaf = null;
  }
  tlScrollTarget = null;
}

/* Molette au-dessus de la frise : le defilement vertical est converti en
   defilement horizontal quand la frise deborde. Sans debordement, la page
   defile normalement. Le zoom (Ctrl molette) reste au navigateur. */
function tlOnStripWheel(e) {
  var ev = e || window.event;
  var strip = document.getElementById("tlStrip");
  var delta, mode, max, from, to, horizontal;

  if (!strip || ev.ctrlKey) return;

  delta = ev.deltaY || 0;

  /* Anciens navigateurs : wheelDelta (IE, anciens WebKit) ou detail
     (ancien Firefox) remplacent deltaY. */
  if (!delta) {
    if (ev.wheelDelta) delta = -ev.wheelDelta;
    else if (ev.detail) delta = ev.detail * 16;
  }

  /* Pave tactile : un geste franchement horizontal prime sur le vertical et
     garde son sens naturel. La molette verticale, elle, est inversee : vers
     le bas on remonte le temps. */
  horizontal = !!ev.deltaX && Math.abs(ev.deltaX) > Math.abs(delta);
  if (horizontal) delta = ev.deltaX;
  else delta = -delta;

  if (!delta) return;
  if (strip.scrollWidth <= strip.clientWidth + 1) return;

  mode = ev.deltaMode;
  if (mode === 1) delta *= 16;
  else if (mode === 2) delta *= strip.clientHeight;

  max = strip.scrollWidth - strip.clientWidth;
  from = tlScrollTarget === null ? strip.scrollLeft : tlScrollTarget;
  to = from + delta;

  if (to < 0) to = 0;
  if (to > max) to = max;

  /* Butee atteinte : on laisse la page defiler au lieu de bloquer la
     molette. La tolerance absorbe les fractions de scrollLeft dues au zoom
     CSS et les arrondis de scrollWidth/clientWidth. */
  if (Math.abs(to - from) < 1) return;

  tlPinEnd = to >= max - 1;
  tlScrollTarget = to;
  if (!tlScrollRaf) tlScrollRaf = tlRequestFrame(tlScrollStep);

  if (ev.preventDefault) ev.preventDefault();
  else ev.returnValue = false;
}

var tlResizeTimer = null;

/* Le nombre de colonnes visibles depend de la largeur : on recalcule leur
   largeur apres un redimensionnement, sans reconstruire la frise. */
function tlOnResize() {
  if (tlResizeTimer) window.clearTimeout(tlResizeTimer);
  tlResizeTimer = window.setTimeout(function() {
    tlResizeTimer = null;
    tlApplyColWidths();
  }, 150);
}

/* Une page ouverte en arriere-plan n'a pas de largeur exploitable : au retour
   au premier plan, on recalcule les largeurs et on remet la fin de la frise
   dans le champ si l'utilisateur n'a pas encore defile. */
function tlOnVisibility() {
  if (document.hidden) return;
  tlApplyColWidths();
}

function initTimeline() {
  var strip = document.getElementById("tlStrip");

  if (!strip) return;

  strip.onclick = tlOnStripClick;
  if (strip.addEventListener) {
    strip.addEventListener("wheel", tlOnStripWheel, false);
  } else {
    strip.onwheel = tlOnStripWheel;
  }
  window.onresize = tlOnResize;
  if (document.addEventListener) {
    document.addEventListener("visibilitychange", tlOnVisibility, false);
  } else {
    window.onfocus = tlOnVisibility;
  }
  document.getElementById("tlDetailHead").onclick = tlOnHeadClick;
  document.getElementById("tlMore").onclick = tlOnMoreClick;
  document.getElementById("tlLegend").onclick = tlOnLegendClick;
  document.getElementById("tlAll").onclick = tlOnLegendClick;
  document.getElementById("tlGrans").onclick = tlOnGranClick;
}

initTimeline();
