# Cahier des charges — Camions Dubois Production Manager

> **Comment utiliser ce fichier :**
> Modifie les sections directement sur GitHub (bouton ✏️), puis dis-le à Claude pour qu'il implémente les changements.
> Pour ajouter une feature : décris-la sous la bonne section.
> Pour modifier : change le texte existant.
> Pour supprimer : efface la ligne ou écris `[SUPPRIMER]` devant.

> 📂 **Modules en cours de spécification** :
> - `MODULE_MOTEUR_SPECS.md` — Module de gestion des moteurs (atelier rebuild) — WIP

---

## 1. Vue d'ensemble

Application web de gestion visuelle de production pour l'atelier Camions Dubois.
Permet de suivre en temps réel l'emplacement de chaque camion dans les différents garages, gérer les files d'attente, les road maps de production, l'inventaire et les clients. Affichage TV en temps réel par département + dashboard livraisons.

**Technologies :** React + TypeScript + Vite + Supabase (base de données temps réel + auth + storage)
**Déploiement :** Netlify (mise en ligne automatique à chaque push GitHub)

---

## 2. Rôles et accès

| Rôle | Accès |
|------|-------|
| `gestion` | Accès complet à toutes les vues + admin TV |
| `planification` | Comme gestion (à confirmer si distinct) |
| `employe` | Voit uniquement la vue département (VueDepartement) selon son département |
| `tv` | Compte partagé pour les écrans TV de garage — affichage seulement |

### Compte TV partagé
- Un seul utilisateur Supabase Auth (`tv@camionsdubois.local`) avec rôle `tv`
- Credentials dans `.env` (`VITE_TV_EMAIL`, `VITE_TV_PASSWORD`)
- L'identification du garage se fait ensuite par **code d'accès** (table `tv_acces`)
- Code stocké en localStorage (`tvSession`) — la TV reste connectée

---

## 3. Navigation

Barre de navigation fixe en haut avec les onglets suivants :

| Onglet | Description | Couleur | Visible pour |
|--------|-------------|---------|--------------|
| Vue Plancher | Plan visuel du garage | Blanc | gestion |
| Camions à eau | Gestion des camions eau | Orange | gestion |
| Jobs clients | Travaux clients externes | Bleu | gestion |
| Camions détail | Camions détail | Vert | gestion |
| Prêts | Véhicules terminés en attente | Vert | gestion |
| **Suivi livraisons** | Dashboard livraisons (vendus/réservés/location) | **Rouge** | gestion |
| Inventaire | Inventaire complet | Noir | gestion |
| Réservoirs | Gestion des réservoirs | Bleu ciel | gestion |
| Clients | Base de données clients | Indigo | gestion |
| Analyse | Rapports et statistiques | Violet | gestion |
| Archive | Véhicules archivés | Gris | gestion |
| **TV** | Admin codes d'accès TV | Orange | gestion uniquement |

- Bouton **+ Nouveau** visible uniquement sur Vue Plancher (en haut à droite, orange)
- Horloge temps réel affichée dans la barre

---

## 4. Vue Plancher

### 4.1 Layout
Grille 3 colonnes × 2 rangées représentant le plancher du garage :

| Position | Station |
|----------|---------|
| Colonne 1, Rangée 1 | Soudure générale + Point-S (empilés) |
| Colonne 2, Rangée 1 | Mécanique générale |
| Colonne 3, Rangée 1 | Mécanique moteur |
| Colonnes 1+2, Rangée 2 | Sous-traitants (pleine largeur gauche) |
| Colonne 3, Rangée 2 | Soudure spécialisée + Peinture (côte à côte) |

### 4.2 Stations et slots

| Station | ID | Slots | Couleur |
|---------|----|-------|---------|
| Soudure générale | `soudure-generale` | G-01 à G-05 | Rouge-orangé |
| Point-S | `point-s` | PS-01 à PS-04 | Jaune |
| Mécanique générale | `mecanique-generale` | MG-01 à MG-06 | Bleu |
| Mécanique moteur | `mecanique-moteur` | MM-01 à MM-04 | Bleu foncé |
| Sous-traitants | `sous-traitants` | S-01 à S-12 | Violet |
| Soudure spécialisée | `soudure-specialisee` | SS-01 à SS-04 | Orange |
| Peinture | `peinture` | P-01 à P-03 | Gris-bleu |

> **Note :** La peinture gère des **réservoirs** (pas des camions).

### 4.3 Comportement des slots
- **Vide** : clic → choisir un job à assigner
- **Occupé (camion normal)** : clic → ouvre le panneau détail du véhicule
- **Occupé (job temporaire)** : clic → voir durée + bouton "Vider le slot"

### 4.4 File d'attente
- Chaque station affiche les camions en attente sous les slots
- Numéroté 1, 2, 3... avec badge coloré (rouge=1er, orange=2e, jaune=3e)
- **Numéros de stock plus gros (lisibles à distance/TV)**
- Drag-and-drop pour réordonner
- Flèches ▲▼ pour remonter/descendre
- Clic sur le badge numéro pour choisir directement la position

### 4.5 Pipeline planifié
Section sous chaque station qui affiche les camions **planifiés** (pas encore en file) pour cette station. Numéros de stock en gros aussi.

### 4.6 Jobs temporaires
Types disponibles :
- 🚛 Camion export
- 🔧 Démantèlement pièces
- 📋 Autres travaux

Durée trackée automatiquement depuis l'entrée dans le slot.

### 4.7 Road Map (Plan de production)
Séquence ordonnée d'étapes assignées à un camion.

**Statuts d'étape :**
- ⬜ Planifié
- ⏳ En attente
- 🔵 En cours
- ✅ Terminé
- ⏭️ Sauté

**Panneau Road Map** (s'ouvre au clic sur un slot vide → choisir depuis inventaire) :
- Grille 3×N de postes à sélectionner (dark theme)
- Liste ordonnée des étapes avec ↑↓ et ✕
- Description libre pour les sous-traitants
- Sélection du réservoir requis (camions eau seulement)
- Bouton "Sauvegarder et assigner"

---

## 5. Types de véhicules

| Type | Couleur | Description |
|------|---------|-------------|
| `eau` | Orange `#f97316` | Camions à eau |
| `client` | Bleu `#3b82f6` | Jobs clients externes |
| `detail` | Vert `#22c55e` | Camions détail |

---

## 6. Panneau détail véhicule

Tiroir latéral droit (460px) s'ouvrant sur n'importe quel camion.
Couleur de texte forcée (`#111827`) pour ne pas hériter d'un parent dark.
Bouton **✕ visible en tout temps** (position fixed top-right) — ne défile pas avec le contenu.

**Sections (de haut en bas) :**
1. En-tête : numéro, marque/modèle/année, statut, slot actuel, badge prêt
2. Photo (upload, changer, supprimer)
3. **Type de camion** (Eau / Détail) — toggle avec sauvegarde immédiate
4. Statut commercial (Non vendu / Réservé / Vendu / Location + nom client + date livraison)
5. Réservoir — camions eau seulement (assigner depuis inventaire ou marquer hors-inventaire)
6. Plan de production (RoadMapEditor)
7. Informations (variante, marque, modèle, année, client, téléphone, description)
8. Fiche client liée (si applicable)
9. Documents PDF (max 3, upload, visualisation, suppression)
10. Actions slot (changer de slot si en garage)
11. **Marquer prêt** — bouton désactivé avec message d'avertissement si :
    - Étapes road map non terminées (planifié / en attente / en cours)
    - Pas de réservoir installé (camions eau)
12. Retourner à l'inventaire
13. Archiver (rôle gestion seulement)
14. Supprimer (rôle gestion seulement)

---

## 7. Inventaire

### 7.1 Statuts véhicule
- `disponible` — dans l'inventaire, pas en production
- `en-production` — actuellement dans un garage
- `archive` — terminé, sorti de production

### 7.2 États commerciaux
- Non vendu
- Réservé
- Vendu (+ nom client acheteur + date livraison)
- Location (+ nom client + date livraison)

### 7.3 Progression dans l'app (sections Asana-style)
- 📋 À planifier — pas de road map actif
- ⏳ En attente — road map défini, attend son tour
- 🔧 En garage — étape en cours
- ✅ Prêt — toutes les étapes terminées + réservoir installé (si eau)

### 7.4 Validation "Prêt" (anti-bug en 3 couches)
1. **Écriture** : bouton désactivé tant que conditions pas remplies
2. **Lecture** : helper `estVehiculePret()` filtre les faux prêts à l'affichage (filtres Prêts, badges PRÊT, sections Asana)
3. **Auto-correctif** : au chargement de l'app, les `est_pret = true` invalides sont automatiquement repassés à `false` en BD

---

## 8. Réservoirs

- Inventaire de réservoirs séparés des camions
- Types : 2500g, 3750g, 4000g, 5000g
- États : disponible, en-peinture, installé
- Assignables à un slot Peinture ou à un camion eau
- Un camion eau peut avoir un réservoir "hors inventaire" (booléen simple)

---

## 9. Interfaces TV par garage *(implémenté)*

### 9.1 Concept
Chaque garage a un écran TV affichant son état en temps réel — vue interactive (les mécanos peuvent cliquer pour modifier).

### 9.2 Authentification TV
- Compte Supabase Auth partagé (`tv@camionsdubois.local`, rôle `tv`)
- À la connexion, écran `TVConnexion` demande un **code d'accès garage**
- Le code identifie quel groupe de stations afficher (table `tv_acces`)
- Session stockée en localStorage (la TV reste sur le bon garage après reload)
- Heartbeat 25 sec + listener `visibilitychange` pour rester live

### 9.3 Configurations TV disponibles

| Code | Stations affichées | Layout |
|------|-------------------|--------|
| `general` | Toutes les stations | Réplique exacte de PlancherView |
| `soudure-generale` | Soudure générale | Plein écran 1 station |
| `mecanique` | Méc. générale + Méc. moteur + Sous-traitants | Grille 2×2 |
| `spec` ou `soudure-specialisee` | Soudure spéc. + Peinture (avec réservoirs) | Côte à côte |
| `sous-traitants` | Sous-traitants | Plein écran 1 station |

### 9.4 Comportement TV
- Affiche le **pipeline planifié** par défaut sur chaque station
- Clic sur un slot/camion → ouvre le panneau détail (entièrement éditable)
- Réutilise les mêmes composants que PlancherView (StationBlock, PeintureStationBlock)

### 9.5 Admin TV
Onglet **TV** (gestion uniquement) → `VueAdminTV` :
- Liste des codes d'accès actifs
- Création / activation / désactivation / suppression
- Presets disponibles pour création rapide

### 9.6 Vue 3D garage *(idée future, non implémentée)*
- Image 3D/isométrique du garage créée dans un logiciel externe (SketchUp, Blender, etc.)
- Overlays positionnés par coordonnées (x%, y%) sur l'image
- Chaque overlay = infos temps réel du slot correspondant

---

## 10. Suivi livraisons *(implémenté)*

### 10.1 Concept
Dashboard dédié au gestionnaire pour voir d'un coup d'œil les camions **engagés** (vendus / réservés / location) et leur état d'avancement vers la livraison. TV-friendly.

### 10.2 Accès
- **Windows** : onglet "Suivi livraisons" dans la nav (icône 🚚 rouge)
- **Mobile (VueTerrain)** : bouton rouge 🚚 dans le header

### 10.3 Layout dashboard (desktop / TV)
- **Header KPI strip** :
  - Engagés (total)
  - En retard (rouge pulsant si > 0)
  - Aujourd'hui / Demain
  - Sans réservoir (camions eau sans rés.)
  - Prêts à livrer (vert)
  - Horloge live (mise à jour 30 sec)
  - Bouton **🖥 Mode TV** → bascule en plein écran navigateur + cache la nav

- **Grille principale "À LIVRER"** (auto-fit, ~68% hauteur)
  - Tri intelligent : avec date d'abord (urgents en haut), sans date triés par progression descendante
  - Largeur min de carte calculée selon le nombre (240/270/195/170/150)
  - Aucun scroll — `grid-auto-rows: 1fr` distribue l'espace

- **Grille séparée "PRÊTS À LIVRER"** (~32% hauteur, theme vert)
  - Affichée seulement s'il y a des prêts
  - Triés par date la plus proche

### 10.4 Carte camion (riche)
1. Photo (cliquable → s'ouvre en plein écran) ou icône fallback
2. # numéro en gros
3. Badge commercial (✓ VENDU / 🔒 RÉSERVÉ / 🔑 LOCATION)
4. Pill date colorée par urgence (rouge si retard, orange si ≤7j, jaune ≤30j, bleu plus tard, gris sans date)
5. Nom du client (gras blanc)
6. Marque / modèle / variante
7. Barre de progression %
8. Étape en cours / prochaine (avec icône station)
9. Nombre d'étapes restantes + slot garage + alertes (sans réservoir)
10. **Boutons PDF en bas** (un par document, en ligne, auto-fit) — clic ouvre le PDF directement sans passer par le panneau détail

### 10.5 Modals
- Clic photo → modal photo plein écran (fond noir, image centrée maxWidth 92vw)
- Clic PDF → modal PDF plein écran (iframe 90vw × 90vh)
- Clic carte (ailleurs) → ouvre le panneau détail véhicule

### 10.6 Mode TV
- Bouton 🖥 Mode TV → `requestFullscreen()` + position fixed inset:0 z-index:9999
- Recouvre la barre de navigation Windows
- Sortie via bouton ✕ Quitter ou touche ESC

### 10.7 Mobile (VueTerrain)
- Liste filtrable (statut commercial, type, tri par livraison/priorité/restantes)
- Recherche numéro/marque/modèle/client
- Clic camion → ouvre la fiche détail VueTerrain existante (avec PDF + modifs)

---

## 11. Vue Asana / Département

Vue tabulaire avec colonnes par section (À planifier / En attente / En garage / Prêt / Archive) et progression par étape road map à droite.

Utilisée pour :
- Camions à eau (`VueCamionsEau`)
- Jobs clients (`VueClientsExternes`)
- Camions détail (`VueCamionsDetail`)
- Inventaire (`VueInventaire`)
- Vue département pour rôle `employe` (`VueDepartement`)

---

## 12. Analyse

Dashboard de stats avec :
- Pie chart par phase (prêt / en production / disponible)
- Bar chart par station (camions actifs)
- Aging des camions en production
- Alertes : vendus pas prêts, écart réservoir
- Sous-filtres commercial (vendu / réservé / location)
- Tri par phase + progression

---

## 13. Realtime & Performance

- Supabase Realtime sur `prod_items`, `prod_inventaire`, `prod_reservoirs`
- Heartbeat toutes les 25 secondes (prévenir timeout TV)
- Rechargement automatique quand l'écran se réveille (`visibilitychange`)
- Auto-correctif `est_pret` au chargement (cleanup des faux prêts)

---

## 14. Fonctionnalités futures / Backlog

- [x] ~~Interfaces TV par garage~~ ✅ implémenté
- [x] ~~Authentification par code pour les TV~~ ✅ implémenté
- [x] ~~Mode interactif sur les TV~~ ✅ implémenté
- [x] ~~Suivi livraisons (dashboard gestionnaire)~~ ✅ implémenté
- [ ] **Module Moteur** (cahier des charges en cours — voir `MODULE_MOTEUR_SPECS.md`)
- [ ] Vue 3D du garage
- [ ] Notifications (camion prêt, urgence, etc.)
- [ ] Export PDF des rapports d'analyse
- [ ] Historique des temps par poste/camion
- [ ] Application mobile native pour les techniciens (actuellement web responsive)
- [ ] Sous-sections par état production dans Suivi livraisons (en discussion : options A/B/C)
- [ ] Calendrier livraisons (vue par mois/semaine)

---

## 15. Base de données (tables principales)

| Table | Contenu |
|-------|---------|
| `prod_items` | Jobs de production actifs (slots, états) |
| `prod_inventaire` | Véhicules inventaire (road map, commercial, photos, est_pret, type) |
| `prod_reservoirs` | Réservoirs (état, slot peinture, véhicule lié) |
| `prod_clients` | Base clients |
| `prod_time_logs` | Logs de temps par job/poste |
| `profiles` | Comptes utilisateurs (rôle, nom, département, actif) |
| `tv_acces` | Codes d'accès TV par garage (code, garage_id, label, actif) |

### Storage Supabase
- `inventaire` : photos véhicules
- `items` : photos jobs production

---

*Dernière mise à jour : 2026-05-01*
