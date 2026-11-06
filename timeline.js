/* Frise de la vue Archives : une colonne par jour, semaine, mois ou annee,
   empilee par famille politique, au-dessus de la liste des resultats.
   La recherche (getVisibleArchiveItems, archives.js) et les filtres de famille
   alimentent a la fois la frise et la liste ; un clic sur une colonne (maj +
   clic pour une plage) restreint la liste a cette periode.
   Ce fichier se charge apres archives.js et script.js ; archives.js lui confie
   le rendu (renderArchive -> renderTimeline). JavaScript volontairement ES5. */

var TL_GROUPS = [
  { cls: "nr", label: "NPA RP" },
  { cls: "pcf", label: "PCF" },
  { cls: "lfi", label: "LFI" },
  { cls: "eelv", label: "EELV" },
  { cls: "aprd", label: "APR D!" },
  { cls: "ps", label: "PS" },
  { cls: "centre", label: "REN MODEM HOR UDI" },
  { cls: "lr", label: "LR" },
  { cls: "ed", label: "RN UDR" },
  { cls: "r", label: "R!" },
  { cls: "meeting", label: "Autres" }
];
var TL_MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
var TL_MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
var TL_JOURS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
var TL_UNITS = { day: ["jour", "jours"], week: ["semaine", "semaines"], month: ["mois", "mois"], year: ["année", "années"] };

var TL_BAR_H = 62;          /* hauteur max d'une colonne, en px (frise a l'echelle 1 : voir .tl-strip) */
var TL_AUTO_MAX = 64;       /* nombre de seaux que l'echelle auto accepte */
var TL_MAX_COLS = 64;       /* nombre de colonnes visibles au maximum */
var TL_DAY_COL_W = 10;      /* largeur fixe d'une colonne en granularite Jours, en px */
var TL_COL_MIN = { day: 8, week: 15, month: 29, year: 53 };  /* largeurs minimales, en px */
var TL_COL_MAX = { day: 29, week: 29, month: 44, year: 79 }; /* largeurs maximales, en px */
var TL_PAGE = 100;          /* lignes affichees par page dans la liste */
var TL_DAY_MS = 86400000;
var TL_GAP_MAX = { day: 10, week: 6, month: 4, year: 2 }; /* au-dela : coupure */

var tlGran = "day";         /* auto | day | week | month | year */
var tlGroupsOff = {};       /* famille -> true si masquee */
var tlSel = null;           /* { from, to } : clees de colonnes selectionnees */
var tlSelAuthor = null;     /* nom de l'auteur selectionne (filtre par chaine) ou null */
var tlAnchor = null;        /* point de depart d'une selection par plage */
var tlLimit = TL_PAGE;      /* lignes affichees par page dans la liste */
var tlToEnd = true;         /* ramene la frise sur sa fin (le plus recent) */
var tlPinEnd = true;        /* la fin reste visible tant qu'on n'a pas defile */
var tlModel = null;
var tlLastStripWidth = 0;   /* derniere largeur clientWidth valide du bandeau tl-strip */

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

function tlAnyGroupOff() {
  var k;
  for (k in tlGroupsOff) if (tlGroupsOff[k]) return true;
  return false;
}

function tlCompute() {
  var input = document.getElementById("archiveFilter");
  var needle = lower(trimString(input ? input.value : ""));
  var found = getVisibleArchiveItems(needle);

  /* Filtre par chaine : quand un auteur est selectionne, seules ses videos
     sont gardees (le groupe reste affiche sur la frise avec son propre count). */
  if (tlSelAuthor) {
    var tmp = [];
    for (i = 0; i < found.length; i++) {
      if (found[i].author === tlSelAuthor) tmp.push(found[i]);
    }
    found = tmp;
  }
  var counts = {}, vis = [], all = [], i, item, cls, endDi = null, every, di;

  /* Fin de la frise : le dernier jour de toutes les archives, pour qu'une
     recherche garde la meme etendue (debut ARCHIVE_START, fin identique). */
  every = needle ? getVisibleArchiveItems("") : found;
  for (i = 0; i < every.length; i++) {
    di = tlDayIndex(every[i]);
    if (di !== null && (endDi === null || di > endDi)) endDi = di;
  }

  for (i = 0; i < found.length; i++) {
    item = found[i];
    if (tlDayIndex(item) === null) continue;
    cls = tlClass(item);
    counts[cls] = (counts[cls] || 0) + 1;
    all.push(item);
    if (!tlGroupsOff[cls]) vis.push(item);
  }

  /* all : resultats sans le filtre de famille, pour garder une frise (vide)
     quand toutes les familles sont masquees. */
  return { needle: needle, vis: vis, all: all, counts: counts, total: found.length, gran: "day", bk: null, endDi: endDi, filtered: !!needle || tlAnyGroupOff() };
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

function tlBuckets(vis, gran, all) {
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

  /* Aucune entree visible (toutes les familles masquees) : la frise garde les
     colonnes des resultats, mais vides. */
  if (!keys.length && all) {
    for (i = 0; i < all.length; i++) {
      key = tlKey(all[i].di, gran);
      if (!map[key]) {
        map[key] = { key: key, total: 0, by: {} };
        keys.push(key);
      }
    }
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
  model.gran = tlGran === "auto" ? tlPickGran(model.vis.length ? model.vis : model.all) : tlGran;
  model.bk = tlBuckets(model.vis, model.gran, model.all);

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
            '<i class="tl-chip-dot"></i>' + g.label + "</a>";
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
function tlColWidth(gran, count, stripWidth) {
  var strip = document.getElementById("tlStrip");
  var min = TL_COL_MIN[gran] || 8;
  var max = TL_COL_MAX[gran] || 29;
  var cols = count || TL_MAX_COLS;
  var available, width;

  /* Granularite Jours : largeur fixe, quel que soit le nombre de colonnes
     (groupes selectionnes, recherche) et la largeur de la fenetre. */
  if (gran === "day") return TL_DAY_COL_W;

  if (!strip) return min;

  if (cols > TL_MAX_COLS) cols = TL_MAX_COLS;
  if (cols < 1) cols = 1;

  /* Utilise la largeur passee en argument si fournie, sinon clientWidth.
     Quand l'onglet est en arriere-plan, clientWidth peut etre faux ou
     temporairement reduit (Firefox, Chrome) : on prefere alors la derniere
     largeur connue valide pour ne pas reduire les colonnes a leur minimum. */
  if (stripWidth === undefined) stripWidth = strip.clientWidth;
  /* Onglet masque : clientWidth vaut 0, on garde la derniere largeur valide. */
  if (!stripWidth) stripWidth = tlLastStripWidth;
  if (!stripWidth) return min;

  /* Les gap de 1 px entre colonnes comptent dans la largeur occupee. */
  available = stripWidth - (cols - 1);
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
  var stripWidth;

  if (!strip || !wrap || !wrap.childNodes) return;

  /* Un onglet mis en arriere-plan n'a pas de largeur exploitable (clientWidth
     vaut 0 ou une valeur fausse dans Firefox et Chrome). Recalculer alors
     reduit toutes les colonnes a leur largeur minimale : la frise "retrécit"
     au retour au premier plan. On utilise la derniere largeur connue valide
     (memorisee a chaque rendu dans tlDrawStrip) pour garder les bonnes
     largeurs, et on s'en remet au prochain rendu pour la mettre a jour. Le
     veritable redimensionnement de la fenetre est gere par tlOnResize. */
  stripWidth = strip.clientWidth;
  if (!stripWidth || document.hidden) return;
  tlLastStripWidth = stripWidth;

  if (!stripWidth) return;

  if (!tlModel) return;

  nodes = wrap.childNodes;

  for (i = 0; i < nodes.length; i++) {
    if (nodes[i].nodeType === 1 && hasClass(nodes[i], "tl-col")) count++;
  }

  width = tlColWidth(tlModel.gran, count, stripWidth);

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
function tlColHtml(cell, gran, max, tick, width, afterBrk, weekStart, dayNum) {
  var h = cell.total ? Math.max(3, Math.round(TL_BAR_H * Math.sqrt(cell.total / max))) : 0;
  var wk = weekStart ? '<div class="tl-wknum">' + dayNum + "</div>" : "";

   return '<div class="tl-col' + (cell.total ? "" : " is-empty") + (afterBrk ? " is-after-brk" : "") + (weekStart ? " is-wk" : "") + '" data-key="' + cell.key +
          '" style="width:' + width + 'px" title="' + tlKeyLabel(cell.key, gran) + '">' +
         '<div class="tl-bar">' + (h ? tlSegments(cell, h) : "") + "</div>" +
         wk +
         '<div class="tl-tick">' + tick + "</div></div>";
}

function tlDrawStrip(model) {
  var strip = document.getElementById("tlStrip");
  var gran = model.gran, bk = model.bk, keys = bk.keys;
  var cells = [], html, i, j, key, gap, max = 0, cell, colW, colCount = 0, last;
  var ci = 0, wkBlock = 0, tickLen, isWk;
  var prev = tlKey(tlStartDay(), gran) - 1;
  var afterBreak = true, brkPending = false, prevYm = null, prevY = null, d, y, ym, tick;
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
    if (gap > TL_GAP_MAX[gran] && !model.filtered) {
      cells.push({ brk: true, units: gap });
    } else {
      for (j = 1; j <= gap; j++) cells.push({ key: prev + j, total: 0, by: {} });
    }

    cells.push(bk.map[key]);
    colCount++;
    prev = key;
  }

  /* Recherche ou famille masquee : la frise garde son etendue normale (debut a ARCHIVE_START,
     fin au dernier jour des archives), sans coupure ; les jours sans resultat
     sont des colonnes vides. */
  if (model.filtered && model.endDi !== null) {
    last = tlKey(model.endDi, gran);
    for (j = prev + 1; j <= last; j++) cells.push({ key: j, total: 0, by: {} });
    colCount = 0;
    for (i = 0; i < cells.length; i++) if (!cells[i].brk) colCount++;
  }

  html = '<div class="tl-cols tl-gran-' + gran + '">';

  colW = tlColWidth(gran, colCount);
  if (strip.clientWidth > 0) tlLastStripWidth = strip.clientWidth;

  for (i = 0; i < cells.length; i++) {
    cell = cells[i];

    if (cell.brk) {
      /* Pas d'element dans la frise : l'espacement entre colonnes reste de
         1 px partout. La coupure est un trait pointille dans ce 1 px, porte
         par la colonne suivante (is-after-brk). */
      brkPending = true;
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
      if (ym !== prevYm) {
        tick = "<span>" + TL_MOIS[d.getUTCMonth()] + "</span>";
        if (afterBreak || y !== prevY) tick += "<span>" + y + "</span>";
      }
      prevYm = ym;
      prevY = y;
      /* Un repere de semaine ne doit pas recouvrir l'etiquette du mois : on
         ignore les lundis des colonnes que cette etiquette occupe. */
      if (tick && gran === "day") {
        tickLen = tick.indexOf("</span><span>") !== -1 ? 4 : TL_MOIS[d.getUTCMonth()].length;
        wkBlock = ci + Math.ceil((tickLen * 7 + 6) / (colW + 1));
      }
    }
    afterBreak = false;

    /* Granularite Jours (donc aussi Auto quand elle retient les jours) : un
       repere marque chaque lundi, debut de semaine, avec le numero du jour. */
    isWk = gran === "day" && tlDate(cell.key).getUTCDay() === 1 && ci >= wkBlock;
    ci++;
    html += tlColHtml(cell, gran, max, tick, colW, brkPending, isWk, isWk ? tlDate(cell.key).getUTCDate() : null);
    brkPending = false;
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

  multi = items.length > 0 && (!sel || items[0].di !== items[items.length - 1].di);

  label = sel ? tlRangeLabel(sel, model.gran) : (model.needle ? "Tous les résultats" : "Toute la période");
  headBox.innerHTML = "<span><b>" + label + "</b>&nbsp;&nbsp;" + tlCount(items.length, "vidéo", "vidéos") + "</span>";

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
    container.innerHTML = '<div class="archive-hint">Aucune vidéo pour cette période.</div>';
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
  tlSelAuthor = null;
  tlResetNavigation();
}

/* Colonne la plus proche horizontalement d'une abscisse (strip).
   Utilisee pour rendre cliquable l'intervalle entre deux colonnes. */
function tlClosestColByX(strip, x) {
  var cols = strip.getElementsByClassName("tl-col");
  var stripRect = strip.getBoundingClientRect();
  var i, node, rect, cx, dist, best, bestDist;

  if (!cols.length) return null;
  /* x est en coordonnées viewport ; on le ramène en coordonnées strip pour
     neutraliser le zoom appliqué sur .tl-strip. */
  x -= stripRect.left;

  best = null;
  bestDist = Infinity;

  for (i = 0; i < cols.length; i++) {
    node = cols[i];
    rect = node.getBoundingClientRect();
    cx = (rect.left + rect.right) / 2 - stripRect.left;
    dist = Math.abs(cx - x);
    if (dist < bestDist) {
      bestDist = dist;
      best = node;
    }
  }

  return best;
}

/* Clic sur une colonne : la selectionne ; maj + clic etend la plage. Un
   nouveau clic sur la colonne retenue ne change rien. */
function tlOnStripClick(e) {
  var ev = e || window.event;
  var strip = document.getElementById("tlStrip");
  var col = tlClosest(tlTarget(ev), "tl-col", strip);
  var eff, base, key;

  if (!col) {
    /* Clic dans l'intervalle entre deux colonnes : on choisit la colonne la
       plus proche horizontalement pour ne pas laisser de "trou" non cliquable. */
    col = tlClosestColByX(strip, ev.clientX);
  }

  if (!col || !tlModel) return;
  key = parseInt(col.getAttribute("data-key"), 10);
  eff = tlEffectiveSel();
  base = tlAnchor !== null ? tlAnchor : (eff ? eff.from : null);

  if (ev.shiftKey && base !== null) {
    tlSel = { from: Math.min(base, key), to: Math.max(base, key) };
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
    tlSelAuthor = null;
    tlToEnd = true;
    tlPinEnd = true;
  } else if (g === "-") {
    for (i = 0; i < TL_GROUPS.length; i++) tlGroupsOff[TL_GROUPS[i].cls] = true;
    tlToEnd = true;
    tlPinEnd = true;
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

  /* La souris est sur la timeline : la molette ne doit jamais faire
     defiler la page entiere. Le zoom au clavier (Ctrl + molette) reste
     au navigateur. */
  if (ev.preventDefault) ev.preventDefault();
  else ev.returnValue = false;

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
}

var tlResizeTimer = null;

/* Le nombre de colonnes visibles depend de la largeur : on recalcule leur
   largeur apres un redimensionnement, sans reconstruire la frise. */
var tlLastWinWidth = 0;

function tlOnResize() {
  /* Les changements d'onglet declenchent des resize parasites (Firefox,
     Chrome) : seule une vraie variation de largeur de fenetre compte. */
  if (document.hidden || window.innerWidth === tlLastWinWidth) return;
  if (tlResizeTimer) window.clearTimeout(tlResizeTimer);
  tlResizeTimer = window.setTimeout(function() {
    tlResizeTimer = null;
    tlLastWinWidth = window.innerWidth;
    tlApplyColWidths();
  }, 150);
}

/* Une page ouverte en arriere-plan n'a pas de largeur exploitable : au retour
   au premier plan, on remet la fin de la frise dans le champ si l'utilisateur
   n'a pas encore defile. On NE recalcule PAS les largeurs des colonnes ici :
   le clientWidth lu juste apres un retour d'onglet peut etre temporairement
   faux (Firefox, Chrome), ce qui reduit toutes les colonnes a leur largeur
   minimale et fait "retrécir" la frise. Les largeurs sont deja correctes
   depuis le dernier rendu ; seul le redimensionnement reel de la fenetre
   (tlOnResize) doit les recalculer. */
function tlOnVisibility() {
  if (document.hidden) return;
  var strip = document.getElementById("tlStrip");
  if (strip && tlPinEnd) strip.scrollLeft = strip.scrollWidth;
}

/* Clic sur le nom d'une chaine (auteur) dans la liste des archives :
   selectionne cette chaine dans la timeline (filtre par auteur).
   Re-cliquer sur le meme auteur alors qu'il est deja selectionne le deselectionne. */
function tlSelectAuthor(author) {
  tlSelAuthor = (tlSelAuthor === author) ? null : author;
  tlResetNavigation();
  renderTimeline();
}

function initArchiveAuthorClick() {
  var box = document.getElementById("archive");
  if (!box || box._authorClick) return;
  box._authorClick = true;
  if (box.addEventListener) {
    box.addEventListener("click", function(e) {
      var target = e.target || e.srcElement;
      var author = tlClosest(target, "author", box);
      var name;
      if (!author) return;
      name = author.getAttribute("data-author");
      if (!name) name = trimString(author.textContent || author.innerText || "");
      if (!name) return;
      tlSelectAuthor(name);
      if (e.preventDefault) e.preventDefault();
      return false;
    }, false);
  }
}

function initTimeline() {
  var strip = document.getElementById("tlStrip");

  if (!strip) return;

  tlLastWinWidth = window.innerWidth;
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
initArchiveAuthorClick();
