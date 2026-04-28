// Gestion de la session TV locale (localStorage)
// L'authentification Supabase est gérée séparément dans TVConnexion

const KEYS = {
  garageId: 'tv_garage_id',
  label:    'tv_label',
  code:     'tv_code',
} as const;

export interface TVSession {
  garageId: string;
  label: string;
  code: string;
}

export function getTVSession(): TVSession | null {
  const garageId = localStorage.getItem(KEYS.garageId);
  const label    = localStorage.getItem(KEYS.label);
  const code     = localStorage.getItem(KEYS.code);
  if (garageId && label && code) return { garageId, label, code };
  return null;
}

export function saveTVSession(garageId: string, label: string, code: string) {
  localStorage.setItem(KEYS.garageId, garageId);
  localStorage.setItem(KEYS.label,    label);
  localStorage.setItem(KEYS.code,     code);
}

export function clearTVSession() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}
