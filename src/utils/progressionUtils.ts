import type { Item } from '../types/item.types';

interface Station {
  id: string;
  label: string;
  labelCourt: string;
  color: string;
  ordre: number;
}

export function getStatutEffectif(
  item: Item,
  stationId: string,
  stations: Station[]
): 'non-commence' | 'en-cours' | 'termine' | 'saute' | 'non-requis' {

  const progReelle = item.progression?.find((p) => p.stationId === stationId);

  // Non-requis — retourner directement, ignorer tout le reste
  if (progReelle?.status === 'non-requis') return 'non-requis';
  if (progReelle?.status === 'termine') return 'termine';
  if (progReelle?.status === 'en-cours') return 'en-cours';

  const stationCible = stations.find((s) => s.id === stationId);
  if (!stationCible) return 'non-commence';

  // Sautée si une station d'ordre supérieur est avancée
  // (ignorer les non-requis dans ce calcul)
  const uneStationApresEstAvancee = stations
    .filter((s) => s.ordre > stationCible.ordre)
    .some((s) => {
      const prog = item.progression?.find((p) => p.stationId === s.id);
      return prog?.status === 'termine' || prog?.status === 'en-cours';
    });

  if (uneStationApresEstAvancee) return 'saute';
  return 'non-commence';
}

// Vérifie si toutes les étapes actives sont terminées ou non-requises
export function toutesEtapesCompletees(item: Item): boolean {
  if (item.stationsActives.length === 0) return false;
  return item.stationsActives.every(stationId => {
    const prog = item.progression.find(p => p.stationId === stationId);
    return prog?.status === 'termine' || prog?.status === 'non-requis';
  });
}