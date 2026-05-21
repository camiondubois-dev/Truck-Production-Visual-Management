import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface FinancialData {
  stock_numero: string;
  prix_achat_reel: number | null;
  cout_mo: number | null;
  cout_total_investi: number | null;
  prix_demande: number | null;
}

export type FinancialMap = Record<string, FinancialData>;

/**
 * Fetch financial data from prod_ventes for a list of stock_numero values.
 * Also provides a mutation to update prix_demande in prod_ventes.
 *
 * Pass an empty array to skip fetching (gestion guard at call site).
 */
export function useFinancialData(stockNumeros: string[]): {
  dataByNumero: FinancialMap;
  loading: boolean;
  updatePrixDemande: (stockNumero: string, prix: number | null) => Promise<void>;
  setLocalPrixDemande: (stockNumero: string, prix: number | null) => void;
} {
  const [dataByNumero, setDataByNumero] = useState<FinancialMap>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (stockNumeros.length === 0) return;

    let cancelled = false;
    setLoading(true);

    // On utilise les VUES (accessibles via le compte TV) au lieu de prod_ventes directement.
    // - prod_inventaire_couts : camions en inventaire
    // - prod_rapport_profitabilite : camions vendus
    Promise.all([
      supabase
        .from('prod_inventaire_couts')
        .select('stock_numero, prix_achat_reel, cout_total_depense, cout_achat, prix_demande')
        .in('stock_numero', stockNumeros),
      supabase
        .from('prod_rapport_profitabilite')
        .select('stock_numero, prix_achat_reel, cout_mo, cout_total')
        .in('stock_numero', stockNumeros),
    ]).then(([invRes, ventRes]) => {
      if (cancelled) return;
      if (invRes.error)  console.error('[useFinancialData] inventaire_couts:', invRes.error);
      if (ventRes.error) console.error('[useFinancialData] rapport_profitabilite:', ventRes.error);

      const map: FinancialMap = {};

      // Camions en inventaire
      for (const row of (invRes.data ?? [])) {
        const r = row as any;
        map[r.stock_numero] = {
          stock_numero:       r.stock_numero,
          prix_achat_reel:    r.prix_achat_reel ?? r.cout_achat ?? null,
          cout_mo:            r.cout_total_depense ?? null,
          cout_total_investi: (r.cout_achat ?? 0) + (r.cout_total_depense ?? 0) || null,
          prix_demande:       r.prix_demande ?? null,
        };
      }

      // Camions vendus (écrase si jamais présent dans les deux)
      for (const row of (ventRes.data ?? [])) {
        const r = row as any;
        map[r.stock_numero] = {
          stock_numero:       r.stock_numero,
          prix_achat_reel:    r.prix_achat_reel ?? null,
          cout_mo:            r.cout_mo ?? null,
          cout_total_investi: r.cout_total ?? null,
          prix_demande:       map[r.stock_numero]?.prix_demande ?? null,
        };
      }

      setDataByNumero(map);
      setLoading(false);
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(stockNumeros.slice().sort())]);

  const updatePrixDemande = useCallback(async (stockNumero: string, prix: number | null) => {
    const { error } = await supabase
      .from('prod_ventes')
      .update({ prix_demande: prix })
      .eq('stock_numero', stockNumero);

    if (error) {
      console.error('[useFinancialData] update prix_demande error:', error);
      throw error;
    }

    // Optimistic update
    setDataByNumero(prev => ({
      ...prev,
      [stockNumero]: { ...(prev[stockNumero] ?? { stock_numero: stockNumero, prix_achat_reel: null, cout_mo: null, cout_total_investi: null }), prix_demande: prix },
    }));
  }, []);

  const setLocalPrixDemande = useCallback((stockNumero: string, prix: number | null) => {
    setDataByNumero(prev => ({
      ...prev,
      [stockNumero]: { ...(prev[stockNumero] ?? { stock_numero: stockNumero, prix_achat_reel: null, cout_mo: null, cout_total_investi: null }), prix_demande: prix },
    }));
  }, []);

  return { dataByNumero, loading, updatePrixDemande, setLocalPrixDemande };
}
