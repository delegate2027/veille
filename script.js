// =============================================================================
// script.js — Interface de visualisation du flux RSS agrégé
// Charge flux.xml, filtre les Shorts, construit les cards et intègre le player YouTube.
// =============================================================================


// =============================================================================
// Utilitaires
// =============================================================================

/**
 * Échappe les caractères spéciaux HTML pour prévenir les injections XSS.
 * À utiliser sur toute donnée externe avant insertion dans le DOM.
 * @param {string} str — chaîne brute à sécuriser
 * @returns {string} chaîne avec les entités HTML encodées
 */
function escapeHtml(str) {
  return str
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

/**
 * Détecte si une vidéo est un YouTube Short.
 * On vérifie le titre, la description et le lien pour les marqueurs "#shorts" / "/shorts/".
 * @param {string} title — titre de la vidéo
 * @param {string} link  — URL de la vidéo
 * @param {string} desc  — description de la vidéo
 * @returns {boolean} true si c'est un Short (à exclure)
 */
function isShort(title, link, desc) {
  const t = title.toLowerCase();
  const d = desc.toLowerCase();
  const l = link.toLowerCase();

  return (
    t.includes("#shorts") ||
    t.includes("shorts")  ||
    d.includes("#shorts") ||
    l.includes("/shorts/")
  );
}

/**
 * Supprime les emojis d'une chaîne de texte.
 * Utilise plusieurs plages Unicode couvrant les emojis modernes,
 * puis réduit les espaces multiples laissés après suppression.
 * @param {string} str — texte brut pouvant contenir des emojis
 * @returns {string} texte nettoyé
 */
function removeEmojis(str) {
  return str
    .replace(
      /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]\uFE0F?|[\u{FE00}-\u{FE0F}]|\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u{200D}|\u{20E3}/gu,
      ""
    )
    .replace(/\s{2,}/g, " ")  // condense les espaces multiples
    .trim();
}

// Fonction utilitaire pour détecter et remplacer les URLs par "url"
function replaceUrlsWithPlaceholder(text) {
  // Expression régulière pour détecter les URLs (couvre http, https, www, et les liens sans protocole)
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
  return text.replace(urlRegex, "url");
}

/**
 * Supprime les caractères répétés plus de 3 fois de suite dans une chaîne.
 * @param {string} str - Chaîne à nettoyer.
 * @returns {string} Chaîne avec les répétitions réduites à 1 occurrence.
 */
function removeExcessiveRepeats(str) {
  return str.replace(/(.)\1{3,}/g, "$1");
}


// =============================================================================
// Chargement et rendu du flux RSS
// =============================================================================

/**
 * Charge flux.xml, parse les items RSS et injecte les cards dans le DOM.
 *
 * Étapes :
 *   1. Fetch du fichier XML
 *   2. Affichage de la date de dernière mise à jour (header Last-Modified)
 *   3. Parse XML + détection d'erreur de parsing
 *   4. Tri par date décroissante
 *   5. Filtrage des Shorts
 *   6. Limitation à 100 entrées
 *   7. Construction des cards HTML (titre, auteur, date, description)
 *   8. Gestion du player YouTube intégré au clic
 */
async function loadRSS() {
  const feed = document.getElementById("feed");

  try {
    const response = await fetch("flux.xml");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // --- Date de dernière modification du fichier XML (en-tête HTTP) ---
    const lastModified = response.headers.get("Last-Modified");
    if (lastModified) {
      const updateDate = new Date(lastModified);
      document.getElementById("lastUpdate").innerHTML =
        "&nbsp; Dernière mise à jour : " +
        updateDate.toLocaleDateString("fr-FR", {
          day:    "2-digit",
          month:  "2-digit",
          hour:   "2-digit",
          minute: "2-digit",
        });
    }

    // --- Parse du contenu XML ---
    const xmlText = await response.text();
    const parser  = new DOMParser();
    const xml     = parser.parseFromString(xmlText, "text/xml");

    // Vérification d'erreur de parsing (DOMParser ne lève pas d'exception)
    const parseError = xml.querySelector("parsererror");
    if (parseError) {
      throw new Error("Erreur de parsing XML");
    }

    // --- Sélection, tri, filtrage et limitation des items ---
    const items = [...xml.querySelectorAll("item")]

      // Tri par date de publication décroissante (plus récent en premier)
      .sort((a, b) => {
        return (
          new Date(b.querySelector("pubDate")?.textContent || 0) -
          new Date(a.querySelector("pubDate")?.textContent || 0)
        );
      })

      // Exclusion des YouTube Shorts
      .filter((item) => {
        const title = item.querySelector("title")?.textContent       || "";
        const link  = item.querySelector("link")?.textContent        || "";
        const desc  = item.querySelector("description")?.textContent || "";
        return !isShort(title, link, desc);
      })

      // Limitation à 100 entrées affichées
      .slice(0, 100);


    // --- Construction des cards dans le DOM ---
items.forEach((item) => {
  // Extraction et nettoyage des données de l'item RSS
  const title = removeExcessiveRepeats(
    removeEmojis(item.querySelector("title")?.textContent || "")
  );
  const link = item.querySelector("link")?.textContent || "#";
  const author = item.querySelector("author")?.textContent || "Auteur";
  const description = removeExcessiveRepeats(
    removeEmojis(
      replaceUrlsWithPlaceholder(
        item.querySelector("description")?.textContent || ""
      )
    )
  );

      const pubDate = new Date(item.querySelector("pubDate")?.textContent || "");

      // Normalisation Unicode NFC pour éviter les problèmes d'affichage des caractères spéciaux
      const safeAuthor = author.normalize("NFC").trim();

      // Formatage de la date en français (JJ/MM HH:MM)
      const formattedDate = isNaN(pubDate)
        ? ""
        : pubDate.toLocaleDateString("fr-FR", {
            day:    "2-digit",
            month:  "2-digit",
            hour:   "2-digit",
            minute: "2-digit",
          });

      // --- Extraction de l'identifiant vidéo YouTube depuis l'URL ---
      let videoId = null;
      try {
        const url = new URL(link);
        if (url.hostname.includes("youtube.com")) {
          videoId = url.searchParams.get("v");          // format : youtube.com/watch?v=XXXX
        } else if (url.hostname.includes("youtu.be")) {
          videoId = url.pathname.slice(1);              // format : youtu.be/XXXX
        }
      } catch {
        // URL malformée : videoId reste null, la card s'ouvrira dans un nouvel onglet
      }

      // --- Création de l'élément card ---
      const div = document.createElement("div");
      div.className = "item";
      div.setAttribute("data-author", safeAuthor);  // utilisé par le CSS pour la couleur du parti

      // Injection HTML sécurisée : toutes les données externes passent par escapeHtml()
      div.innerHTML = `
        <div class="top">
          <span class="author" data-author="${escapeHtml(safeAuthor)}">${escapeHtml(safeAuthor)}</span>
          <span class="date">${escapeHtml(formattedDate)}</span>
        </div>
        <div class="title">
          <a href="${escapeHtml(link)}" class="video-link"
            ${videoId ? "" : 'target="_blank" rel="noopener noreferrer"'}>
            ${escapeHtml(title)}
          </a>
        </div>
        <div class="desc">${escapeHtml(description.replace(/\n/g, " "))}</div>
      `;

      feed.appendChild(div);

      // Si pas de videoId YouTube, pas de player intégré à gérer
      if (!videoId) return;

      const videoLink = div.querySelector(".video-link");

      /**
       * Crée le lecteur YouTube embarqué (iframe).
       * Utilise loading="lazy" pour ne pas charger les iframes hors écran.
       * @returns {HTMLElement} conteneur div avec l'iframe YouTube
       */
      const createPlayer = () => {
        const player = document.createElement("div");
        player.className = "youtube-player";
        player.innerHTML = `
          <iframe
            src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}"
            title="${escapeHtml(title)}"
            allowfullscreen
            loading="lazy">
          </iframe>
        `;
        return player;
      };

      // --- Gestion du clic sur le titre : toggle du player YouTube ---
      videoLink.addEventListener("click", (e) => {
        e.preventDefault();

        const existing = div.querySelector(".youtube-player");

        // Si un player est déjà ouvert sur cette card → on le ferme (toggle)
        if (existing) {
          existing.remove();
          div.classList.remove("expanded");
          return;
        }

        // Fermer tous les autres players ouverts (une seule vidéo à la fois)
        document.querySelectorAll(".youtube-player").forEach((p) => p.remove());
        document.querySelectorAll(".item.expanded").forEach((i) => i.classList.remove("expanded"));

        // Ouvrir le player sur la card courante et faire défiler jusqu'à elle
        div.appendChild(createPlayer());
        div.classList.add("expanded");
        div.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      // --- Ouverture automatique du player pour le premier item du feed ---
      if (feed.children.length === 1) {
        div.appendChild(createPlayer());
        div.classList.add("expanded");
      }
    });

  } catch (err) {
    // Affichage d'un message d'erreur stylisé en cas d'échec du chargement
    feed.innerHTML = `<div class="error">Impossible de charger le flux : ${escapeHtml(err.message)}</div>`;
    console.error("loadRSS error:", err);
  }
}

// Lancement du chargement dès l'exécution du script
loadRSS();
