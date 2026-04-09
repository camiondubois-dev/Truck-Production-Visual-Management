import { supabase } from '../lib/supabase';
import type { Reservoir } from '../types/reservoirTypes';

function fromDB(row: any): Reservoir {
  return {
    id: row.id,
    numero: row.numero,
    type: row.type,
    etat: row.etat,
    camionId: row.camion_id ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
  };
}

function toDB(r: Reservoir): any {
  return {
    id: r.id,
    numero: r.numero,
    type: r.type,
    etat: r.etat,
    camion_id: r.camionId ?? null,
    notes: r.notes ?? null,
  };
}

export const reservoirService = {
  async getAll(): Promise<Reservoir[]> {
    const { data, error } = await supabase
      .from('prod_reservoirs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async ajouter(r: Reservoir): Promise<void> {
    const { error } = await supabase
      .from('prod_reservoirs')
      .insert(toDB(r));
    if (error) throw error;
  },

  async installerSurCamion(reservoirId: string, camionId: string): Promise<void> {
    const { error: rErr } = await supabase
      .from('prod_reservoirs')
      .update({ etat: 'installe', camion_id: camionId })
      .eq('id', reservoirId);
    if (rErr) throw rErr;

    const { error: iErr } = await supabase
      .from('prod_items')
      .update({ a_un_reservoir: true, reservoir_id: reservoirId })
      .eq('id', camionId);
    if (iErr) throw iErr;

    const { data: itemData } = await supabase
      .from('prod_items')
      .select('inventaire_id')
      .eq('id', camionId)
      .maybeSingle();

    if (itemData?.inventaire_id) {
      await supabase
        .from('prod_inventaire')
        .update({ a_un_reservoir: true, reservoir_id: reservoirId })
        .eq('id', itemData.inventaire_id);
    }
  },

  async desinstallerDuCamion(reservoirId: string, camionId: string): Promise<void> {
    const { error: rErr } = await supabase
      .from('prod_reservoirs')
      .update({ etat: 'disponible', camion_id: null })
      .eq('id', reservoirId);
    if (rErr) throw rErr;

    const { error: iErr } = await supabase
      .from('prod_items')
      .update({ a_un_reservoir: false, reservoir_id: null })
      .eq('id', camionId);
    if (iErr) throw iErr;

    const { data: itemData } = await supabase
      .from('prod_items')
      .select('inventaire_id')
      .eq('id', camionId)
      .maybeSingle();

    if (itemData?.inventaire_id) {
      await supabase
        .from('prod_inventaire')
        .update({ a_un_reservoir: false, reservoir_id: null })
        .eq('id', itemData.inventaire_id);
    }
  },

  async installerSurInventaire(reservoirId: string, inventaireId: string): Promise<void> {
    const { error: rErr } = await supabase
      .from('prod_reservoirs')
      .update({ etat: 'installe', camion_id: inventaireId })
      .eq('id', reservoirId);
    if (rErr) throw rErr;

    const { error: iErr } = await supabase
      .from('prod_inventaire')
      .update({ a_un_reservoir: true, reservoir_id: reservoirId })
      .eq('id', inventaireId);
    if (iErr) throw iErr;
  },

  async desinstallerDeInventaire(reservoirId: string, inventaireId: string): Promise<void> {
    const { error: rErr } = await supabase
      .from('prod_reservoirs')
      .update({ etat: 'disponible', camion_id: null })
      .eq('id', reservoirId);
    if (rErr) throw rErr;

    const { error: iErr } = await supabase
      .from('prod_inventaire')
      .update({ a_un_reservoir: false, reservoir_id: null })
      .eq('id', inventaireId);
    if (iErr) throw iErr;
  },

  async supprimer(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_reservoirs')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
