# 📺 Veille médiatique politique

Un agrégateur de flux RSS YouTube regroupant les vidéos des principales formations et personnalités politiques françaises, avec mise à jour automatique via GitHub Actions

---

## Structure du projet

```
.
├── rss.py                         # Script Python d'agrégation RSS
├── flux.xml                       # Flux agrégé généré automatiquement
├── index.html                     # Page web principale
├── script.js                      # Rendu des vidéos côté client
├── style.css                      # Styles de la page
├── requirements.txt               # Dépendances Python (feedparser)
├── meetings.xml                   # (optionnel) Événements locaux manuels
├── favicon/                       # Icônes du site
└── .github/workflows/
    └── update-rss.yml             # Workflow GitHub Actions de mise à jour
```
