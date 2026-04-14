/*
  # Add type_reservoir_requis to prod_inventaire

  Allows planning which type of reservoir (2500g, 3750g, 4000g, 5000g)
  each water truck needs. Set via the RoadMapEditor during production planning.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'prod_inventaire' AND column_name = 'type_reservoir_requis'
  ) THEN
    ALTER TABLE prod_inventaire ADD COLUMN type_reservoir_requis text;
  END IF;
END $$;
