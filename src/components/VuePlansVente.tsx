// ════════════════════════════════════════════════════════════════
// VuePlansVente — Onglet "Plans de vente" (sortie de Profitabilité)
//
// Wrapper qui charge invMeta puis rend VuePlans (qui contient toute
// la logique des plans). Accessible aux rôles gestion + vendeur.
// ════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { VuePlans, type InvMeta } from './VueProfitabilite';

export function VuePlansVente() {
  const [invMeta, setInvMeta] = useState<InvMeta[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from('prod_inventaire')
      .select('numero, marque, modele, annee, type')
      .then(({ data }) => {
        if (data) setInvMeta(data as InvMeta[]);
        setLoading(false);
      });
  }, []);

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: '#0f0e0b', color: 'white', padding: 20 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>📋 OUTIL DE PROJECTION</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: 'white' }}>Plans de vente</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 }}>
          Sélectionne des camions à venir, propose des prix → suis l'évolution de tes projections vs ventes réelles.
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.4)' }}>
          Chargement de l'inventaire…
        </div>
      ) : (
        <VuePlans invMeta={invMeta} />
      )}
    </div>
  );
}
