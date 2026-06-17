function escapeHtml(str) {
  return str
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

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

function removeEmojis(str) {
  return str
    .replace(
      /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]\uFE0F?|[\u{FE00}-\u{FE0F}]|\p{Emoji_Presentation}|\p{Extended_Pictographic}|\u{200D}|\u{20E3}/gu,
      ""
    )
    .replace(/\s{2,}/g, " ")
    .trim();
}

function replaceUrlsWithPlaceholder(text) {
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/gi;
  return text.replace(urlRegex, "url");
}

function removeExcessiveRepeats(str) {
  return str.replace(/(.)\\1{3,}/g, "$1");
}

// Set of link URLs already rendered — used to detect new items
const renderedLinks = new Set();

// Last-Modified header value from the previous fetch
let lastModifiedSeen = null;

// Poll interval in milliseconds (30 seconds)
const POLL_INTERVAL = 30_000;

function buildItemElement(item, feed) {
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
  const safeAuthor = author.normalize("NFC").trim();

  const formattedDate = isNaN(pubDate)
    ? ""
    : pubDate.toLocaleString("fr-FR", {
        hour:   "2-digit",
        minute: "2-digit",
        day:    "2-digit",
        month:  "2-digit",
        year:   undefined,
      });

  let videoId = null;
  try {
    const url = new URL(link);
    if (url.hostname.includes("youtube.com")) {
      videoId = url.searchParams.get("v");
    } else if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.slice(1);
    }
  } catch {
    // URL malformée
  }

  const div = document.createElement("div");
  div.className = "item";
  div.setAttribute("data-author", safeAuthor);

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

  if (!videoId) return div;

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

    document.querySelectorAll(".youtube-player").forEach((p) => p.remove());
    document.querySelectorAll(".item.expanded").forEach((i) => i.classList.remove("expanded"));

    div.appendChild(createPlayer());
    div.classList.add("expanded");
    div.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });

  return div;
}

async function loadRSS() {
  const feed = document.getElementById("feed");

  try {
    // Cache-bust on first load; subsequent polls use conditional request
    const response = await fetch("flux.xml", { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const lastModified = response.headers.get("Last-Modified");
    if (lastModified) {
      const updateDate = new Date(lastModified);
      document.getElementById("lastUpdate").innerHTML =
        "&nbsp; Dernière mise à jour : " +
        updateDate.toLocaleDateString("fr-FR", {
          hour:   "2-digit",
          minute: "2-digit",
          day:    "2-digit",
          month:  "2-digit",
        });
      lastModifiedSeen = lastModified;
    }

    const xmlText = await response.text();
    const parser  = new DOMParser();
    const xml     = parser.parseFromString(xmlText, "text/xml");

    const parseError = xml.querySelector("parsererror");
    if (parseError) {
      throw new Error("Erreur de parsing XML");
    }

    const items = [...xml.querySelectorAll("item")]
      .sort((a, b) => {
        return (
          new Date(b.querySelector("pubDate")?.textContent || 0) -
          new Date(a.querySelector("pubDate")?.textContent || 0)
        );
      })
      .filter((item) => {
        const title = item.querySelector("title")?.textContent       || "";
        const link  = item.querySelector("link")?.textContent        || "";
        const desc  = item.querySelector("description")?.textContent || "";
        return !isShort(title, link, desc);
      })
      .slice(0, 100);

    items.forEach((item) => {
      const link = item.querySelector("link")?.textContent || "#";

      // Skip items already displayed
      if (renderedLinks.has(link)) return;
      renderedLinks.add(link);

      const div = buildItemElement(item, feed);

      // Insert new items at the top; for the very first load append normally
      if (feed.children.length === 0) {
        feed.appendChild(div);
        // Auto-open first video on initial load
        const videoLink = div.querySelector(".video-link");
        if (videoLink && div.querySelector) {
          // trigger the first player only when it's a YouTube link
          const href = videoLink.getAttribute("href") || "";
          if (href.includes("youtube.com") || href.includes("youtu.be")) {
            const player = div.querySelector ? null : null;
            // handled inside buildItemElement already; skip here
          }
        }
      } else {
        // Prepend new item with a visual highlight
        div.classList.add("item--new");
        feed.insertBefore(div, feed.firstChild);

        // Remove highlight after animation completes (3 s)
        setTimeout(() => div.classList.remove("item--new"), 3000);
      }
    });

    // Auto-open first video on very first load
    if (feed.children.length === 1) {
      const firstItem = feed.firstElementChild;
      const videoLink = firstItem?.querySelector(".video-link");
      if (videoLink) {
        videoLink.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
    }

  } catch (err) {
    if (feed.children.length === 0) {
      feed.innerHTML = `<div class="error">Impossible de charger le flux : ${escapeHtml(err.message)}</div>`;
    }
    console.error("loadRSS error:", err);
  }
}

async function pollRSS() {
  const feed = document.getElementById("feed");

  try {
    // Use conditional GET: only re-parse if the file changed
    const headers = {};
    if (lastModifiedSeen) {
      headers["If-Modified-Since"] = lastModifiedSeen;
    }

    const response = await fetch("flux.xml", {
      cache:   "no-store",
      headers,
    });

    // 304 Not Modified — nothing to do
    if (response.status === 304) return;

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const lastModified = response.headers.get("Last-Modified");
    if (lastModified) {
      // If the file hasn't changed since last poll, bail out early
      if (lastModified === lastModifiedSeen) return;

      lastModifiedSeen = lastModified;

      const updateDate = new Date(lastModified);
      document.getElementById("lastUpdate").innerHTML =
        "&nbsp; Dernière mise à jour : " +
        updateDate.toLocaleDateString("fr-FR", {
          hour:   "2-digit",
          minute: "2-digit",
          day:    "2-digit",
          month:  "2-digit",
        });
    }

    const xmlText = await response.text();
    const parser  = new DOMParser();
    const xml     = parser.parseFromString(xmlText, "text/xml");

    const parseError = xml.querySelector("parsererror");
    if (parseError) throw new Error("Erreur de parsing XML");

    const items = [...xml.querySelectorAll("item")]
      .sort((a, b) => (
        new Date(b.querySelector("pubDate")?.textContent || 0) -
        new Date(a.querySelector("pubDate")?.textContent || 0)
      ))
      .filter((item) => {
        const title = item.querySelector("title")?.textContent       || "";
        const link  = item.querySelector("link")?.textContent        || "";
        const desc  = item.querySelector("description")?.textContent || "";
        return !isShort(title, link, desc);
      })
      .slice(0, 100);

    let newCount = 0;

    items.forEach((item) => {
      const link = item.querySelector("link")?.textContent || "#";
      if (renderedLinks.has(link)) return;

      renderedLinks.add(link);
      newCount++;

      const div = buildItemElement(item, feed);
      div.classList.add("item--new");
      feed.insertBefore(div, feed.firstChild);

      setTimeout(() => div.classList.remove("item--new"), 3000);
    });

    if (newCount > 0) {
      console.log(`[veille] ${newCount} nouvel(s) élément(s) ajouté(s)`);
    }

  } catch (err) {
    console.warn("pollRSS error:", err);
  }
}

// Initial load
loadRSS().then(() => {
  // Start polling after first load
  setInterval(pollRSS, POLL_INTERVAL);
});
