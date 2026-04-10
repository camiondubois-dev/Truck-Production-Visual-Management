import { supabase } from '../lib/supabase';
import type { VehiculeInventaire, EtapeFaite, RoadMapEtape } from '../types/inventaireTypes';

export function fromDB(row: any): VehiculeInventaire {
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
    roadMap: row.road_map ?? [],
    aUnReservoir: row.a_un_reservoir ?? false,
    reservoirId: row.reservoir_id ?? undefined,
    estPret: row.est_pret ?? false,
    etatCommercial: row.etat_commercial ?? 'non-vendu',
    dateLivraisonPlanifiee: row.date_livraison_planifiee ?? undefined,
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
    road_map: v.roadMap ?? [],
    a_un_reservoir: v.aUnReservoir ?? false,
    reservoir_id: v.reservoirId ?? null,
    est_pret: v.estPret ?? false,
    etat_commercial: v.etatCommercial ?? 'non-vendu',
    date_livraison_planifiee: v.dateLivraisonPlanifiee ?? null,
  };
}

export const inventaireService = {
  async getAll(): Promise<VehiculeInventaire[]> {
    const { data, error } = await supabase
      .from('prod_inventaire')
      .select('*')
      .neq('statut', 'archive')
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
        est_pret: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
  },

  async mettreAJourPhoto(id: string, photoUrl: string | null): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    // Sync vers prod_items si le véhicule est en production
    await supabase
      .from('prod_items')
      .update({ photo_url: photoUrl, updated_at: new Date().toISOString() })
      .eq('inventaire_id', id)
      .neq('etat', 'termine');
  },

  async mettreAJourType(id: string, type: 'eau' | 'detail'): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ type, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async mettreAJourVariante(id: string, variante: 'Neuf' | 'Usagé' | null): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ variante, updated_at: new Date().toISOString() })
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

  async mettreAJourRoadMap(id: string, roadMap: RoadMapEtape[]): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ road_map: roadMap, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async avancerRoadMap(id: string, stationTermineeId: string): Promise<void> {
    const { data } = await supabase
      .from('prod_inventaire')
      .select('road_map')
      .eq('id', id)
      .single();
    if (!data?.road_map) return;
    const roadMap: RoadMapEtape[] = data.road_map;
    const updated = roadMap.map(e =>
      e.stationId === stationTermineeId ? { ...e, statut: 'termine' as const } : e
    );
    // Set next 'planifie' step to 'en-attente'
    const doneIdx = updated.findIndex(e => e.stationId === stationTermineeId);
    if (doneIdx >= 0) {
      const next = updated.slice(doneIdx + 1).find(e => e.statut === 'planifie');
      if (next) {
        const nextIdx = updated.findIndex(e => e.stationId === next.stationId);
        updated[nextIdx] = { ...updated[nextIdx], statut: 'en-attente' };
      }
    }
    await supabase.from('prod_inventaire')
      .update({ road_map: updated, updated_at: new Date().toISOString() })
      .eq('id', id);
  },

  async mettreAJourReservoir(id: string, aUnReservoir: boolean, reservoirId: string | null): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ a_un_reservoir: aUnReservoir, reservoir_id: reservoirId, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    // Sync vers prod_items si le véhicule est actuellement en production
    await supabase
      .from('prod_items')
      .update({ a_un_reservoir: aUnReservoir, reservoir_id: reservoirId, updated_at: new Date().toISOString() })
      .eq('inventaire_id', id)
      .neq('etat', 'termine');
  },

  async marquerPret(id: string, estPret: boolean): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ est_pret: estPret, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async mettreAJourCommercial(id: string, etatCommercial: 'non-vendu' | 'reserve' | 'vendu' | 'location', dateLivraisonPlanifiee: string | null, clientAcheteur: string | null): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ etat_commercial: etatCommercial, date_livraison_planifiee: dateLivraisonPlanifiee, client_acheteur: clientAcheteur, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    // Sync vers prod_items si le véhicule est en production
    await supabase
      .from('prod_items')
      .update({ etat_commercial: etatCommercial, date_livraison_planifiee: dateLivraisonPlanifiee, client_acheteur: clientAcheteur, updated_at: new Date().toISOString() })
      .eq('inventaire_id', id)
      .neq('etat', 'termine');
  },

  async archiver(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ statut: 'archive', est_pret: false, updated_at: new Date().toISOString() })
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
