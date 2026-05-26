/**
 * useSupabaseKeepAlive — ping léger toutes les 25s pour maintenir
 * le WebSocket Supabase ouvert sur les écrans TV / affichage permanent.
 *
 * À utiliser UNE SEULE FOIS, au niveau racine (GarageContext ou App).
 * Remplace les deux heartbeats séparés dans GarageContext + InventaireContext.
 */
import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

const INTERVAL_MS = 25_000;

export function useSupabaseKeepAlive() {
  useEffect(() => {
    const heartbeat = setInterval(() => {
      supabase.from('prod_items').select('id').limit(1)
        .catch(() => {}); // ping silencieux — pas critique si ça échoue
    }, INTERVAL_MS);
    return () => clearInterval(heartbeat);
  }, []);
}
