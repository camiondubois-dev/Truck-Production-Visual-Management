// ════════════════════════════════════════════════════════════════
// Service Vendeurs (table prod_vendeurs)
// ════════════════════════════════════════════════════════════════
import { supabase } from '../lib/supabase';

export interface Vendeur {
  id: string;
  nom: string;
  actif: boolean;
  createdAt: string;
}

function fromDB(row: any): Vendeur {
  return {
    id: row.id,
    nom: row.nom,
    actif: row.actif ?? true,
    createdAt: row.created_at,
  };
}

export const vendeurService = {
  async getAll(): Promise<Vendeur[]> {
    const { data, error } = await supabase
      .from('prod_vendeurs')
      .select('*')
      .order('nom', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async creer(nom: string): Promise<Vendeur> {
    const trimmed = nom.trim().toUpperCase();
    if (!trimmed) throw new Error('Nom vide');
    const { data, error } = await supabase
      .from('prod_vendeurs')
      .insert({ nom: trimmed, actif: true })
      .select()
      .single();
    if (error) throw error;
    return fromDB(data);
  },

  async desactiver(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_vendeurs')
      .update({ actif: false })
      .eq('id', id);
    if (error) throw error;
  },
};
