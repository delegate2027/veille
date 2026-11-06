# AGENTS.md

## Projet

Application web statique de veille médiatique politique. Le navigateur affiche un flux RSS agrégé généré côté Python à partir de flux YouTube.

## Structure

- `index.html` : structure de la page.
- `style.css` : styles responsifs et thème sombre.
- `script.js` : chargement, filtrage, rendu et actualisation du flux.
- `timeline.js` et `timeline.css` : frise de la vue Archives (colonnes par jour, semaine, mois ou année, empilées par famille) et liste des résultats ; `archives.js` leur confie le rendu. La date de départ des archives est `ARCHIVE_START` dans `archives.js`.
- `rss.py` : agrégation des flux et génération de `flux.xml` et `archives.xml`.
- `flux.xml` et `archives.xml` : fichiers générés, suivis dans `main` car GitHub Pages les sert. Ne jamais les modifier, les supprimer ni les retirer du suivi Git à la main.
- `requirements.txt` : dépendances Python.

## Commandes

Installer les dépendances :

```powershell
python -m pip install -r requirements.txt
```

Régénérer le flux depuis la racine du projet :

```powershell
python rss.py
```

Le projet ne contient ni build front-end ni tests, lint ou formatage automatisé.

**Ne pas** exécuter `rss.py` pour régénérer `flux.xml` et `archives.xml` en local, sauf demande explicite.

## Conventions

- Garder l’interface et les messages utilisateur en français.
- Maintenir la compatibilité JavaScript avec les anciens navigateurs : syntaxe ES5, déclaration avec `var`, aucune étape de compilation.
- Préserver la présentation statique simple et le thème sombre définis dans `style.css`.
- Utiliser quatre espaces en Python et des noms de fonctions/variables en `snake_case`.
- Exécuter les scripts Python depuis la racine car ils utilisent des chemins relatifs.
- Mettre à jour `requirements.txt` pour toute nouvelle dépendance Python.
- Ne **jamais** committer de fichiers ou dossiers superflus : uniquement les sources du projet. Exclure les dossiers d'outillage et de configuration d'agents (`.kilo/`, `.opencode/`, `.vscode/`, `.idea/`), les caches (`__pycache__/`, `.pytest_cache/`) et les autres artefacts générés, sauf `flux.xml` et `archives.xml` qui sont requis par le site.
- Ne **jamais** toucher à `flux.xml` ni `archives.xml` sur le dépôt : ne pas les modifier, les supprimer, les retirer du suivi (`git rm --cached`), les remplacer par une branche orpheline ni les pousser manuellement. Ils sont requis dans `main` pour GitHub Pages et sont régénérés uniquement par `rss.py` et le workflow `update-rss`. Toute suppression ou réécriture manuelle casse le site.
- Ne pas régénérer `flux.xml` ni `archives.xml` en local après une modification des sources ou des flux, sauf demande explicite.

## Ajouter une chaîne YouTube

1. Extraire l'identifiant `channel_id` de l'URL `https://www.youtube.com/channel/<channel_id>`.
2. Ajouter le flux `https://www.youtube.com/feeds/videos.xml?channel_id=<channel_id>` dans le groupe correspondant du dictionnaire `FEEDS` de `rss.py`.
3. Si le nom de la chaîne (le champ `<author>`) n'est pas déjà reconnu par `sourceClass` dans `script.js`, ajouter le nom au groupe correspondant pour lui attribuer la bonne couleur.
4. Ne pas régénérer `flux.xml` ni `archives.xml` en local, sauf demande explicite.
5. Committer uniquement les fichiers sources (`rss.py`, `script.js`, `AGENTS.md`). Ne jamais modifier, supprimer ni retirer du suivi `flux.xml` et `archives.xml` : ils sont gérés par `rss.py` et le workflow `update-rss`.
