import { supabase } from '../lib/supabase';
import type { VehiculeInventaire, EtapeFaite } from '../types/inventaireTypes';

function fromDB(row: any): VehiculeInventaire {
  return {
    id: row.id,
    statut: row.statut,
    dateImport: row.date_import,
    dateEnProduction: row.date_en_production ?? undefined,
    jobId: row.job_id ?? undefined,
    numero: row.numero,
    type: row.type,
    variante: row.variante ?? undefined,
    marque: row.marque ?? undefined,
    modele: row.modele ?? undefined,
    annee: row.annee ?? undefined,
    clientAcheteur: row.client_acheteur ?? undefined,
    notes: row.notes ?? undefined,
    nomClient: row.nom_client ?? undefined,
    telephone: row.telephone ?? undefined,
    vehicule: row.vehicule ?? undefined,
    descriptionTravail: row.description_travail ?? undefined,
    descriptionTravaux: row.description_travaux ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    etapesFaites: row.etapes_faites ?? [],
    aUnReservoir: row.a_un_reservoir ?? false,
    reservoirId: row.reservoir_id ?? undefined,
  };
}

function toDB(v: VehiculeInventaire): any {
  return {
    id: v.id,
    statut: v.statut,
    date_import: v.dateImport,
    date_en_production: v.dateEnProduction ?? null,
    job_id: v.jobId ?? null,
    numero: v.numero,
    type: v.type,
    variante: v.variante ?? null,
    marque: v.marque ?? null,
    modele: v.modele ?? null,
    annee: v.annee ?? null,
    client_acheteur: v.clientAcheteur ?? null,
    notes: v.notes ?? null,
    nom_client: v.nomClient ?? null,
    telephone: v.telephone ?? null,
    vehicule: v.vehicule ?? null,
    description_travail: v.descriptionTravail ?? null,
    description_travaux: v.descriptionTravaux ?? null,
    photo_url: v.photoUrl ?? null,
    etapes_faites: v.etapesFaites ?? [],
    a_un_reservoir: v.aUnReservoir ?? false,
    reservoir_id: v.reservoirId ?? null,
  };
}

export const inventaireService = {
  async getAll(): Promise<VehiculeInventaire[]> {
    const { data, error } = await supabase
      .from('prod_inventaire')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async ajouter(v: VehiculeInventaire): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .insert(toDB(v));
    if (error) throw error;
  },

  async importerPlusieurs(vehicules: VehiculeInventaire[]): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .upsert(vehicules.map(toDB), { onConflict: 'numero' });
    if (error) throw error;
  },

  async marquerEnProduction(id: string, jobId: string): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({
        statut: 'en-production',
        job_id: jobId,
        date_en_production: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async marquerDisponible(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({
        statut: 'disponible',
        job_id: null,
        date_en_production: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  // ← AJOUT — synchroniser la photo vers l'inventaire
  async mettreAJourPhoto(id: string, photoUrl: string | null): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({
        photo_url: photoUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async mettreAJourType(id: string, type: 'eau' | 'detail'): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ type, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async mettreAJourEtapes(id: string, etapesFaites: EtapeFaite[]): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ etapes_faites: etapesFaites, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async mettreAJourReservoir(id: string, aUnReservoir: boolean, reservoirId: string | null): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ a_un_reservoir: aUnReservoir, reservoir_id: reservoirId, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async supprimer(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};