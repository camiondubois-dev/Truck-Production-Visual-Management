-- ════════════════════════════════════════════════════════════════════
-- Module Achats — Phase 2 Mobile
-- ════════════════════════════════════════════════════════════════════
-- Date : 2026-05-04
-- - PIN auth pour /achats (chaque acheteur a son PIN)
-- - Specs techniques détaillées sur prod_achats
-- - RLS étendue pour permettre au compte TV partagé d'accéder

-- ═══ 1. PIN sur profiles ═══════════════════════════════════════════
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS pin_achat text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_pin_achat_unique
  ON profiles (pin_achat) WHERE pin_achat IS NOT NULL;

-- Fonction publique pour identifier un profil par PIN
-- (callable par le compte TV partagé qui sert de base auth pour /achats)
CREATE OR REPLACE FUNCTION get_profile_by_pin(p_pin text)
RETURNS TABLE (id uuid, nom text, email text, roles_achat text[]) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.nom, p.email, p.roles_achat
  FROM profiles p
  WHERE p.pin_achat = p_pin
    AND p.actif = true
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_profile_by_pin(text) TO authenticated;

-- ═══ 2. Specs techniques détaillées sur prod_achats ════════════════
ALTER TABLE prod_achats
  -- Moteur
  ADD COLUMN IF NOT EXISTS moteur_marque       text,
  ADD COLUMN IF NOT EXISTS moteur_modele       text,
  ADD COLUMN IF NOT EXISTS moteur_hp           int,
  ADD COLUMN IF NOT EXISTS moteur_couple       int,         -- lb-ft
  ADD COLUMN IF NOT EXISTS moteur_epa          text,
  ADD COLUMN IF NOT EXISTS moteur_serie        text,        -- ex CM2350, CM871

  -- Transmission
  ADD COLUMN IF NOT EXISTS trans_type          text,        -- Manuelle / Auto / AMT
  ADD COLUMN IF NOT EXISTS trans_marque        text,
  ADD COLUMN IF NOT EXISTS trans_modele        text,
  ADD COLUMN IF NOT EXISTS trans_vitesses      text,        -- ex "10-speed", "13-speed"

  -- Différentiel
  ADD COLUMN IF NOT EXISTS differentiel_ratio  text,        -- "3.55", "4.11", etc.

  -- Suspension / châssis
  ADD COLUMN IF NOT EXISTS suspension          text,
  ADD COLUMN IF NOT EXISTS config_essieux      text,        -- 6x4, 4x2, 8x4, etc.
  ADD COLUMN IF NOT EXISTS empattement         int,         -- pouces (wheelbase)
  ADD COLUMN IF NOT EXISTS gvwr                text,

  -- Cabine
  ADD COLUMN IF NOT EXISTS type_cabine         text,
  ADD COLUMN IF NOT EXISTS taille_couchette    text,
  ADD COLUMN IF NOT EXISTS equipements_cabine  text[],

  -- Pneus
  ADD COLUMN IF NOT EXISTS pneus_avant         text,        -- ex "295/75R22.5"
  ADD COLUMN IF NOT EXISTS pneus_arriere       text,
  ADD COLUMN IF NOT EXISTS pneus_etat          text,        -- neufs / mi-vie / a-changer

  -- Géolocalisation manuelle
  ADD COLUMN IF NOT EXISTS lieu_localisation   text;        -- ville/ville pour pickup

-- ═══ 3. RLS étendue pour /achats (compte TV partagé inclus) ════════
-- On modifie les policies pour permettre au compte 'tv' d'écrire sur
-- les achats (il sert de compte partagé pour /achats mobile)

DROP POLICY IF EXISTS "achats_write_staff" ON prod_achats;
CREATE POLICY "achats_write_staff"
  ON prod_achats FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                 AND profiles.role IN ('gestion','planification','employe','tv')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('gestion','planification','employe','tv')));

DROP POLICY IF EXISTS "achats_photos_write" ON prod_achats_photos;
CREATE POLICY "achats_photos_write" ON prod_achats_photos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                 AND profiles.role IN ('gestion','planification','employe','tv')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('gestion','planification','employe','tv')));

DROP POLICY IF EXISTS "eval_init_write" ON prod_achats_evaluations_initiales;
CREATE POLICY "eval_init_write" ON prod_achats_evaluations_initiales FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                 AND profiles.role IN ('gestion','planification','employe','tv')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('gestion','planification','employe','tv')));

DROP POLICY IF EXISTS "eval_finale_write" ON prod_achats_evaluations_finales;
CREATE POLICY "eval_finale_write" ON prod_achats_evaluations_finales FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                 AND profiles.role IN ('gestion','planification','employe','tv')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('gestion','planification','employe','tv')));

DROP POLICY IF EXISTS "decisions_insert" ON prod_achats_decisions;
CREATE POLICY "decisions_insert" ON prod_achats_decisions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('gestion','planification','employe','tv')));

DROP POLICY IF EXISTS "towing_write" ON prod_achats_towing;
CREATE POLICY "towing_write" ON prod_achats_towing FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                 AND profiles.role IN ('gestion','planification','employe','tv')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('gestion','planification','employe','tv')));

DROP POLICY IF EXISTS "vendeurs_ext_write" ON prod_vendeurs_externes;
CREATE POLICY "vendeurs_ext_write" ON prod_vendeurs_externes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                 AND profiles.role IN ('gestion','planification','employe','tv')))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid()
                      AND profiles.role IN ('gestion','planification','employe','tv')));

-- ═══ Vérification ════════════════════════════════════════════════════
SELECT column_name FROM information_schema.columns
WHERE table_name = 'prod_achats' AND column_name LIKE '%moteur%' OR column_name LIKE 'trans%' OR column_name = 'differentiel_ratio'
ORDER BY column_name;
