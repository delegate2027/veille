async function loadRSS() {

      const response = await fetch("aggregate.xml");

      // Date de dernière modification du fichier XML
      const lastModified = response.headers.get("Last-Modified");

      if (lastModified) {
        const updateDate = new Date(lastModified);

        document.getElementById("lastUpdate").innerHTML =
          "&nbsp Dernière actualisation : " +
          updateDate.toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
      }
      const xmlText = await response.text();

      const parser = new DOMParser();
      const xml = parser.parseFromString(xmlText, "text/xml");

      let items = [...xml.querySelectorAll("item")]

      // Trier par date décroissante
      .sort((a, b) => {

        return new Date(
          b.querySelector("pubDate").textContent
        ) - new Date(
          a.querySelector("pubDate").textContent
        );
      })

      // Garder uniquement les 50 dernières entrées
      .slice(0, 50);

      // Exclure les shorts
      items = items.filter(item => {

        const title =
          item.querySelector("title")?.textContent.toLowerCase() || "";

        const desc =
          item.querySelector("description")?.textContent.toLowerCase() || "";

        return !title.includes("#shorts")
          && !title.includes("shorts")
          && !desc.includes("#shorts");
      });

      const feed = document.getElementById("feed");

      items.forEach(item => {

        const title =
          item.querySelector("title")?.textContent || "";

        const link =
          item.querySelector("link")?.textContent || "#";

        const author =
          item.querySelector("author")?.textContent || "Auteur";

        const description =
          item.querySelector("description")?.textContent || "";

        const pubDate = new Date(
          item.querySelector("pubDate")?.textContent || ""
        );

        // Gestion unicode / accents / caractères spéciaux
        const safeAuthor = author.normalize("NFC");

        const formattedDate = pubDate.toLocaleDateString(
          "fr-FR",
          {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          }
        );

        const div = document.createElement("div");

        div.className = "item";

        div.setAttribute("data-author", safeAuthor);

        div.innerHTML = `
          <div class="top">

            <span class="author" data-author="${safeAuthor}">
              ${author}
            </span>

            <span class="date">
              ${formattedDate}
            </span>

          </div>

          <div class="title">
<a href="${link}" class="video-link">
  ${title}
</a>
          </div>

          <div class="desc">
            ${description.replace(/\n/g, " ")}
          </div>
        `;

        feed.appendChild(div);





        const videoLink = div.querySelector(".video-link");

videoLink.addEventListener("click", (e) => {
  e.preventDefault();

  // Si déjà ouvert → refermer
  const existing = div.querySelector(".youtube-player");

  if (existing) {
    existing.remove();
    div.classList.remove("expanded");
    return;
  }

  // Extraction de l'ID YouTube
  let videoId = null;

  try {
    const url = new URL(link);

    if (url.hostname.includes("youtube.com")) {
      videoId = url.searchParams.get("v");
    } else if (url.hostname.includes("youtu.be")) {
      videoId = url.pathname.slice(1);
    }
  } catch {}

  if (!videoId) return;

  const player = document.createElement("div");

  player.className = "youtube-player";

  player.innerHTML = `
    <iframe
      src="https://www.youtube.com/embed/${videoId}"
      title="${title}"
      allowfullscreen>
    </iframe>
  `;





document.querySelectorAll(".youtube-player").forEach(player => {
  player.remove();
});

document.querySelectorAll(".item.expanded").forEach(item => {
  item.classList.remove("expanded");
});





  div.appendChild(player);
  div.classList.add("expanded");
});





      });
    }

    loadRSS();