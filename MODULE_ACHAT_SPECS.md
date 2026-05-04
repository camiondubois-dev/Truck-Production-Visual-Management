# Module Achats — Cahier des charges

> **Statut** : Validé pour implémentation
> **Dernière mise à jour** : 2026-05-04
> **Phase active** : Phase 1 (MVP) à venir

Module dédié à la gestion de l'**achat de camions** — du repérage de l'opportunité jusqu'au transfert en inventaire de production. Intégré comme **module** dans l'app existante (`Truck-Production-Visual-Management`), mêmes Supabase / Auth / Realtime.

---

## 1. Objectif & Portée

### Buts principaux
1. Centraliser toutes les opportunités d'achat (avant qu'elles ne deviennent des camions en production)
2. Permettre une **évaluation collective** structurée (estimations multiples)
3. Gérer le workflow d'**approbation et de négociation** avec le vendeur
4. Coordonner le **paiement** et le **transport** (towing si nécessaire)
5. Transférer automatiquement vers l'**inventaire de production** une fois le camion sur place
6. Conserver l'**historique complet** pour analyse (prix payés, marges, etc.)

### Hors scope (pour l'instant)
- ❌ Intégration auctions externes (Manheim, Adesa, etc.) — phase future
- ❌ Carfax / historique VIN auto — phase future
- ❌ Suivi paiements complexe (acompte, solde, échéancier) — juste payé/non payé
- ❌ Budgets mensuels avec alertes — juste un dashboard d'achats

---

## 2. Acteurs & Rôles

### 🛒 Acheteurs (créent les opportunités)

**Principaux** — évaluation initiale obligatoire :
- Stéphane Dalpé
- Roger St-Amands

**Secondaires** — peuvent créer mais pas d'évaluation initiale obligatoire :
- Régis Dubois
- Jason Dubois
- Joel Cartier
- Dany Gemme

### 🎯 Évaluateurs finaux
- Joel Cartier
- Jason Dubois
- Régis Dubois

### ✅ Approbateurs (étape 4)
- **Joel Cartier** approuve → destination = 🔧 **Pièces**
- **Jason Dubois** approuve → destination = 🏷️ **Vente détails**
- L'un OU l'autre suffit (un seul approbateur). La destination est décidée par **qui approuve**.

### 💰 Paiement / Admin
- **Michael Dubois** — notifié dès l'achat conclu, voit info paiement
- **Christina Dubois** — idem Michael, peut aussi gérer le transfert inventaire

### 📦 Transfert vers inventaire
- Christina Dubois OU n'importe quel employé interne autorisé

---

## 3. Workflow détaillé (9 étapes)

### Étape 1 — Création de l'opportunité
**Qui** : N'importe quel acheteur (6 personnes)
**Saisit** :
- 📸 Photos (multi-upload)
- Identification : marque, modèle, année, VIN (optionnel), kilométrage
- Specs : moteur, transmission, type, capacité, EPA, GHG, HP
- État général + défauts connus
- **Vendeur** :
  - Nom complet (obligatoire)
  - Téléphone principal (obligatoire)
  - Email (obligatoire)
  - Type : particulier / concessionnaire / encan / flotte / autre (obligatoire)
  - Adresse complète (obligatoire)
  - Note libre (obligatoire mais peut être courte)
- Source de l'opportunité
- Prix demandé initial

**Statut résultant** : `evaluation-initiale`

### Étape 2 — Évaluation initiale (OBLIGATOIRE)
**Qui** : Stéphane Dalpé **ET** Roger St-Amands (les 2)
**Bloquante** : opportunité ne peut pas avancer tant que les 2 n'ont pas saisi
**Chacun saisit** :
- Mon estimation (meilleur de ma connaissance) — chiffre $
- Ce que le vendeur s'attend à recevoir — chiffre $
- Commentaire libre

**Statut résultant** : `evaluation-finale` (auto quand les 2 ont soumis)

### Étape 3 — Évaluation finale
**Qui** : Joel + Jason + Régis (les 3 peuvent évaluer)
**Saisit** :
- Prix proposé final $
- Recommandation : Acheter / Négocier / Passer
- Destination suggérée : 🔧 Pièces / 🏷️ Vente détails / Indéterminé
- Commentaire libre

**Statut résultant** : `a-approuver` (peut transitionner manuellement)

### Étape 4 — Approbation prix offre + destination
**Qui** : Joel **OU** Jason (l'un OU l'autre, un seul suffit)

L'approbation **détermine la destination** :
- Si **Joel** approuve → destination = 🔧 **Pièces**
- Si **Jason** approuve → destination = 🏷️ **Vente détails**

**Saisit** :
- Prix d'offre approuvé $ (peut différer de l'éval finale)
- Note de décision

**Statut résultant** : `approuve-a-offrir`

### Étape 5 — Offre + Contre-offre
**Qui** : L'acheteur (qui a créé l'opportunité ou autre)
**Action** : Fait l'offre au vendeur (téléphone/courriel — hors app)
**Saisit le résultat** :
- ✅ **Acceptée directement** → étape 6
- 🔄 **Contre-offre du vendeur** → saisir le nouveau prix demandé
  - Doit être **acceptée par Joel OU Jason** (un des deux suffit)
  - Si acceptée → étape 6
  - Si refusée → boucle (re-négocier ou clore)
- ❌ **Refusée** → opportunité fermée (statut `refusee` archivée)

**Statut résultant** : `acceptee` ou `refusee`

### Étape 6 — Achat conclu
**Qui** : L'acheteur
**Saisit** :
- Prix final convenu $
- Ententes avec vendeur (texte libre — conditions, délais, garanties verbales, etc.)
- Mode de transport :
  - 🚗 Capable de rouler par lui-même
  - 🚛 Besoin de towing
- Adresse pickup (préfill depuis vendeur, modifiable)
- Contact pickup (téléphone, horaires dispo)

**Action automatique** :
- 📩 **Notification immédiate** à Michael Dubois ET Christina Dubois
- Statut : `acheté-a-payer-a-ramasser`

### Étape 7 — Paiement
**Qui** : Michael Dubois OU Christina Dubois
**Action simple** :
- Toggle ☑ **Payé** / ☐ **Non payé**
- Date de paiement (auto = today, modifiable)

**Pas d'autres détails** (pas de mode paiement, montant, etc. — juste le statut).

### Étape 8 — Towing / Pickup
**Si "Besoin de towing"** :
- Assigner un conducteur depuis la liste `prod_conducteurs`
- Saisir date prévue
- Statut tracking : `a-ramasser` → `en-route` → `arrive`
- Photos pickup (multi-upload)
- Notes de transport

**Si "Capable de rouler"** :
- Section minimale, juste un bouton "Marquer comme arrivé"

**Liste des conducteurs** : table dédiée gérée par admin (voir §4)

### Étape 9 — Transfert vers inventaire
**Qui** : Christina Dubois OU employé interne autorisé
**Action** : Bouton "Transférer en inventaire de production"
- Préfill auto avec : photos, marque, modèle, année, VIN, kilométrage, état, notes
- Choix du **type d'inventaire** :
  - 💧 Camion à eau (`prod_inventaire.type = 'eau'`)
  - 🏷️ Camion détail (`prod_inventaire.type = 'detail'`)
  - (Le choix peut différer de la destination d'achat — un camion destiné "Pièces" peut être démantelé directement, ou requalifié en "Détail" plus tard)
- Création automatique d'une ligne dans `prod_inventaire`
- Photos transférées (les liens sont conservés, les fichiers ne bougent pas)
- Lien permanent : `prod_inventaire.achat_id` → `prod_achats.id`

**Statut résultant** : `transferee-inventaire`
- La fiche d'achat reste **archivée** mais consultable pour analyses (prix payé vs prix de vente, etc.)

---

## 4. Modèle de données BD (Supabase Postgres)

### Table `prod_achats`
```sql
CREATE TABLE prod_achats (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification camion
  marque                   text,
  modele                   text,
  annee                    int,
  vin                      text,
  kilometrage              int,
  specs                    jsonb,                       -- moteur, transmission, etc.
  etat_general             text,                        -- excellent / bon / moyen / projet / pieces
  defauts_connus           text,

  -- Vendeur
  vendeur_nom              text NOT NULL,
  vendeur_telephone        text NOT NULL,
  vendeur_email            text NOT NULL,
  vendeur_type             text NOT NULL                -- particulier / concessionnaire / encan / flotte / autre
                           CHECK (vendeur_type IN ('particulier','concessionnaire','encan','flotte','autre')),
  vendeur_adresse          text NOT NULL,
  vendeur_note             text NOT NULL,

  -- Source
  source                   text,                        -- libre, ex: "Encan Manheim 2025-04-30"

  -- Prix
  prix_demande_initial     decimal(10,2),
  prix_approuve            decimal(10,2),
  prix_paye                decimal(10,2),
  prix_contre_offre        decimal(10,2),               -- si négociation

  -- Décision
  destination              text                         -- pieces / vente-detail (NULL avant approbation)
                           CHECK (destination IN ('pieces','vente-detail')),
  approbateur_id           uuid REFERENCES profiles(id),

  -- Achat
  ententes_vendeur         text,                        -- texte libre saisi à l'étape 6
  mode_transport           text                         -- roule / towing
                           CHECK (mode_transport IN ('roule','towing')),
  adresse_pickup           text,
  contact_pickup           text,
  horaires_pickup          text,

  -- Paiement
  paye                     boolean NOT NULL DEFAULT false,
  date_paiement            timestamptz,

  -- Statut workflow
  statut                   text NOT NULL DEFAULT 'evaluation-initiale'
                           CHECK (statut IN (
                             'evaluation-initiale',
                             'evaluation-finale',
                             'a-approuver',
                             'approuve-a-offrir',
                             'offre-faite',
                             'contre-offre',
                             'acceptee',
                             'refusee',
                             'achete-a-payer-a-ramasser',
                             'paye-a-ramasser',
                             'en-towing',
                             'arrive',
                             'transferee-inventaire',
                             'archivee'
                           )),

  -- Liens
  acheteur_id              uuid NOT NULL REFERENCES profiles(id),
  inventaire_id            uuid REFERENCES prod_inventaire(id),  -- NULL avant transfert

  -- Méta
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  archived_at              timestamptz
);

CREATE INDEX idx_achats_statut ON prod_achats (statut);
CREATE INDEX idx_achats_acheteur ON prod_achats (acheteur_id);
CREATE INDEX idx_achats_destination ON prod_achats (destination);
CREATE INDEX idx_achats_created ON prod_achats (created_at DESC);
```

### Table `prod_achats_photos`
```sql
CREATE TABLE prod_achats_photos (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id          uuid NOT NULL REFERENCES prod_achats(id) ON DELETE CASCADE,
  url               text NOT NULL,
  tag               text,                                -- exterieur / interieur / moteur / chassis / defaut / documents / pickup
  ordre             int NOT NULL DEFAULT 0,
  uploaded_by       uuid REFERENCES profiles(id),
  uploaded_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_achats_photos_achat ON prod_achats_photos (achat_id, ordre);
```

### Table `prod_achats_evaluations_initiales`
```sql
CREATE TABLE prod_achats_evaluations_initiales (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id              uuid NOT NULL REFERENCES prod_achats(id) ON DELETE CASCADE,
  evaluateur_id         uuid NOT NULL REFERENCES profiles(id),
  mon_estimation        decimal(10,2) NOT NULL,
  prix_attendu_vendeur  decimal(10,2) NOT NULL,
  commentaire           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (achat_id, evaluateur_id)                       -- 1 seule éval par évaluateur par achat
);
```

### Table `prod_achats_evaluations_finales`
```sql
CREATE TABLE prod_achats_evaluations_finales (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id              uuid NOT NULL REFERENCES prod_achats(id) ON DELETE CASCADE,
  evaluateur_id         uuid NOT NULL REFERENCES profiles(id),
  prix_propose          decimal(10,2) NOT NULL,
  recommandation        text NOT NULL                    -- acheter / negocier / passer
                        CHECK (recommandation IN ('acheter','negocier','passer')),
  destination_suggeree  text                             -- pieces / vente-detail / indetermine
                        CHECK (destination_suggeree IN ('pieces','vente-detail','indetermine')),
  commentaire           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (achat_id, evaluateur_id)
);
```

### Table `prod_achats_decisions` (historique audit)
```sql
CREATE TABLE prod_achats_decisions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id        uuid NOT NULL REFERENCES prod_achats(id) ON DELETE CASCADE,
  decideur_id     uuid NOT NULL REFERENCES profiles(id),
  type            text NOT NULL                          -- approbation / refus / contre-offre-acceptee / contre-offre-refusee / transfert
                  CHECK (type IN (
                    'approbation','refus','contre-offre-acceptee',
                    'contre-offre-refusee','transfert','annulation'
                  )),
  montant         decimal(10,2),
  destination     text,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
```

### Table `prod_achats_messages` (chat — phase 2)
```sql
CREATE TABLE prod_achats_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id    uuid NOT NULL REFERENCES prod_achats(id) ON DELETE CASCADE,
  auteur_id   uuid NOT NULL REFERENCES profiles(id),
  contenu     text NOT NULL,
  type        text NOT NULL DEFAULT 'texte',             -- texte / photo / pdf / systeme
  media_url   text,
  mentions    uuid[],                                    -- ids des mentionnés
  parent_id   uuid REFERENCES prod_achats_messages(id),  -- threads
  created_at  timestamptz NOT NULL DEFAULT now(),
  edited_at   timestamptz
);
```

### Table `prod_achats_towing`
```sql
CREATE TABLE prod_achats_towing (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id            uuid NOT NULL UNIQUE REFERENCES prod_achats(id) ON DELETE CASCADE,
  conducteur_id       uuid REFERENCES prod_conducteurs(id),
  vehicule_remorque   text,                              -- ex: "Remorque Peterbilt 379"
  date_prevue         date,
  date_depart         timestamptz,
  date_arrivee        timestamptz,
  km_aller            int,
  notes               text,
  statut              text NOT NULL DEFAULT 'a-ramasser'
                      CHECK (statut IN ('a-ramasser','en-route','arrive','annule')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
```

### Table `prod_conducteurs` (nouvelle)
```sql
CREATE TABLE prod_conducteurs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom               text NOT NULL UNIQUE,
  telephone         text,
  email             text,
  peut_towing       boolean NOT NULL DEFAULT false,
  peut_chauffeur    boolean NOT NULL DEFAULT false,
  classe_permis     text,                                -- '1', '3', '5', etc.
  notes             text,
  actif             boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);
```

### Storage Supabase
- Bucket `achats-photos` (public)
- Bucket `achats-pickup` (photos lors du pickup)

---

## 5. RLS / Permissions

### Lecture
- **Tous les rôles authentifiés** peuvent voir toutes les fiches d'achat (transparence interne)
- **TVs** peuvent voir mais sans détails sensibles (prix exclus si on veut — phase 2)

### Écriture (résumé)
| Action | Qui peut |
|--------|----------|
| Créer opportunité | Acheteurs principaux + secondaires (les 6) |
| Évaluation initiale | Stéphane + Roger uniquement |
| Évaluation finale | Joel + Jason + Régis uniquement |
| Approbation étape 4 | Joel ou Jason uniquement |
| Saisir offre/contre-offre | Tout acheteur |
| Accepter contre-offre | Joel ou Jason |
| Saisir achat conclu (étape 6) | Tout acheteur |
| Toggle Payé | Michael ou Christina |
| Towing : assigner / mettre à jour | Christina ou gestion |
| Transfert vers inventaire | Christina ou gestion |
| Gérer liste conducteurs | Gestion uniquement |

> Implémentation : check `profiles.role` + `profiles.id` dans une whitelist (constante côté code et/ou table `prod_achats_permissions`).

---

## 6. Écrans à construire (Phase 1 MVP)

### Nouvelle nav
- 🛒 **Achats** — onglet principal (couleur émeraude `#10b981`)

### Écrans
1. **Dashboard Achats** (KPI semaine / mois / année)
   - Nb opportunités créées · approuvées · achetées · transférées
   - Valeur en pipeline · valeur achetée
   - Liste des fiches "à action requise pour moi" (selon rôle utilisateur)

2. **Liste des opportunités**
   - Filtres : statut, acheteur, destination, source, date
   - Recherche : VIN, marque, modèle, vendeur

3. **Wizard création opportunité** (5 étapes)
   - 1. Photos
   - 2. Identification camion
   - 3. Specs et état
   - 4. Vendeur
   - 5. Source + prix demandé

4. **Fiche opportunité** (l'écran principal)
   - Galerie photos (carrousel + zoom)
   - Sections : Description, Évaluations initiales, Évaluations finales, Approbation, Offre/Contre-offre, Achat, Paiement, Towing
   - Boutons d'action contextuels selon le statut + le rôle de l'utilisateur

5. **Module évaluation** (modal/section dans la fiche)
   - Formulaire selon Phase A ou B

6. **Module towing** (section dans la fiche, visible si applicable)
   - Liste conducteurs disponibles
   - Suivi statut

7. **Admin Conducteurs** (gestion uniquement)
   - Liste · ajouter · désactiver · modifier

### Mobile (VueTerrain)
- Bouton "Achats" dans le header
- Vue compacte : liste filtrable + clic = fiche compacte
- **Création depuis téléphone** (les acheteurs sur le terrain)
- Photos directement depuis caméra

---

## 7. Phases d'implémentation

### **Phase 1 — MVP fonctionnel** (cible : 2-3 semaines)
- ✅ Migration SQL (toutes tables ci-dessus)
- ✅ Onglet Achats + routing
- ✅ Wizard création opportunité
- ✅ Liste opportunités + filtres
- ✅ Fiche opportunité (lecture + édition selon statut)
- ✅ Évaluations initiales (Stéphane + Roger)
- ✅ Évaluations finales (Joel + Jason + Régis)
- ✅ Approbation étape 4 (Joel/Jason → destination)
- ✅ Saisie offre + contre-offre
- ✅ Achat conclu + notif Michael/Christina
- ✅ Toggle paiement
- ✅ Towing basique (sans liste conducteurs encore)
- ✅ Transfert vers inventaire (préfill auto)
- ✅ Dashboard simple (KPI)

### **Phase 2 — Conducteurs + Mobile** (cible : 1 semaine)
- ✅ Table `prod_conducteurs` + admin écran
- ✅ Towing avec assignation conducteur
- ✅ VueTerrain mobile : accès achats + création terrain
- ✅ Notifications (badge non-lus, mention email pour Michael/Christina)

### **Phase 3 — Chat + Analytics**
- ✅ Chat par fiche (`prod_achats_messages` activé)
- ✅ Mentions @
- ✅ Stats avancées (prix moyen / marque, marge moyenne, top évaluateurs)
- ✅ Comparaison side-by-side
- ✅ Export PDF fiche évaluation

### **Phase 4+ — Pro features** (au besoin)
- Templates specs par marque
- OCR VIN auto depuis photo
- Map view towing (Google Maps)
- Optimisation route pickup multiple
- Intégration externe (Manheim, Adesa via API si dispo)

---

## 8. Décisions clés (résumé)

| Question | Décision |
|----------|----------|
| BD | **Supabase** (cohérent avec reste de l'app) |
| Photos | Storage Supabase (compression côté client avant upload) |
| Realtime | Activé sur `prod_achats` + `prod_achats_messages` |
| Destination | Décidée à l'étape 4 par l'approbateur (Joel = Pièces, Jason = Vente) |
| Évaluation initiale | Bloquante (Stéphane + Roger obligatoires) |
| Approbation finale | Joel OU Jason (un seul suffit) |
| Contre-offre | Acceptée par Joel OU Jason |
| Notifications achat | Email/badge à Michael + Christina |
| Conducteurs | Table dédiée, gérée par admin |
| Paiement | Simple toggle (payé/non payé) — pas de détails financiers |
| Transfert inventaire | Christina OU employé interne, fiche archivée pour analyse |
| Mobile | VueTerrain enrichi (création terrain par les acheteurs) |
| Couleur onglet | Émeraude `#10b981` |

---

## 9. Notes / À questionner plus tard

- **Vendeurs récurrents** : devrait-on créer une table `prod_vendeurs_externes` pour pré-remplir les infos quand on rachète chez un même vendeur ? (Phase 2+)
- **Permissions exactes par rôle** : à finaliser dans la migration SQL avec RLS policies précises (whitelist par UUID si simple, ou champ `role_achat` sur profiles)
- **Notification Michael/Christina** : email automatique via Supabase Edge Function ou simple badge dans l'app ? (à valider en Phase 1)
- **Délai contre-offre** : doit-on tracker combien de temps Joel/Jason mettent à accepter une contre-offre ? (analytics phase 3)
- **Annulation après achat** : que se passe-t-il si une fois acheté, on veut annuler (vendeur change d'avis) ? Statut `annulee` dédié ?

---

## 🎯 Prochaine étape

Une fois ce document validé :
1. Créer migration SQL `sql/2026-05-XX_module_achats.sql`
2. Créer types TypeScript `src/types/achatTypes.ts`
3. Créer service `src/services/achatService.ts`
4. Créer context `src/contexts/AchatContext.tsx`
5. Créer composants : `VueAchats.tsx`, `WizardAchat.tsx`, `FicheAchat.tsx`, `AdminConducteurs.tsx`
6. Wire dans Navigation + App.tsx
7. Test bout en bout

---

*Référence des autres modules : `SPECS.md` (app principale), `MODULE_MOTEUR_SPECS.md` (module Moteurs)*
