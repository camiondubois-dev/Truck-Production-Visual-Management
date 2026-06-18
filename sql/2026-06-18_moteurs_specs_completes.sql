-- ════════════════════════════════════════════════════════════════
-- Module Moteurs — Specs complètes (moteur diesel camion lourd usagé)
--
-- Champs standards des revendeurs (Adelman's, Vander Haags, etc.).
-- TOUS OPTIONNELS (nullable) — « s'il ne l'a pas, il ne l'a pas ».
-- (marque, modele, serie, annee, epa, ghg, puissance_hp, code_moteur,
--  millage existent déjà.)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE prod_moteurs
  ADD COLUMN IF NOT EXISTS esn              text,      -- N° de série moteur (Engine Serial Number)
  ADD COLUMN IF NOT EXISTS cpl              text,      -- CPL / N° d'arrangement (Cummins, etc.)
  ADD COLUMN IF NOT EXISTS cylindree        text,      -- Cylindrée (ex. '12.9L', '15L')
  ADD COLUMN IF NOT EXISTS configuration    text,      -- Configuration (ex. 'L6', 'V8')
  ADD COLUMN IF NOT EXISTS couple_lb_ft     integer,   -- Couple (lb-pi)
  ADD COLUMN IF NOT EXISTS rpm              integer,   -- Régime max (RPM)
  ADD COLUMN IF NOT EXISTS heures           integer,   -- Heures moteur
  ADD COLUMN IF NOT EXISTS condition_moteur text,      -- ex. 'Running takeout', 'Rebuild', 'Core', 'Testé'
  ADD COLUMN IF NOT EXISTS frein_moteur     text;      -- Frein moteur / Jake : 'oui' | 'non' | null
