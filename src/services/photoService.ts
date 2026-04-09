import { supabase } from '../lib/supabase';

export const photoService = {

  async uploaderPhoto(fichier: File, dossier: 'items' | 'inventaire'): Promise<string> {
    const ext = fichier.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const nomFichier = `${dossier}/${Date.now()}-${Math.random().toString(36).slice(2,7)}.${ext}`;

    const { error } = await supabase.storage
      .from('camions-photos')
      .upload(nomFichier, fichier, {
        cacheControl: '3600',
        upsert: false,
        contentType: fichier.type,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('camions-photos')
      .getPublicUrl(nomFichier);

    return data.publicUrl;
  },

  async supprimerPhoto(url: string): Promise<void> {
    const partie = url.split('/camions-photos/')[1];
    if (!partie) return;

    const { error } = await supabase.storage
      .from('camions-photos')
      .remove([partie]);

    if (error) console.error('Erreur suppression photo:', error);
  },
};
