# 🧭 Dashboard Geocaching Master Pro

Bienvenue sur le **Dashboard Geocaching Master Pro**. Cet outil est une interface de statistiques avancée conçue pour les passionnés de géocaching souhaitant une analyse plus fine que ce que proposent les outils standards.

L'objectif principal est de vous permettre de visualiser vos performances **avant même de loguer officiellement** vos caches (via vos brouillons) et de traquer des exploits spécifiques comme les FTF oubliés.

## 🔒 Confidentialité & Vie Privée
**La sécurité de vos données est au cœur de ce projet.**
*   **Local Only :** Tout le traitement des données est effectué **localement** dans votre navigateur.
*   **Aucun serveur :** Vos fichiers GPX, vos coordonnées personnelles et vos logs ne sont **jamais envoyés sur le web**. Ils restent sur votre ordinateur.

---

## 🚀 Fonctionnalités principales

*   **Mode Prévisionnel :** Importez vos brouillons pour visualiser vos stats en temps réel (séries, challenges, compteurs) avant de valider vos logs.
*   **Challenge 360° (Premium) :** Visualisez votre progression azimutale avec une carte sectorielle interactive et un radar polaire.
*   **Top 50 des meilleures journées :** Un classement dynamique de vos records de découvertes.
*   **Détecteur de FTF Oubliés :** Identifiez les caches où vous avez logué en premier mais où le tag `[FTF]` est absent.

---

## 📂 Préparation des données

Pour que le Dashboard soit complet, assurez-vous de charger les bons fichiers :

### 1. Caches trouvées (Historique personnel)
*   **Format :** `.gpx` (Pocket Query "My Finds").
*   **Utilisation :** Statistiques globales, Matrice D/T, Calendrier 366 jours.

### 2. Adventures Labs
*   **Format :** `.txt`.
*   **Utilisation :** Intégration des découvertes Lab Caches.
*   **Instructions :** Copiez-collez votre liste depuis Project-GC dans un fichier texte.

### 3. Brouillons (Mode Prévisionnel)
*   **Format :** `.txt` ou `.gpx`.
*   **Utilisation :** Simulation des stats avant logs officiels.

### 4. FTF Oubliés (Détecteur avancé)
*   **Format :** `.gpx` (Pocket Query de zone ou Liste).
*   **Important :** Le fichier "My Finds" ne suffit pas ici car il ne contient pas les logs des autres joueurs. Pour détecter un FTF oublié, le script doit comparer vos logs avec ceux des autres joueurs de la zone. Utilisez une **Pocket Query géographique**[cite: 8] pour avoir accès à l'historique complet des logs de la zone[cite: 10].

---

## 🛠️ Utilisation

1.  Rendez-vous sur [l'interface en ligne](https://quentinbezille.github.io/Geocaching-Statistique/).
2.  Dans le panneau de configuration, renseignez votre **Pseudo** et vos **Coordonnées de domicile** (pour calculer l'azimut du challenge 360°).
3.  Chargez vos fichiers via les boutons dédiés.
4.  Activez le **Mode Prévisionnel** pour inclure vos brouillons dans les calculs.
5.  Utilisez le raccourci clavier `F` pour replier/déplier les sections et `P` pour basculer le mode prévisionnel rapidement.

---

## 💡 Conseils pour le Challenge 360°
*   Le curseur vous permet de définir votre objectif de caches par secteur (de 1 à 15).
*   Le graphique réagit dynamiquement : 
    *   **Vert :** Objectif atteint.
    *   **Orange :** Secteur en cours.
    *   **Rouge :** Secteur vide.

---

*Projet développé par Quentin Bezille. Les données géocaching sont la propriété de Groundspeak Inc.*
