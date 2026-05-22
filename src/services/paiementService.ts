// ════════════════════════════════════════════════════════════════
// Service Paiements (table prod_ventes — colonnes paiement)
//
// Permet de gérer le suivi des paiements sur les ventes finalisées :
//   - statut_paiement       : paye | partiel | depot | po | non-paye
//   - montant_recu          : montant total reçu
//   - date_paiement_complet : date du paiement complet (NULL si pas encore)
//   - notes_paiement        : notes libres
// ════════════════════════════════════════════════════════════════
import { supabase } from '../lib/supabase';

export type StatutPaiement = 'paye' | 'partiel' | 'depot' | 'po' | 'non-paye';

export interface VentePaiement {
  stockNumero:          string;
  prixVente:            number | null;
  statutPaiement:       StatutPaiement;
  montantRecu:          number;
  datePaiementComplet:  string | null;
  notesPaiement:        string | null;
  // Calculés
  soldeARecevoir:       number;  // prix_vente − montant_recu
}

function fromDB(row: any): VentePaiement {
  const prix = row.prix_vente != null ? Number(row.prix_vente) : null;
  const recu = Number(row.montant_recu ?? 0);
  return {
    stockNumero:         row.stock_numero,
    prixVente:           prix,
    statutPaiement:      (row.statut_paiement ?? 'non-paye') as StatutPaiement,
    montantRecu:         recu,
    datePaiementComplet: row.date_paiement_complet ?? null,
    notesPaiement:       row.notes_paiement ?? null,
    soldeARecevoir:      prix != null ? Math.max(prix - recu, 0) : 0,
  };
}

export const paiementService = {
  /** Récupère les infos de paiement pour un seul camion. */
  async getOne(stockNumero: string): Promise<VentePaiement | null> {
    const { data, error } = await supabase
      .from('prod_ventes')
      .select('stock_numero, prix_vente, statut_paiement, montant_recu, date_paiement_complet, notes_paiement')
      .eq('stock_numero', stockNumero)
      .eq('statut', 'vendu')
      .maybeSingle();
    if (error) throw error;
    return data ? fromDB(data) : null;
  },

  /** Récupère TOUS les vendus avec leurs infos de paiement, triés par numéro de stock décroissant. */
  async getAllVendus(): Promise<VentePaiement[]> {
    const { data, error } = await supabase
      .from('prod_ventes')
      .select('stock_numero, prix_vente, statut_paiement, montant_recu, date_paiement_complet, notes_paiement')
      .eq('statut', 'vendu')
      .order('stock_numero', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  /** Récupère uniquement les vendus NON PAYÉS (= argent à venir), triés par numéro de stock. */
  async getNonPayes(): Promise<VentePaiement[]> {
    const { data, error } = await supabase
      .from('prod_ventes')
      .select('stock_numero, prix_vente, statut_paiement, montant_recu, date_paiement_complet, notes_paiement')
      .eq('statut', 'vendu')
      .neq('statut_paiement', 'paye')
      .order('stock_numero', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  /** Met à jour le statut + montant + notes. */
  async mettreAJour(stockNumero: string, patch: Partial<{
    statutPaiement:      StatutPaiement;
    montantRecu:         number;
    datePaiementComplet: string | null;
    notesPaiement:       string | null;
  }>): Promise<void> {
    const dbPatch: any = {};
    if ('statutPaiement'      in patch) dbPatch.statut_paiement       = patch.statutPaiement;
    if ('montantRecu'         in patch) dbPatch.montant_recu          = patch.montantRecu;
    if ('datePaiementComplet' in patch) dbPatch.date_paiement_complet = patch.datePaiementComplet;
    if ('notesPaiement'       in patch) dbPatch.notes_paiement        = patch.notesPaiement;

    const { error } = await supabase
      .from('prod_ventes')
      .update(dbPatch)
      .eq('stock_numero', stockNumero);
    if (error) throw error;
  },

  /** Raccourci : marquer comme entièrement payé aujourd'hui. */
  async marquerPaye(stockNumero: string, prixVente: number): Promise<void> {
    await this.mettreAJour(stockNumero, {
      statutPaiement:      'paye',
      montantRecu:         prixVente,
      datePaiementComplet: new Date().toISOString().slice(0, 10),
    });
  },
};

// ─── Helpers d'affichage ──────────────────────────────────────────

export const STATUT_LABELS: Record<StatutPaiement, string> = {
  'paye':     'Payé',
  'partiel':  'Paiement partiel',
  'depot':    'Dépôt reçu',
  'po':       'PO reçu',
  'non-paye': 'Non payé',
};

export const STATUT_COLORS: Record<StatutPaiement, string> = {
  'paye':     '#22c55e',
  'partiel':  '#f59e0b',
  'depot':    '#f59e0b',
  'po':       '#3b82f6',
  'non-paye': '#ef4444',
};

export const STATUT_EMOJIS: Record<StatutPaiement, string> = {
  'paye':     '✅',
  'partiel':  '🟠',
  'depot':    '💵',
  'po':       '📋',
  'non-paye': '⏳',
};
