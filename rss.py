import feedparser
import xml.etree.ElementTree as ET

from datetime import datetime, timezone
from email.utils import formatdate
import re
from pathlib import Path


# =============================================================================
# Configuration globale
# =============================================================================

# Fichier de sortie XML généré par ce script
OUTPUT_FILE = "flux.xml"

# Nombre maximum d'entrées conservées par flux RSS individuel
MAX_ENTRIES_PER_FEED = 10


# =============================================================================
# Sources RSS 
# =============================================================================

FEEDS = {
    "LFI": [
        # Damien Maudet
        "https://www.youtube.com/feeds/videos.xml?channel_id=UClqKoEMJ0wq0ZoA4kz9N94g",
        # Antoine Léaument
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC3q3FLPQtuWWv1uTkTfpEtw",
        # Aurélie Trouvé
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCBmDLidbbwRUiZeCKWrlPMg",
        # Aurélien Saintoul
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCDmff0YxGkS8JRMGzaAe-jg",
        # Clémence Guetté
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCpU9riAixpc1Xn9Q4i7AkOw",
        # David Guiraud
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCNlu6bn_Vu37IDINEpVlEog",
        # Eric Coquerel
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC4A3K4CT4swDAW57fzXIMVA",
        # Francois Piquemal
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCB6vbZrh1S6EC1PAokq3xRA",
        # Gabrielle Cathala
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCzB-k0YgJkNsBeHyfnjg4_w",
        # Hadrien Clouet
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCFVKtK2LxUkuudXpOGOiUjg",
        # Jean-Luc Mélenchon
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCk-_PEY3iC6DIGJKuoEe9bw",
        # Louis Boyard
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCcru_TwWwshPbjIWvp6B7dg",
        # Manon Aubry
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCyX-_BipdNpdFgeZEQBNstA",
        # Manuel Bompard
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCr7r7gh9N45WVwYAmHQ3m3w",
        # Mathilde Panot
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCilxiEGEQHVZ25GU_cnyCzg",
        # Paul Vannier
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCeVAGmpsgoy521FecTcC34g",
        # Sophia Chikirou
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC0Uk2pyZI6-FxL8MbtKD27w",
    ],

    "ECOLOGISTES": [
        # Parti EELV
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCB8Q3N-nvX1YlMUL7Zl_16w",
        # Sandrine Rousseau
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCA8JG3JY883RjCmAU9lABzw",
    ],

    "PCF": [
        # Parti Communiste
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCSwPcnzaMTuDcTgjRiJvZnw",
    ],

    "BLOC SOCIAL DEMOCRATE": [
        # Parti Socialiste
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCo7xGEOV-RfxOAxRfhlR3Ww",
        # François Ruffin
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCIQGSp79vVch0vO3Efqif_w",
        # Boris Vallaud
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCScGc5Cd6h3Y_djPloqI7UA",
        # Jérôme Guedj
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCWsy5JK3eZSZp2YVekifHNQ",
        # Raphaël Glucksmann
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCyVYj4HdtEbcMngyD6_OLzg",
        # L'Après
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCmOokTCPhaGXqIKAFFeylag",
        # Alexis Corbière
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCDKcvNGkX-1QxNoBt_Ac-zA",
        # Clémentine Autain
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCZgJ_r_Ewlu1Ck-RzNCHuUQ",
    ],

    "CENTRE": [
        # Parti Horizons
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCoDttl6w1T-Stuw_pvNOvLA",
        # Parti Modem
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCfHWZNJQ7wZpG_cL9ukYX1Q",
        # Parti Renaissance
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCJw8np695wqWOaKVhFjkRyg",
        # Gabriel Attal
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCOcDPuYTuxoRBtfmTBXtqBA",
        # Aurore Bergé
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCiT4UyKh-cF8qBaBQP4p1ow",
    ],

    "BLOC LR": [
        # Retailleau
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCRkuLQabW1hsihpZuHJSbEA",
        # Bellamy
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC7dqnnA1NyHvUiZgyK_vMiQ",
        # Wauquiez
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCjo4wCbga9X01yGwm0gB0Wg",
        # Lisnard
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC2XZY-bjIEmyLZ9MPJQytZg",
    ],

    "EXTREME DROITE": [
        # Rassemblement National
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCeWMp4Frgyv275gSnWNYoZQ",
        # Jordan Bardella
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC3U0VIDgANFaXeOAtt1m5Mw",
        # Marine Le Pen
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCU3z3px1_RCqYBwrs8LJVWg",
        # Eric Zemmour
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCjTbZBXEw-gplUAnMXLYHpg",
        # Sarah Knafo
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC8ba7bn2fuU_lsVweb4YM4Q",
    ],
}

# Liste plate de toutes les URLs extraites du dictionnaire FEEDS
RSS_FEEDS = [feed for group in FEEDS.values() for feed in group]


# =============================================================================
# Fonctions utilitaires
# =============================================================================

def is_short(entry):
    """
    Détecte si une entrée RSS est un YouTube Short.
    Vérifie le titre, le lien et la description pour les marqueurs "#shorts" ou "/shorts/".
    Retourne True si l'entrée est un Short (à exclure du flux final).
    """
    title = entry.get("title", "").lower()
    link  = entry.get("link",  "").lower()
    desc  = entry.get("summary", "").lower()

    return (
        "#shorts" in title
        or "shorts" in title
        or "/shorts/" in link
        or "#shorts" in desc
    )


def get_entries(feed_url):
    """
    Récupère et trie les entrées d'un flux RSS distant.

    - Utilise feedparser pour parser l'URL.
    - Gère silencieusement les flux invalides ou inaccessibles (bozo flag).
    - Trie par date de publication décroissante.
    - Limite le résultat à MAX_ENTRIES_PER_FEED entrées.

    Retourne une liste d'entrées, ou [] en cas d'erreur.
    """
    try:
        parsed = feedparser.parse(feed_url)
        
        if parsed.bozo and not parsed.entries:
            print(f"Flux invalide ou inaccessible : {feed_url}")
            return []

        return sorted(
            parsed.entries,
            key=lambda x: x.get(
                "published_parsed",
                datetime.now(timezone.utc).timetuple() 
            ),
            reverse=True
        )[:MAX_ENTRIES_PER_FEED]

    except Exception as e:
        print(f"Erreur lors de la récupération de {feed_url} : {e}")
        return []


def get_meetings_entries():
    """
    Lit les entrées du fichier local meetings.xml.
    Ce fichier permet d'injecter manuellement des événements (meetings, AG, etc.)
    dans le flux agrégé, en complément des flux YouTube automatiques.

    Retourne une liste d'entrées, ou [] si le fichier est absent ou illisible.
    """
    meetings_file = Path("meetings.xml")

    if not meetings_file.exists():
        return []

    try:
        parsed = feedparser.parse(str(meetings_file))
        return parsed.entries
    except Exception as e:
        print(f"Erreur lors de la lecture de meetings.xml : {e}")
        return []


# =============================================================================
# Construction du XML de sortie
# =============================================================================

def build_xml(entries):
    """
    Construit un arbre XML RSS 2.0 à partir d'une liste d'entrées feedparser.

    Structure générée :
      <rss version="2.0">
        <channel>
          <title>, <description>, <link>, <lastBuildDate>
          <item> × N   (titre, lien, guid, date, auteur, description, miniature)
        </channel>
      </rss>

    Pour les vidéos YouTube, ajoute :
      - <videoId>  : identifiant de la vidéo (yt:videoId)
      - <enclosure> : URL de la miniature en qualité maximale (maxresdefault.jpg)

    Retourne un objet ElementTree prêt à être sérialisé.
    """
    # Élément racine du flux RSS
    rss     = ET.Element("rss", version="2.0")
    channel = ET.SubElement(rss, "channel")

    # Métadonnées du canal agrégé
    ET.SubElement(channel, "title").text       = "YouTube Aggregated Feed"
    ET.SubElement(channel, "description").text = "Flux RSS agrégé YouTube"
    ET.SubElement(channel, "link").text        = "https://youtube.com"
    ET.SubElement(channel, "lastBuildDate").text = formatdate()  # RFC 2822, date/heure courante

    for entry in entries:
        item = ET.SubElement(channel, "item")

        # Champs textuels standards RSS 2.0
        ET.SubElement(item, "title").text       = entry.get("title",     "")
        ET.SubElement(item, "link").text         = entry.get("link",      "")
        ET.SubElement(item, "guid").text         = entry.get("link",      "")  # guid = lien (identifiant unique)
        ET.SubElement(item, "pubDate").text      = entry.get("published", "")
        ET.SubElement(item, "author").text       = entry.get("author",    "")
        ET.SubElement(item, "description").text  = entry.get("summary",   "")
        ET.SubElement(item, "channelTitle").text = entry.get("author",    "")  # doublon auteur, utilisé côté JS

        # Champs spécifiques YouTube (présents uniquement pour les flux YT)
        if "yt_videoid" in entry:
            ET.SubElement(item, "videoId").text = entry.yt_videoid

            # Miniature YouTube en résolution maximale via l'URL standard
            thumbnail = ET.SubElement(item, "enclosure")
            thumbnail.set(
                "url",
                f"https://i.ytimg.com/vi/{entry.yt_videoid}/maxresdefault.jpg"
            )
            thumbnail.set("type", "image/jpeg")

    return ET.ElementTree(rss)


# =============================================================================
# Point d'entrée principal
# =============================================================================

def main():
    """
    Orchestre la récupération, le filtrage et la génération du flux agrégé :
      1. Parcourt tous les flux RSS définis dans FEEDS
      2. Filtre les YouTube Shorts
      3. Fusionne avec les entrées de meetings.xml
      4. Trie l'ensemble par date décroissante
      5. Limite à 100 entrées
      6. Génère le fichier flux.xml indenté
    """
    all_entries = []
    errors      = 0

    # --- Récupération de tous les flux distants ---
    for feed_url in RSS_FEEDS:
        entries = get_entries(feed_url)

        if not entries:
            errors += 1  # compteur pour le rapport final

        for entry in entries:
            # On exclut les YouTube Shorts du flux agrégé
            if not is_short(entry):
                all_entries.append(entry)

    # --- Ajout des événements locaux (meetings, AG, etc.) ---
    meetings = get_meetings_entries()
    all_entries.extend(meetings)
    if meetings:
        print(f"{len(meetings)} entrée(s) ajoutée(s) depuis meetings.xml")

    # --- Rapport d'erreurs non bloquantes ---
    if errors:
        print(f"Avertissement : {errors} flux inaccessibles sur {len(RSS_FEEDS)}")

    # --- Tri global par date décroissante (plus récent en premier) ---
    all_entries.sort(
        key=lambda x: x.get(
            "published_parsed",
            datetime.now(timezone.utc).timetuple()  # fallback si date absente
        ),
        reverse=True
    )

    # --- Limitation à 100 entrées dans le flux final ---
    all_entries = all_entries[:100]

    # --- Génération du fichier XML de sortie ---
    tree = build_xml(all_entries)

    ET.indent(tree, space="  ")  # indentation lisible pour debug
    tree.write(
        OUTPUT_FILE,
        encoding="utf-8",
        xml_declaration=True  # ajoute <?xml version='1.0' encoding='utf-8'?>
    )

    print(f"Fichier créé : {OUTPUT_FILE} ({len(all_entries)} entrées)")


# Lancement uniquement si exécuté directement (pas en import)
if __name__ == "__main__":
    main()
