import { useEffect, useRef } from 'react';
import { activiteService } from '../services/activiteService';

export const PAGE_LABELS: Record<string, string> = {
  'plancher':      '🏭 Vue Plancher',
  'eau':           '🚰 Camions à eau',
  'clients':       '🔧 Jobs Client',
  'detail':        '🏷️ Camions détail',
  'livraisons':    '🚚 Suivi livraisons',
  'suivi-vente':   '🛒 Suivi vente',
  'moteurs':       '🛠️ Moteurs',
  'inventaire':    '📋 Inventaire',
  'reservoirs':    '🛢️ Réservoirs',
  'archive':       '📦 Archive',
  'analyse':       '📊 Analyse',
  'tv-admin':      '📺 Admin TV',
  'import':        '📥 Import',
  'profitabilite': '💹 Profitabilité',
  'activite':      '👁️ Activité',
  'achats-mobile': '🚛 App Achats',
  'terrain':       '🔧 App Terrain',
};

export function useActiviteTracker(
  utilisateurNom:  string | null | undefined,
  utilisateurRole: string | null | undefined,
  pageId:          string,
  app = 'desktop',
) {
  const prevPageRef = useRef<string | null>(null);
  const pageLabel = PAGE_LABELS[pageId] ?? pageId;

  useEffect(() => {
    if (!utilisateurNom) return;

    const nom  = utilisateurNom;
    const role = utilisateurRole ?? '';

    // Log la navigation seulement si la page change
    if (prevPageRef.current !== pageId) {
      prevPageRef.current = pageId;
      activiteService.loguerNavigation(nom, role, pageId, pageLabel, app).catch(console.error);
    }

    // Présence immédiate
    activiteService.mettreAJourPresence(nom, role, pageId, pageLabel, app).catch(console.error);

    // Ping keep-alive toutes les 30s
    const interval = setInterval(() => {
      activiteService.mettreAJourPresence(nom, role, pageId, pageLabel, app).catch(console.error);
    }, 30_000);

    return () => clearInterval(interval);
  }, [utilisateurNom, utilisateurRole, pageId, pageLabel, app]);
}
