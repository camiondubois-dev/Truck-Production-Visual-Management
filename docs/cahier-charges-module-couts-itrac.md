# Cahier des charges — Module Coûts iTRAC

> **Statut** : Brouillon — en attente du fichier exemple iTRAC pour finaliser le mapping des champs.
> **Dernière MAJ** : 2026-05-05

---

## 1. Contexte et objectif

### Problème actuel
Les coûts réels par camion (achat + salaires + pièces + sous-traitance + peinture) sont gérés dans **iTRAC Entreprise**, un logiciel comptable / ERP séparé de l'application Dubois. L'équipe de gestion n'a pas de visibilité directe sur le coût courant d'un camion en production sans aller fouiller dans iTRAC.

### Objectif
Importer périodiquement les coûts d'iTRAC dans l'application Dubois pour :
1. **Afficher le coût courant** sur la fiche d'un camion (visible uniquement aux personnes autorisées)
2. **Conserver l'historique** des coûts pour analyser l'évolution dans le temps
3. **Servir de fondation** pour de futurs rapports financiers (marges, dépenses par département, etc.)

### Hors scope (v1)
- Édition des coûts depuis l'application (lecture seule, iTRAC reste la source de vérité)
- Calcul de marges automatique (sera basé sur ces données plus tard)
- Synchronisation bidirectionnelle avec iTRAC

---

## 2. Acteurs et permissions

### Utilisateurs autorisés à voir les coûts
2-3 personnes dans l'entreprise (à définir précisément). Liste à compléter.

| Personne | Rôle | Accès |
|---|---|---|
| (À définir) | Direction | Voit + importe |
| (À définir) | Direction / Compta | Voit + importe |
| (À définir) | (optionnel) | Voit seulement |

### Mécanisme de permission
**Décision** : flag dédié `profiles.voit_couts boolean` (plus souple qu'un nouveau rôle).
- Les admins activent le flag pour les personnes autorisées
- L'ajout/retrait d'une personne ne demande aucun déploiement de code
- La RLS Postgres applique automatiquement la restriction

### Visibilité dans l'app
- Reste de l'équipe : **ne voit même pas** que la section coûts existe (UI cachée)
- Personne autorisée : voit la section coûts sur la fiche camion + accès au module dédié

---

## 3. Source de données : iTRAC

### Identification des camions
**Bonne nouvelle confirmée** : iTRAC et Dubois utilisent **le même numéro de stock** (ex: 35468). Le matching entre les deux systèmes est donc trivial — pas besoin de table de correspondance complexe, juste un `JOIN ON numero_stock`.

### Modes d'import envisagés (par ordre de préférence)

| Plan | Description | Effort | Avantages | Inconvénients |
|---|---|---|---|---|
| **A — Connexion SQL directe** | Lecture directe de la BD iTRAC (lecture seule), job planifié | 1-2 sem. | Données fraîches, zéro manuel, foundation solide | Dépend de l'hébergement iTRAC, contrat fournisseur, schéma à découvrir |
| **B — API iTRAC** | Si iTRAC expose une API REST/SOAP | 1 sem. | Stable, propre | Existe seulement si fournisseur l'offre |
| **C — Export auto vers dossier partagé** | iTRAC dépose un Excel/CSV dans OneDrive chaque nuit, app le ramasse | 4-5 jours | Pas de manuel, robuste | Format dépendant des updates iTRAC |
| **D — Import manuel Excel dans l'app** | User upload le fichier dans l'app, validation + import | 3-4 jours | Rapide à livrer | Quelqu'un fait l'export chaque semaine |

### Questions ouvertes pour décider du mode
- [ ] iTRAC tourne sur quel serveur (sur place ou en ligne) ?
- [ ] Quelle technologie de BD (probablement Microsoft SQL Server) ?
- [ ] Le contrat iTRAC permet-il un user lecture seule ?
- [ ] iTRAC a-t-il une API ou un export programmé possible ?

### Décision provisoire
**Plan D (import manuel) pour la v1**, avec architecture conçue pour migrer vers Plan A/B/C plus tard sans refactor majeur.

---

## 4. Modèle de données

### Principe directeur
**Snapshots, pas écrasement**. Chaque import crée de nouvelles lignes datées. La « valeur courante » d'un camion = la dernière ligne pour ce camion. Aucune donnée n'est jamais perdue.

### Tables proposées

#### `prod_itrac_imports`
Journal des imports effectués.
```
id                   uuid PK
uploaded_at          timestamptz
uploaded_by          uuid → profiles.id
semaine_couverte     date          -- ex: 2026-05-04 (lundi de la semaine)
fichier_nom          text
fichier_hash         text          -- SHA-256, évite le double-import
nb_lignes            int
status               text          -- 'en_cours' | 'valide' | 'annule'
notes                text
```

#### `prod_itrac_couts`
Une ligne par camion par import.
```
id                   uuid PK
import_id            uuid → prod_itrac_imports.id
inventaire_id        text → prod_inventaire.id   -- résolu via numéro de stock
numero_stock         text                         -- pour debug et matching
prix_achat           numeric(12,2)
cumul_salaires       numeric(12,2)
cumul_pieces         numeric(12,2)
cumul_sous_traitance numeric(12,2)
cumul_peinture       numeric(12,2)
cumul_autre          numeric(12,2)
cout_total           numeric(12,2)               -- somme calculée
data_brute           jsonb                        -- ligne Excel originale
created_at           timestamptz default now()
```

> ⚠️ Les colonnes financières exactes seront ajustées **une fois le fichier exemple iTRAC reçu**. Le schéma ci-dessus est une supposition raisonnable.

#### `prod_itrac_correspondances` (optionnel — filet de sécurité)
Pour gérer les cas tordus si jamais le numéro de stock ne matche pas.
```
itrac_ref            text PK
inventaire_id        text → prod_inventaire.id
confirmed_by         uuid
confirmed_at         timestamptz
notes                text
```

### Index
- `prod_itrac_couts (inventaire_id, created_at DESC)` — pour la requête « dernière valeur par camion »
- `prod_itrac_imports (semaine_couverte DESC)` — pour lister les imports récents
- `prod_itrac_imports (fichier_hash)` — unique partial pour bloquer doublons

### RLS (Row-Level Security)
- Lecture : seulement si `profiles.voit_couts = true` (vérifié via une fonction Postgres `auth_voit_couts()`)
- Écriture : seulement si `voit_couts = true`
- Aucun autre rôle ne voit ces tables, même pas en SELECT

---

## 5. Flow utilisateur

### Import d'un nouveau rapport iTRAC
1. Personne autorisée navigue vers **Module Finances → Importer rapport iTRAC**
2. Drag & drop d'un fichier `.xlsx`
3. L'app parse le fichier et affiche un **preview** :
   - Date détectée du rapport
   - Nb de camions présents
   - 🟢 X lignes matchées automatiquement (numéro de stock connu)
   - 🟡 Y lignes nouvelles ou ambiguës → demande confirmation
   - 🔴 Z lignes orphelines (camion archivé ou erreur de saisie)
4. Personne valide les cas 🟡 manuellement
5. Bouton **« Confirmer l'import »** → écriture en BD
6. Confirmation : « Import du 4 mai validé, 47 camions enregistrés »

### Consultation sur la fiche camion (côté visible aux autorisés)
Sur la fiche d'un camion en production, nouvelle section **« Coûts »** :
- Coût total courant (gros, en évidence) : ex. **47 230 $**
- Détail :
  - Achat : 32 000 $
  - Salaires : 8 450 $
  - Pièces : 4 230 $
  - Sous-traitance : 1 800 $
  - Peinture : 750 $
- Date du dernier import : « Au 4 mai 2026 »
- Mini-graphique d'évolution (semaine sur semaine)
- Bouton « Voir l'historique complet »

### Module dédié (pour les autorisés)
Tableau type Suivi Vente avec colonnes :
- Stock | Équipement | Prix achat | Salaires | Pièces | Total | Évolution 7j | Date dernier import

Filtres : par semaine, par modèle, par fourchette de coût.

---

## 6. Architecture extensible (vision long terme)

### Principe
Le module iTRAC sera la **première instance** d'un pattern réutilisable :

```
[ Source de données externe ] → [ Mapping ] → [ Storage ] → [ Vues / Rapports ]
```

### Organisation du code
```
src/modules/
  └── imports/
       ├── core/                  -- helpers parsing xlsx, génération hash, etc.
       ├── itrac/                 -- v1 : iTRAC
       │    ├── parser.ts
       │    ├── mapper.ts
       │    └── ImportPage.tsx
       └── (futurs)/              -- ex: bons de commande, ventes, productivité
```

### Foundation pour les rapports
Une fois les données stockées proprement :
- Rapports = composants UI qui interrogent Supabase (vues SQL ou agrégations)
- Pas de logique business duplicate
- Faciles à itérer

### Exemples de rapports futurs envisageables
- Top 10 camions les plus coûteux
- Coût moyen par modèle / par année
- Évolution des coûts par département (heures de salaires par station)
- Marge brute par camion (coût total vs prix de vente)
- Camions « dérivants » (coût qui augmente anormalement vite)

---

## 7. Performance

### Volume estimé sur 5 ans
- 200 camions actifs × 52 semaines × 5 ans = **52 000 lignes** maximum
- Postgres gère ça sans broncher (saturation à des dizaines de millions)

### Impact sur l'app
| Action | Impact perf |
|---|---|
| Affichage coûts sur fiche camion | < 1 ms (1 requête indexée) |
| Module liste pour utilisateurs autorisés | Négligeable |
| Import hebdo | Tourne à part, zéro impact pour les autres users |
| Stockage historique 5 ans | Quelques Mo, négligeable |
| Rapports complexes futurs | Si besoin : vues matérialisées Postgres |

### Règles à respecter
- ✅ Index sur `(inventaire_id, created_at DESC)`
- ✅ Lecture à la demande (pas de pré-chargement global)
- ✅ Stocker `cout_total` (pas recalculer à chaque affichage)
- ✅ Cache côté client (existant déjà sur le projet)

**Conclusion** : **aucun impact perceptible** sur l'application existante.

---

## 8. Sécurité

- Aucune information de coût n'apparaît dans le DOM ni dans les requêtes pour les non-autorisés (RLS bloque côté serveur, pas seulement l'UI)
- Hash SHA-256 du fichier importé : empêche un double-import accidentel
- Audit trail : qui a importé quoi et quand est inscrit dans `prod_itrac_imports`
- Pas d'accès écriture vers iTRAC depuis l'app (lecture seule absolue)
- Si on passe au Plan A (SQL direct) : user iTRAC dédié, lecture seule, mot de passe stocké côté serveur uniquement

---

## 9. Plan de livraison (provisoire)

### Phase 0 — Préparation (tu fais)
- [ ] Trouver / créer un modèle de rapport dans iTRAC qui sort les colonnes utiles
- [ ] M'envoyer un fichier exemple anonymisé
- [ ] Confirmer la liste des 2-3 personnes autorisées
- [ ] (Optionnel) Vérifier l'hébergement iTRAC pour décider du Plan A/B/C/D

### Phase 1 — Architecture finale (on fait ensemble)
- [ ] Recevoir le fichier exemple
- [ ] Compléter section 4 (modèle de données) avec les vrais champs iTRAC
- [ ] Décider Plan A/B/C/D définitif
- [ ] Valider le cahier des charges complet

### Phase 2 — Implémentation v1 (Plan D : import manuel)
- [ ] Migration SQL : créer les 3 tables + RLS + flag `voit_couts`
- [ ] Page d'import (parser xlsx + preview + confirmation)
- [ ] Section « Coûts » sur la fiche camion (visible si autorisé)
- [ ] Module liste dédié
- [ ] Tests avec un vrai fichier iTRAC

### Phase 3 — Améliorations (selon usage réel)
- [ ] Rapports custom selon besoins remontés
- [ ] Migration vers SQL direct ou API si pertinent
- [ ] Alertes (camion qui dépasse un seuil, etc.)

---

## 10. Notes et décisions enregistrées

- **2026-05-05** : Discussion architecturale initiale. Décision de commencer par Plan D (import manuel) avec design extensible. Identification des 4 modes possibles. Confirmation que iTRAC et Dubois partagent le numéro de stock (matching trivial).
- **2026-05-05** : Décision du flag `voit_couts` plutôt qu'un nouveau rôle.
- **2026-05-05** : Décision de stocker chaque snapshot (jamais d'écrasement). Foundation pour rapports futurs.

---

## 11. À compléter quand le fichier iTRAC sera reçu

- [ ] Liste exacte des colonnes du rapport iTRAC
- [ ] Mapping colonne iTRAC → champ Postgres
- [ ] Granularité confirmée (1 ligne = 1 camion, ou plusieurs lignes à sommer)
- [ ] Format de date utilisé par iTRAC
- [ ] Présence ou non du VIN (utile comme clé secondaire)
- [ ] Cas spéciaux observés (camions fantômes, retours, etc.)
- [ ] Définition finale du schéma `prod_itrac_couts`
