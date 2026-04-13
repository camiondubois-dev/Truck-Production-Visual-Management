/*
  # Add slot_id to prod_reservoirs for peinture station tracking

  Peinture station slots exclusively track reservoirs (prod_reservoirs), not trucks.
  This migration adds a slot_id column so a reservoir can be assigned to a peinture slot.
  The 'en-peinture' etat is used while the reservoir occupies a peinture slot.
*/

ALTER TABLE prod_reservoirs
  ADD COLUMN IF NOT EXISTS slot_id text;
