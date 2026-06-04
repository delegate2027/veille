import feedparser
import xml.etree.ElementTree as ET

from datetime import datetime, timezone
from email.utils import formatdate
import re
from pathlib import Path

OUTPUT_FILE = "flux.xml"
MAX_ENTRIES_PER_FEED = 10  # nombre maximum de liens conservés par flux RSS

FEEDS = {
    "LFI": [
    #Damien Maudet
        "https://www.youtube.com/feeds/videos.xml?channel_id=UClqKoEMJ0wq0ZoA4kz9N94g",
    #Antoine Léaument
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC3q3FLPQtuWWv1uTkTfpEtw",
    #Aurélie Trouvé
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCBmDLidbbwRUiZeCKWrlPMg",
    #Aurélien Saintoul
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCDmff0YxGkS8JRMGzaAe-jg",
    #Clémence Guetté
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCpU9riAixpc1Xn9Q4i7AkOw",
    #David Guiraud
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCNlu6bn_Vu37IDINEpVlEog",
    #Eric Coquerel
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC4A3K4CT4swDAW57fzXIMVA",
    #Francois Piquemal
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCB6vbZrh1S6EC1PAokq3xRA",
    #Gabrielle Cathala
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCzB-k0YgJkNsBeHyfnjg4_w",
    #Clouet
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCFVKtK2LxUkuudXpOGOiUjg",
    #Jean-Luc Mélenchon
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCk-_PEY3iC6DIGJKuoEe9bw",
    #Louis Boyard
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCcru_TwWwshPbjIWvp6B7dg",
    #Manon Aubry
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCyX-_BipdNpdFgeZEQBNstA",
    #Manuel Bompard
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCr7r7gh9N45WVwYAmHQ3m3w",
    #Mathilde Panot
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCilxiEGEQHVZ25GU_cnyCzg",
    #Paul Vannier
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCeVAGmpsgoy521FecTcC34g",
    #Sophia Chikirou
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC0Uk2pyZI6-FxL8MbtKD27w",


    ],
    
    "ECOLOGISTES": [
    #Parti EELV
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCB8Q3N-nvX1YlMUL7Zl_16w",
    #Sandrine Rousseau
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCA8JG3JY883RjCmAU9lABzw",
        
    ],
    
    "PCF": [
    #Parti Communiste
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCSwPcnzaMTuDcTgjRiJvZnw",

        
    ],

    "BLOC SOCIAL DEMOCRATE": [
    #Parti Socialiste
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCo7xGEOV-RfxOAxRfhlR3Ww",
    #François Ruffin
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCIQGSp79vVch0vO3Efqif_w",
    #Boris Vallaud
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCScGc5Cd6h3Y_djPloqI7UA",
    #Jérome Guedj
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCWsy5JK3eZSZp2YVekifHNQ",
    #Raphaël Glucksmann
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCyVYj4HdtEbcMngyD6_OLzg",
    #L'Après
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCmOokTCPhaGXqIKAFFeylag",
    #Alexis Corbière
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCDKcvNGkX-1QxNoBt_Ac-zA",
    #Clémentine Autain
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCZgJ_r_Ewlu1Ck-RzNCHuUQ",
    ],

    "CENTRE": [
    #Parti Horizons
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCoDttl6w1T-Stuw_pvNOvLA",
    #Parti Modem
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCfHWZNJQ7wZpG_cL9ukYX1Q",
    #Parti Renaissance
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCJw8np695wqWOaKVhFjkRyg",
    #Gabriel Attal
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCOcDPuYTuxoRBtfmTBXtqBA",
    #Aurore Bergé
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCiT4UyKh-cF8qBaBQP4p1ow",

    ],
    "BLOC LR": [
    #Retailleau
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCRkuLQabW1hsihpZuHJSbEA",
    #Bellamy
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC7dqnnA1NyHvUiZgyK_vMiQ",
    #Wauquiez
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCjo4wCbga9X01yGwm0gB0Wg",
    #Lisnard
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC2XZY-bjIEmyLZ9MPJQytZg",
    ],

    "EXTREME DROITE": [
    #Rassemblement National
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCeWMp4Frgyv275gSnWNYoZQ",
    #Jordan Bardella
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC3U0VIDgANFaXeOAtt1m5Mw",
    #Marine Le Pen
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCU3z3px1_RCqYBwrs8LJVWg",
    #Eric Zemmour
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCjTbZBXEw-gplUAnMXLYHpg",
    #Sarah Knafo
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC8ba7bn2fuU_lsVweb4YM4Q",
    ],
}

RSS_FEEDS = [feed for group in FEEDS.values() for feed in group]


def is_short(entry):
    title = entry.get("title", "").lower()
    link = entry.get("link", "").lower()

    return (
        "#shorts" in title
        or "/shorts/" in link
        or "shorts" in title
    )


def get_entries(feed_url):
    parsed = feedparser.parse(feed_url)

    return sorted(
        parsed.entries,
        key=lambda x: x.get(
            "published_parsed",
            datetime.now(timezone.utc).timetuple()
        ),
        reverse=True
    )[:MAX_ENTRIES_PER_FEED]


def build_xml(entries):
    rss = ET.Element("rss", version="2.0")
    channel = ET.SubElement(rss, "channel")

    ET.SubElement(channel, "title").text = "YouTube Aggregated Feed"
    ET.SubElement(channel, "description").text = "Flux RSS agrégé YouTube"
    ET.SubElement(channel, "link").text = "https://youtube.com"
    ET.SubElement(channel, "lastBuildDate").text = formatdate()

    for entry in entries:
        item = ET.SubElement(channel, "item")

        ET.SubElement(item, "title").text = entry.get("title", "")
        ET.SubElement(item, "link").text = entry.get("link", "")
        ET.SubElement(item, "guid").text = entry.get("link", "")
        ET.SubElement(item, "pubDate").text = entry.get("published", "")
        ET.SubElement(item, "author").text = entry.get("author", "")
        ET.SubElement(item, "description").text = entry.get("summary", "")
        ET.SubElement(item, "channelTitle").text = entry.get("author", "")

        if "yt_videoid" in entry:
            ET.SubElement(item, "videoId").text = entry.yt_videoid

            thumbnail = ET.SubElement(item, "enclosure")
            thumbnail.set(
                "url",
                f"https://i.ytimg.com/vi/{entry.yt_videoid}/maxresdefault.jpg"
            )
            thumbnail.set("type", "image/jpeg")

    return ET.ElementTree(rss)




WORKFLOW_FILE = ".github/workflows/update-rss.yml"
INDEX_FILE = "index.html"


def get_update_frequency():
    try:
        content = Path(WORKFLOW_FILE).read_text(encoding="utf-8")

        match = re.search(r"cron:\s*['\"]?([^'\"\n]+)['\"]?", content)
        if not match:
            return None

        cron = match.group(1).strip()
        parts = cron.split()

        if len(parts) < 1:
            return None

        minute = parts[0]

        # gère */15 proprement
        if "*/" in minute:
            return minute.replace("*/", "")

        # gère valeur directe
        if minute.isdigit():
            return minute

        return None

    except Exception as e:
        print(f"Impossible de lire le cron : {e}")
        return None
    
def update_index_html():
    frequency = get_update_frequency()

    if not frequency:
        return

    try:
        html = Path(INDEX_FILE).read_text(encoding="utf-8")    
        
        html = re.sub(
        r'(<span id="updateFrequency">).*?(</span>)',
        rf'\1{frequency}\2',
        html
        )

        Path(INDEX_FILE).write_text(html, encoding="utf-8")

    except Exception as e:
        print(f"Erreur mise à jour index.html : {e}")


def main():
    all_entries = []

    for feed_url in RSS_FEEDS:
        for entry in get_entries(feed_url):
            if not is_short(entry):
                all_entries.append(entry)

    all_entries.sort(
        key=lambda x: x.get(
            "published_parsed",
            datetime.now(timezone.utc).timetuple()
        ),
        reverse=True
    )

    tree = build_xml(all_entries)

    ET.indent(tree, space="  ")
    tree.write(
        OUTPUT_FILE,
        encoding="utf-8",
        xml_declaration=True
    )

    update_index_html()

    print(f"Fichier créé : {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
