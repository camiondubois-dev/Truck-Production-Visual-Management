// ════════════════════════════════════════════════════════════════
// Service Main-d'œuvre — Phase 1
// CRUD sur prod_employes + helpers pour prod_work_orders et prod_heures_employes
// (les imports + analytics arrivent en Phase 2/3)
// ════════════════════════════════════════════════════════════════

import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────

export interface Employe {
  id:                  string;
  nom:                 string;
  nomComplet:          string | null;       // nom complet (vs nom = code court iTrack)
  codeHitrac:          string | null;       // code iTrack (ex: 'atormis')
  noEmployeAcomba:     string | null;       // numéro Acomba (ex: '1021', '82-1558')
  departement:         string | null;
  tauxHoraire:         number;              // $/h (0 si payé à la semaine)
  salaireHebdomadaire: number | null;       // $/sem pour les salariés (sinon NULL)
  actif:               boolean;
  notes:               string | null;
  createdAt:           string;
  updatedAt:           string;
}

export interface WorkOrder {
  id:               string;
  woNumero:         string;
  type:             'interne' | 'externe';
  dateOuverture:    string | null;
  dateFermeture:    string | null;
  stockNumero:      string | null;  // si interne
  client:           string | null;  // si externe
  description:      string | null;
  statut:           'ouvert' | 'ferme' | 'facture';
  montantFacture:   number;
  coutPieces:       number;
  tauxFacturation:  number;          // $/h facturé (défaut 140)
}

export interface HeureEmploye {
  id:            string;
  employeId:     string;
  woNumero:      string | null;
  date:          string;
  heures:        number;
  notes:         string | null;
  /** Taux figé au moment de l'import iTrack (null pour données avant migration). */
  tauxApplique:  number | null;
}

/** Agrégat par WO (vue prod_wo_cout_mo) */
export interface WoCoutMo {
  woNumero:        string;
  type:            'interne' | 'externe';
  stockNumero:     string | null;
  client:          string | null;
  montantFacture:  number;
  coutPieces:      number;
  tauxFacturation: number;          // $/h facturé
  totalHeures:     number;
  coutMoReel:      number;
  revenuMoCalcule: number;          // heures × taux_facturation
  profitMo:        number;          // revenu_mo_calcule − cout_mo_reel
  profitBrut:      number;          // (externe) montant_facture − pièces − cout_mo
}

/** Agrégat par camion (vue prod_camion_cout_mo_reel) */
export interface CamionCoutMoReel {
  stockNumero:             string;
  nbWo:                    number;
  totalHeures:             number;
  coutMoReelTotal:         number;
  revenuMoCalculeTotal:    number;
  profitMoTotal:           number;
}

// ─── Mappers ──────────────────────────────────────────────────────

function employeFromDB(row: any): Employe {
  return {
    id:                  row.id,
    nom:                 row.nom,
    nomComplet:          row.nom_complet ?? null,
    codeHitrac:          row.code_hitrac ?? null,
    noEmployeAcomba:     row.no_employe_acomba ?? null,
    departement:         row.departement ?? null,
    tauxHoraire:         Number(row.taux_horaire ?? 0),
    salaireHebdomadaire: row.salaire_hebdomadaire != null ? Number(row.salaire_hebdomadaire) : null,
    actif:               row.actif !== false,
    notes:               row.notes ?? null,
    createdAt:           row.created_at,
    updatedAt:           row.updated_at,
  };
}

function woFromDB(row: any): WorkOrder {
  return {
    id:              row.id,
    woNumero:        row.wo_numero,
    type:            row.type,
    dateOuverture:   row.date_ouverture ?? null,
    dateFermeture:   row.date_fermeture ?? null,
    stockNumero:     row.stock_numero ?? null,
    client:          row.client ?? null,
    description:     row.description ?? null,
    statut:          row.statut ?? 'ouvert',
    montantFacture:  Number(row.montant_facture ?? 0),
    coutPieces:      Number(row.cout_pieces ?? 0),
    tauxFacturation: Number(row.taux_facturation ?? 140),
  };
}

function heureFromDB(row: any): HeureEmploye {
  return {
    id:           row.id,
    employeId:    row.employe_id,
    woNumero:     row.wo_numero ?? null,
    date:         row.date,
    heures:       Number(row.heures),
    notes:        row.notes ?? null,
    tauxApplique: row.taux_horaire_applique != null ? Number(row.taux_horaire_applique) : null,
  };
}

// ─── Service CRUD employés ─────────────────────────────────────────

export const employeService = {
  async getAll(): Promise<Employe[]> {
    const { data, error } = await supabase
      .from('prod_employes')
      .select('*')
      .order('nom', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(employeFromDB);
  },

  async getActifs(): Promise<Employe[]> {
    const { data, error } = await supabase
      .from('prod_employes')
      .select('*')
      .eq('actif', true)
      .order('nom', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(employeFromDB);
  },

  async creer(payload: {
    nom:                  string;
    nomComplet?:          string | null;
    codeHitrac?:          string | null;
    noEmployeAcomba?:     string | null;
    departement?:         string | null;
    tauxHoraire:          number;
    salaireHebdomadaire?: number | null;
    notes?:               string | null;
  }): Promise<Employe> {
    const { data, error } = await supabase
      .from('prod_employes')
      .insert({
        nom:                  payload.nom.trim(),
        nom_complet:          payload.nomComplet ?? null,
        code_hitrac:          payload.codeHitrac ?? null,
        no_employe_acomba:    payload.noEmployeAcomba ?? null,
        departement:          payload.departement ?? null,
        taux_horaire:         payload.tauxHoraire,
        salaire_hebdomadaire: payload.salaireHebdomadaire ?? null,
        notes:                payload.notes ?? null,
        actif:                true,
      })
      .select()
      .single();
    if (error) throw error;
    return employeFromDB(data);
  },

  async modifier(id: string, patch: Partial<{
    nom:                  string;
    nomComplet:           string | null;
    codeHitrac:           string | null;
    noEmployeAcomba:      string | null;
    departement:          string | null;
    tauxHoraire:          number;
    salaireHebdomadaire:  number | null;
    actif:                boolean;
    notes:                string | null;
  }>): Promise<void> {
    const dbPatch: any = {};
    if ('nom'                 in patch) dbPatch.nom                  = patch.nom?.trim();
    if ('nomComplet'          in patch) dbPatch.nom_complet          = patch.nomComplet;
    if ('codeHitrac'          in patch) dbPatch.code_hitrac          = patch.codeHitrac;
    if ('noEmployeAcomba'     in patch) dbPatch.no_employe_acomba    = patch.noEmployeAcomba;
    if ('departement'         in patch) dbPatch.departement          = patch.departement;
    if ('tauxHoraire'         in patch) dbPatch.taux_horaire         = patch.tauxHoraire;
    if ('salaireHebdomadaire' in patch) dbPatch.salaire_hebdomadaire = patch.salaireHebdomadaire;
    if ('actif'               in patch) dbPatch.actif                = patch.actif;
    if ('notes'               in patch) dbPatch.notes                = patch.notes;
    const { error } = await supabase
      .from('prod_employes')
      .update(dbPatch)
      .eq('id', id);
    if (error) throw error;
  },

  async desactiver(id: string): Promise<void> {
    await this.modifier(id, { actif: false });
  },

  async reactiver(id: string): Promise<void> {
    await this.modifier(id, { actif: true });
  },

  /** Suppression définitive (uniquement si aucune heure pointée). */
  async supprimer(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_employes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// ─── Service WO + heures (lecture seule pour Phase 1) ──────────────

export const workOrderService = {
  async getAll(): Promise<WorkOrder[]> {
    const { data, error } = await supabase
      .from('prod_work_orders')
      .select('*')
      .order('date_ouverture', { ascending: false, nullsFirst: false });
    if (error) throw error;
    return (data ?? []).map(woFromDB);
  },

  async getByStock(stockNumero: string): Promise<WorkOrder[]> {
    const { data, error } = await supabase
      .from('prod_work_orders')
      .select('*')
      .eq('stock_numero', stockNumero)
      .order('date_ouverture', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(woFromDB);
  },

  async getCoutsByWo(): Promise<WoCoutMo[]> {
    const { data, error } = await supabase
      .from('prod_wo_cout_mo')
      .select('*');
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      woNumero:        r.wo_numero,
      type:            r.type,
      stockNumero:     r.stock_numero ?? null,
      client:          r.client ?? null,
      montantFacture:  Number(r.montant_facture ?? 0),
      coutPieces:      Number(r.cout_pieces ?? 0),
      tauxFacturation: Number(r.taux_facturation ?? 140),
      totalHeures:     Number(r.total_heures ?? 0),
      coutMoReel:      Number(r.cout_mo_reel ?? 0),
      revenuMoCalcule: Number(r.revenu_mo_calcule ?? 0),
      profitMo:        Number(r.profit_mo ?? 0),
      profitBrut:      Number(r.profit_brut ?? 0),
    }));
  },

  async getCoutMoParCamion(): Promise<Record<string, CamionCoutMoReel>> {
    const { data, error } = await supabase
      .from('prod_camion_cout_mo_reel')
      .select('*');
    if (error) throw error;
    const map: Record<string, CamionCoutMoReel> = {};
    for (const r of (data ?? [])) {
      const c: CamionCoutMoReel = {
        stockNumero:          (r as any).stock_numero,
        nbWo:                 Number((r as any).nb_wo ?? 0),
        totalHeures:          Number((r as any).total_heures ?? 0),
        coutMoReelTotal:      Number((r as any).cout_mo_reel_total ?? 0),
        revenuMoCalculeTotal: Number((r as any).revenu_mo_calcule_total ?? 0),
        profitMoTotal:        Number((r as any).profit_mo_total ?? 0),
      };
      map[c.stockNumero] = c;
    }
    return map;
  },
};

export const heuresService = {
  async getByEmploye(employeId: string, from?: string, to?: string): Promise<HeureEmploye[]> {
    let q = supabase
      .from('prod_heures_employes')
      .select('*')
      .eq('employe_id', employeId);
    if (from) q = q.gte('date', from);
    if (to)   q = q.lte('date', to);
    const { data, error } = await q.order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(heureFromDB);
  },

  async getByWo(woNumero: string): Promise<HeureEmploye[]> {
    const { data, error } = await supabase
      .from('prod_heures_employes')
      .select('*')
      .eq('wo_numero', woNumero)
      .order('date', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(heureFromDB);
  },

  /** Toutes les heures dans une plage (ou tout si pas de filtre). Paginé pour > 1000. */
  async getAll(from?: string, to?: string): Promise<HeureEmploye[]> {
    const PAGE = 1000;
    let offset = 0;
    let all: any[] = [];
    while (true) {
      let q = supabase.from('prod_heures_employes').select('*');
      if (from) q = q.gte('date', from);
      if (to)   q = q.lte('date', to);
      const { data, error } = await q.range(offset, offset + PAGE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return all.map(heureFromDB);
  },
};

// ─── Helpers de période ───────────────────────────────────────────

export type PreriodeOption = 'semaine_passee' | 'semaine' | 'mois' | 'trimestre' | 'annee_fiscale' | 'tout';

/** Retourne {from, to} en YYYY-MM-DD selon une option de période. */
export function periodeBounds(opt: PreriodeOption): { from: string | null; to: string | null; label: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  switch (opt) {
    case 'semaine_passee': {
      // Semaine précédente : lundi à dimanche
      const dow = now.getDay();
      const daysToMon = dow === 0 ? 6 : dow - 1;
      const monCet = new Date(now); monCet.setDate(now.getDate() - daysToMon); monCet.setHours(0,0,0,0);
      const monPasse = new Date(monCet); monPasse.setDate(monCet.getDate() - 7);
      const dimPasse = new Date(monPasse); dimPasse.setDate(monPasse.getDate() + 6);
      return { from: fmt(monPasse), to: fmt(dimPasse), label: 'Semaine passée' };
    }
    case 'semaine': {
      const dow = now.getDay();
      const daysToMon = dow === 0 ? 6 : dow - 1;
      const mon = new Date(now); mon.setDate(now.getDate() - daysToMon); mon.setHours(0,0,0,0);
      return { from: fmt(mon), to: fmt(now), label: 'Semaine en cours' };
    }
    case 'mois': {
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: fmt(first), to: fmt(now), label: 'Ce mois-ci' };
    }
    case 'trimestre': {
      const q = Math.floor(now.getMonth() / 3);
      const first = new Date(now.getFullYear(), q * 3, 1);
      return { from: fmt(first), to: fmt(now), label: 'Ce trimestre' };
    }
    case 'annee_fiscale': {
      // FY commence en juillet
      const fyStart = now.getMonth() >= 6
        ? new Date(now.getFullYear(), 6, 1)
        : new Date(now.getFullYear() - 1, 6, 1);
      return { from: fmt(fyStart), to: fmt(now), label: `AF ${now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1}` };
    }
    case 'tout':
    default:
      return { from: null, to: null, label: 'Toute la période' };
  }
}

// ─── Constantes utiles ────────────────────────────────────────────

export const DEPARTEMENTS_SUGGEREES = [
  'Mécanique',
  'Soudure',
  'Électrique',
  'Peinture',
  'Carrosserie',
  'Hydraulique',
  'Assemblage final',
  'Sous-traitance',
  'Autre',
];
