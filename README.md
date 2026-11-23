# Mon Plan Santé

Application PWA (installable sur iPhone, fonctionne hors ligne) : https://oucothmane.github.io/mon-plan-sante/

## Où trouver les données (fichiers JSON)

Toute la configuration et les données du plan sont centralisées dans des fichiers JSON dédiés (lus par l'application) :

- **[plan-rules.json](plan-rules.json)** — Règles, cibles par défaut (`2 200 / 2 000` en Cut · `2 400 / 2 200` en Maintien), plancher strict (`2 000 kcal`), macros (`165 g` prot max · `1,0 / 1,2 g/kg` lipides ON/OFF), plafonds aliments et cardio.
- **[foods.json](foods.json)** — Base des aliments et valeurs nutritionnelles **pour 100 g** (`kcal`, `P`, `G`, `L`, `Fibres`), exportable depuis *Réglages → Valeurs des aliments*.
- **[meals.json](meals.json)** — Les **6 repas** du régime (3 repas Jour ON + 3 repas Jour OFF) en Cut et Maintien, sans riz.
- **[courses.json](courses.json)** — Liste de courses complète sur 8 jours (`4 ON + 4 OFF`), sans riz.
- **[split.json](split.json)** — Programme d'entraînement Full Body 4 séances sur 8 jours (`J1`–`J8`, 1 ON / 1 OFF), exercices, RIR et deload.

## Règles de mise à jour (workflow & invariants)

- **Workflow choisi** : toutes les modifications durables des cibles, macros, aliments, repas, cardio ou charges se font **directement dans ces 5 fichiers JSON** avec l'assistant puis par commit sur `main` (pas d'écriture automatique vers GitHub depuis l'interface de l'app).
- **Zéro valeur en dur dans le code** : [`app.js`](app.js), [`nutritionEngine.js`](nutritionEngine.js) et [`index.html`](index.html) doivent toujours lire toutes les règles, cibles, plafonds, fibres, swaps protéines, cardio et règles d'entraînement depuis les 5 JSON.
- **Zéro riz** nulle part dans le dépôt (féculents de base : pâtes complètes crues + patate douce crue).
- **Après modification** : vérifier avec `node --check app.js && node --check nutritionEngine.js && node --check sw.js && node nutritionEngine.test.js`. Garder `README.md` comme seul fichier Markdown du dépôt, et incrémenter `CACHE` dans [`sw.js`](sw.js) dès qu'un fichier de code change.

