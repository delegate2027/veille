"""Récupération des notices publiées par la Commission des sondages.

La page /notices/ regroupe les notices par mois, chaque notice étant un lien
PDF dont le libellé contient le numéro, le thème, l'institut et la date.
Le résultat est écrit dans sondages.xml, reprenant la structure de flux.xml
pour être lu par les mêmes fonctions JavaScript.
"""

import calendar
import html
import re
import unicodedata
import xml.etree.ElementTree as ET

from datetime import datetime, timezone
from email.utils import formatdate

import requests

SONDAGES_FILE = "sondages.xml"
SONDAGES_URL = "https://www.commission-des-sondages.fr/notices/"
MAX_SONDAGES = 300
REQUEST_TIMEOUT = 30

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
)

MOIS_FR = {
    "janvier": 1,
    "fevrier": 2,
    "mars": 3,
    "avril": 4,
    "mai": 5,
    "juin": 6,
    "juillet": 7,
    "aout": 8,
    "septembre": 9,
    "octobre": 10,
    "novembre": 11,
    "decembre": 12,
}

# Du plus spécifique au plus général : "IPSOS BVA" avant "IPSOS", etc.
INSTITUTS = [
    "TOLUNA HARRIS INTERACTIVE",
    "HARRIS INTERACTIVE",
    "TOLUNA",
    "OPINIONWAY",
    "OPINION WAY",
    "CLUSTER17",
    "CLUSTER 17",
    "IPSOS BVA",
    "IPSOS",
    "IFOP",
    "ELABE",
    "ODOXA",
    "YOUGOV",
    "VERIAN",
    "SAGIS",
    "PIGE",
    "THI",
    "CSA",
]

DEFAULT_AUTHOR = "Commission des sondages"

RE_BLOCK = re.compile(
    r'<h2 class="notices-mois-titre"[^>]*>([^<]+)</h2>'
    r".*?"
    r'<div id=pannel_\d+ class="notices-elements">(.*?)</div>',
    re.S,
)

RE_LINK = re.compile(r'<a href="([^"]+)" class="pdf_download"[^>]*>(.*?)</a>', re.S)

RE_TAIL_DATE = re.compile(r"(\d{1,2})?\s*([A-Za-zéèêëàâûôç]+)?\s*$")


def clean_text(text):
    """Retire les tags restants et écrase les espaces superflus."""
    return re.sub(r"\s{2,}", " ", re.sub(r"<[^>]+>", " ", text)).strip()


def strip_accents(text):
    """Passe les lettres accentuées en version simple pour les comparaisons."""
    decomposed = unicodedata.normalize("NFD", text)
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


def month_number(word):
    return MOIS_FR.get(strip_accents(word or "").lower())


def detect_institute(title):
    """Retrouve l'institut de sondage dans le libellé de la notice."""
    upper = strip_accents(title).upper()
    for name in INSTITUTS:
        if strip_accents(name).upper() in upper:
            return name
    return DEFAULT_AUTHOR


def parse_notice_date(title, month_label):
    """Jour lu dans le libellé, mois et année lus dans le panneau mensuel.
    Sans jour exploitable, le 1er du mois sert de repère de tri."""
    year_match = re.search(r"(20\d{2})", month_label)
    year = int(year_match.group(1)) if year_match else datetime.now().year

    label_words = month_label.split()
    month = month_number(label_words[0]) if label_words else None
    day = 1

    tail = RE_TAIL_DATE.search(title)
    if tail:
        if tail.group(1):
            day = int(tail.group(1))
        if tail.group(2) and month_number(tail.group(2)):
            month = month_number(tail.group(2))

    if not month:
        month = datetime.now().month

    month = min(max(month, 1), 12)
    day = min(day, calendar.monthrange(year, month)[1])

    return datetime(year, month, day, tzinfo=timezone.utc)


def build_item(notice_id, title, label, link, published, author):
    """Entree au format de celles de flux.xml."""
    return {
        "title": title,
        "link": link,
        "published": published,
        "author": author,
        "summary": f"Notice n° {notice_id} — {label}",
    }


def fetch_sondages():
    """Recupere les notices du site de la Commission des sondages."""
    try:
        response = requests.get(
            SONDAGES_URL,
            headers={"User-Agent": USER_AGENT},
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        response.encoding = "utf-8"
    except Exception as e:
        print(f"Erreur lors de la récupération des sondages : {e}")
        return []

    notices = []
    seen = set()

    for month_label, body in RE_BLOCK.findall(response.text):
        label = clean_text(html.unescape(month_label))
        if not label:
            continue

        for href, raw_title in RE_LINK.findall(body):
            title = clean_text(html.unescape(raw_title))
            if not title:
                continue

            link = "https://www.commission-des-sondages.fr" + href
            if link in seen:
                continue
            seen.add(link)

            parts = title.split(" ", 1)
            notice_id = parts[0]
            short_title = parts[1] if len(parts) > 1 else title
            moment = parse_notice_date(title, label)

            notices.append(
                build_item(
                    notice_id=notice_id,
                    title=short_title,
                    label=label,
                    link=link,
                    published=formatdate(moment.timestamp(), usegmt=True),
                    author=detect_institute(title),
                )
            )

    return notices[:MAX_SONDAGES]


def update_sondages():
    """Ecrit sondages.xml ; conserve le fichier precedent si le site est hors ligne."""
    notices = fetch_sondages()

    if not notices:
        print("Aucune notice récupérée, sondages.xml inchangé")
        return 0

    rss = ET.Element("rss", version="2.0")
    channel = ET.SubElement(rss, "channel")

    ET.SubElement(channel, "title").text = "Veille médiatique politique — sondages"
    ET.SubElement(channel, "description").text = (
        "Notices publiées par la Commission des sondages"
    )
    ET.SubElement(channel, "link").text = SONDAGES_URL
    ET.SubElement(channel, "lastBuildDate").text = formatdate(usegmt=True)

    for notice in notices:
        item = ET.SubElement(channel, "item")
        ET.SubElement(item, "title").text = notice["title"]
        ET.SubElement(item, "link").text = notice["link"]
        ET.SubElement(item, "guid").text = notice["link"]
        ET.SubElement(item, "pubDate").text = notice["published"]
        ET.SubElement(item, "author").text = notice["author"]
        ET.SubElement(item, "description").text = notice["summary"]
        ET.SubElement(item, "channelTitle").text = notice["author"]

    tree = ET.ElementTree(rss)
    ET.indent(tree, space="  ")
    tree.write(SONDAGES_FILE, encoding="utf-8", xml_declaration=True)

    print(f"Fichier créé : {SONDAGES_FILE} ({len(notices)} entrées)")
    return len(notices)
