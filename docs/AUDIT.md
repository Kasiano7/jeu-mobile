# Audit avant mise en ligne — Money Machine

Date : 28/10/2026 · Version auditée : branche `claude/stoic-ritchie-91qajq` · Méthode : relecture du code (dont une relecture indépendante), tests unitaires, tests Playwright sur viewport iPhone 13 / iPhone SE / paysage, test de charge, simulation physique accélérée, Lighthouse 13.6 (profil mobile) sur le build de production.

> Limite : le conteneur de test fait le rendu en logiciel (SwiftShader). Les mesures de fluidité sont des **ordres de grandeur relatifs** ; aucun test n'a été fait sur un vrai téléphone.

## Note globale : 8,0 / 10 — prêt pour une bêta publique

Le cœur du jeu est solide et les défauts bloquants trouvés pendant l'audit sont corrigés. Il reste trois actions avant une mise en ligne publique, toutes hors code ou presque :
1. **Tester sur de vrais téléphones** (un iPhone récent, un Android d'entrée de gamme) : fluidité, son, encoche, installation sur l'écran d'accueil.
2. **Ajouter des mentions légales** (obligatoires en France pour un site public, loi LCEN) avec l'identité de l'éditeur.
3. **Brancher une mesure d'audience** sans cookie, sinon impossible de savoir ce que rapporte la vidéo TikTok.

## Tableau des notes

| # | Domaine | Avant | Après | Commentaire |
|---|---|:-:|:-:|---|
| 1 | Stabilité de la physique (pièces coincées) | 3 | **9** | 8 % des pièces coincées → 0 sur 4 configurations |
| 2 | Robustesse, sauvegarde, gains hors ligne | 6 | **8,5** | 6 défauts corrigés, reste le risque d'effacement Safari |
| 3 | Fiabilité des interactions (tactile, boutons) | 5 | **9** | achats fantômes via l'usine cachée corrigés |
| 4 | Performance | 6 | **8** | rendu en double supprimé : ~5× moins de calcul par image |
| 5 | Gameplay et sensations | 8 | **8** | riche et lisible ; manque un tutoriel et une musique |
| 6 | Économie et progression | 7 | **7,5** | calibrée sur le vrai plateau, à valider avec des joueurs |
| 7 | Mobile et responsive | 7,5 | **8,5** | petits écrans, encoche, paysage géré |
| 8 | PWA et hors ligne | 9 | **9** | installable, fonctionne sans réseau |
| 9 | SEO et partage social | 5 | **9,5** | image de partage, balises Open Graph, robots.txt |
| 10 | Accessibilité | 7 | **8** | zoom réactivé, animations réduites selon le système |
| 11 | Sécurité | 7 | **9** | en-têtes de sécurité, crochets de debug masqués |
| 12 | Légal et conformité | 5 | **5,5** | RGPD OK (aucune donnée), mentions légales absentes |
| 13 | Mesure d'audience et suivi des erreurs | 1 | **6** | Vercel Web Analytics sans cookie ; pas encore de suivi des erreurs |
| 14 | Qualité du code et tests | 7 | **8,5** | 22 tests, CI GitHub ajoutée |

Lighthouse mobile (build de production, avant → après) : Performance 60 → **66** · Accessibilité 92 → **100** · Bonnes pratiques 100 → **100** · SEO 91 → **100**.

---

## 1. Stabilité de la physique — 9/10 (avant 3/10)

**Problème signalé confirmé et corrigé.** Simulation accélérée de 15 min de jeu sur le vrai moteur :

| Mesure | Avant | Après |
|---|---|---|
| Pièces forcées après > 15 s bloquées | 441 / 5 361 (8,2 %) | **0 / 5 376** |
| Arrêts > 0,6 s | 10 190 | 47 |
| Âge maximal d'une pièce en jeu | 35 s | 4,3 s |

- **Cause** : les picots en bout des rangées paires étaient à 51 px du mur, moins qu'un diamètre de pièce (88 px). Sans frottement, la pièce coincée entre mur et picot restait en équilibre stable.
- **Correctif** : ces picots sont remplacés par des butées demi-rondes fixées au mur, qui renvoient toujours la pièce vers le centre. Le « coup de pouce » anti-blocage pousse désormais vers le centre (avant : direction aléatoire, parfois vers le mur). La sécurité ultime passe de 40 à 20 s.
- **Vérifié aussi** : plateaux 2, 3 et 5, avec bumpers, hélices et porte Split, à cadence max, sur écran court (iPhone SE) et écran haut. 0 pièce forcée partout.

## 2. Robustesse et sauvegarde — 8,5/10 (avant 6/10)

Corrigé :
- Gains hors ligne **perdus** si on quittait l'appli avant de toucher « Collecter » (remplacés par un montant plus petit ou effacés). Ils sont maintenant cumulés, plafonnés et sauvegardés immédiatement. Le même temps d'absence ne peut plus être payé deux fois.
- Gains hors ligne, missions et cadeau calculés sur un revenu **gonflé par les boosts** (jusqu'à ×4) : ils utilisent maintenant le revenu sans boost.
- Paquet de cartes **payé sans rien recevoir** une fois la collection complète : le bouton affiche « Collection complète ».
- Sauvegarde corrompue (`1eNaN`, `Infinity`, niveaux énormes) : une valeur NaN rendait tous les achats gratuits, et 10 000 générateurs figeaient le jeu. Les valeurs sont maintenant rejetées et les niveaux bornés à leur maximum réel.
- Écouteurs non retirés à la destruction du jeu.

Reste :
- **Safari efface le stockage d'un site non visité pendant 7 jours** (hors appli installée). Le jeu demande un stockage persistant et invite à l'ajouter à l'écran d'accueil, mais rien n'est garanti. Piste : export/import d'un code de sauvegarde, ou sauvegarde en ligne plus tard.
- La sauvegarde est modifiable par le joueur (localStorage). C'est sans importance tant qu'il n'y a pas de classement.

## 3. Fiabilité des interactions — 9/10 (avant 5/10)

Corrigé (défauts **graves**, trouvés par la relecture indépendante et confirmés en navigateur) :
- Au lancement, la scène Usine restait **visible et cliquable sous le plateau**. Taper le plateau pouvait acheter une roue, ouvrir sa fiche ou afficher « Il faut $X », même usine verrouillée. Elle était aussi dessinée pour rien à chaque image.
- Les taps sur les fenêtres React (fermer une fiche, « Collecter », etc.) **traversaient vers les roues** de l'usine en dessous.
- Un appui à deux doigts sur un bouton « maintenir pour acheter » pouvait laisser une boucle d'achat tourner seule.
- Son iOS : le déverrouillage ne se faisait qu'au premier `pointerdown`, qu'iOS ne considère pas comme un geste. Le jeu réessaie maintenant à chaque geste jusqu'à ce que le son marche, et le relance au retour de l'appli.
- Vibration déclenchée hors geste (orbe attrapé par une pièce) : bloquée par le navigateur et signalée comme erreur. Elle est maintenant réservée aux actions du joueur.
- Le texte du cadeau annonçait 30 s de FRENZY pour 20 s réelles.

## 4. Performance — 8/10

- Chargement (Lighthouse simule une 4G lente et un processeur 4× plus lent) : premier affichage **0,8 s** grâce au nouvel écran de chargement, jeu complet affiché en **2,8 s**, aucun décalage de mise en page (CLS 0). 485 Ko transférés, dont Phaser ~330 Ko gzip.
- Animation (test de charge, production maximale) : **2,1 ms de calcul par image** après correctif (9 à 14 ms avant), mémoire 45 Mo (68 à 92 Mo avant). Le débit physique est plafonné à 6 pièces/s, 29 pièces simultanées au maximum.
- Le score Lighthouse « Performance 60 » vient du **Temps de blocage total** : la boucle de jeu tourne en continu sous un processeur simulé 4× plus lent. C'est normal pour un jeu et ça ne gêne pas le chargement.
- Pistes : Phaser personnalisé (sans les modules inutilisés, environ −40 %), désactiver la scène cachée sur les téléphones lents, détection automatique d'un appareil lent → animations réduites.

## 5. Gameplay et sensations — 8/10

Points forts :
- Vraie physique.
- Valeurs qui changent à vue à chaque porte.
- Usine mécanique synchronisée.
- Retours visuels et sonores à chaque gain.
- Lâcher manuel limité, donc actif sans être obligatoire.

À améliorer :
- Pas de tutoriel au-delà de « Touche le plateau » : l'usine et les cartes ne sont jamais expliquées.
- Pas de musique d'ambiance.
- Pas de prestige : après environ 8 h, il n'y a plus d'objectif nouveau.
- L'orbe doré est parfois masqué par la bulle d'aide au tout début.

## 6. Économie et progression — 7,5/10

- La valeur réelle des pièces est **mesurée sur le vrai plateau** (portes, bacs) et injectée dans la simulation d'économie. Rythme d'un joueur optimal : 2ᵉ plateau à ~21 min, 3ᵉ à ~1 h 10, 4ᵉ à ~3 h 15.
- Risques :
  - Rythme jamais validé avec de vrais joueurs.
  - Phases d'attente possibles avant les gros achats de plateau (la simulation montre 20 à 45 min d'économie).
  - Le joueur ne voit pas « combien de temps avant le prochain plateau ».
- Recommandation : afficher un temps estimé sur le bouton du plateau suivant, et faire jouer 5 personnes pendant 30 min avant le lancement.

## 7. Mobile et responsive — 8,5/10

- Encoche et barre d'accueil iOS respectées, hauteur `100dvh`, plateau qui s'adapte à la hauteur d'écran. Vérifié sur iPhone 13 (390×844), iPhone SE (667 px de haut) et bureau.
- **Ajouté** : écran « Tourne ton téléphone » en paysage (avant, le plateau devenait minuscule).
- Reste : la vibration n'existe pas sur iPhone (limite de Safari). Quelques textes font 9 à 11 px (sous-titres des boutons, badges), à vérifier à l'œil sur petit écran.

## 8. PWA et hors ligne — 9/10

- Manifeste, icônes (dont masquable), service worker vérifié actif, jeu jouable sans réseau, polices auto-hébergées.
- Reste : aucune explication dans le jeu pour l'installer sur iPhone (Partager → « Sur l'écran d'accueil »). C'est pourtant ce qui protège la sauvegarde.

## 9. SEO et partage social — 9,5/10 (avant 5/10)

- **Ajouté** :
  - image de partage 1200×630 (`public/og-image.png`, faite de vraies captures du jeu), balises Open Graph et Twitter ;
  - `robots.txt`, titre plus explicite et `<noscript>`.
- Sans ces balises, le lien partagé depuis TikTok, WhatsApp ou Discord n'affichait aucun aperçu.
- **À faire au déploiement** : l'adresse absolue de l'image est remplie automatiquement sur Vercel. Pour un domaine personnalisé, définir `SITE_URL=https://ton-domaine` dans les variables d'environnement Vercel.

## 10. Accessibilité — 8/10

- Lighthouse 100. Zoom à deux doigts réactivé (il était bloqué). Préférence système « réduire les animations » respectée dès la première partie. Libellés présents sur les boutons-icônes. Option sons et vibrations.
- Limite inhérente : le plateau est un canvas, illisible par un lecteur d'écran. L'information est en partie doublée par l'interface React (argent, revenu, prix).

## 11. Sécurité — 9/10

- Aucun serveur, aucune donnée transmise.
- **Ajouté** : en-têtes Vercel
  - `Content-Security-Policy` stricte, testée sans aucun blocage ;
  - `X-Frame-Options`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`, `nosniff`.
- **Ajouté** : les crochets de test `window.__MM__` (accès complet au jeu depuis la console) ne sont plus exposés en production, sauf avec `?debug` dans l'URL.
- `npm audit` : **0 vulnérabilité** dans ce qui est publié. Les 7 alertes concernent uniquement les outils de dev (vitest, workbox-build) ; à mettre à jour plus tard.

## 12. Légal et conformité — 5,5/10

- RGPD : aucun cookie, aucun traceur, sauvegarde uniquement locale. **Pas de bandeau cookies nécessaire**. Une mention de confidentialité est ajoutée dans Réglages.
- Pas d'argent réel ni de publicité : aucun risque lié aux jeux d'argent ni aux achats intégrés.
- **Mentions légales** : page ajoutée en v1.0 (Réglages → Mentions légales), avec l'hébergeur et la politique de données. L'identité de l'éditeur vient des variables `VITE_LEGAL_PUBLISHER` et `VITE_LEGAL_CONTACT`, à renseigner dans Vercel ; le build affiche un avertissement tant qu'elles manquent.
- **À vérifier** :
  - disponibilité du nom « Money Machine » (INPI, stores, autres jeux du même nom) ;
  - pour la vidéo TikTok, ne pas montrer le jeu de référence d'une manière qui laisserait croire à un lien officiel.
- Les graphismes et sons sont générés par le code, donc pas de problème de droits sur les visuels.

## 13. Mesure d'audience et suivi des erreurs — 6/10 (avant 1/10)

- **Ajouté (v1.0)** : Vercel Web Analytics, sans cookie, chargé depuis le même domaine. Il reste compatible avec la CSP et ne demande pas de bandeau.
  - Mesure : pages vues, provenance, appareil et 7 étapes du parcours (première amélioration, niveaux, usine, première roue, plateaux, cadeau, installation).
  - Les paramètres d'URL ne sont jamais transmis.
  - Testé sur le build de production : aucune erreur.
  - À activer dans l'onglet Analytics du projet Vercel.
- Mention de confidentialité mise à jour en conséquence.
- Reste : pas de suivi des erreurs JavaScript (plantages sur certains téléphones invisibles).

## 14. Qualité du code et tests — 8,5/10

- **22 tests unitaires**, dont 5 ajoutés lors de cet audit : cumul hors ligne, boosts exclus, collection complète, usine verrouillée, sauvegarde corrompue.
- Scripts Playwright : `smoke` (parcours complet), `stress` (charge maximale).
- **Ajouté** : intégration continue GitHub Actions (tests et build à chaque push).
- Reste : les tests navigateur ne tournent pas en CI, et le code des scènes Phaser n'a pas de tests automatisés propres (la simulation accélérée de blocage peut le devenir).

---

## Plan d'action avant lancement

| Priorité | Action | Qui | Effort |
|---|---|---|---|
| 🔴 Bloquant | Test sur un vrai iPhone et un Android bas de gamme (son, fluidité, encoche, installation) | toi | 30 min |
| 🔴 Bloquant | Mentions légales : page intégrée (v1.0), il reste à renseigner `VITE_LEGAL_PUBLISHER` et `VITE_LEGAL_CONTACT` dans Vercel | toi | 5 min |
| ✅ Fait (v1.0) | Mesure d'audience sans cookie (à activer dans l'onglet Analytics de Vercel) | — | — |
| 🟠 Important | Suivi des erreurs JavaScript | à décider | 30 min |
| 🟠 Important | Faire jouer 5 personnes 30 min, ajuster le rythme | toi | 1 jour |
| ✅ Fait (v1.0) | Aide à l'installation (bouton Android, instructions iPhone) | — | — |
| 🟡 Conseillé | Mini-tutoriel usine et cartes | dev | 2 h |
| ✅ Fait (v1.0) | Temps estimé avant le prochain plateau | — | — |
| 🟡 Conseillé | Export/import de sauvegarde | dev | 1 h |
| ⚪ Plus tard | Prestige, musique, Phaser allégé, tests navigateur en CI | dev | — |
