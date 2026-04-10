import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { VehiculeInventaire, EtapeFaite, RoadMapEtape } from '../types/inventaireTypes';
import { inventaireService } from '../services/inventaireService';

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
    await inventaireService.mettreAJourRoadMap(id, roadMap);
    setVehicules(prev => prev.map(v =>
      v.id === id ? { ...v, roadMap } : v
    ));
  };

  const mettreAJourReservoir = async (id: string, aUnReservoir: boolean, reservoirId: string | null) => {
    await inventaireService.mettreAJourReservoir(id, aUnReservoir, reservoirId);
    setVehicules(prev => prev.map(v =>
      v.id === id ? { ...v, aUnReservoir, reservoirId: reservoirId ?? undefined } : v
    ));
  };

  const marquerPret = async (id: string, estPret: boolean) => {
    await inventaireService.marquerPret(id, estPret);
    setVehicules(prev => prev.map(v =>
      v.id === id ? { ...v, estPret } : v
    ));
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
      mettreAJourEtapes, mettreAJourRoadMap, mettreAJourReservoir,
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
