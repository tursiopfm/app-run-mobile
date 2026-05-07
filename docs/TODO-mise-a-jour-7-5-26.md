# TODO — Mise à jour Trail Cockpit — 7 mai 2026

## 🏃 Onglet Activités — Liste

- [x] Au clic sur le niveau d'effort dans la liste, ouvrir un popup expliquant la valeur "comme à un enfant de 10 ans"
- [x] Au clic sur l'emoji intensité dans la liste, ouvrir un popup avec tous les emoji intensité et leurs descriptions
- [x] Ajouter un filtre par type d'intensité entre les filtres "activité" et "date"
- [x] Mettre le titre des activités en blanc en thème sombre, en noir en thème clair
- [x] Centrer verticalement dans leur bloc la valeur du niveau d'effort et l'emoji intensité
- [x] Conserver la recherche/filtre actif lors du retour depuis le détail d'une activité (corriger la perte d'état)

## 🏃 Onglet Activités — Détail d'une activité

- [x] Ajouter une poignée en bas de la carte permettant de la descendre pour afficher la carte quasi en plein écran
- [x] Refondre les icônes "flèche retour" et "crayon" : design plus soigné, intégré au reste de l'UI
- [x] Ajouter un onglet "STATS" à droite de "Split" et "Zone FC" (regroupant toutes les stats Strava par catégorie)
- [x] Au clic sur l'effort dans l'activité → popup d'explication "comme à un enfant de 10 ans"
- [x] Au clic sur l'emoji intensité → popup identique (description des emoji)
- [x] Diagnostiquer pourquoi la valeur calories est vide dans une activité

> **Note calories** : Cause identifiée — l'endpoint liste Strava (`GET /athlete/activities`) n'inclut pas les calories, uniquement l'endpoint de détail (`GET /activities/{id}`). Fix appliqué : lors du fetch de détail (pour les splits), le champ `calories` est maintenant mis à jour en DB si absent. Les activités se mettront à jour au prochain accès à leur détail.

## 👤 Page Profil utilisateur (nouvelle)

- [x] Au clic sur les "…" en haut de la page (Settings), ouvrir une page Profil utilisateur contenant :
  - Le bloc "Profil athlète" actuellement dans Réglages
  - Les différents modes de calcul des zones FC (Seuils physiologiques, Test terrain 30min, Réserve FC/Karvonen, % FC max, Estimation automatique, Personnalisé)

## 🎯 Onglet Cockpit — Bloc Objectif

- [x] Pour la distance annuelle, indiquer le nombre de km en avance ou en retard par rapport à l'objectif
- [x] Renommer les graphiques : "Km semaine", "D+ semaine", "Km année"
- [x] Remplacer la roue dentée (⚙️) par les "…" verticaux (cohérence avec les autres blocs)

## 🎨 Onglet Cockpit — Couleurs & icônes

- [x] Couleur de l'intitulé du sport dans les blocs : Course à pied → orange (déjà OK), Vélo → vert, Natation → bleu
- [x] Remplacer l'emoji ⚡ des activités "Toutes" par 🌎

## 📊 Onglet Cockpit — Autres blocs

- [x] Bloc "Cumul km par mois" : afficher l'étiquette de la dernière valeur de chaque mois ; pour le mois en cours, afficher la valeur du jour
- [x] Bloc "Semaine en cours" : corriger les labels manquants en vue RUN (présents dans ALL, absents dans RUN)

## ⚙️ Onglet Réglages

- [x] Implémenter les boutons langue non fonctionnels : persistance localStorage + bouton "Système" détecte la langue du navigateur
- [x] Retirer le bloc "Préférences cockpit"

---

---

*Généré le 7 mai 2026 — Trail Cockpit PWA*
