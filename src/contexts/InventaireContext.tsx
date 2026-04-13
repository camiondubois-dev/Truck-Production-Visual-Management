import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { VehiculeInventaire, EtapeFaite, RoadMapEtape } from '../types/inventaireTypes';
import { inventaireService, fromDB } from '../services/inventaireService';
import { supabase } from '../lib/supabase';

interface InventaireContextType {
  vehicules: VehiculeInventaire[];
  loading: boolean;
  importerVehicules: (vehicules: VehiculeInventaire[]) => Promise<void>;
  ajouterVehicule: (vehicule: VehiculeInventaire) => Promise<void>;
  marquerEnProduction: (id: string, jobId: string) => Promise<void>;
  marquerDisponible: (id: string) => Promise<void>;
  mettreAJourPhotoInventaire: (id: string, photoUrl: string | null) => Promise<void>;
  mettreAJourType: (id: string, type: 'eau' | 'detail') => Promise<void>;
  mettreAJourEtapes: (id: string, etapes: EtapeFaite[]) => Promise<void>;
  mettreAJourRoadMap: (id: string, roadMap: RoadMapEtape[]) => Promise<void>;
  mettreAJourPriorites: (updates: { id: string; roadMap: RoadMapEtape[] }[]) => Promise<void>;
  mettreAJourReservoir: (id: string, aUnReservoir: boolean, reservoirId: string | null) => Promise<void>;
  marquerPret: (id: string, estPret: boolean) => Promise<void>;
  mettreAJourCommercial: (id: string, etatCommercial: 'non-vendu' | 'reserve' | 'vendu' | 'location', dateLivraisonPlanifiee: string | null, clientAcheteur: string | null) => Promise<void>;
  archiverVehicule: (id: string) => Promise<void>;
  supprimerVehicule: (id: string) => Promise<void>;
}

const InventaireContext = createContext<InventaireContextType | null>(null);

export const InventaireProvider = ({ children }: { children: ReactNode }) => {
  const [vehicules, setVehicules] = useState<VehiculeInventaire[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inventaireService.getAll()
      .then(setVehicules)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Real-time : toute modification de prod_inventaire (de n'importe quelle source)
  // met à jour le state local → PlancherView, VueInventaire, etc. voient les données fraîches
  useEffect(() => {
    const channel = supabase
      .channel('inventaire-realtime')
      .on(
        'postgres_changes' as any,
        { event: 'UPDATE', schema: 'public', table: 'prod_inventaire' },
        (payload: any) => {
          const updated = fromDB(payload.new);
          setVehicules(prev => prev.map(v => v.id === updated.id ? updated : v));
        }
      )
      .on(
        'postgres_changes' as any,
        { event: 'INSERT', schema: 'public', table: 'prod_inventaire' },
        (payload: any) => {
          const inserted = fromDB(payload.new);
          setVehicules(prev => {
            if (prev.some(v => v.id === inserted.id)) return prev;
            return [inserted, ...prev];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const importerVehicules = async (nouveaux: VehiculeInventaire[]) => {
    await inventaireService.importerPlusieurs(nouveaux);
    const updated = await inventaireService.getAll();
    setVehicules(updated);
  };

  const ajouterVehicule = async (vehicule: VehiculeInventaire) => {
    await inventaireService.ajouter(vehicule);
    setVehicules(prev => [vehicule, ...prev]);
  };

  const marquerEnProduction = async (id: string, jobId: string) => {
    await inventaireService.marquerEnProduction(id, jobId);
    setVehicules(prev => prev.map(v =>
      v.id === id
        ? { ...v, statut: 'en-production', jobId, dateEnProduction: new Date().toISOString() }
        : v
    ));
  };

  const marquerDisponible = async (id: string) => {
    await inventaireService.marquerDisponible(id);
    setVehicules(prev => prev.map(v =>
      v.id === id
        ? { ...v, statut: 'disponible', jobId: undefined, dateEnProduction: undefined, estPret: false }
        : v
    ));
  };

  const mettreAJourPhotoInventaire = async (id: string, photoUrl: string | null) => {
    await inventaireService.mettreAJourPhoto(id, photoUrl);
    setVehicules(prev => prev.map(v =>
      v.id === id ? { ...v, photoUrl: photoUrl ?? undefined } : v
    ));
  };

  const mettreAJourType = async (id: string, type: 'eau' | 'detail') => {
    await inventaireService.mettreAJourType(id, type);
    setVehicules(prev => prev.map(v =>
      v.id === id ? { ...v, type } : v
    ));
  };

  const mettreAJourEtapes = async (id: string, etapes: EtapeFaite[]) => {
    await inventaireService.mettreAJourEtapes(id, etapes);
    setVehicules(prev => prev.map(v =>
      v.id === id ? { ...v, etapesFaites: etapes } : v
    ));
  };

  const mettreAJourRoadMap = async (id: string, roadMap: RoadMapEtape[]) => {
    // Mise à jour optimiste : le UI reflète le changement IMMÉDIATEMENT,
    // avant même que Supabase réponde (~300-600 ms de latence évités)
    setVehicules(prev => prev.map(v => v.id === id ? { ...v, roadMap } : v));

    await inventaireService.mettreAJourRoadMap(id, roadMap);
    // ── Lifecycle automatique ──────────────────────────────────────
    // Lire le statut/jobId FRAIS depuis Supabase (évite la stale closure)
    const { data: freshRow } = await supabase
      .from('prod_inventaire')
      .select('statut, job_id')
      .eq('id', id)
      .single();

    if (freshRow) {
      const currentStatut = freshRow.statut as string;
      const currentJobId = freshRow.job_id as string | null;

      const activeSteps = roadMap.filter(s => s.statut === 'en-attente' || s.statut === 'en-cours');
      const allDone = roadMap.length > 0 && roadMap.every(s => s.statut === 'termine' || s.statut === 'saute');

      if (activeSteps.length > 0 && currentStatut === 'disponible') {
        // Au moins une étape active → créer job si pas encore en production
        try {
          // Lire les données complètes du véhicule pour créer le job
          const { data: fullRow } = await supabase
            .from('prod_inventaire')
            .select('*')
            .eq('id', id)
            .single();
          if (fullRow) {
            const freshVehicule = fromDB(fullRow);
            const jobId = await inventaireService.creerProdItemDepuisVehicule({ ...freshVehicule, roadMap });
            setVehicules(prev => prev.map(v =>
              v.id === id ? { ...v, roadMap, statut: 'en-production', jobId: jobId ?? v.jobId, dateEnProduction: v.dateEnProduction ?? new Date().toISOString() } : v
            ));
            return;
          }
        } catch (err) {
          console.error('[InventaireContext] creerProdItemDepuisVehicule error:', err);
        }
      }

      if (allDone && currentStatut === 'en-production') {
        // Toutes les étapes terminées/sautées → fermer le job
        try {
          if (currentJobId) {
            await supabase.from('prod_items')
              .update({ etat: 'termine', date_archive: new Date().toISOString(), updated_at: new Date().toISOString() })
              .eq('id', currentJobId);
          }
          await inventaireService.marquerDisponible(id);
          setVehicules(prev => prev.map(v =>
            v.id === id ? { ...v, roadMap, statut: 'disponible', jobId: undefined, dateEnProduction: undefined } : v
          ));
          return;
        } catch (err) {
          console.error('[InventaireContext] terminer job error:', err);
        }
      }
    }
    setVehicules(prev => prev.map(v =>
      v.id === id ? { ...v, roadMap } : v
    ));
  };

  // Mise à jour atomique des priorités de file d'attente — UN seul setVehicules,
  // SANS lifecycle checks (changer l'ordre ne crée/ferme pas de job)
  const mettreAJourPriorites = async (updates: { id: string; roadMap: RoadMapEtape[] }[]) => {
    // Optimistic : un seul appel qui applique tous les changements d'un coup
    setVehicules(prev => {
      let next = prev;
      for (const { id, roadMap } of updates) {
        next = next.map(v => v.id === id ? { ...v, roadMap } : v);
      }
      return next;
    });
    // Sauvegarde en parallèle, sans lifecycle
    await Promise.all(updates.map(({ id, roadMap }) =>
      inventaireService.mettreAJourRoadMap(id, roadMap)
    ));
  };

  const mettreAJourReservoir = async (id: string, aUnReservoir: boolean, reservoirId: string | null) => {
    await inventaireService.mettreAJourReservoir(id, aUnReservoir, reservoirId);
    setVehicules(prev => prev.map(v =>
      v.id === id ? { ...v, aUnReservoir, reservoirId: reservoirId ?? undefined } : v
    ));
  };

  const marquerPret = async (id: string, estPret: boolean) => {
    if (estPret) {
      // Marquer prêt = toutes les étapes terminées, camion prêt pour livraison
      // 1) Fermer le job prod_items actif
      await supabase.from('prod_items')
        .update({ etat: 'termine', date_archive: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('inventaire_id', id)
        .neq('etat', 'termine');
      // 2) Marquer toutes les étapes road_map comme terminées
      const { data: inv } = await supabase.from('prod_inventaire').select('road_map').eq('id', id).single();
      const roadMapFini = (inv?.road_map ?? []).map((s: any) =>
        s.statut === 'saute' ? s : { ...s, statut: 'termine' as const }
      );
      // 3) Mettre à jour prod_inventaire: disponible + est_pret=true + job_id=null
      await supabase.from('prod_inventaire').update({
        est_pret: true,
        statut: 'disponible',
        job_id: null,
        date_en_production: null,
        road_map: roadMapFini,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      setVehicules(prev => prev.map(v =>
        v.id === id ? { ...v, estPret: true, statut: 'disponible', jobId: undefined, dateEnProduction: undefined, roadMap: roadMapFini } : v
      ));
    } else {
      await inventaireService.marquerPret(id, false);
      setVehicules(prev => prev.map(v =>
        v.id === id ? { ...v, estPret: false } : v
      ));
    }
  };

  const mettreAJourCommercial = async (id: string, etatCommercial: 'non-vendu' | 'reserve' | 'vendu' | 'location', dateLivraisonPlanifiee: string | null, clientAcheteur: string | null) => {
    await inventaireService.mettreAJourCommercial(id, etatCommercial, dateLivraisonPlanifiee, clientAcheteur);
    setVehicules(prev => prev.map(v =>
      v.id === id ? { ...v, etatCommercial, dateLivraisonPlanifiee: dateLivraisonPlanifiee ?? undefined, clientAcheteur: clientAcheteur ?? undefined } : v
    ));
  };

  const archiverVehicule = async (id: string) => {
    await inventaireService.archiver(id);
    setVehicules(prev => prev.filter(v => v.id !== id));
  };

  const supprimerVehicule = async (id: string) => {
    await inventaireService.supprimer(id);
    setVehicules(prev => prev.filter(v => v.id !== id));
  };

  return (
    <InventaireContext.Provider value={{
      vehicules, loading,
      importerVehicules, ajouterVehicule,
      marquerEnProduction, marquerDisponible,
      mettreAJourPhotoInventaire, mettreAJourType,
      mettreAJourEtapes, mettreAJourRoadMap, mettreAJourPriorites, mettreAJourReservoir,
      marquerPret, mettreAJourCommercial, archiverVehicule, supprimerVehicule,
    }}>
      {children}
    </InventaireContext.Provider>
  );
};

export const useInventaire = () => {
  const ctx = useContext(InventaireContext);
  if (!ctx) throw new Error('useInventaire doit être utilisé dans InventaireProvider');
  return ctx;
};
