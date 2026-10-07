import feedparser
import xml.etree.ElementTree as ET

from datetime import datetime, timezone
from email.utils import formatdate
from pathlib import Path

OUTPUT_FILE = "flux.xml"
ARCHIVE_FILE = "archives.xml"
MAX_PER_SOURCE = 10
MAX_FEED_ITEMS = 100
MAX_ARCHIVE_ITEMS = 2000

FEEDS = {
    "LFI": [
        "https://www.youtube.com/feeds/videos.xml?channel_id=UClqKoEMJ0wq0ZoA4kz9N94g",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC3q3FLPQtuWWv1uTkTfpEtw",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCBmDLidbbwRUiZeCKWrlPMg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCDmff0YxGkS8JRMGzaAe-jg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCpU9riAixpc1Xn9Q4i7AkOw",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCNlu6bn_Vu37IDINEpVlEog",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC4A3K4CT4swDAW57fzXIMVA",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCB6vbZrh1S6EC1PAokq3xRA",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCzB-k0YgJkNsBeHyfnjg4_w",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCFVKtK2LxUkuudXpOGOiUjg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCk-_PEY3iC6DIGJKuoEe9bw",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCcru_TwWwshPbjIWvp6B7dg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCyX-_BipdNpdFgeZEQBNstA",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCr7r7gh9N45WVwYAmHQ3m3w",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCilxiEGEQHVZ25GU_cnyCzg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCeVAGmpsgoy521FecTcC34g",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC0Uk2pyZI6-FxL8MbtKD27w",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCceXHq4GoIM-6ZFQpG915ew",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCOBMbaiQeFI4PNDa18IQkLg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCpQ4STl8j62KeiApns4FndA",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCKB_K3phNlVxVEKIOUKnhVw",
    ],

    "ECOLOGISTES": [
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCB8Q3N-nvX1YlMUL7Zl_16w",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCA8JG3JY883RjCmAU9lABzw",
    ],

    "PCF": [
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCSwPcnzaMTuDcTgjRiJvZnw",
    ],

    "BLOC SOCIAL DEMOCRATE": [
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCo7xGEOV-RfxOAxRfhlR3Ww",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCIQGSp79vVch0vO3Efqif_w",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCScGc5Cd6h3Y_djPloqI7UA",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCWsy5JK3eZSZp2YVekifHNQ",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCyVYj4HdtEbcMngyD6_OLzg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCmOokTCPhaGXqIKAFFeylag",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCDKcvNGkX-1QxNoBt_Ac-zA",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCZgJ_r_Ewlu1Ck-RzNCHuUQ",
    ],

    "CENTRE": [
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCoDttl6w1T-Stuw_pvNOvLA",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCfHWZNJQ7wZpG_cL9ukYX1Q",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCJw8np695wqWOaKVhFjkRyg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCOcDPuYTuxoRBtfmTBXtqBA",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCiT4UyKh-cF8qBaBQP4p1ow",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCFqGa9uitcB-fWyNZK2xImw",
    ],

    "BLOC LR": [
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCRkuLQabW1hsihpZuHJSbEA",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC7dqnnA1NyHvUiZgyK_vMiQ",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCjo4wCbga9X01yGwm0gB0Wg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC2XZY-bjIEmyLZ9MPJQytZg",
    ],

    "EXTREME DROITE": [
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCeWMp4Frgyv275gSnWNYoZQ",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC3U0VIDgANFaXeOAtt1m5Mw",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCU3z3px1_RCqYBwrs8LJVWg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UCjTbZBXEw-gplUAnMXLYHpg",
        "https://www.youtube.com/feeds/videos.xml?channel_id=UC8ba7bn2fuU_lsVweb4YM4Q",
    ],
}

RSS_FEEDS = [feed for group in FEEDS.values() for feed in group]


def is_short(entry):
    title = entry.get("title", "").lower()
    link = entry.get("link", "").lower()
    desc = entry.get("summary", "").lower()

    return (
        "#shorts" in title
        or "shorts" in title
        or "/shorts/" in link
        or "#shorts" in desc
    )


def entry_timestamp(entry):
    """Date de publication sous forme triable ; l'heure courante pour
    les entrees sans date, qui montent alors en tete du tri."""
    parsed = entry.get("published_parsed")

    if parsed is None:
        return datetime.now(timezone.utc).timetuple()

    return parsed


def get_entries(feed_url):
    try:
        parsed = feedparser.parse(feed_url)

        if parsed.bozo and not parsed.entries:
            print(f"Flux invalide ou inaccessible : {feed_url}")
            return []

        return sorted(
            parsed.entries,
            key=entry_timestamp,
            reverse=True,
        )[:MAX_PER_SOURCE]

    except Exception as e:
        print(f"Erreur lors de la récupération de {feed_url} : {e}")
        return []


def get_meetings_entries():
    meetings_file = Path("meetings.xml")

    if not meetings_file.exists():
        return []

    try:
        parsed = feedparser.parse(str(meetings_file))
        return parsed.entries
    except Exception as e:
        print(f"Erreur lors de la lecture de meetings.xml : {e}")
        return []


def add_xml_item(channel, entry):
    """Ecrit une entree dans le flux XML (titre, lien, meta, vignette)."""
    item = ET.SubElement(channel, "item")

    ET.SubElement(item, "title").text = entry.get("title", "")
    ET.SubElement(item, "link").text = entry.get("link", "")
    ET.SubElement(item, "guid").text = entry.get("link", "")
    ET.SubElement(item, "pubDate").text = entry.get("published", "")
    ET.SubElement(item, "author").text = entry.get("author", "")
    ET.SubElement(item, "description").text = entry.get("summary", "")
    ET.SubElement(item, "channelTitle").text = entry.get("author", "")

    video_id = entry.get("yt_videoid") or entry.get("video_id")

    if video_id:
        ET.SubElement(item, "videoId").text = video_id

        thumbnail = ET.SubElement(item, "enclosure")
        thumbnail.set(
            "url",
            f"https://i.ytimg.com/vi/{video_id}/maxresdefault.jpg",
        )
        thumbnail.set("type", "image/jpeg")


def build_xml(entries, title="YouTube Aggregated Feed", description="Flux RSS agrégé YouTube"):
    rss = ET.Element("rss", version="2.0")
    channel = ET.SubElement(rss, "channel")

    ET.SubElement(channel, "title").text = title
    ET.SubElement(channel, "description").text = description
    ET.SubElement(channel, "link").text = "https://youtube.com"
    ET.SubElement(channel, "lastBuildDate").text = formatdate()
    ET.SubElement(channel, "feedCount").text = str(len(RSS_FEEDS))

    for entry in entries:
        add_xml_item(channel, entry)

    return ET.ElementTree(rss)


def entry_to_dict(entry):
    """Convertit une entree feedparser en dictionnaire d'archive."""
    return {
        "title": entry.get("title", ""),
        "link": entry.get("link", ""),
        "published": entry.get("published", ""),
        "author": entry.get("author", ""),
        "summary": entry.get("summary", ""),
        "video_id": entry.get("yt_videoid", ""),
        "timestamp": entry_timestamp(entry),
    }


def load_archive():
    """Relit l'archive existante et renvoie ses entrées sous forme de dictionnaire."""
    archive_path = Path(ARCHIVE_FILE)

    if not archive_path.exists():
        return {}

    try:
        parsed = feedparser.parse(str(archive_path))
    except Exception as e:
        print(f"Erreur lors de la lecture de {ARCHIVE_FILE} : {e}")
        return {}

    archive = {}

    for entry in parsed.entries:
        item = entry_to_dict(entry)

        if item["link"]:
            archive[item["link"]] = item

    return archive


def update_archive(entries):
    """Ajoute les nouvelles entrées à l'archive et écarte les doublons (même lien)."""
    archive = load_archive()
    new_items = 0

    for entry in entries:
        item = entry_to_dict(entry)
        link = item["link"]

        if not link or link in archive:
            continue

        archive[link] = item
        new_items += 1

    ordered = sorted(
        archive.values(),
        key=lambda x: x["timestamp"],
        reverse=True,
    )[:MAX_ARCHIVE_ITEMS]

    tree = build_xml(
        ordered,
        title="Veille médiatique politique — archives",
        description="Archive historique de toutes les entrées déjà vues",
    )
    ET.indent(tree, space="  ")
    tree.write(
        ARCHIVE_FILE,
        encoding="utf-8",
        xml_declaration=True,
    )

    print(
        f"Fichier créé : {ARCHIVE_FILE} "
        f"({len(ordered)} entrées, {new_items} nouvelle(s))"
    )


def fetch_all_entries():
    """Recupere les entrees de tous les flux abonnes, shorts exclus."""
    entries = []
    unavailable = 0

    for feed_url in RSS_FEEDS:
        feed_entries = get_entries(feed_url)

        if not feed_entries:
            unavailable += 1

        for entry in feed_entries:
            if not is_short(entry):
                entries.append(entry)

    return entries, unavailable


def main():
    all_entries, unavailable = fetch_all_entries()

    meetings = get_meetings_entries()
    all_entries.extend(meetings)

    if meetings:
        print(f"{len(meetings)} entrée(s) ajoutée(s) depuis meetings.xml")

    if unavailable:
        print(f"Avertissement : {unavailable} flux inaccessibles sur {len(RSS_FEEDS)}")

    all_entries.sort(
        key=entry_timestamp,
        reverse=True,
    )

    update_archive(all_entries)

    all_entries = all_entries[:MAX_FEED_ITEMS]

    tree = build_xml(all_entries)
    ET.indent(tree, space="  ")
    tree.write(
        OUTPUT_FILE,
        encoding="utf-8",
        xml_declaration=True,
    )

    print(f"Fichier créé : {OUTPUT_FILE} ({len(all_entries)} entrées)")


if __name__ == "__main__":
    main()