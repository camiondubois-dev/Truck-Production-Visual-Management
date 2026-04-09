import { supabase } from '../lib/supabase';
import type { Item } from '../types/item.types';

function fromDB(row: any): Item {
  return {
    id: row.id,
    type: row.type,
    etat: row.etat,
    numero: row.numero,
    label: row.label,
    slotId: row.slot_id ?? undefined,
    dateCreation: row.date_creation,
    dateEntreeSlot: row.date_entree_slot ?? undefined,
    dateArchive: row.date_archive ?? undefined,
    stationActuelle: row.station_actuelle ?? undefined,
    dernierGarageId: row.dernier_garage_id ?? undefined,
    dernierSlotId: row.dernier_slot_id ?? undefined,
    urgence: row.urgence ?? false,
    notes: row.notes ?? undefined,
    etatCommercial: row.etat_commercial ?? undefined,
    clientAcheteur: row.client_acheteur ?? undefined,
    variante: row.variante ?? undefined,
    annee: row.annee ?? undefined,
    marque: row.marque ?? undefined,
    modele: row.modele ?? undefined,
    nomClient: row.nom_client ?? undefined,
    telephone: row.telephone ?? undefined,
    descriptionTravail: row.description_travail ?? undefined,
    vehicule: row.vehicule ?? undefined,
    descriptionTravaux: row.description_travaux ?? undefined,
    stationsActives: row.stations_actives ?? [],
    progression: row.progression ?? [],
    documents: row.documents ?? [],
    inventaireId: row.inventaire_id ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    clientId: row.client_id ?? undefined,
    aUnReservoir: row.a_un_reservoir ?? false,
    reservoirId: row.reservoir_id ?? undefined,
  };
}

function toDB(item: Item): any {
  return {
    id: item.id,
    type: item.type,
    etat: item.etat,
    numero: item.numero,
    label: item.label,
    slot_id: item.slotId ?? null,
    date_creation: item.dateCreation,
    date_entree_slot: item.dateEntreeSlot ?? null,
    date_archive: item.dateArchive ?? null,
    station_actuelle: item.stationActuelle ?? null,
    dernier_garage_id: item.dernierGarageId ?? null,
    dernier_slot_id: item.dernierSlotId ?? null,
    urgence: item.urgence ?? false,
    notes: item.notes ?? null,
    etat_commercial: item.etatCommercial ?? null,
    client_acheteur: item.clientAcheteur ?? null,
    variante: item.variante ?? null,
    annee: item.annee ?? null,
    marque: item.marque ?? null,
    modele: item.modele ?? null,
    nom_client: item.nomClient ?? null,
    telephone: item.telephone ?? null,
    description_travail: item.descriptionTravail ?? null,
    vehicule: item.vehicule ?? null,
    description_travaux: item.descriptionTravaux ?? null,
    stations_actives: item.stationsActives,
    progression: item.progression,
    documents: item.documents ?? [],
    inventaire_id: item.inventaireId ?? null,
    photo_url: item.photoUrl ?? null,
    client_id: item.clientId ?? null,
  };
}

export const itemsService = {
  async getAll(): Promise<Item[]> {
    const { data, error } = await supabase
      .from('prod_items')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async ajouter(item: Item): Promise<void> {
    if (item.inventaireId) {
      const { data: existants } = await supabase
        .from('prod_items')
        .select('id, etat')
        .eq('inventaire_id', item.inventaireId)
        .neq('etat', 'termine');
      if (existants && existants.length > 0) {
        throw new Error('Ce véhicule est déjà en production');
      }
    }
    const { error } = await supabase
      .from('prod_items')
      .insert(toDB(item));
    if (error) throw error;
  },

  async mettreAJour(id: string, patch: Partial<Item>): Promise<void> {
    const partiel: any = {};
    if (patch.type !== undefined)              partiel.type = patch.type;
    if (patch.etat !== undefined)              partiel.etat = patch.etat;
    if (patch.slotId !== undefined)            partiel.slot_id = patch.slotId ?? null;
    if (patch.stationActuelle !== undefined)   partiel.station_actuelle = patch.stationActuelle ?? null;
    if (patch.dernierGarageId !== undefined)   partiel.dernier_garage_id = patch.dernierGarageId ?? null;
    if (patch.dernierSlotId !== undefined)     partiel.dernier_slot_id = patch.dernierSlotId ?? null;
    if (patch.dateEntreeSlot !== undefined)    partiel.date_entree_slot = patch.dateEntreeSlot ?? null;
    if (patch.dateArchive !== undefined)       partiel.date_archive = patch.dateArchive ?? null;
    if (patch.urgence !== undefined)           partiel.urgence = patch.urgence;
    if (patch.notes !== undefined)             partiel.notes = patch.notes ?? null;
    if (patch.etatCommercial !== undefined)    partiel.etat_commercial = patch.etatCommercial ?? null;
    if (patch.clientAcheteur !== undefined)    partiel.client_acheteur = patch.clientAcheteur ?? null;
    if (patch.progression !== undefined)       partiel.progression = patch.progression;
    if (patch.stationsActives !== undefined)   partiel.stations_actives = patch.stationsActives;
    if (patch.documents !== undefined)         partiel.documents = patch.documents;
    if (patch.photoUrl !== undefined)          partiel.photo_url = patch.photoUrl ?? null;
    if (patch.clientId !== undefined)          partiel.client_id = patch.clientId ?? null;
    if (patch.aUnReservoir !== undefined)      partiel.a_un_reservoir = patch.aUnReservoir;
    if (patch.reservoirId !== undefined)       partiel.reservoir_id = patch.reservoirId ?? null;
    partiel.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from('prod_items')
      .update(partiel)
      .eq('id', id);
    if (error) throw error;
  },

  async supprimer(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_items')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
