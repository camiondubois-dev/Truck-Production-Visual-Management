// ════════════════════════════════════════════════════════════════
// Service Conducteurs (table prod_conducteurs)
// ════════════════════════════════════════════════════════════════
import { supabase } from '../lib/supabase';
import type { Conducteur } from '../types/achatTypes';

function fromDB(row: any): Conducteur {
  return {
    id: row.id,
    nom: row.nom,
    telephone: row.telephone ?? undefined,
    email: row.email ?? undefined,
    peutTowing: row.peut_towing ?? false,
    peutChauffeur: row.peut_chauffeur ?? false,
    classePermis: row.classe_permis ?? undefined,
    notes: row.notes ?? undefined,
    actif: row.actif ?? true,
    createdAt: row.created_at,
  };
}

function toDB(c: Partial<Conducteur>): any {
  const out: any = {};
  if (c.nom            !== undefined) out.nom            = c.nom;
  if (c.telephone      !== undefined) out.telephone      = c.telephone ?? null;
  if (c.email          !== undefined) out.email          = c.email ?? null;
  if (c.peutTowing     !== undefined) out.peut_towing    = c.peutTowing;
  if (c.peutChauffeur  !== undefined) out.peut_chauffeur = c.peutChauffeur;
  if (c.classePermis   !== undefined) out.classe_permis  = c.classePermis ?? null;
  if (c.notes          !== undefined) out.notes          = c.notes ?? null;
  if (c.actif          !== undefined) out.actif          = c.actif;
  return out;
}

export const conducteurService = {
  async getAll(): Promise<Conducteur[]> {
    const { data, error } = await supabase
      .from('prod_conducteurs')
      .select('*')
      .order('nom', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async creer(c: Omit<Conducteur, 'id' | 'createdAt'>): Promise<Conducteur> {
    const { data, error } = await supabase
      .from('prod_conducteurs')
      .insert(toDB(c))
      .select()
      .single();
    if (error) throw error;
    return fromDB(data);
  },

  async mettreAJour(id: string, updates: Partial<Conducteur>): Promise<void> {
    const { error } = await supabase
      .from('prod_conducteurs')
      .update(toDB(updates))
      .eq('id', id);
    if (error) throw error;
  },

  async desactiver(id: string): Promise<void> {
    await this.mettreAJour(id, { actif: false });
  },
};
