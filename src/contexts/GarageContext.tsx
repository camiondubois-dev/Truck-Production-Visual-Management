import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Item, GarageContextType, EtatItem } from '../types/item.types';
import { SLOT_TO_GARAGE, STATION_TO_GARAGE, GARAGE_TO_ROAD_MAP_STATIONS } from '../data/garageData';
import { itemsService } from '../services/itemsService';
import { logEntreeGarage, logSortieGarage } from '../services/timeLogService';
import { supabase } from '../lib/supabase';
import { inventaireService } from '../services/inventaireService';
import type { RoadMapEtape } from '../types/inventaireTypes';

const GarageContext = createContext<GarageContextType | null>(null);

export const GarageProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  const chargerItems = async () => {
    try {
      const data = await itemsService.getAll();
      setItems(data);
    } catch (err) {
      console.error('[GarageContext] itemsService.getAll() threw:', err);
      setItems([]);
    }
  };

  const rechargerItems = async (): Promise<Item[]> => {
    try {
      const data = await itemsService.getAll();
      setItems(data);
      return data;
    } catch (err) {
      console.error('[GarageContext] rechargerItems threw:', err);
      return [];
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { setLoading(false); return; }
      await chargerItems();
      setLoading(false);
    });
  }, []);

  // Real-time: auto-created prod_items (from road_map lifecycle) appear instantly
  useEffect(() => {
    const channel = supabase
      .channel('garage-items-realtime')
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'prod_items' },
        async () => { await chargerItems(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
    // Sync réservoir et statut commercial vers prod_inventaire si l'item est lié
    const needsSync = patch.aUnReservoir !== undefined || patch.reservoirId !== undefined
      || patch.etatCommercial !== undefined || patch.dateLivraisonPlanifiee !== undefined
      || patch.clientAcheteur !== undefined;
    if (needsSync) {
      const item = items.find(i => i.id === itemId);
      if (item?.inventaireId) {
        const syncPatch: Record<string, any> = { updated_at: new Date().toISOString() };
        if (patch.aUnReservoir !== undefined)          syncPatch.a_un_reservoir = patch.aUnReservoir;
        if ('reservoirId' in patch)                    syncPatch.reservoir_id = patch.reservoirId ?? null;
        if (patch.etatCommercial !== undefined)        syncPatch.etat_commercial = patch.etatCommercial ?? null;
        if ('dateLivraisonPlanifiee' in patch)         syncPatch.date_livraison_planifiee = patch.dateLivraisonPlanifiee ?? null;
        if ('clientAcheteur' in patch)                 syncPatch.client_acheteur = patch.clientAcheteur ?? null;
        await supabase.from('prod_inventaire').update(syncPatch).eq('id', item.inventaireId);
      }
    }
  };

  const marquerPret = async (inventaireId: string) => {
    // Trouve le prodItem par inventaireId directement dans Supabase
    const { data } = await supabase
      .from('prod_items')
      .select('id, progression')
      .eq('inventaire_id', inventaireId)
      .neq('etat', 'termine')
      .maybeSingle();

    const now = new Date().toISOString();

    if (data) {
      // Marquer toute la progression comme terminée
      const nouvelleProgression = (data.progression ?? []).map((p: any) => ({
        ...p,
        status: p.status === 'non-requis' ? 'non-requis' : 'termine',
      }));
      // Fermer le job prod_items
      await supabase.from('prod_items').update({
        progression: nouvelleProgression,
        etat: 'termine',
        date_archive: now,
        updated_at: now,
      }).eq('id', data.id);
      setItems(prev => prev.map(i => i.id !== data.id ? i : {
        ...i,
        progression: nouvelleProgression,
        etat: 'termine' as import('../types/item.types').EtatItem,
        dateArchive: now,
      }));
    }

    // Marquer toutes les étapes road_map comme terminées + statut=disponible + est_pret=true
    const { data: inv } = await supabase.from('prod_inventaire').select('road_map').eq('id', inventaireId).single();
    const roadMapFini = (inv?.road_map ?? []).map((s: any) =>
      s.statut === 'saute' ? s : { ...s, statut: 'termine' as const }
    );
    await supabase.from('prod_inventaire').update({
      est_pret: true,
      statut: 'disponible',
      job_id: null,
      date_en_production: null,
      road_map: roadMapFini,
      updated_at: now,
    }).eq('id', inventaireId);
  };

  const assignerSlot = async (itemId: string, slotId: string) => {
    const item = items.find(i => i.id === itemId);
    const garageId = SLOT_TO_GARAGE[slotId];

    // Auto-marquer la station de ce garage comme "en-cours"
    let progressionPatch: Partial<typeof item> = {};
    if (item && garageId) {
      // Trouver la première station non-commencée qui appartient à ce garage
      const stationACommen = item.stationsActives.find(stationId => {
        if (STATION_TO_GARAGE[stationId] !== garageId) return false;
        const prog = item.progression.find(p => p.stationId === stationId);
        return prog?.status === 'non-commence';
      });
      if (stationACommen) {
        const nouvelleProgression = item.progression.map(p =>
          p.stationId === stationACommen ? { ...p, status: 'en-cours' as const } : p
        );
        progressionPatch = { progression: nouvelleProgression, stationActuelle: stationACommen };
      }
    }

    const patch = {
      etat: 'en-slot' as EtatItem,
      slotId,
      dernierSlotId: undefined,
      dernierGarageId: undefined,
      dateEntreeSlot: new Date().toISOString(),
      ...progressionPatch,
    };
    await itemsService.mettreAJour(itemId, patch);
    if (garageId) await logEntreeGarage(itemId, garageId, slotId);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
    // Sync road_map: mark station as en-cours
    if (item?.inventaireId && garageId) {
      const { data: inv } = await supabase
        .from('prod_inventaire')
        .select('road_map')
        .eq('id', item.inventaireId)
        .single();
      if (inv?.road_map) {
        const stationsForGarage = GARAGE_TO_ROAD_MAP_STATIONS[garageId] ?? [garageId];
        const updated = (inv.road_map as RoadMapEtape[]).map(e =>
          stationsForGarage.includes(e.stationId) && (e.statut === 'en-attente' || e.statut === 'planifie')
            ? { ...e, statut: 'en-cours' as const } : e
        );
        await supabase.from('prod_inventaire')
          .update({ road_map: updated, updated_at: new Date().toISOString() })
          .eq('id', item.inventaireId);
      }
    }
  };

  const retirerVersAttente = async (itemId: string) => {
    const item = items.find(i => i.id === itemId);
    if (!item) return;
    const garageActuel = item.slotId ? SLOT_TO_GARAGE[item.slotId] : item.dernierGarageId;
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
    const item = items.find(i => i.id === itemId);
    const patch = {
      etat: 'termine' as EtatItem,
      slotId: undefined,
      dernierSlotId: undefined,
      dernierGarageId: undefined,
      dateArchive: new Date().toISOString(),
    };
    await itemsService.mettreAJour(itemId, patch);
    // Sync back to prod_inventaire: job terminé → statut disponible
    if (item?.inventaireId) {
      await supabase
        .from('prod_inventaire')
        .update({ statut: 'disponible', updated_at: new Date().toISOString() })
        .eq('id', item.inventaireId);
    }
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
    const patch = { stationActuelle: nouvelleStation, progression: nouvelleProgression };
    await itemsService.mettreAJour(itemId, patch);
    setItems(prev => prev.map(i => i.id !== itemId ? i : { ...i, ...patch }));
    // Sync road_map: mark station terminé, advance next step to en-attente
    if (status === 'termine') {
      const item = items.find(i => i.id === itemId);
      if (item?.inventaireId) {
        await inventaireService.avancerRoadMap(item.inventaireId, stationId);
      }
    }
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

  if (loading) return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      height: '100vh', background: '#1a1a1a', color: 'white', fontSize: '18px',
    }}>
      Chargement...
    </div>
  );

  return (
    <GarageContext.Provider value={{
      items, slotMap, enAttente,
      ajouterItem, supprimerItem, mettreAJourItem,
      archiverItem, reouvrirItem, assignerSlot,
      retirerVersAttente, terminerEtAvancer, terminerItem,
      updateStationStatus, updateStationsActives,
      ajouterDocument, supprimerDocument,
      marquerPret, rechargerItems,
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
