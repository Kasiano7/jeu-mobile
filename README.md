# Money Machine — jeu idle mobile (Money Drop + Money Factory)

Jeu web mobile premium, jouable immédiatement, installable en PWA, prêt pour Vercel et une future adaptation Capacitor.
Deux machines partagent le même argent :

- **Money Drop** : plateau vertical façon Plinko, vraie physique 2D Matter.js (gravité, rebonds, collisions pièce-pièce et pièce-obstacle), portes bonus `+N` / `×N` qui modifient la valeur affichée sur chaque pièce au moment du passage, bumpers, hélices, porte Split, bacs multiplicateurs en bas.
- **Money Factory** : convoyeur en boucle, roues achetables reliées par bielles d'accouplement et courroies, presses entraînées par système bielle-manivelle, liasses multipliées à chaque station, coffre de collecte.

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # tests unitaires (économie, sauvegarde, formats)
npm run build      # typecheck + build de production + service worker
```

## 1. Analyse des références et hypothèses

Les trois captures citées (`references/`) **n'étaient pas présentes dans le dépôt** au moment de l'implémentation. Le jeu a donc été construit à partir de la description du brief, avec ces hypothèses :

| Élément du brief | Mécanique retenue |
| --- | --- |
| Générateur en haut | 1 à 5 « droppers » qui se déplacent sur un rail et lâchent des pièces à intervalle régulier. Toucher le plateau lâche aussi une pièce (jeu actif). |
| Bonus fixes / multiplicateurs | Portes-capteurs traversables : `+N` (proportionnel à la valeur de base) et `×1.2 / ×1.5 / ×2 / ×3`. Chaque porte agit **une fois par pièce**. Certaines portes oscillent. |
| Bonus temporaires | Orbe doré (apparaît toutes les ~60 s, se déclenche si une pièce le touche ou si on le tape) → **RUSH ×2** sur le Drop pendant 15 s. Cadeau gratuit toutes les 4 min → 45 s de revenu + **FRENZY ×2** sur tout pendant 20 s (vraie récompense, aucune publicité simulée). |
| Bonus spéciaux de progression | Obstacles débloquables : bumpers (+valeur au contact), hélices rotatives (×1.25), porte Split (duplique la pièce). Pièces chanceuses ×5 dès le 2ᵉ plateau, bac Jackpot dès le 3ᵉ. |
| Compartiments inférieurs | 7 bacs à multiplicateurs (bords élevés, centre faible ; jackpot central étroit sur les plateaux avancés). La valeur créditée est `valeur de la pièce × multiplicateur du bac × boosts`, c'est donc le parcours qui décide du gain. |
| Grille de cartes (capture 1) | 3 à 6 emplacements de cartes, 10 cartes (4 raretés), paquets achetables, doublons = montée de niveau. Une carte n'agit que si elle est équipée. |
| Niveaux | 5 plateaux (Copper Falls → Diamond Sky) avec disposition, palette et multiplicateur permanent propres. |
| Factory | Boutons SPEED, ADD WHEEL (devient EXPAND quand les emplacements sont pleins), MULTIPLIER, RETURN. 8 emplacements de roues (4 au départ, +2 par agrandissement). Toucher une roue ouvre son amélioration. |

## 2. Architecture

```
src/
  core/            Agent D — économie, sauvegarde (aucune dépendance à Phaser/React)
    types.ts       contrats TypeScript partagés (GameState, DropStats, FactoryStats, événements)
    bignum.ts      break_infinity.js + formatage 1K / 1M / 1B / 1T … aa, ab
    config.ts      toutes les valeurs de design : coûts, plateaux, cartes, missions
    stats.ts       statistiques dérivées (pures, testées)
    store.ts       état + actions (acheter, créditer, cartes, missions, hors ligne, autosave)
    save.ts        (dé)sérialisation validée + adaptateur de stockage (localStorage aujourd'hui, Capacitor Preferences demain)
  game/
    drop/          Agent A — DropScene (Matter.js, pas fixe 60 Hz) + layout déterministe du plateau
    factory/       Agent B — FactoryScene (cinématique déterministe) + géométrie du convoyeur
    shared/        textures procédurales, police bitmap générée, FX, synthé WebAudio
    index.ts       création du jeu Phaser, bascule de mode, redimensionnement
  ui/              Agent C — HUD, panneaux, feuilles modales, célébrations (React)
tests/             tests Vitest du cœur
scripts/           smoke test navigateur, test de charge, simulation d'économie, génération d'icônes
```

Règles d'intégration :

- Les scènes ne modifient jamais l'état directement : elles lisent `store.dropStats` / `store.factoryStats` et appellent des actions (`store.earn`, `store.recordGateHit`…).
- `store.earn()` renvoie le montant réellement crédité après boosts : le texte flottant affiche toujours la vraie valeur. Le revenu « /s » du HUD est **mesuré** sur les crédits réels des 5 dernières secondes, ce n'est pas un compteur théorique.
- Les deux scènes tournent en permanence. Celle qui est cachée continue de simuler (sans rendu ni effets), donc les deux machines produisent vraiment en même temps.
- React se rafraîchit au plus ~12 fois par seconde (notifications regroupées), Phaser rend à 60 i/s.

## 3. Économie

- Coûts géométriques `base × croissance^niveau`. Les effets sont surtout **linéaires**, avec un ×2 tous les 25 niveaux, pour que le temps d'amortissement augmente : progression rapide au début, plus lente ensuite.
- **Calibration sur le vrai plateau** : la valeur moyenne d'une pièce a été mesurée en accélérant la vraie scène Matter (10 minutes simulées par plateau). On mesure la somme des portes `+N`, le produit des portes `×N` et le multiplicateur de bac moyen par pièce. Sur le premier plateau, une pièce rapporte ~4× sa valeur de base. Ces mesures alimentent `scripts/sim.ts`.
- Simulation (`npx vite-node scripts/sim.ts`, joueur optimal sans cartes ni agrandissements ; un vrai joueur ira environ 1,5 à 2× moins vite) :

  | Temps | Revenu | Étape |
  | --- | --- | --- |
  | 1 min | ~55 $/s | 1ʳᵉ amélioration à ~5 s |
  | 5 min | ~1,5 K$/s | 2ᵉ générateur à ~1 min 20 |
  | 15 min | ~15 K$/s | |
  | ~21 min | | Silver Rapids |
  | ~1 h 10 | | Golden Canyon |
  | ~3 h 15 | | Emerald Vault |
  | > 8 h | | Diamond Sky |
- Lâcher manuel limité : 5 charges, +1 toutes les 2,5 s. Taper aide sans remplacer la machine.
- Niveau joueur indexé sur les gains cumulés (×3,6 par niveau) : chaque niveau donne de l'argent (~10 s de revenu) et une carte. La Factory se débloque au niveau 2 (moins d'une minute).
- 25 missions écrites, puis des missions infinies générées automatiquement.
- Gains hors ligne : revenu mesuré × durée, plafonnés à 2 h et à 50 % d'efficacité (améliorables avec la carte Night Shift). Ils s'appliquent aussi quand l'app revient du second plan.
- Débit physique plafonné à 6 pièces/s : au-delà, chaque pièce représente un lot de pièces (valeur, bonus de portes et de bumpers multipliés d'autant). Les améliorations de cadence restent donc réellement efficaces sans saturer le plateau.
- Prestige : `state.prestige` est déjà prévu dans le modèle et la sauvegarde. Il n'y a pas encore d'interface, pour ne pas afficher de bouton sans fonction.

## 4. Qualité et tests

- `npm test` : 22 tests (formats, coûts, crédits, boosts, roues et agrandissements, niveaux, cartes, missions, cadeau, plateaux, aller-retour de sauvegarde, sauvegarde corrompue, horloge reculée, valeurs extrêmes, plafond de débit).
- `node scripts/smoke.cjs <url> <dossier>` : test Playwright sur un viewport iPhone. Il vérifie que les pièces tombent et sont créditées, les tapotements, l'achat d'améliorations, le passage en Factory, l'achat de roues, la production de liasses, les paquets de cartes, la persistance après rechargement et la modale de gains hors ligne.
- `node scripts/stress.cjs <url> 45` : production maximale (5 droppers, cadence max, tous obstacles, 8 roues) pendant 45 s. Résultat : 52 pièces simultanées au maximum, aucune erreur, mémoire stable.

## 5. Audit

Voir [`docs/AUDIT.md`](docs/AUDIT.md) : notes par domaine, corrections faites et plan d'action avant lancement.
Mise en ligne et liste de test sur téléphone : [`docs/LANCEMENT.md`](docs/LANCEMENT.md).

## 6. Mobile, PWA, déploiement

- Monde logique de 1080 unités de large (net sur un iPhone 3×). La hauteur s'adapte au ratio d'écran et le plateau se réorganise (plus de rangées sur un écran haut).
- Safe areas iOS (`viewport-fit=cover`, `env(safe-area-inset-*)`), `100dvh`, pas de zoom ni de rebond.
- PWA : manifeste, icônes, service worker Workbox (le jeu fonctionne hors ligne). Aucun asset externe : les graphismes et les sons sont générés dans le code.
- Réglages : son, vibrations, animations réduites (moins de particules, pas de tremblement de caméra), remise à zéro.
- **Vercel** : `vercel.json` (en-têtes de sécurité, cache) est fourni. Importer le dépôt (framework Vite) suffit. L'URL absolue de l'image de partage est remplie automatiquement ; pour un domaine personnalisé, définir `SITE_URL`.
- Outils de test : `?debug` dans l'URL expose `window.__MM__` (désactivé sinon en production). `node scripts/og-image.cjs` régénère l'image de partage.
- **Capacitor** : `base: './'`, aucune dépendance serveur, stockage derrière `StorageAdapter`.
