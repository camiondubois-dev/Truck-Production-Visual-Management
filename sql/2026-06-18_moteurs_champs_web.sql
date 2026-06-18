-- ════════════════════════════════════════════════════════════════
-- Module Moteurs — Champs « Préparation site Web » (étape 7)
--
-- Ajoute les champs saisis à l'étape 7 pour préparer l'annonce web :
--   • millage   : kilométrage/millage du moteur (champ neuf)
--   • info_web  : description / notes de l'annonce
--   • lien_web  : URL de l'annonce une fois publiée (sert à l'étape 8)
-- ════════════════════════════════════════════════════════════════

ALTER TABLE prod_moteurs
  ADD COLUMN IF NOT EXISTS millage   integer,
  ADD COLUMN IF NOT EXISTS info_web  text,
  ADD COLUMN IF NOT EXISTS lien_web  text;
