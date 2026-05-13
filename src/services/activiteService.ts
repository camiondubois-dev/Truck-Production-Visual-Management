import { supabase } from '../lib/supabase';

export interface PresenceRecord {
  utilisateur_nom:  string;
  utilisateur_role: string;
  page_id:          string;
  page_label:       string;
  app:              string;
  updated_at:       string;
}

export interface ActiviteRecord {
  id:               string;
  utilisateur_nom:  string;
  utilisateur_role: string;
  page_id:          string;
  page_label:       string;
  app:              string;
  created_at:       string;
}

export interface FiltresHistorique {
  dateDebut?:    string; // YYYY-MM-DD
  dateFin?:      string; // YYYY-MM-DD
  utilisateur?:  string;
  pageId?:       string;
  limit?:        number;
}

export const activiteService = {

  async mettreAJourPresence(
    nom:   string,
    role:  string,
    pageId: string,
    pageLabel: string,
    app = 'desktop',
  ): Promise<void> {
    await supabase.from('prod_presence').upsert(
      { utilisateur_nom: nom, utilisateur_role: role, page_id: pageId, page_label: pageLabel, app, updated_at: new Date().toISOString() },
      { onConflict: 'utilisateur_nom' },
    );
  },

  async loguerNavigation(
    nom:      string,
    role:     string,
    pageId:   string,
    pageLabel: string,
    app = 'desktop',
  ): Promise<void> {
    await supabase.from('prod_activite_log').insert(
      { utilisateur_nom: nom, utilisateur_role: role, page_id: pageId, page_label: pageLabel, app },
    );
  },

  async getPresence(): Promise<PresenceRecord[]> {
    const { data } = await supabase
      .from('prod_presence')
      .select('*')
      .order('updated_at', { ascending: false });
    return data ?? [];
  },

  async getHistorique(filtres: FiltresHistorique = {}): Promise<ActiviteRecord[]> {
    let q = supabase
      .from('prod_activite_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(filtres.limit ?? 1000);

    if (filtres.dateDebut)   q = q.gte('created_at', filtres.dateDebut + 'T00:00:00');
    if (filtres.dateFin)     q = q.lte('created_at', filtres.dateFin   + 'T23:59:59');
    if (filtres.utilisateur) q = q.eq('utilisateur_nom', filtres.utilisateur);
    if (filtres.pageId)      q = q.eq('page_id', filtres.pageId);

    const { data } = await q;
    return data ?? [];
  },

  async getUtilisateursDistincts(): Promise<string[]> {
    const { data } = await supabase
      .from('prod_activite_log')
      .select('utilisateur_nom')
      .order('utilisateur_nom');
    if (!data) return [];
    return [...new Set(data.map((r: any) => r.utilisateur_nom as string))];
  },
};
