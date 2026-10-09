# AGENTS.md

## Projet

Application web statique de veille médiatique politique. Le navigateur affiche un flux RSS agrégé généré côté Python à partir de flux YouTube et, éventuellement, de `meetings.xml`.

## Structure

- `index.html` : structure de la page.
- `style.css` : styles responsifs et thème sombre.
- `script.js` : chargement, filtrage, rendu et actualisation du flux.
- `rss.py` : agrégation des flux et génération de `flux.xml`.
- `flux.xml` : fichier généré à ne pas modifier manuellement.
- `meetings.xml` : entrée facultative consumed par `rss.py` si le fichier existe.
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

## Conventions

- Garder l’interface et les messages utilisateur en français.
- Maintenir la compatibilité JavaScript avec les anciens navigateurs : syntaxe ES5, déclaration avec `var`, aucune étape de compilation.
- Préserver la présentation statique simple et le thème sombre définis dans `style.css`.
- Utiliser quatre espaces en Python et des noms de fonctions/variables en `snake_case`.
- Exécuter les scripts Python depuis la racine car ils utilisent des chemins relatifs.
- Mettre à jour `requirements.txt` pour toute nouvelle dépendance Python.
- Ne **jamais** pousser `flux.xml` et `archives.xml` : fichiers générés, exclus du commit et du push. Ils restent modifiés en local ; les écarter avec `git restore --staged` (ou `git stash push -- flux.xml archives.xml` avant un rebase/pull). Un hook `pre-push` local refuse tout push les contenant.
- Régénérer `flux.xml` avec `rss.py` après toute modification des sources ou des flux (localement seulement).

## Ajouter une chaîne YouTube

1. Extraire l'identifiant `channel_id` de l'URL `https://www.youtube.com/channel/<channel_id>`.
2. Ajouter le flux `https://www.youtube.com/feeds/videos.xml?channel_id=<channel_id>` dans le groupe correspondant du dictionnaire `FEEDS` de `rss.py`.
3. Si le nom de la chaîne (le champ `<author>`) n'est pas déjà reconnu par `sourceClass` dans `script.js`, ajouter le nom au groupe correspondant pour lui attribuer la bonne couleur.
4. Régénérer localement avec `python rss.py`.
5. Committer uniquement les fichiers sources (`rss.py`, `script.js`, `AGENTS.md`), jamais `flux.xml` ni `archives.xml`.
