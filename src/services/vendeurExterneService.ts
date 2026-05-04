// ════════════════════════════════════════════════════════════════
// Service Vendeurs externes (table prod_vendeurs_externes)
// ════════════════════════════════════════════════════════════════
import { supabase } from '../lib/supabase';
import type { VendeurExterne, TypeVendeur } from '../types/achatTypes';

function fromDB(row: any): VendeurExterne {
  return {
    id: row.id,
    nom: row.nom,
    type: row.type,
    telephonePrincipal: row.telephone_principal ?? undefined,
    email: row.email ?? undefined,
    adresse: row.adresse ?? undefined,
    note: row.note ?? undefined,
    foisUtilise: row.fois_utilise ?? 0,
    derniereUtilisation: row.derniere_utilisation ?? undefined,
    actif: row.actif ?? true,
    createdAt: row.created_at,
  };
}

function toDB(v: Partial<VendeurExterne>): any {
  const out: any = {};
  if (v.nom                !== undefined) out.nom                  = v.nom;
  if (v.type               !== undefined) out.type                 = v.type;
  if (v.telephonePrincipal !== undefined) out.telephone_principal  = v.telephonePrincipal ?? null;
  if (v.email              !== undefined) out.email                = v.email ?? null;
  if (v.adresse            !== undefined) out.adresse              = v.adresse ?? null;
  if (v.note               !== undefined) out.note                 = v.note ?? null;
  if (v.foisUtilise        !== undefined) out.fois_utilise         = v.foisUtilise;
  if (v.derniereUtilisation!== undefined) out.derniere_utilisation = v.derniereUtilisation ?? null;
  if (v.actif              !== undefined) out.actif                = v.actif;
  return out;
}

export const vendeurExterneService = {
  async getAll(actifSeulement = true): Promise<VendeurExterne[]> {
    let query = supabase.from('prod_vendeurs_externes').select('*');
    if (actifSeulement) query = query.eq('actif', true);
    const { data, error } = await query.order('nom', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async getOrCreate(nom: string, type: TypeVendeur): Promise<VendeurExterne> {
    const trimmed = nom.trim();
    // Try get first
    const { data: existant } = await supabase
      .from('prod_vendeurs_externes')
      .select('*')
      .ilike('nom', trimmed)
      .maybeSingle();
    if (existant) return fromDB(existant);

    // Create
    const { data, error } = await supabase
      .from('prod_vendeurs_externes')
      .insert({ nom: trimmed, type })
      .select()
      .single();
    if (error) throw error;
    return fromDB(data);
  },

  async mettreAJour(id: string, updates: Partial<VendeurExterne>): Promise<void> {
    const { error } = await supabase
      .from('prod_vendeurs_externes')
      .update(toDB(updates))
      .eq('id', id);
    if (error) throw error;
  },

  async incrementerUtilisation(id: string): Promise<void> {
    const { error } = await supabase.rpc('increment_vendeur_externe_utilisation', { vendeur_id: id });
    // Si la RPC n'existe pas, fallback: SELECT puis UPDATE manuel
    if (error) {
      const { data: current } = await supabase
        .from('prod_vendeurs_externes')
        .select('fois_utilise')
        .eq('id', id)
        .single();
      const nb = (current?.fois_utilise ?? 0) + 1;
      await supabase
        .from('prod_vendeurs_externes')
        .update({ fois_utilise: nb, derniere_utilisation: new Date().toISOString() })
        .eq('id', id);
    }
  },
};
