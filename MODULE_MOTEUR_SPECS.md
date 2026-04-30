# Module Moteur — Cahier des charges (WIP)

> **Statut** : En cours d'élaboration (atelier collaboratif)
> **Dernière mise à jour** : 2026-04-30
> **Sections complétées** : 1, 2, 3
> **Sections en attente** : 4, 5, 6, 7, 8, 9, 10

---

## ✅ Section 1 — Objectif & Portée [VALIDÉ]

### Décisions
- Module **autonome**, **non lié** au système camions/trucks
- Possesseurs possibles d'un moteur :
  - Client externe
  - Interne (nous)
  - Exportation
  - Stock interne
  - Inventaire (notre stock revente)
- Cycle : rebuild OU stock interne
- **Pas de facturation directe** dans le système

### Intégration externe
- Les données saisies en production seront **exportées en PDF** vers le **Work Order Itrack** (système externe)
- ⭐ Le système doit **construire automatiquement un document PDF** consolidant l'historique du moteur
- À définir : contenu exact du PDF, template, déclencheur de génération

### Buts principaux
1. Suivre l'inventaire des moteurs (marque / modèle / année / etc.)
2. Planning de l'équipe
3. Suivi en temps réel
4. Dashboard de performance (par employé, par type de moteur)

---

## ✅ Section 2 — Entité Moteur [VALIDÉ]

### Identification
| Champ | Type | Obligatoire ? |
|-------|------|---------------|
| **Numéro interne** | saisi manuellement | oui |
| **VIN moteur** (n° série constructeur) | texte | oui |
| **Marque** | liste prédéfinie (CAT, Cummins, Detroit, Mack…) | oui |
| **Modèle** | liste cascade selon marque | oui |
| **Année** | int | oui |
| **Type carburant** | tous diesel (pas de toggle) | — |
| **Informations additionnelles** | champs flexibles | à définir |

> Le client veut pouvoir **modifier facilement** quels champs sont obligatoires plus tard.

### Médias
- **Photos** : multiples (avant / pendant / après — tags à définir)
- **PDFs** : multiples (devis, rapports, etc.)

### Possession (statut origine)
3 catégories :
- Stock interne
- Client externe
- Inventaire

### Types de services
Principaux (**extensible** — l'utilisateur pourra en ajouter dynamiquement) :
- Installation client
- Rebuild
- Nettoyage
- Peinture
- Démarrage / Redémarrage (test initial et test final)

Options modulaires :
- Changement mains et rods (paliers principaux + bielles)
- Petites interventions (seal de crinque, seal de tête, etc.)
- Liste extensible

### Fiche moteur (vue détail)
Au clic sur un moteur, on doit voir :
- Tout ce qui a été fait (historique d'étapes)
- Tout ce qui a été vérifié (checklists complétées)
- **Quel mécano** a fait/vérifié quoi
- Photos avant/pendant/après
- PDFs liés

### Base de données mécanos
- Lier au système des `profiles` existant
- Filtrer par département `mecanique-moteur`
- Voir si besoin d'un rôle/groupe additionnel

---

## ✅ Section 3 — Workflows / Services [VALIDÉ – à creuser en S4]

### Étapes principales (ordre type)
1. **Démarrage initial** (test à la réception) — détection des problèmes
2. **Inspection / vérification** — checklist de problématiques
3. **Réparation en atelier moteur** (rebuild + interventions)
4. **Re-test démarrage** — validation post-réparation
5. **Nettoyage**
6. **Peinture**
7. **Tests finaux** — validation avant départ
8. ~~Emballage / réinstallation camion~~ **HORS PROJET**

### Caractéristiques clés
- ⏱ **Durée planifiée vs durée réelle** sur chaque étape (KPI performance)
- 🔀 **Étapes sautables** : tous les moteurs ne passent pas par tout
- 🎯 **Validation pré-job** : avant qu'un job ne démarre, on coche les étapes nécessaires → ça génère le **plan de production**
- 🔬 **Micro-étapes** dans chaque grande étape (avec leurs propres durées)
- 🔁 **Étapes répétables** : ex. démarrage initial + re-démarrage post-rebuild

### Cas particuliers
- **Petits jobs** : juste un seal de crinque ou seal de tête → majorité des étapes sautées
- Le système doit gérer indifféremment un gros rebuild ou un petit fix

### À détailler (Section 4)
- Liste précise des étapes + micro-étapes pour chacune
- Durées de référence
- Slots physiques (banc d'essai, atelier rebuild, etc.)
- Checklists de vérification

---

## ⏳ Sections en attente

### 4. Étapes & micro-étapes (détail)
À questionner avec l'équipe :
- Liste exhaustive des étapes
- Micro-étapes pour chacune
- Durées planifiées de référence
- Slots physiques (banc d'essai, etc.)
- Checklists de vérification
- Comment fonctionne la validation "pré-job"

### 5. Employés & temps
- Tracking : punch in/out par étape ? Saisie manuelle ? Mix ?
- Visualisation : temps cumulé par moteur / par employé / par étape
- Heures vendables vs internes ?
- Réutilise-t-on `prod_time_logs` existant ?

### 6. Planning
- File d'attente avec priorités drag-drop ?
- Calendrier ?
- Date promise client → urgence ?
- Vue plancher moteur (similaire à PlancherView) ?

### 7. Commercial
- Statut commercial moteur ?
- Lien table `prod_clients` ?
- Date livraison ?
- Devis dans le système ou seulement référence externe ?

### 8. Liens avec l'existant
- `profiles` (mécanos)
- `prod_clients`
- `prod_time_logs`
- Storage Supabase (photos + PDFs)
- Itrack (export PDF du Work Order)

### 9. Écrans à concevoir
Hypothèses, à prioriser phase 1 / phase 2 :
- Inventaire moteurs (liste filtrable)
- Plancher moteur (cartes par étape)
- Panneau détail moteur (photos, PDFs, road map, temps, mécano)
- Wizard création moteur
- Vue employé "mes moteurs" (mobile/terrain)
- TV département moteur
- Analyse / stats moteurs

### 10. Permissions
- Qui voit / modifie / archive ?
- Lien avec `profile.role` et `profile.departement`

---

## 🚀 Plan pour la prochaine session

À l'ouverture de la prochaine session, reprendre **dans cet ordre** :

| Étape | Section | Sujet |
|-------|---------|-------|
| 1 | **4** | Étapes détaillées + micro-étapes + durées + slots + checklists + validation pré-job |
| 2 | **5** | Mode de tracking temps + vues + heures vendables |
| 3 | **6** | Planning / file d'attente / calendrier |
| 4 | **7** | Aspect commercial / clients |
| 5 | **8** | Liens avec modules existants |
| 6 | **9** | Liste des écrans + priorisation phase 1 / 2 |
| 7 | **10** | Matrice de permissions |

Une fois tout validé :
1. Bâtir le **schéma BD** (tables Supabase)
2. Définir le **modèle de données TypeScript**
3. Coder par phases (commencer par : table BD + entité + inventaire moteurs + wizard création)

---

## 📝 Notes brutes / Decisions à confirmer

- **Format PDF Itrack** : structure exacte à fournir (modèle existant ?)
- **Liste marques moteur** : à fournir par le client (CAT, Cummins, Detroit, Mack, et autres)
- **Cascade marque → modèles** : à compiler (data file équivalent à `camionData.ts`)
- **Liste mécanos initiale** : déjà identifiable via `profiles WHERE departement = 'mecanique-moteur'`
- **Champs additionnels obligatoires** : configurable par l'utilisateur ? Ou hardcodé ?

---

> **Pour reprendre demain** : dis "on continue le module moteur" et je redémarre exactement à la **Section 4**.
