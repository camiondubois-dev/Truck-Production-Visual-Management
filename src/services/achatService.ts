// ════════════════════════════════════════════════════════════════
// Service Achats (table prod_achats + tables liées)
// ════════════════════════════════════════════════════════════════
import { supabase } from '../lib/supabase';
import type {
  Achat, AchatPhoto, EvaluationInitiale, EvaluationFinale,
  DecisionAchat, NotificationAchat, AchatTowing, StatutAchat,
} from '../types/achatTypes';

// ── Mappers ─────────────────────────────────────────────────────
export function fromDB(row: any): Achat {
  return {
    id: row.id,
    marque: row.marque ?? undefined,
    modele: row.modele ?? undefined,
    annee: row.annee ?? undefined,
    vin: row.vin ?? undefined,
    kilometrage: row.kilometrage ?? undefined,
    specs: row.specs ?? {},
    etatGeneral: row.etat_general ?? undefined,
    defautsConnus: row.defauts_connus ?? undefined,
    vendeurExterneId: row.vendeur_externe_id ?? undefined,
    vendeurNom: row.vendeur_nom,
    vendeurTelephone: row.vendeur_telephone,
    vendeurEmail: row.vendeur_email,
    vendeurType: row.vendeur_type,
    vendeurAdresse: row.vendeur_adresse,
    vendeurNote: row.vendeur_note ?? '',
    source: row.source ?? undefined,
    prixDemandeInitial: row.prix_demande_initial ?? undefined,
    prixApprouve: row.prix_approuve ?? undefined,
    prixContreOffre: row.prix_contre_offre ?? undefined,
    prixPaye: row.prix_paye ?? undefined,
    destination: row.destination ?? undefined,
    approbateurId: row.approbateur_id ?? undefined,
    ententesVendeur: row.ententes_vendeur ?? undefined,
    modeTransport: row.mode_transport ?? undefined,
    adressePickup: row.adresse_pickup ?? undefined,
    contactPickup: row.contact_pickup ?? undefined,
    horairesPickup: row.horaires_pickup ?? undefined,
    paye: row.paye ?? false,
    datePaiement: row.date_paiement ?? undefined,
    paiementParId: row.paiement_par_id ?? undefined,
    annulationMotif: row.annulation_motif ?? undefined,
    statut: row.statut,
    acheteurId: row.acheteur_id,
    inventaireId: row.inventaire_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at ?? undefined,
  };
}

function toDB(a: Partial<Achat>): any {
  const out: any = {};
  if (a.marque              !== undefined) out.marque                  = a.marque ?? null;
  if (a.modele              !== undefined) out.modele                  = a.modele ?? null;
  if (a.annee               !== undefined) out.annee                   = a.annee ?? null;
  if (a.vin                 !== undefined) out.vin                     = a.vin ?? null;
  if (a.kilometrage         !== undefined) out.kilometrage             = a.kilometrage ?? null;
  if (a.specs               !== undefined) out.specs                   = a.specs ?? {};
  if (a.etatGeneral         !== undefined) out.etat_general            = a.etatGeneral ?? null;
  if (a.defautsConnus       !== undefined) out.defauts_connus          = a.defautsConnus ?? null;
  if (a.vendeurExterneId    !== undefined) out.vendeur_externe_id      = a.vendeurExterneId ?? null;
  if (a.vendeurNom          !== undefined) out.vendeur_nom             = a.vendeurNom;
  if (a.vendeurTelephone    !== undefined) out.vendeur_telephone       = a.vendeurTelephone;
  if (a.vendeurEmail        !== undefined) out.vendeur_email           = a.vendeurEmail;
  if (a.vendeurType         !== undefined) out.vendeur_type            = a.vendeurType;
  if (a.vendeurAdresse      !== undefined) out.vendeur_adresse         = a.vendeurAdresse;
  if (a.vendeurNote         !== undefined) out.vendeur_note            = a.vendeurNote ?? '';
  if (a.source              !== undefined) out.source                  = a.source ?? null;
  if (a.prixDemandeInitial  !== undefined) out.prix_demande_initial    = a.prixDemandeInitial ?? null;
  if (a.prixApprouve        !== undefined) out.prix_approuve           = a.prixApprouve ?? null;
  if (a.prixContreOffre     !== undefined) out.prix_contre_offre       = a.prixContreOffre ?? null;
  if (a.prixPaye            !== undefined) out.prix_paye               = a.prixPaye ?? null;
  if (a.destination         !== undefined) out.destination             = a.destination ?? null;
  if (a.approbateurId       !== undefined) out.approbateur_id          = a.approbateurId ?? null;
  if (a.ententesVendeur     !== undefined) out.ententes_vendeur        = a.ententesVendeur ?? null;
  if (a.modeTransport       !== undefined) out.mode_transport          = a.modeTransport ?? null;
  if (a.adressePickup       !== undefined) out.adresse_pickup          = a.adressePickup ?? null;
  if (a.contactPickup       !== undefined) out.contact_pickup          = a.contactPickup ?? null;
  if (a.horairesPickup      !== undefined) out.horaires_pickup         = a.horairesPickup ?? null;
  if (a.paye                !== undefined) out.paye                    = a.paye;
  if (a.datePaiement        !== undefined) out.date_paiement           = a.datePaiement ?? null;
  if (a.paiementParId       !== undefined) out.paiement_par_id         = a.paiementParId ?? null;
  if (a.annulationMotif     !== undefined) out.annulation_motif        = a.annulationMotif ?? null;
  if (a.statut              !== undefined) out.statut                  = a.statut;
  if (a.acheteurId          !== undefined) out.acheteur_id             = a.acheteurId;
  if (a.inventaireId        !== undefined) out.inventaire_id           = a.inventaireId ?? null;
  return out;
}

function photoFromDB(row: any): AchatPhoto {
  return {
    id: row.id,
    achatId: row.achat_id,
    url: row.url,
    tag: row.tag ?? undefined,
    ordre: row.ordre ?? 0,
    uploadedBy: row.uploaded_by ?? undefined,
    uploadedAt: row.uploaded_at,
  };
}

function evalInitFromDB(row: any): EvaluationInitiale {
  return {
    id: row.id,
    achatId: row.achat_id,
    evaluateurId: row.evaluateur_id,
    monEstimation: parseFloat(row.mon_estimation),
    prixAttenduVendeur: parseFloat(row.prix_attendu_vendeur),
    commentaire: row.commentaire ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function evalFinaleFromDB(row: any): EvaluationFinale {
  return {
    id: row.id,
    achatId: row.achat_id,
    evaluateurId: row.evaluateur_id,
    prixPropose: parseFloat(row.prix_propose),
    recommandation: row.recommandation,
    destinationSuggeree: row.destination_suggeree ?? undefined,
    commentaire: row.commentaire ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function decisionFromDB(row: any): DecisionAchat {
  return {
    id: row.id,
    achatId: row.achat_id,
    decideurId: row.decideur_id,
    type: row.type,
    montant: row.montant ?? undefined,
    destination: row.destination ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.created_at,
  };
}

function notifFromDB(row: any): NotificationAchat {
  return {
    id: row.id,
    destinataireId: row.destinataire_id,
    achatId: row.achat_id,
    type: row.type,
    message: row.message ?? undefined,
    lu: row.lu ?? false,
    emailEnvoye: row.email_envoye ?? false,
    createdAt: row.created_at,
    luAt: row.lu_at ?? undefined,
  };
}

function towingFromDB(row: any): AchatTowing {
  return {
    id: row.id,
    achatId: row.achat_id,
    conducteurId: row.conducteur_id ?? undefined,
    vehiculeRemorque: row.vehicule_remorque ?? undefined,
    datePrevue: row.date_prevue ?? undefined,
    dateDepart: row.date_depart ?? undefined,
    dateArrivee: row.date_arrivee ?? undefined,
    kmAller: row.km_aller ?? undefined,
    notes: row.notes ?? undefined,
    statut: row.statut,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Service ─────────────────────────────────────────────────────
export const achatService = {
  // ── Achats CRUD ─────────────────────────────────────────────
  async getAll(): Promise<Achat[]> {
    const { data, error } = await supabase
      .from('prod_achats')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async getById(id: string): Promise<Achat | null> {
    const { data, error } = await supabase
      .from('prod_achats')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? fromDB(data) : null;
  },

  async creer(a: Omit<Achat, 'id' | 'createdAt' | 'updatedAt'>): Promise<Achat> {
    const { data, error } = await supabase
      .from('prod_achats')
      .insert(toDB(a))
      .select()
      .single();
    if (error) throw error;
    return fromDB(data);
  },

  async mettreAJour(id: string, updates: Partial<Achat>): Promise<void> {
    const { error } = await supabase
      .from('prod_achats')
      .update(toDB(updates))
      .eq('id', id);
    if (error) throw error;
  },

  async changerStatut(id: string, statut: StatutAchat): Promise<void> {
    return this.mettreAJour(id, { statut });
  },

  // ── Photos ──────────────────────────────────────────────────
  async getPhotos(achatId: string): Promise<AchatPhoto[]> {
    const { data, error } = await supabase
      .from('prod_achats_photos')
      .select('*')
      .eq('achat_id', achatId)
      .order('ordre', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(photoFromDB);
  },

  async ajouterPhoto(achatId: string, url: string, tag?: string, uploadedBy?: string): Promise<AchatPhoto> {
    const { data: existing } = await supabase
      .from('prod_achats_photos')
      .select('ordre')
      .eq('achat_id', achatId)
      .order('ordre', { ascending: false })
      .limit(1);
    const nextOrdre = (existing?.[0]?.ordre ?? -1) + 1;

    const { data, error } = await supabase
      .from('prod_achats_photos')
      .insert({ achat_id: achatId, url, tag: tag ?? null, ordre: nextOrdre, uploaded_by: uploadedBy ?? null })
      .select()
      .single();
    if (error) throw error;
    return photoFromDB(data);
  },

  async supprimerPhoto(photoId: string): Promise<void> {
    const { error } = await supabase
      .from('prod_achats_photos')
      .delete()
      .eq('id', photoId);
    if (error) throw error;
  },

  // ── Évaluations initiales ───────────────────────────────────
  async getEvaluationsInitiales(achatId: string): Promise<EvaluationInitiale[]> {
    const { data, error } = await supabase
      .from('prod_achats_evaluations_initiales')
      .select('*')
      .eq('achat_id', achatId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(evalInitFromDB);
  },

  async upsertEvaluationInitiale(e: Omit<EvaluationInitiale, 'id' | 'createdAt' | 'updatedAt'>): Promise<EvaluationInitiale> {
    const { data, error } = await supabase
      .from('prod_achats_evaluations_initiales')
      .upsert({
        achat_id: e.achatId,
        evaluateur_id: e.evaluateurId,
        mon_estimation: e.monEstimation,
        prix_attendu_vendeur: e.prixAttenduVendeur,
        commentaire: e.commentaire ?? null,
      }, { onConflict: 'achat_id,evaluateur_id' })
      .select()
      .single();
    if (error) throw error;
    return evalInitFromDB(data);
  },

  // ── Évaluations finales ─────────────────────────────────────
  async getEvaluationsFinales(achatId: string): Promise<EvaluationFinale[]> {
    const { data, error } = await supabase
      .from('prod_achats_evaluations_finales')
      .select('*')
      .eq('achat_id', achatId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(evalFinaleFromDB);
  },

  async upsertEvaluationFinale(e: Omit<EvaluationFinale, 'id' | 'createdAt' | 'updatedAt'>): Promise<EvaluationFinale> {
    const { data, error } = await supabase
      .from('prod_achats_evaluations_finales')
      .upsert({
        achat_id: e.achatId,
        evaluateur_id: e.evaluateurId,
        prix_propose: e.prixPropose,
        recommandation: e.recommandation,
        destination_suggeree: e.destinationSuggeree ?? null,
        commentaire: e.commentaire ?? null,
      }, { onConflict: 'achat_id,evaluateur_id' })
      .select()
      .single();
    if (error) throw error;
    return evalFinaleFromDB(data);
  },

  // ── Décisions (audit) ───────────────────────────────────────
  async getDecisions(achatId: string): Promise<DecisionAchat[]> {
    const { data, error } = await supabase
      .from('prod_achats_decisions')
      .select('*')
      .eq('achat_id', achatId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(decisionFromDB);
  },

  async ajouterDecision(d: Omit<DecisionAchat, 'id' | 'createdAt'>): Promise<DecisionAchat> {
    const { data, error } = await supabase
      .from('prod_achats_decisions')
      .insert({
        achat_id: d.achatId,
        decideur_id: d.decideurId,
        type: d.type,
        montant: d.montant ?? null,
        destination: d.destination ?? null,
        note: d.note ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return decisionFromDB(data);
  },

  // ── Notifications ───────────────────────────────────────────
  async getNotificationsUtilisateur(userId: string, lues = false): Promise<NotificationAchat[]> {
    let q = supabase
      .from('prod_achats_notifications')
      .select('*')
      .eq('destinataire_id', userId);
    if (!lues) q = q.eq('lu', false);
    const { data, error } = await q.order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(notifFromDB);
  },

  async creerNotification(destinataireId: string, achatId: string, type: string, message?: string): Promise<void> {
    const { error } = await supabase
      .from('prod_achats_notifications')
      .insert({ destinataire_id: destinataireId, achat_id: achatId, type, message: message ?? null });
    if (error) throw error;
  },

  async marquerLue(notifId: string): Promise<void> {
    const { error } = await supabase
      .from('prod_achats_notifications')
      .update({ lu: true, lu_at: new Date().toISOString() })
      .eq('id', notifId);
    if (error) throw error;
  },

  // ── Towing ──────────────────────────────────────────────────
  async getTowing(achatId: string): Promise<AchatTowing | null> {
    const { data, error } = await supabase
      .from('prod_achats_towing')
      .select('*')
      .eq('achat_id', achatId)
      .maybeSingle();
    if (error) throw error;
    return data ? towingFromDB(data) : null;
  },

  async upsertTowing(t: Partial<AchatTowing> & { achatId: string }): Promise<AchatTowing> {
    const out: any = { achat_id: t.achatId };
    if (t.conducteurId    !== undefined) out.conducteur_id    = t.conducteurId ?? null;
    if (t.vehiculeRemorque!== undefined) out.vehicule_remorque= t.vehiculeRemorque ?? null;
    if (t.datePrevue      !== undefined) out.date_prevue      = t.datePrevue ?? null;
    if (t.dateDepart      !== undefined) out.date_depart      = t.dateDepart ?? null;
    if (t.dateArrivee     !== undefined) out.date_arrivee     = t.dateArrivee ?? null;
    if (t.kmAller         !== undefined) out.km_aller         = t.kmAller ?? null;
    if (t.notes           !== undefined) out.notes            = t.notes ?? null;
    if (t.statut          !== undefined) out.statut           = t.statut;

    const { data, error } = await supabase
      .from('prod_achats_towing')
      .upsert(out, { onConflict: 'achat_id' })
      .select()
      .single();
    if (error) throw error;
    return towingFromDB(data);
  },
};
