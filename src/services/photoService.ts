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

  /** Upload un PDF dans le bucket camions-photos/documents/ — retourne { url, storagePath } */
  async uploaderDocument(fichier: File): Promise<{ url: string; storagePath: string }> {
    const ext = fichier.name.split('.').pop()?.toLowerCase() ?? 'pdf';
    const storagePath = `documents/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

    const { error } = await supabase.storage
      .from('camions-photos')
      .upload(storagePath, fichier, {
        cacheControl: '3600',
        upsert: false,
        contentType: fichier.type || 'application/pdf',
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from('camions-photos')
      .getPublicUrl(storagePath);

    return { url: data.publicUrl, storagePath };
  },

  /** Upload des octets PDF (déjà remplis) dans documents/ — retourne { url, storagePath } */
  async uploaderDocumentBytes(data: Blob | ArrayBuffer | Uint8Array, ext = 'pdf'): Promise<{ url: string; storagePath: string }> {
    const storagePath = `documents/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error } = await supabase.storage
      .from('camions-photos')
      .upload(storagePath, data, { cacheControl: '3600', upsert: false, contentType: 'application/pdf' });
    if (error) throw error;
    const { data: pub } = supabase.storage.from('camions-photos').getPublicUrl(storagePath);
    return { url: pub.publicUrl, storagePath };
  },

  /** Supprime un document PDF du Storage via son storagePath */
  async supprimerDocumentStorage(storagePath: string): Promise<void> {
    if (!storagePath) return;
    const { error } = await supabase.storage
      .from('camions-photos')
      .remove([storagePath]);
    if (error) console.error('Erreur suppression document Storage:', error);
  },
};
