import { useGarage as useGarageContext } from '../contexts/GarageContext';
import type { Item } from '../types/item.types';

export function useGarage() {
  const context = useGarageContext();

  const enAttente = {
    eau: context.items.filter((i) => i.type === 'eau' && i.etat === 'en-attente'),
    client: context.items.filter((i) => i.type === 'client' && i.etat === 'en-attente'),
    detail: context.items.filter((i) => i.type === 'detail' && i.etat === 'en-attente'),
  };

  const enSlot = {
    eau: context.items.filter((i) => i.type === 'eau' && i.etat === 'en-slot'),
    client: context.items.filter((i) => i.type === 'client' && i.etat === 'en-slot'),
    detail: context.items.filter((i) => i.type === 'detail' && i.etat === 'en-slot'),
  };

  const termines = context.items.filter((i) => i.etat === 'termine');

  return {
    ...context,
    enAttente,
    enSlot,
    termines,
      mettreAJourItem: context.mettreAJourItem, // ← forcer l'exposition
  };
}
