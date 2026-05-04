-- ════════════════════════════════════════════════════════════════════
-- Module Achats — Schema Phase 1 MVP
-- ════════════════════════════════════════════════════════════════════
-- Date : 2026-05-04
-- À rouler dans Supabase SQL Editor

-- ═══ 1. Rôles d'achat sur profiles ═══════════════════════════════════
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS roles_achat text[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_profiles_roles_achat
  ON profiles USING GIN (roles_achat);

-- Helper : checker si un user a un rôle achat
-- Usage : WHERE 'acheteur-principal' = ANY(profiles.roles_achat)

-- ═══ 2. Table conducteurs ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS prod_conducteurs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom             text NOT NULL UNIQUE,
  telephone       text,
  email           text,
  peut_towing     boolean NOT NULL DEFAULT false,
  peut_chauffeur  boolean NOT NULL DEFAULT false,
  classe_permis   text,                                -- '1', '3', '5', etc.
  notes           text,
  actif           boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE prod_conducteurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conducteurs_select_authenticated" ON prod_conducteurs;
CREATE POLICY "conducteurs_select_authenticated"
  ON prod_conducteurs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "conducteurs_write_gestion" ON prod_conducteurs;
CREATE POLICY "conducteurs_write_gestion"
  ON prod_conducteurs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion', 'planification')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion', 'planification')));

ALTER PUBLICATION supabase_realtime ADD TABLE prod_conducteurs;

-- ═══ 3. Table vendeurs externes (récurrents) ═════════════════════════
CREATE TABLE IF NOT EXISTS prod_vendeurs_externes (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nom                   text NOT NULL UNIQUE,
  type                  text NOT NULL
                        CHECK (type IN ('particulier','concessionnaire','encan','flotte','autre')),
  telephone_principal   text,
  email                 text,
  adresse               text,
  note                  text,
  fois_utilise          int NOT NULL DEFAULT 0,
  derniere_utilisation  timestamptz,
  actif                 boolean NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vendeurs_ext_type ON prod_vendeurs_externes (type);
CREATE INDEX IF NOT EXISTS idx_vendeurs_ext_actif ON prod_vendeurs_externes (actif) WHERE actif = true;

ALTER TABLE prod_vendeurs_externes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vendeurs_ext_select" ON prod_vendeurs_externes;
CREATE POLICY "vendeurs_ext_select" ON prod_vendeurs_externes FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vendeurs_ext_write" ON prod_vendeurs_externes;
CREATE POLICY "vendeurs_ext_write" ON prod_vendeurs_externes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion', 'planification', 'employe')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion', 'planification', 'employe')));

ALTER PUBLICATION supabase_realtime ADD TABLE prod_vendeurs_externes;

-- ═══ 4. Table principale prod_achats ═════════════════════════════════
CREATE TABLE IF NOT EXISTS prod_achats (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identification camion
  marque                   text,
  modele                   text,
  annee                    int,
  vin                      text,
  kilometrage              int,
  specs                    jsonb NOT NULL DEFAULT '{}'::jsonb,
  etat_general             text                                  -- excellent / bon / moyen / projet / pieces
                           CHECK (etat_general IS NULL OR etat_general IN ('excellent','bon','moyen','projet','pieces')),
  defauts_connus           text,

  -- Vendeur (snapshot dans la fiche, peut référencer prod_vendeurs_externes)
  vendeur_externe_id       uuid REFERENCES prod_vendeurs_externes(id) ON DELETE SET NULL,
  vendeur_nom              text NOT NULL,
  vendeur_telephone        text NOT NULL,
  vendeur_email            text NOT NULL,
  vendeur_type             text NOT NULL
                           CHECK (vendeur_type IN ('particulier','concessionnaire','encan','flotte','autre')),
  vendeur_adresse          text NOT NULL,
  vendeur_note             text NOT NULL DEFAULT '',

  -- Source (texte libre, ex: "Encan Manheim 2025-04-30")
  source                   text,

  -- Prix
  prix_demande_initial     decimal(10,2),
  prix_approuve            decimal(10,2),
  prix_contre_offre        decimal(10,2),
  prix_paye                decimal(10,2),

  -- Décision / destination
  destination              text                                  -- pieces / vente-detail (NULL avant approbation)
                           CHECK (destination IS NULL OR destination IN ('pieces','vente-detail')),
  approbateur_id           uuid REFERENCES profiles(id),

  -- Achat conclu
  ententes_vendeur         text,
  mode_transport           text                                  -- roule / towing
                           CHECK (mode_transport IS NULL OR mode_transport IN ('roule','towing')),
  adresse_pickup           text,
  contact_pickup           text,
  horaires_pickup          text,

  -- Paiement
  paye                     boolean NOT NULL DEFAULT false,
  date_paiement            timestamptz,
  paiement_par_id          uuid REFERENCES profiles(id),

  -- Annulation
  annulation_motif         text,

  -- Statut workflow (15 statuts)
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
                             'annulee',
                             'archivee'
                           )),

  -- Liens
  acheteur_id              uuid NOT NULL REFERENCES profiles(id),
  inventaire_id            uuid REFERENCES prod_inventaire(id),

  -- Méta
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  archived_at              timestamptz
);

CREATE INDEX IF NOT EXISTS idx_achats_statut         ON prod_achats (statut);
CREATE INDEX IF NOT EXISTS idx_achats_acheteur       ON prod_achats (acheteur_id);
CREATE INDEX IF NOT EXISTS idx_achats_destination    ON prod_achats (destination);
CREATE INDEX IF NOT EXISTS idx_achats_vendeur_ext    ON prod_achats (vendeur_externe_id);
CREATE INDEX IF NOT EXISTS idx_achats_created        ON prod_achats (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_achats_inventaire     ON prod_achats (inventaire_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION set_achats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_achats_updated_at ON prod_achats;
CREATE TRIGGER trg_achats_updated_at
BEFORE UPDATE ON prod_achats
FOR EACH ROW EXECUTE FUNCTION set_achats_updated_at();

ALTER TABLE prod_achats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "achats_select_authenticated" ON prod_achats;
CREATE POLICY "achats_select_authenticated"
  ON prod_achats FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "achats_write_staff" ON prod_achats;
CREATE POLICY "achats_write_staff"
  ON prod_achats FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')));

ALTER PUBLICATION supabase_realtime ADD TABLE prod_achats;

-- ═══ 5. Photos achats ════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS prod_achats_photos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id     uuid NOT NULL REFERENCES prod_achats(id) ON DELETE CASCADE,
  url          text NOT NULL,
  tag          text,                                            -- exterieur / interieur / moteur / chassis / defaut / documents / pickup
  ordre        int NOT NULL DEFAULT 0,
  uploaded_by  uuid REFERENCES profiles(id),
  uploaded_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achats_photos_achat ON prod_achats_photos (achat_id, ordre);

ALTER TABLE prod_achats_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "achats_photos_select" ON prod_achats_photos;
CREATE POLICY "achats_photos_select" ON prod_achats_photos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "achats_photos_write" ON prod_achats_photos;
CREATE POLICY "achats_photos_write" ON prod_achats_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')));

ALTER PUBLICATION supabase_realtime ADD TABLE prod_achats_photos;

-- ═══ 6. Évaluations initiales (Stéphane + Roger obligatoire) ════════
CREATE TABLE IF NOT EXISTS prod_achats_evaluations_initiales (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id               uuid NOT NULL REFERENCES prod_achats(id) ON DELETE CASCADE,
  evaluateur_id          uuid NOT NULL REFERENCES profiles(id),
  mon_estimation         decimal(10,2) NOT NULL,
  prix_attendu_vendeur   decimal(10,2) NOT NULL,
  commentaire            text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (achat_id, evaluateur_id)
);

ALTER TABLE prod_achats_evaluations_initiales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eval_init_select" ON prod_achats_evaluations_initiales;
CREATE POLICY "eval_init_select" ON prod_achats_evaluations_initiales FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "eval_init_write" ON prod_achats_evaluations_initiales;
CREATE POLICY "eval_init_write" ON prod_achats_evaluations_initiales FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')));

ALTER PUBLICATION supabase_realtime ADD TABLE prod_achats_evaluations_initiales;

-- ═══ 7. Évaluations finales (Joel + Jason + Régis) ══════════════════
CREATE TABLE IF NOT EXISTS prod_achats_evaluations_finales (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id               uuid NOT NULL REFERENCES prod_achats(id) ON DELETE CASCADE,
  evaluateur_id          uuid NOT NULL REFERENCES profiles(id),
  prix_propose           decimal(10,2) NOT NULL,
  recommandation         text NOT NULL
                         CHECK (recommandation IN ('acheter','negocier','passer')),
  destination_suggeree   text
                         CHECK (destination_suggeree IS NULL OR destination_suggeree IN ('pieces','vente-detail','indetermine')),
  commentaire            text,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  UNIQUE (achat_id, evaluateur_id)
);

ALTER TABLE prod_achats_evaluations_finales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "eval_finale_select" ON prod_achats_evaluations_finales;
CREATE POLICY "eval_finale_select" ON prod_achats_evaluations_finales FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "eval_finale_write" ON prod_achats_evaluations_finales;
CREATE POLICY "eval_finale_write" ON prod_achats_evaluations_finales FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')));

ALTER PUBLICATION supabase_realtime ADD TABLE prod_achats_evaluations_finales;

-- ═══ 8. Décisions (audit trail) ══════════════════════════════════════
CREATE TABLE IF NOT EXISTS prod_achats_decisions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id     uuid NOT NULL REFERENCES prod_achats(id) ON DELETE CASCADE,
  decideur_id  uuid NOT NULL REFERENCES profiles(id),
  type         text NOT NULL
               CHECK (type IN (
                 'approbation','refus',
                 'contre-offre-acceptee','contre-offre-refusee',
                 'transfert','annulation','re-ouverture'
               )),
  montant      decimal(10,2),
  destination  text,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achats_decisions_achat ON prod_achats_decisions (achat_id, created_at DESC);

ALTER TABLE prod_achats_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "decisions_select" ON prod_achats_decisions;
CREATE POLICY "decisions_select" ON prod_achats_decisions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "decisions_insert" ON prod_achats_decisions;
CREATE POLICY "decisions_insert" ON prod_achats_decisions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')));

ALTER PUBLICATION supabase_realtime ADD TABLE prod_achats_decisions;

-- ═══ 9. Notifications in-app (badges + futur email) ══════════════════
CREATE TABLE IF NOT EXISTS prod_achats_notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinataire_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achat_id        uuid NOT NULL REFERENCES prod_achats(id) ON DELETE CASCADE,
  type            text NOT NULL,                                 -- achat-conclu / mention / contre-offre / paiement-attendu / etc.
  message         text,
  lu              boolean NOT NULL DEFAULT false,
  email_envoye    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  lu_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_notif_destinataire ON prod_achats_notifications (destinataire_id, lu, created_at DESC);

ALTER TABLE prod_achats_notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifs_select_destinataire" ON prod_achats_notifications;
CREATE POLICY "notifs_select_destinataire"
  ON prod_achats_notifications FOR SELECT TO authenticated
  USING (destinataire_id = auth.uid());
DROP POLICY IF EXISTS "notifs_update_destinataire" ON prod_achats_notifications;
CREATE POLICY "notifs_update_destinataire"
  ON prod_achats_notifications FOR UPDATE TO authenticated
  USING (destinataire_id = auth.uid());
DROP POLICY IF EXISTS "notifs_insert_authenticated" ON prod_achats_notifications;
CREATE POLICY "notifs_insert_authenticated"
  ON prod_achats_notifications FOR INSERT TO authenticated
  WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE prod_achats_notifications;

-- ═══ 10. Towing ══════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS prod_achats_towing (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achat_id            uuid NOT NULL UNIQUE REFERENCES prod_achats(id) ON DELETE CASCADE,
  conducteur_id       uuid REFERENCES prod_conducteurs(id) ON DELETE SET NULL,
  vehicule_remorque   text,
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

CREATE INDEX IF NOT EXISTS idx_towing_statut ON prod_achats_towing (statut);

ALTER TABLE prod_achats_towing ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "towing_select" ON prod_achats_towing;
CREATE POLICY "towing_select" ON prod_achats_towing FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "towing_write" ON prod_achats_towing;
CREATE POLICY "towing_write" ON prod_achats_towing FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role IN ('gestion','planification','employe')));

ALTER PUBLICATION supabase_realtime ADD TABLE prod_achats_towing;

-- ═══ Vérification ════════════════════════════════════════════════════
SELECT
  (SELECT COUNT(*) FROM prod_conducteurs)              AS nb_conducteurs,
  (SELECT COUNT(*) FROM prod_vendeurs_externes)        AS nb_vendeurs_ext,
  (SELECT COUNT(*) FROM prod_achats)                   AS nb_achats;

-- Tables créées :
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename LIKE 'prod_achats%' OR tablename = 'prod_conducteurs' OR tablename = 'prod_vendeurs_externes'
ORDER BY tablename;
