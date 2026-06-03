import { supabase } from '../lib/supabase';
import type { VehiculeInventaire, EtapeFaite, RoadMapEtape, DocumentVehicule } from '../types/inventaireTypes';
import type { Item, StationProgress } from '../types/item.types';

const generateUUID = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Un numéro de stock de camion valide est purement numérique et comporte ≥ 4 chiffres.
 * Rejette les WO ("1-XXXXX", "WO-XXXXX"), codes alphanumériques, etc.
 */
export function estStockCamionValide(numero: string | null | undefined): boolean {
  return /^\d{4,}$/.test((numero ?? '').trim());
}

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
    roadMap: (row.road_map ?? []).map((s: any) => ({
      ...s,
      id: s.id ?? generateUUID(),
    })),
    aUnReservoir: row.a_un_reservoir ?? false,
    reservoirId: row.reservoir_id ?? undefined,
    typeReservoirRequis: row.type_reservoir_requis ?? undefined,
    estPret: row.est_pret ?? false,
    etatCommercial: row.etat_commercial ?? 'non-vendu',
    prixAchat: row.prix_achat_reel ?? undefined,
    vendeurId: row.vendeur_id ?? undefined,
    dateLivraisonPlanifiee: row.date_livraison_planifiee ?? undefined,
    livraisonAsap: row.livraison_asap ?? false,
    lavageEtat: row.lavage_etat ?? 'a-faire',
    retoucheEtat: row.retouche_etat ?? 'a-faire',
    paiementDepot: row.paiement_depot ?? false,
    paiementComplet: row.paiement_complet ?? false,
    paiementPo: row.paiement_po ?? false,
    enFinancement: row.en_financement ?? false,
    montantDepot: row.montant_depot ?? undefined,
    dateDepot: row.date_depot ?? undefined,
    modePaiementDepot: row.mode_paiement_depot ?? undefined,
    documents: row.documents ?? [],
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
    type_reservoir_requis: v.typeReservoirRequis ?? null,
    est_pret: v.estPret ?? false,
    etat_commercial: v.etatCommercial ?? 'non-vendu',
    prix_achat_reel: v.prixAchat ?? null,
    vendeur_id: v.vendeurId ?? null,
    date_livraison_planifiee: v.dateLivraisonPlanifiee ?? null,
    livraison_asap: v.livraisonAsap ?? false,
    lavage_etat: v.lavageEtat ?? 'a-faire',
    retouche_etat: v.retoucheEtat ?? 'a-faire',
    paiement_depot: v.paiementDepot ?? false,
    paiement_complet: v.paiementComplet ?? false,
    paiement_po: v.paiementPo ?? false,
    documents: v.documents ?? [],
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

    // Synchroniser dans prod_ventes pour que age_jours et les coûts soient visibles
    // Guard : les jobs client ne vont JAMAIS dans prod_ventes (c'est pour eau/détail seulement)
    // Guard : on n'enregistre jamais un WO ou un numéro non-numérique dans prod_ventes
    if (v.type === 'client' || !estStockCamionValide(v.numero)) return;
    const vehiculeLabel = [v.annee, v.marque, v.modele].filter(Boolean).join(' ') || v.numero;
    await supabase.from('prod_ventes').upsert({
      stock_numero:    v.numero,
      statut:          'inventaire',
      source:          v.type === 'eau' ? 'eau' : 'detail',
      source_priorite: 3,
      vehicule:        vehiculeLabel,
      marque:          v.marque ?? null,
      modele:          v.modele ?? null,
      annee:           v.annee ?? null,
      date_achat:      v.dateImport ?? new Date().toISOString(),
      ...(v.prixAchat != null ? { prix_achat_reel: v.prixAchat } : {}),
    }, { onConflict: 'stock_numero', ignoreDuplicates: true });
  },

  async importerPlusieurs(vehicules: VehiculeInventaire[]): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .upsert(vehicules.map(toDB), { onConflict: 'numero' });
    if (error) throw error;

    // Synchroniser dans prod_ventes (ignoreDuplicates = ne pas écraser les vendus)
    // Guard : exclure les jobs client (prod_ventes = eau/détail seulement) et les WO/non-numériques
    const venteRows = vehicules.filter(v => v.type !== 'client' && estStockCamionValide(v.numero)).map(v => ({
      stock_numero:    v.numero,
      statut:          'inventaire',
      source:          v.type === 'eau' ? 'eau' : 'detail',
      source_priorite: 3,
      vehicule:        [v.annee, v.marque, v.modele].filter(Boolean).join(' ') || v.numero,
      marque:          v.marque ?? null,
      modele:          v.modele ?? null,
      annee:           v.annee ?? null,
      date_achat:      v.dateImport ?? new Date().toISOString(),
    }));
    await supabase.from('prod_ventes')
      .upsert(venteRows, { onConflict: 'stock_numero', ignoreDuplicates: true });
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

    // Idempotent : si l'étape est DÉJÀ terminée, ne rien faire
    const stepActuel = roadMap.find(e => e.stationId === stationTermineeId);
    if (stepActuel?.statut === 'termine') return;

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

  /**
   * Désarchive un véhicule : remet statut='disponible' et le réintroduit dans le pipeline.
   * Utilisé quand un client retourne un camion qui avait été archivé par erreur ou suite à un retour.
   */
  async desarchiver(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ statut: 'disponible', updated_at: new Date().toISOString() })
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

  // Crée automatiquement un prod_items pour un véhicule qui commence sa production
  // (appelé quand une étape road_map passe en 'en-attente' ou 'en-cours')
  async creerProdItemDepuisVehicule(v: VehiculeInventaire): Promise<string | null> {
    // Vérifier si un job actif existe déjà
    const { data: existing } = await supabase
      .from('prod_items')
      .select('id')
      .eq('inventaire_id', v.id)
      .neq('etat', 'termine')
      .maybeSingle();
    if (existing?.id) {
      // Déjà un job actif — s'assurer que prod_inventaire est bien marqué en-production
      await supabase
        .from('prod_inventaire')
        .update({ statut: 'en-production', job_id: existing.id, date_en_production: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', v.id);
      return existing.id;
    }

    const jobId = `item-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const now = new Date().toISOString();

    let label = '';
    if (v.type === 'client') label = v.nomClient ? `${v.nomClient} — ${v.descriptionTravail ?? ''}` : v.vehicule ?? v.numero;
    else label = `${v.marque ?? ''} ${v.modele ?? ''} ${v.annee ?? ''}`.trim() || v.numero;

    // Dériver les stationsActives depuis la road_map (toutes les étapes non-sautées)
    const roadMap = v.roadMap ?? [];
    const stationsActives = roadMap
      .filter(s => s.statut !== 'saute')
      .map(s => s.stationId)
      .filter((id, idx, arr) => arr.indexOf(id) === idx); // déduplique pour progression

    const progression: StationProgress[] = stationsActives.map(sid => {
      const step = roadMap.find(s => s.stationId === sid);
      const status = step?.statut === 'termine' ? 'termine' as const
        : step?.statut === 'en-cours' ? 'en-cours' as const
        : 'non-commence' as const;
      return { stationId: sid, status, subTasks: [] };
    });

    const nouvelItem: Partial<Item> & { id: string } = {
      id: jobId,
      type: v.type,
      numero: v.numero,
      label,
      etat: 'en-attente',
      date_creation: now,
      stationsActives,
      progression,
      stationActuelle: stationsActives[0],
      inventaireId: v.id,
      photoUrl: v.photoUrl,
      ...(v.variante && { variante: v.variante }),
      ...(v.marque && { marque: v.marque }),
      ...(v.modele && { modele: v.modele }),
      ...(v.annee && { annee: v.annee }),
      ...(v.clientAcheteur && { clientAcheteur: v.clientAcheteur }),
      ...(v.notes && { notes: v.notes }),
      ...(v.nomClient && { nomClient: v.nomClient }),
      ...(v.telephone && { telephone: v.telephone }),
      ...(v.vehicule && { vehicule: v.vehicule }),
      ...(v.descriptionTravail && { descriptionTravail: v.descriptionTravail }),
      ...(v.descriptionTravaux && { descriptionTravaux: v.descriptionTravaux }),
      aUnReservoir: v.aUnReservoir ?? false,
      reservoirId: v.reservoirId,
      etatCommercial: v.etatCommercial ?? 'non-vendu',
      dateLivraisonPlanifiee: v.dateLivraisonPlanifiee,
      clientAcheteur: v.clientAcheteur,
    };

    // Insérer dans prod_items
    const { error: insertError } = await supabase.from('prod_items').insert({
      id: jobId,
      type: nouvelItem.type,
      numero: nouvelItem.numero,
      label: nouvelItem.label,
      etat: 'en-attente',
      date_creation: now,
      stations_actives: stationsActives,
      progression: progression,
      station_actuelle: stationsActives[0] ?? null,
      inventaire_id: v.id,
      photo_url: v.photoUrl ?? null,
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
      a_un_reservoir: v.aUnReservoir ?? false,
      reservoir_id: v.reservoirId ?? null,
      etat_commercial: v.etatCommercial ?? 'non-vendu',
      date_livraison_planifiee: v.dateLivraisonPlanifiee ?? null,
    });
    if (insertError) throw insertError;

    // Mettre à jour prod_inventaire : statut en-production
    await supabase
      .from('prod_inventaire')
      .update({ statut: 'en-production', job_id: jobId, date_en_production: now, updated_at: now })
      .eq('id', v.id);

    return jobId;
  },

  // ── Documents PDF ─────────────────────────────────────────────
  // Stockés dans prod_inventaire.documents (JSONB) avec URLs Supabase Storage.
  // Max 3 documents par véhicule.

  async ajouterDocument(vehiculeId: string, doc: DocumentVehicule): Promise<void> {
    // Lire les docs actuels
    const { data, error: fetchErr } = await supabase
      .from('prod_inventaire')
      .select('documents')
      .eq('id', vehiculeId)
      .single();
    if (fetchErr) throw fetchErr;
    const existants: DocumentVehicule[] = data?.documents ?? [];
    if (existants.length >= 3) throw new Error('Maximum 3 documents par véhicule.');
    const nouveaux = [...existants, doc];
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ documents: nouveaux, updated_at: new Date().toISOString() })
      .eq('id', vehiculeId);
    if (error) throw error;
  },

  async supprimerDocument(vehiculeId: string, docId: string): Promise<{ storagePath: string }> {
    const { data, error: fetchErr } = await supabase
      .from('prod_inventaire')
      .select('documents')
      .eq('id', vehiculeId)
      .single();
    if (fetchErr) throw fetchErr;
    const existants: DocumentVehicule[] = data?.documents ?? [];
    const aSupprimer = existants.find(d => d.id === docId);
    const nouveaux = existants.filter(d => d.id !== docId);
    const { error } = await supabase
      .from('prod_inventaire')
      .update({ documents: nouveaux, updated_at: new Date().toISOString() })
      .eq('id', vehiculeId);
    if (error) throw error;
    return { storagePath: aSupprimer?.storagePath ?? '' };
  },
};
