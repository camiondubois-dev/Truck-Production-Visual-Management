// ════════════════════════════════════════════════════════════════
// Auth /achats — PIN code identifie l'acheteur
// ════════════════════════════════════════════════════════════════
// Pattern : compte Supabase Auth partagé (TV) + PIN sélectionne
// quel acheteur est en train d'utiliser le téléphone.

import { supabase } from '../lib/supabase';

const STORAGE_KEYS = {
  profileId:   'achats_profile_id',
  profileNom:  'achats_profile_nom',
  rolesAchat:  'achats_profile_roles',
};

export interface AchatsSession {
  profileId: string;
  nom: string;
  rolesAchat: string[];
}

/** Récupère la session locale (PIN déjà entré). */
export function getAchatsSession(): AchatsSession | null {
  const profileId = localStorage.getItem(STORAGE_KEYS.profileId);
  const nom       = localStorage.getItem(STORAGE_KEYS.profileNom);
  const rolesStr  = localStorage.getItem(STORAGE_KEYS.rolesAchat);
  if (!profileId || !nom) return null;
  return {
    profileId,
    nom,
    rolesAchat: rolesStr ? JSON.parse(rolesStr) : [],
  };
}

/** Sauvegarde la session locale après PIN entré. */
export function saveAchatsSession(s: AchatsSession): void {
  localStorage.setItem(STORAGE_KEYS.profileId,  s.profileId);
  localStorage.setItem(STORAGE_KEYS.profileNom, s.nom);
  localStorage.setItem(STORAGE_KEYS.rolesAchat, JSON.stringify(s.rolesAchat));
}

/** Efface la session (logout). */
export function clearAchatsSession(): void {
  localStorage.removeItem(STORAGE_KEYS.profileId);
  localStorage.removeItem(STORAGE_KEYS.profileNom);
  localStorage.removeItem(STORAGE_KEYS.rolesAchat);
}

/**
 * Vérifie un PIN auprès de la BD via la fonction get_profile_by_pin.
 * Retourne le profil si trouvé, null sinon.
 */
export async function loginWithPin(pin: string): Promise<AchatsSession | null> {
  const { data, error } = await supabase.rpc('get_profile_by_pin', { p_pin: pin });
  if (error) {
    console.error('Erreur login PIN:', error);
    return null;
  }
  if (!data || data.length === 0) return null;
  const profile = data[0];
  const session: AchatsSession = {
    profileId: profile.id,
    nom: profile.nom ?? 'Sans nom',
    rolesAchat: profile.roles_achat ?? [],
  };
  saveAchatsSession(session);
  return session;
}

/**
 * Login automatique du compte Supabase Auth partagé.
 * Réutilise le compte TV (VITE_TV_EMAIL / VITE_TV_PASSWORD) — déjà configuré.
 */
export async function ensureSharedAuth(): Promise<boolean> {
  // Vérifier si déjà connecté
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return true;

  const email    = import.meta.env.VITE_TV_EMAIL    as string | undefined;
  const password = import.meta.env.VITE_TV_PASSWORD as string | undefined;
  if (!email || !password) {
    console.error('VITE_TV_EMAIL ou VITE_TV_PASSWORD non défini dans .env');
    return false;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('Erreur connexion Auth partagé:', error);
    return false;
  }
  return true;
}
