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

    supabase
      .from('prod_ventes')
      .select('stock_numero, prix_achat_reel, cout_mo, cout_total_investi, prix_demande')
      .in('stock_numero', stockNumeros)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[useFinancialData] fetch error:', error);
        } else if (data) {
          const map: FinancialMap = {};
          for (const row of data) {
            map[row.stock_numero] = row as FinancialData;
          }
          setDataByNumero(map);
        }
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
