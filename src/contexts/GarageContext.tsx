import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Item, GarageContextType, EtatItem } from '../types/item.types';
import { SLOT_TO_GARAGE, STATION_TO_GARAGE } from '../data/garageData';
import { itemsService } from '../services/itemsService';
import { logEntreeGarage, logSortieGarage } from '../services/timeLogService';

const GarageContext = createContext<GarageContextType | null>(null);

export const GarageProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    itemsService.getAll()
      .then(setItems)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ajouterItem = async (item: Item) => {
    await itemsService.ajouter(item);
    setItems(prev => [item, ...prev]);
  };

  const supprimerItem = async (itemId: string) => {
    await itemsService.supprimer(itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const mettreAJourItem = async (itemId: string, patch: Partial<Item>) => {
    await itemsService.mettreAJour(itemId, patch);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
  };

  const assignerSlot = async (itemId: string, slotId: string) => {
    const garageId = SLOT_TO_GARAGE[slotId];
    const patch = {
      etat: 'en-slot' as EtatItem,
      slotId,
      dernierSlotId: undefined,
      dernierGarageId: undefined,
      dateEntreeSlot: new Date().toISOString(),
    };
    await itemsService.mettreAJour(itemId, patch);
    if (garageId) await logEntreeGarage(itemId, garageId, slotId);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
  };

  const retirerVersAttente = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const garageActuel = item.slotId
      ? SLOT_TO_GARAGE[item.slotId]
      : item.dernierGarageId;
    const patch = {
      etat: 'en-attente' as EtatItem,
      dernierSlotId: item.slotId,
      dernierGarageId: garageActuel,
      slotId: undefined,
      dateEntreeSlot: undefined,
    };
    await itemsService.mettreAJour(itemId, patch);
    if (garageActuel) await logSortieGarage(itemId, garageActuel);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
  };

  const terminerEtAvancer = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const garageActuel = item.slotId ? SLOT_TO_GARAGE[item.slotId] : item.dernierGarageId;
    const prochaineStation = item.stationsActives.find(stationId => {
      const prog = item.progression.find(p => p.stationId === stationId);
      return prog?.status === 'non-commence';
    });
    const prochainGarage = prochaineStation
      ? STATION_TO_GARAGE[prochaineStation]
      : item.slotId ? SLOT_TO_GARAGE[item.slotId] : item.dernierGarageId;
    const patch = {
      etat: 'en-attente' as EtatItem,
      dernierSlotId: item.slotId,
      dernierGarageId: prochainGarage,
      stationActuelle: prochaineStation ?? item.stationActuelle,
      slotId: undefined,
      dateEntreeSlot: undefined,
    };
    await itemsService.mettreAJour(itemId, patch);
    if (garageActuel) await logSortieGarage(itemId, garageActuel);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
  };

  const terminerItem = async (itemId: string) => {
    const patch = {
      etat: 'termine' as EtatItem,
      slotId: undefined,
      dernierSlotId: undefined,
      dernierGarageId: undefined,
    };
    await itemsService.mettreAJour(itemId, patch);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
  };

  const updateStationStatus = async (
    itemId: string,
    stationId: string,
    status: 'non-commence' | 'en-cours' | 'termine' | 'non-requis'
  ) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const nouvelleStation = status === 'en-cours' ? stationId : item.stationActuelle;
    const nouvelleProgression = item.progression.map(p =>
      p.stationId === stationId ? { ...p, status } : p
    );
    const patch = {
      stationActuelle: nouvelleStation,
      progression: nouvelleProgression,
    };
    await itemsService.mettreAJour(itemId, patch);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
  };

  const updateStationsActives = async (itemId: string, stationsActives: string[]) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const nouvelleProgression = stationsActives.map(stationId => {
      const existing = item.progression.find(p => p.stationId === stationId);
      return existing ?? { stationId, status: 'non-commence' as const, subTasks: [] };
    });
    const patch = { stationsActives, progression: nouvelleProgression };
    await itemsService.mettreAJour(itemId, patch);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
  };

  const ajouterDocument = async (itemId: string, doc: import('../types/item.types').Document) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const docsExistants = item.documents ?? [];
    if (docsExistants.length >= 3) return;
    const nouveauxDocs = [...docsExistants, doc];
    await itemsService.mettreAJour(itemId, { documents: nouveauxDocs });
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, documents: nouveauxDocs }));
  };

  const supprimerDocument = async (itemId: string, docId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const nouveauxDocs = (item.documents ?? []).filter(d => d.id !== docId);
    await itemsService.mettreAJour(itemId, { documents: nouveauxDocs });
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, documents: nouveauxDocs }));
  };

  const archiverItem = async (itemId: string) => {
    const patch = {
      etat: 'termine' as EtatItem,
      slotId: undefined,
      dernierSlotId: undefined,
      dernierGarageId: undefined,
      dateArchive: new Date().toISOString(),
    };
    await itemsService.mettreAJour(itemId, patch);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
  };

  const reouvrirItem = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const progressionReset = item.progression.map(p => ({
      ...p, status: 'non-commence' as const,
    }));
    const patch = {
      etat: 'en-attente' as EtatItem,
      slotId: undefined,
      dernierSlotId: undefined,
      dernierGarageId: STATION_TO_GARAGE[item.stationsActives[0]] ?? undefined,
      stationActuelle: item.stationsActives[0],
      dateArchive: undefined,
      progression: progressionReset,
    };
    await itemsService.mettreAJour(itemId, patch);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
  };

  const slotMap: Record<string, Item> = {};
  items.filter(i => i.slotId).forEach(i => { slotMap[i.slotId!] = i; });

  const enAttente = {
    eau:    items.filter(i => i.type === 'eau'    && i.etat === 'en-attente'),
    client: items.filter(i => i.type === 'client' && i.etat === 'en-attente'),
    detail: items.filter(i => i.type === 'detail' && i.etat === 'en-attente'),
  };

  if (loading) return null;

  return (
    <GarageContext.Provider value={{
      items,
      slotMap,
      enAttente,
      ajouterItem,
      supprimerItem,
      mettreAJourItem,
      archiverItem,
      reouvrirItem,
      assignerSlot,
      retirerVersAttente,
      terminerEtAvancer,
      terminerItem,
      updateStationStatus,
      updateStationsActives,
      ajouterDocument,
      supprimerDocument,
    }}>
      {children}
    </GarageContext.Provider>
  );
};

export const useGarage = () => {
  const ctx = useContext(GarageContext);
  if (!ctx) throw new Error('useGarage doit être utilisé dans GarageProvider');
  return ctx;
};