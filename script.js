// Échappe les caractères HTML pour éviter les injections XSS
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Filtre les YouTube Shorts
function isShort(title, link, desc) {
  const t = title.toLowerCase();
  const d = desc.toLowerCase();
  const l = link.toLowerCase();
  return (
    t.includes("#shorts") ||
    t.includes("shorts") ||
    d.includes("#shorts") ||
    l.includes("/shorts/")
  );
}

async function loadRSS() {
  const feed = document.getElementById("feed");

  try {
    const response = await fetch("flux.xml");

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    // Date de dernière modification du fichier XML
    const lastModified = response.headers.get("Last-Modified");
    if (lastModified) {
      const updateDate = new Date(lastModified);
      document.getElementById("lastUpdate").innerHTML =
        "&nbsp; Mise à jour : " +
        updateDate.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        });
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "text/xml");

    // Vérifier les erreurs de parsing XML
    const parseError = xml.querySelector("parsererror");
    if (parseError) {
      throw new Error("Erreur de parsing XML");
    }

    const items = [...xml.querySelectorAll("item")]
      // Trier par date décroissante
      .sort((a, b) => {
        return (
          new Date(b.querySelector("pubDate")?.textContent || 0) -
          new Date(a.querySelector("pubDate")?.textContent || 0)
        );
      })
      // Filtrer les shorts
      .filter((item) => {
        const title = item.querySelector("title")?.textContent || "";
        const link = item.querySelector("link")?.textContent || "";
        const desc = item.querySelector("description")?.textContent || "";
        return !isShort(title, link, desc);
      })
      // Garder les 100 dernières entrées
      .slice(0, 100);

    items.forEach((item) => {
      const title = item.querySelector("title")?.textContent || "";
      const link = item.querySelector("link")?.textContent || "#";
      const author = item.querySelector("author")?.textContent || "Auteur";
      const description = item.querySelector("description")?.textContent || "";

      const pubDate = new Date(
        item.querySelector("pubDate")?.textContent || ""
      );

      const safeAuthor = author.normalize("NFC").trim();

      const formattedDate = isNaN(pubDate)
        ? ""
        : pubDate.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

      // Extraire le videoId YouTube
      let videoId = null;
      try {
        const url = new URL(link);
        if (url.hostname.includes("youtube.com")) {
          videoId = url.searchParams.get("v");
        } else if (url.hostname.includes("youtu.be")) {
          videoId = url.pathname.slice(1);
        }
      } catch {}

      const div = document.createElement("div");
      div.className = "item";
      div.setAttribute("data-author", safeAuthor);

      // Construction sécurisée du DOM (pas d'innerHTML pour les données utilisateur)
      div.innerHTML = `
        <div class="top">
          <span class="author" data-author="${escapeHtml(safeAuthor)}">${escapeHtml(safeAuthor)}</span>
          <span class="date">${escapeHtml(formattedDate)}</span>
        </div>
        <div class="title">
          <a href="${escapeHtml(link)}" class="video-link" ${videoId ? "" : 'target="_blank" rel="noopener noreferrer"'}>
            ${escapeHtml(title)}
          </a>
        </div>
        <div class="desc">${escapeHtml(description.replace(/\n/g, " "))}</div>
      `;

      feed.appendChild(div);

      if (!videoId) return;

      const videoLink = div.querySelector(".video-link");

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

      videoLink.addEventListener("click", (e) => {
        e.preventDefault();

        const existing = div.querySelector(".youtube-player");
        if (existing) {
          existing.remove();
          div.classList.remove("expanded");
          return;
        }

        // Fermer tout autre player ouvert
        document
          .querySelectorAll(".youtube-player")
          .forEach((p) => p.remove());
        document
          .querySelectorAll(".item.expanded")
          .forEach((i) => i.classList.remove("expanded"));

        div.appendChild(createPlayer());
        div.classList.add("expanded");
        div.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });

      // Ouvrir automatiquement le player du premier item
      if (feed.children.length === 1) {
        div.appendChild(createPlayer());
        div.classList.add("expanded");
      }
    });
  } catch (err) {
    feed.innerHTML = `<div class="error">Impossible de charger le flux : ${escapeHtml(err.message)}</div>`;
    console.error("loadRSS error:", err);
  }
}

loadRSS();
