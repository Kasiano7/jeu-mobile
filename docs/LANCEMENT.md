# Mise en ligne — Money Machine v1.0 (MVP)

Périmètre de la v1.0 : Money Drop (5 plateaux, portes, obstacles, orbe Rush), Money Factory (8 roues, SPEED / ADD WHEEL / MULTIPLIER / RETURN), cartes, missions, niveaux, cadeau gratuit, sauvegarde automatique et gains hors ligne, PWA installable. Pas d'achat, pas de publicité, aucune donnée collectée.

## 1. Déployer sur Vercel (≈ 10 min)

1. vercel.com → **Add New… → Project** → importer `Kasiano7/jeu-mobile`.
2. Framework : **Vite** (détecté). Ne rien changer au build (`npm run build`, sortie `dist`).
3. **Environment Variables** (Production) — obligatoire pour les mentions légales :
   | Nom | Exemple |
   |---|---|
   | `VITE_LEGAL_PUBLISHER` | `Prénom Nom` (ou raison sociale + SIREN) |
   | `VITE_LEGAL_CONTACT` | `contact@ton-domaine.fr` |
   | `VITE_LEGAL_DIRECTOR` | *(facultatif, sinon l'éditeur)* |
   | `SITE_URL` | *(seulement avec un domaine personnalisé)* `https://ton-domaine.fr` |
4. **Deploy**. La branche `claude/stoic-ritchie-91qajq` contient la v1.0. Le plus simple est de la fusionner dans `main` puis de déployer `main`. Sinon : Settings → Git → **Production Branch** = `claude/stoic-ritchie-91qajq`.
5. Après un changement de variable : **Redeploy** (les variables sont lues au build).
6. **Mesure d'audience** : projet Vercel → onglet **Analytics** → **Enable**, puis redéployer. Sans cette activation, le jeu fonctionne normalement mais rien n'est compté.

Vérifier en 1 minute sur l'URL de production :
- Réglages → Mentions légales affiche bien l'éditeur.
- Coller l'URL dans WhatsApp ou Discord : l'aperçu avec l'image apparaît.
- `https://…/sw.js` répond (mode hors ligne actif).
- Onglet Analytics de Vercel : ta visite apparaît (en général en moins d'une minute).

## 2. Test sur téléphone (≈ 20 min, iPhone + Android)

| # | Vérifier | OK |
|---|---|:-:|
| 1 | Le jeu s'ouvre en moins de 3 s, écran de chargement puis plateau | ☐ |
| 2 | Les pièces tombent, rebondissent, ne restent jamais collées aux bords | ☐ |
| 3 | Les chiffres des pièces changent en passant les portes vertes/bleues | ☐ |
| 4 | Taper le plateau lâche une pièce (5 charges, pastilles en haut à gauche) | ☐ |
| 5 | Le son marche dès le premier toucher (vérifier le bouton silencieux de l'iPhone) | ☐ |
| 6 | Acheter « Valeur » : l'argent baisse, la valeur des pièces monte | ☐ |
| 7 | Maintenir un bouton d'amélioration achète en série, relâcher arrête | ☐ |
| 8 | Niveau 2 → onglet Factory → ADD WHEEL : la roue apparaît et tourne | ☐ |
| 9 | RETURN revient au plateau, l'argent continue de monter dans les deux modes | ☐ |
| 10 | Cartes : acheter un paquet, la carte s'affiche et s'équipe | ☐ |
| 11 | Missions : en réclamer une | ☐ |
| 12 | 🎁 Cadeau : argent + FRENZY, puis compte à rebours | ☐ |
| 13 | Fermer l'appli 2 min, rouvrir : « Bon retour ! » avec des gains | ☐ |
| 14 | Recharger la page : la progression est intacte | ☐ |
| 15 | Rien n'est caché par l'encoche ni par la barre du bas (iPhone) | ☐ |
| 16 | Téléphone en paysage : message « Tourne ton téléphone » | ☐ |
| 17 | Partager → « Sur l'écran d'accueil » : l'appli s'ouvre en plein écran | ☐ |
| 18 | Fluide après 5 min de jeu (pas de saccade, téléphone pas brûlant) | ☐ |

Si un point échoue : noter le modèle de téléphone, la version d'iOS/Android, ce qui s'est passé, et si possible faire une capture ou une vidéo d'écran.

## 3. En cas de problème après la sortie

- **Revenir en arrière** : Vercel → Deployments → ancien déploiement → **Promote to Production** (instantané).
- Les joueurs reçoivent la nouvelle version au chargement suivant (service worker en mise à jour automatique). La sauvegarde est conservée.
- **Ne pas renommer** la clé de sauvegarde `money-machine.save.v1` : toutes les parties seraient perdues.

## 4. Après la sortie (non bloquant)

Suivi des erreurs JavaScript (par ex. Sentry), mini-tutoriel usine et cartes, export de sauvegarde, prestige. Voir `docs/AUDIT.md`.

## 5. Ce que mesure l'analytics

Vercel Web Analytics, sans cookie et anonyme : pages vues, provenance (dont TikTok, via le référent), pays, appareil.
Étapes de jeu envoyées : `first_upgrade`, `level_reached` (niveaux 2, 5, 10, 15, 20, 30), `factory_opened`, `first_wheel`, `board_unlocked`, `gift_claimed`, `app_installed`.
Les pages vues sont incluses dans l'offre gratuite. Les **événements personnalisés** (les étapes ci-dessus) ne s'affichent qu'avec une offre Vercel qui les inclut. Sinon ils sont ignorés, sans effet sur le jeu.
Astuce TikTok : mets dans la bio un lien avec `?utm_source=tiktok` pour isoler ce trafic dans Analytics.
