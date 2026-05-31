import feedparser
import requests
import xml.etree.ElementTree as ET
from email.utils import formatdate
from datetime import datetime, timezone

# Flux RSS YouTube
RSS_FEEDS = [
#LFI

     #MAUDET
    "https://www.youtube.com/feeds/videos.xml?channel_id=UClqKoEMJ0wq0ZoA4kz9N94g",
     #LEAUMENT
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC3q3FLPQtuWWv1uTkTfpEtw",
     #TROUVE
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCBmDLidbbwRUiZeCKWrlPMg",
     #SAINTOUL
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCDmff0YxGkS8JRMGzaAe-jg",
     #GUETTE
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCpU9riAixpc1Xn9Q4i7AkOw",
     #GUIRAUD
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCNlu6bn_Vu37IDINEpVlEog",
     #OBONO
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCNlu6bn_Vu37IDINEpVlEog",
     #COQUEREL
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC4A3K4CT4swDAW57fzXIMVA",
     #PIQUEMAL
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCB6vbZrh1S6EC1PAokq3xRA",
     #CATHALA
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCzB-k0YgJkNsBeHyfnjg4_w",
     #CLOUET
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCFVKtK2LxUkuudXpOGOiUjg",
     #MELENCHON
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCk-_PEY3iC6DIGJKuoEe9bw",
     #BOYARD
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCcru_TwWwshPbjIWvp6B7dg",
     #AUBR
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCyX-_BipdNpdFgeZEQBNstA",
     #BOMPARD
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCr7r7gh9N45WVwYAmHQ3m3w",
     #PANOT
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCilxiEGEQHVZ25GU_cnyCzg",
     #VANNIER
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCeVAGmpsgoy521FecTcC34g",
     #CHIKIROU
    "https://www.youtube.com/feeds/videos.xml?channel_id=UC0Uk2pyZI6-FxL8MbtKD27w",

#ECOLOGISTES

    #LES ECOLOGISTES
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCB8Q3N-nvX1YlMUL7Zl_16w",

#PSS ET SATELLITES

    #RUFIN
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCIQGSp79vVch0vO3Efqif_w",
    #PARTI SOCIALISTE
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCo7xGEOV-RfxOAxRfhlR3Ww",
    #VALLAUD
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCScGc5Cd6h3Y_djPloqI7UA",
    #GUEDJ
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCWsy5JK3eZSZp2YVekifHNQ",
    #GLUCKSMANN
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCyVYj4HdtEbcMngyD6_OLzg",

#BLOC CENTRAL

    #PARTI HORIZONS
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCoDttl6w1T-Stuw_pvNOvLA",
    #PARTI MODEM
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCfHWZNJQ7wZpG_cL9ukYX1Q",
    #GABRIEL ATTAL
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCOcDPuYTuxoRBtfmTBXtqBA",
    #AURORE BERGE
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCiT4UyKh-cF8qBaBQP4p1ow",
    #PARTI RENNAISSANCEs
    "https://www.youtube.com/feeds/videos.xml?channel_id=UCJw8np695wqWOaKVhFjkRyg",

    






]

OUTPUT_FILE = "aggregate.xml"


def is_short(entry):

    title = entry.get("title", "").lower()
    link = entry.get("link", "").lower()

    return (
        "#shorts" in title
        or "/shorts/" in link
        or "shorts" in title
    )


rss = ET.Element("rss", version="2.0")
channel = ET.SubElement(rss, "channel")

ET.SubElement(channel, "title").text = "YouTube Aggregated Feed"
ET.SubElement(channel, "description").text = "Flux RSS agrégé YouTube"
ET.SubElement(channel, "link").text = "https://youtube.com"
ET.SubElement(channel, "lastBuildDate").text = formatdate()

all_entries = []

for feed_url in RSS_FEEDS:

    parsed = feedparser.parse(feed_url)

    # Garder uniquement les 10 dernières vidéos du flux
    entries = sorted(
        parsed.entries,
        key=lambda x: x.get(
            "published_parsed",
            datetime.now(timezone.utc).timetuple()
        ),
        reverse=True
    )[:10]

    for entry in entries:

        if is_short(entry):
            continue

        all_entries.append(entry)

# Tri par date décroissante
all_entries.sort(
    key=lambda x: x.get("published_parsed", datetime.now(timezone.utc).timetuple()),
    reverse=True
)

for entry in all_entries:

    item = ET.SubElement(channel, "item")

    ET.SubElement(item, "title").text = entry.get("title", "")

    ET.SubElement(item, "link").text = entry.get("link", "")
    ET.SubElement(item, "guid").text = entry.get("link", "")

    ET.SubElement(item, "pubDate").text = entry.get("published", "")

    ET.SubElement(item, "author").text = entry.get("author", "")

    ET.SubElement(item, "description").text = entry.get("summary", "")

    channel_title = ""

    if "author" in entry:
        channel_title = entry.author

    ET.SubElement(item, "channelTitle").text = channel_title

    if "yt_videoid" in entry:
        ET.SubElement(item, "videoId").text = entry.yt_videoid

        thumbnail = ET.SubElement(item, "enclosure")
        thumbnail.set(
            "url",
            f"https://i.ytimg.com/vi/{entry.yt_videoid}/maxresdefault.jpg"
        )
        thumbnail.set("type", "image/jpeg")

tree = ET.ElementTree(rss)

ET.indent(tree, space="  ")

tree.write(
    OUTPUT_FILE,
    encoding="utf-8",
    xml_declaration=True
)

print(f"Fichier créé : {OUTPUT_FILE}")