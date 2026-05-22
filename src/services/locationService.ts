// ════════════════════════════════════════════════════════════════
// Service Locations Camions (table prod_locations)
//
// Règles :
//   • Un seul contrat ACTIF (date_fin IS NULL) par camion à la fois
//   • Historique conservé : un camion peut avoir plusieurs lignes
//     (loué → retourné → reloué à un autre client)
//   • Cumul auto : (mois écoulés depuis date_debut) × montant_mensuel
//     calculé côté DB via la vue prod_locations_avec_cumul
// ════════════════════════════════════════════════════════════════
import { supabase } from '../lib/supabase';

export interface Location {
  id:              string;
  stockNumero:     string;
  client:          string | null;
  vendeurId:       string | null;
  dateDebut:       string;          // ISO date 'YYYY-MM-DD'
  dateFin:         string | null;
  montantMensuel:  number;
  notes:           string | null;
  createdAt:       string;
  updatedAt:       string;
}

/** Ligne enrichie avec cumul calculé (vue prod_locations_avec_cumul) */
export interface LocationAvecCumul extends Location {
  actif:         boolean;
  moisEcoules:   number;
  revenuCumule:  number;
}

/** Agrégat par camion (vue prod_locations_total_par_camion) */
export interface LocationTotalCamion {
  stockNumero:           string;
  revenuLocationTotal:   number;
  nbContrats:            number;
  nbContratsActifs:      number;
  premiereLocation:      string;
  derniereActivite:      string;
}

function fromDB(row: any): Location {
  return {
    id:             row.id,
    stockNumero:    row.stock_numero,
    client:         row.client ?? null,
    vendeurId:      row.vendeur_id ?? null,
    dateDebut:      row.date_debut,
    dateFin:        row.date_fin ?? null,
    montantMensuel: Number(row.montant_mensuel),
    notes:          row.notes ?? null,
    createdAt:      row.created_at,
    updatedAt:      row.updated_at,
  };
}

function fromDBAvecCumul(row: any): LocationAvecCumul {
  return {
    ...fromDB(row),
    actif:        !!row.actif,
    moisEcoules:  Number(row.mois_ecoules ?? 0),
    revenuCumule: Number(row.revenu_cumule ?? 0),
  };
}

function fromDBTotal(row: any): LocationTotalCamion {
  return {
    stockNumero:         row.stock_numero,
    revenuLocationTotal: Number(row.revenu_location_total ?? 0),
    nbContrats:          Number(row.nb_contrats ?? 0),
    nbContratsActifs:    Number(row.nb_contrats_actifs ?? 0),
    premiereLocation:    row.premiere_location,
    derniereActivite:    row.derniere_activite,
  };
}

export const locationService = {
  /** Tous les contrats (avec cumul calculé), triés par date_debut DESC. */
  async getAll(): Promise<LocationAvecCumul[]> {
    const { data, error } = await supabase
      .from('prod_locations_avec_cumul')
      .select('*')
      .order('date_debut', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDBAvecCumul);
  },

  /** Contrats pour un camion spécifique (historique complet). */
  async getByStockNumero(stockNumero: string): Promise<LocationAvecCumul[]> {
    const { data, error } = await supabase
      .from('prod_locations_avec_cumul')
      .select('*')
      .eq('stock_numero', stockNumero)
      .order('date_debut', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDBAvecCumul);
  },

  /** Contrat actif (date_fin IS NULL) pour un camion, ou null. */
  async getActifByStockNumero(stockNumero: string): Promise<LocationAvecCumul | null> {
    const { data, error } = await supabase
      .from('prod_locations_avec_cumul')
      .select('*')
      .eq('stock_numero', stockNumero)
      .is('date_fin', null)
      .maybeSingle();
    if (error) throw error;
    return data ? fromDBAvecCumul(data) : null;
  },

  /** Tous les contrats actifs (en cours). */
  async getActifs(): Promise<LocationAvecCumul[]> {
    const { data, error } = await supabase
      .from('prod_locations_avec_cumul')
      .select('*')
      .is('date_fin', null)
      .order('date_debut', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDBAvecCumul);
  },

  /** Total cumulé par camion (tous les contrats confondus). */
  async getTotaux(): Promise<Record<string, LocationTotalCamion>> {
    const { data, error } = await supabase
      .from('prod_locations_total_par_camion')
      .select('*');
    if (error) throw error;
    const map: Record<string, LocationTotalCamion> = {};
    for (const row of data ?? []) {
      const t = fromDBTotal(row);
      map[t.stockNumero] = t;
    }
    return map;
  },

  /**
   * Crée un nouveau contrat de location.
   * Throw si un contrat actif existe déjà pour ce camion (contrainte unique DB).
   */
  async creer(payload: {
    stockNumero:    string;
    client:         string | null;
    vendeurId:      string | null;
    dateDebut:      string;
    montantMensuel: number;
    notes?:         string | null;
  }): Promise<Location> {
    const { data, error } = await supabase
      .from('prod_locations')
      .insert({
        stock_numero:    payload.stockNumero,
        client:          payload.client,
        vendeur_id:      payload.vendeurId,
        date_debut:      payload.dateDebut,
        date_fin:        null,
        montant_mensuel: payload.montantMensuel,
        notes:           payload.notes ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return fromDB(data);
  },

  /** Met à jour un contrat existant (champ par champ). */
  async modifier(id: string, patch: Partial<{
    client:         string | null;
    vendeurId:      string | null;
    dateDebut:      string;
    dateFin:        string | null;
    montantMensuel: number;
    notes:          string | null;
  }>): Promise<void> {
    const dbPatch: any = {};
    if ('client'         in patch) dbPatch.client          = patch.client;
    if ('vendeurId'      in patch) dbPatch.vendeur_id      = patch.vendeurId;
    if ('dateDebut'      in patch) dbPatch.date_debut      = patch.dateDebut;
    if ('dateFin'        in patch) dbPatch.date_fin        = patch.dateFin;
    if ('montantMensuel' in patch) dbPatch.montant_mensuel = patch.montantMensuel;
    if ('notes'          in patch) dbPatch.notes           = patch.notes;
    const { error } = await supabase
      .from('prod_locations')
      .update(dbPatch)
      .eq('id', id);
    if (error) throw error;
  },

  /** Termine le contrat actif d'un camion (date_fin = date donnée ou today). */
  async terminer(id: string, dateFin: string = new Date().toISOString().slice(0, 10)): Promise<void> {
    const { error } = await supabase
      .from('prod_locations')
      .update({ date_fin: dateFin })
      .eq('id', id);
    if (error) throw error;
  },

  async supprimer(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_locations')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
