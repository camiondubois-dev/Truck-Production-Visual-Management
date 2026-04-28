# Cahier des charges — Camions Dubois Production Manager

> **Comment utiliser ce fichier :**
> Modifie les sections directement sur GitHub (bouton ✏️), puis dis-le à Claude pour qu'il implémente les changements.
> Pour ajouter une feature : décris-la sous la bonne section.
> Pour modifier : change le texte existant.
> Pour supprimer : efface la ligne ou écris `[SUPPRIMER]` devant.

---

## 1. Vue d'ensemble

Application web de gestion visuelle de production pour l'atelier Camions Dubois.  
Permet de suivre en temps réel l'emplacement de chaque camion dans les différents garages, gérer les files d'attente, les road maps de production, l'inventaire et les clients.

**Technologies :** React + TypeScript + Vite + Supabase (base de données temps réel)  
**Déploiement :** Netlify (mise en ligne automatique à chaque push GitHub)

---

## 2. Rôles et accès

| Rôle | Accès |
|------|-------|
| `gestion` | Accès complet à toutes les vues |
| `employe` | Voit uniquement la vue département (VueDepartement) |

> **À venir :** Comptes TV par garage (sans email, code d'accès simple — voir section 9)

---

## 3. Navigation

Barre de navigation fixe en haut avec les onglets suivants :

| Onglet | Description | Couleur |
|--------|-------------|---------|
| Vue Plancher | Plan visuel du garage | Blanc |
| Camions à eau | Gestion des camions eau | Orange |
| Jobs clients | Travaux clients externes | Bleu |
| Camions détail | Camions détail | Vert |
| Prêts | Véhicules terminés en attente | Vert |
| Inventaire | Inventaire complet | Noir |
| Réservoirs | Gestion des réservoirs | Bleu ciel |
| Clients | Base de données clients | Indigo |
| Analyse | Rapports et statistiques | Violet |
| Archive | Véhicules archivés | Gris |

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
- Drag-and-drop pour réordonner
- Flèches ▲▼ pour remonter/descendre
- Clic sur le badge numéro pour choisir directement la position

### 4.5 Jobs temporaires
Types disponibles :
- 🚛 Camion export
- 🔧 Démantèlement pièces
- 📋 Autres travaux

Durée trackée automatiquement depuis l'entrée dans le slot.

### 4.6 Road Map (Plan de production)
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

**Sections :**
1. En-tête : numéro, marque/modèle/année, statut, slot actuel
2. Photo (upload, changer, supprimer)
3. Statut commercial (Non vendu / Réservé / Vendu / Location + nom client + date livraison)
4. Réservoir — camions eau seulement (assigner depuis inventaire ou marquer hors-inventaire)
5. Plan de production (RoadMapEditor)
6. Informations (variante, marque, modèle, année, client, téléphone, description)
7. Fiche client liée (si applicable)
8. Documents PDF (max 3, upload, visualisation, suppression)
9. Actions slot (changer de slot si en garage)
10. Marquer prêt / Retirer statut prêt
11. Retourner à l'inventaire
12. Archiver (rôle gestion seulement)
13. Supprimer (rôle gestion seulement)

---

## 7. Inventaire

### 7.1 Statuts véhicule
- `disponible` — dans l'inventaire, pas en production
- `en-production` — actuellement dans un garage
- `archive` — terminé, sorti de production

### 7.2 États commerciaux
- Non vendu
- Réservé
- Vendu (+ nom client acheteur)
- Location (+ nom client)

### 7.3 Progression dans l'app (sections Asana-style)
- 📋 À planifier — pas de road map actif
- ⏳ En attente — road map défini, attend son tour
- 🔧 En garage — étape en cours
- ✅ Prêt — toutes les étapes terminées

---

## 8. Réservoirs

- Inventaire de réservoirs séparés des camions
- Types : 2500g, 3750g, 4000g, 5000g
- États : disponible, en-peinture, installé
- Assignables à un slot Peinture ou à un camion eau
- Un camion eau peut avoir un réservoir "hors inventaire" (booléen simple)

---

## 9. Interfaces TV par garage *(À développer)*

### 9.1 Concept
Chaque garage a un écran TV affichant son état en temps réel.  
Lecture seule ou interactif — **à confirmer par le client**.

### 9.2 Authentification TV
Mode choisi : **code d'accès par garage** (ex: `SOUDO`, `MECA`)  
- Pas d'email requis
- Code saisi une fois, mémorisé dans le navigateur TV
- Chaque code donne accès à la TV d'un garage spécifique

### 9.3 Groupements TV *(à compléter)*

| TV | Stations affichées | Code accès |
|----|-------------------|------------|
| Soudure générale | Soudure générale uniquement | `SOUDO` |
| Mécanique | Mécanique moteur + Mécanique générale | `MECA` |
| Soudure spécialisée + Peinture | Soudure spécialisée + Peinture | `SPEC` |
| Sous-traitants | Sous-traitants | `SOUS` |

> **À confirmer :** Les sous-traitants apparaissent-ils sur d'autres TV aussi?

### 9.4 Layout TV — Soudure générale
- En-tête station en grand
- Slot(s) affiché(s) avec numéro de camion en très grand (lisible à distance)
- File d'attente en dessous avec numéros de camion en grand

### 9.5 Vue 3D garage *(optionnel)*
- Image 3D/isométrique du garage créée dans un logiciel externe (SketchUp, Blender, etc.)
- Overlays positionnés par coordonnées (x%, y%) sur l'image
- Chaque overlay = infos temps réel du slot correspondant
- **Alternative :** Vue isométrique codée directement (sans image externe)

---

## 10. Analyse

*(Section à documenter — vue statistiques/rapports)*

---

## 11. Realtime & Performance

- Supabase Realtime sur `prod_items` et `prod_inventaire`
- Heartbeat toutes les 25 secondes (prévenir timeout TV)
- Rechargement automatique quand l'écran se réveille (`visibilitychange`)

---

## 12. Fonctionnalités futures / Backlog

> Ajouter ici les idées à implémenter. Format : `- [ ] Description de la feature`

- [ ] Interfaces TV par garage (section 9)
- [ ] Vue 3D du garage
- [ ] Authentification par code pour les TV de garage
- [ ] Notifications (camion prêt, urgence, etc.)
- [ ] Mode interactif sur les TV (marquer étapes terminées)
- [ ] Export PDF des rapports d'analyse
- [ ] Historique des temps par poste/camion
- [ ] Application mobile pour les techniciens

---

## 13. Base de données (tables principales)

| Table | Contenu |
|-------|---------|
| `prod_items` | Jobs de production actifs (slots, états) |
| `prod_inventaire` | Véhicules inventaire (road map, commercial, photos) |
| `prod_reservoirs` | Réservoirs (état, slot peinture, véhicule lié) |
| `prod_clients` | Base clients |
| `prod_time_logs` | Logs de temps par job/poste |
| `profiles` | Comptes utilisateurs (rôle, nom) |

---

*Dernière mise à jour : 2026-04-28*
