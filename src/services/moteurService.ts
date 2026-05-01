// ════════════════════════════════════════════════════════════════
// Module Moteurs — Service Supabase
// ════════════════════════════════════════════════════════════════
import { supabase } from '../lib/supabase';
import type { Moteur, EtapeMoteur, StatutMoteur, ProprietaireMoteur } from '../types/engineTypes';

// ── Mappers DB ↔ App ─────────────────────────────────────────────
export function fromDB(row: any): Moteur {
  return {
    id: row.id,
    stkNumero: row.stk_numero,
    workOrder: row.work_order ?? undefined,
    descriptionMoteur: row.description_moteur ?? undefined,
    proprietaire: (row.proprietaire ?? 'interne') as ProprietaireMoteur,
    nomClient: row.nom_client ?? undefined,
    etatCommercial: row.etat_commercial ?? undefined,
    notes: row.notes ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    statut: (row.statut ?? 'en-attente') as StatutMoteur,
    posteCourant: row.poste_courant ?? undefined,
    employeCourant: row.employe_courant ?? undefined,
    dateEntree: row.date_entree ?? undefined,
    dateSortie: row.date_sortie ?? undefined,
    roadMap: Array.isArray(row.road_map) ? row.road_map.map(fromDBEtape) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function fromDBEtape(e: any): EtapeMoteur {
  return {
    id: e.id,
    etapeId: e.etape_id ?? e.etapeId,
    ordre: e.ordre,
    statut: e.statut,
    employeId: e.employe_id ?? e.employeId,
    debut: e.debut,
    fin: e.fin,
    dureeMinutes: e.duree_minutes ?? e.dureeMinutes,
    note: e.note,
  };
}

function toDB(m: Partial<Moteur>): any {
  const out: any = {};
  if (m.stkNumero         !== undefined) out.stk_numero          = m.stkNumero;
  if (m.workOrder         !== undefined) out.work_order          = m.workOrder ?? null;
  if (m.descriptionMoteur !== undefined) out.description_moteur  = m.descriptionMoteur ?? null;
  if (m.proprietaire      !== undefined) out.proprietaire        = m.proprietaire;
  if (m.nomClient         !== undefined) out.nom_client          = m.nomClient ?? null;
  if (m.etatCommercial    !== undefined) out.etat_commercial     = m.etatCommercial ?? null;
  if (m.notes             !== undefined) out.notes               = m.notes ?? null;
  if (m.photoUrl          !== undefined) out.photo_url           = m.photoUrl ?? null;
  if (m.statut            !== undefined) out.statut              = m.statut;
  if (m.posteCourant      !== undefined) out.poste_courant       = m.posteCourant ?? null;
  if (m.employeCourant    !== undefined) out.employe_courant     = m.employeCourant ?? null;
  if (m.dateEntree        !== undefined) out.date_entree         = m.dateEntree ?? null;
  if (m.dateSortie        !== undefined) out.date_sortie         = m.dateSortie ?? null;
  if (m.roadMap           !== undefined) out.road_map            = m.roadMap.map(toDBEtape);
  return out;
}

function toDBEtape(e: EtapeMoteur): any {
  return {
    id: e.id,
    etape_id: e.etapeId,
    ordre: e.ordre,
    statut: e.statut,
    employe_id: e.employeId ?? null,
    debut: e.debut ?? null,
    fin: e.fin ?? null,
    duree_minutes: e.dureeMinutes ?? null,
    note: e.note ?? null,
  };
}

// ── CRUD ─────────────────────────────────────────────────────────
export const moteurService = {
  async getAll(): Promise<Moteur[]> {
    const { data, error } = await supabase
      .from('prod_moteurs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(fromDB);
  },

  async getById(id: string): Promise<Moteur | null> {
    const { data, error } = await supabase
      .from('prod_moteurs')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? fromDB(data) : null;
  },

  async creer(m: Omit<Moteur, 'id' | 'createdAt' | 'updatedAt'>): Promise<Moteur> {
    const { data, error } = await supabase
      .from('prod_moteurs')
      .insert(toDB(m))
      .select()
      .single();
    if (error) throw error;
    return fromDB(data);
  },

  async mettreAJour(id: string, updates: Partial<Moteur>): Promise<void> {
    const { error } = await supabase
      .from('prod_moteurs')
      .update(toDB(updates))
      .eq('id', id);
    if (error) throw error;
  },

  async supprimer(id: string): Promise<void> {
    const { error } = await supabase
      .from('prod_moteurs')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  // ── Actions métier ────────────────────────────────────────────
  /** Démarre une étape : statut → en-cours, debut = now, employé assigné. */
  async demarrerEtape(moteurId: string, etapeUuid: string, employeId: string): Promise<void> {
    const moteur = await moteurService.getById(moteurId);
    if (!moteur) throw new Error('Moteur introuvable');
    const now = new Date().toISOString();

    const updatedRoadMap = moteur.roadMap.map(e =>
      e.id === etapeUuid
        ? { ...e, statut: 'en-cours' as const, employeId, debut: now, fin: undefined, dureeMinutes: undefined }
        : e
    );

    // Si le moteur n'a pas encore de date d'entrée, on la met
    const updates: Partial<Moteur> = {
      roadMap: updatedRoadMap,
      statut: 'en-cours',
      employeCourant: employeId,
    };
    if (!moteur.dateEntree) updates.dateEntree = now;

    await moteurService.mettreAJour(moteurId, updates);
  },

  /** Termine une étape : statut → termine, fin = now, durée calculée. */
  async terminerEtape(moteurId: string, etapeUuid: string): Promise<void> {
    const moteur = await moteurService.getById(moteurId);
    if (!moteur) throw new Error('Moteur introuvable');
    const etape = moteur.roadMap.find(e => e.id === etapeUuid);
    if (!etape) throw new Error('Étape introuvable');

    const now = new Date().toISOString();
    const dureeMinutes = etape.debut
      ? Math.max(0, Math.round((new Date(now).getTime() - new Date(etape.debut).getTime()) / 60000))
      : undefined;

    const updatedRoadMap = moteur.roadMap.map(e =>
      e.id === etapeUuid
        ? { ...e, statut: 'termine' as const, fin: now, dureeMinutes }
        : e
    );

    // Vérifier si toutes les étapes sont finies
    const toutesFinies = updatedRoadMap.every(e => e.statut === 'termine' || e.statut === 'saute');
    const updates: Partial<Moteur> = { roadMap: updatedRoadMap };

    if (toutesFinies) {
      updates.statut = 'pret';
      updates.dateSortie = now;
      updates.employeCourant = undefined;
    } else {
      // Encore des étapes : libère l'employé courant si plus d'étapes en-cours
      const encoreEnCours = updatedRoadMap.some(e => e.statut === 'en-cours');
      if (!encoreEnCours) updates.employeCourant = undefined;
    }

    await moteurService.mettreAJour(moteurId, updates);
  },

  /** Saute une étape (skip). */
  async sauterEtape(moteurId: string, etapeUuid: string): Promise<void> {
    const moteur = await moteurService.getById(moteurId);
    if (!moteur) throw new Error('Moteur introuvable');

    const updatedRoadMap = moteur.roadMap.map(e =>
      e.id === etapeUuid ? { ...e, statut: 'saute' as const } : e
    );

    const toutesFinies = updatedRoadMap.every(e => e.statut === 'termine' || e.statut === 'saute');
    const updates: Partial<Moteur> = { roadMap: updatedRoadMap };
    if (toutesFinies) {
      updates.statut = 'pret';
      updates.dateSortie = new Date().toISOString();
      updates.employeCourant = undefined;
    }

    await moteurService.mettreAJour(moteurId, updates);
  },

  /** Re-planifie une étape (revert termine/sauté → planifié). */
  async replanifierEtape(moteurId: string, etapeUuid: string): Promise<void> {
    const moteur = await moteurService.getById(moteurId);
    if (!moteur) throw new Error('Moteur introuvable');

    const updatedRoadMap = moteur.roadMap.map(e =>
      e.id === etapeUuid
        ? { ...e, statut: 'planifie' as const, debut: undefined, fin: undefined, dureeMinutes: undefined }
        : e
    );

    // Si le moteur était 'pret', repasse à 'en-cours' (ou 'en-attente' si rien d'actif)
    let nouveauStatut: StatutMoteur = moteur.statut;
    if (moteur.statut === 'pret') {
      const actif = updatedRoadMap.some(e => e.statut === 'en-cours');
      nouveauStatut = actif ? 'en-cours' : 'en-attente';
    }

    await moteurService.mettreAJour(moteurId, {
      roadMap: updatedRoadMap,
      statut: nouveauStatut,
      dateSortie: nouveauStatut === 'pret' ? moteur.dateSortie : undefined,
    });
  },

  /** Déplace un moteur vers un autre slot (poste). */
  async deplacer(moteurId: string, posteCible: string | null): Promise<void> {
    await moteurService.mettreAJour(moteurId, { posteCourant: posteCible ?? undefined });
  },

  /** Archive (sortie de l'atelier). */
  async archiver(moteurId: string): Promise<void> {
    await moteurService.mettreAJour(moteurId, {
      statut: 'archive',
      posteCourant: undefined,
      employeCourant: undefined,
    });
  },
};
