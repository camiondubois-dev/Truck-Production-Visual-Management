import { supabase } from '../lib/supabase';
import type { Client } from '../types/clientTypes';

function fromDB(row: any): Client {
  return {
    id: row.id,
    numeroCompte: row.numero_compte ?? undefined,
    nom: row.nom,
    telephone: row.telephone ?? undefined,
    email: row.email ?? undefined,
    adresse: row.adresse ?? undefined,
    contact: row.contact ?? undefined,
    salesperson: row.salesperson ?? undefined,
    notes: row.notes ?? undefined,
    dateCreation: row.date_creation,
  };
}

function toDB(c: Client): any {
  return {
    id: c.id,
    numero_compte: c.numeroCompte ?? null,
    nom: c.nom,
    telephone: c.telephone ?? null,
    email: c.email ?? null,
    adresse: c.adresse ?? null,
    contact: c.contact ?? null,
    salesperson: c.salesperson ?? null,
    notes: c.notes ?? null,
    date_creation: c.dateCreation,
    updated_at: new Date().toISOString(),
  };
}

export const clientService = {
  async getAll(): Promise<Client[]> {
    const { data, error } = await supabase
      .from('prod_clients')
      .select('*')
      .order('nom', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async ajouter(client: Client): Promise<void> {
    const { error } = await supabase
      .from('prod_clients')
      .insert(toDB(client));
    if (error) throw error;
  },

  // ← AJOUT — import Excel en masse
  async importerPlusieurs(clients: Client[]): Promise<void> {
    const { error } = await supabase
      .from('prod_clients')
      .upsert(clients.map(toDB), { onConflict: 'nom' });
    if (error) throw error;
  },

  async mettreAJour(id: string, patch: Partial<Client>): Promise<void> {
    const partiel: any = {};
    if (patch.nom !== undefined)       partiel.nom = patch.nom;
    if (patch.telephone !== undefined) partiel.telephone = patch.telephone ?? null;
    if (patch.email !== undefined)     partiel.email = patch.email ?? null;
    if (patch.adresse !== undefined)   partiel.adresse = patch.adresse ?? null;
    if (patch.notes !== undefined)     partiel.notes = patch.notes ?? null;
    partiel.updated_at = new Date().toISOString();
    const { error } = await supabase
      .from('prod_clients')
      .update(partiel)
      .eq('id', id);
    if (error) throw error;
  },

  async supprimer(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_clients')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async rechercherParNom(nom: string): Promise<Client[]> {
    const { data, error } = await supabase
      .from('prod_clients')
      .select('*')
      .ilike('nom', `%${nom}%`)
      .order('nom', { ascending: true })
      .limit(10);
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },
};
