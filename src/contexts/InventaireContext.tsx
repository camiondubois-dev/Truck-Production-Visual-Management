import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { VehiculeInventaire } from '../types/inventaireTypes';
import { inventaireService } from '../services/inventaireService';

interface InventaireContextType {
  vehicules: VehiculeInventaire[];
  loading: boolean;
  importerVehicules: (vehicules: VehiculeInventaire[]) => Promise<void>;
  ajouterVehicule: (vehicule: VehiculeInventaire) => Promise<void>;
  marquerEnProduction: (id: string, jobId: string) => Promise<void>;
  marquerDisponible: (id: string) => Promise<void>;
  mettreAJourPhotoInventaire: (id: string, photoUrl: string | null) => Promise<void>;
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
        ? { ...v, statut: 'disponible', jobId: undefined, dateEnProduction: undefined }
        : v
    ));
  };

  const mettreAJourPhotoInventaire = async (id: string, photoUrl: string | null) => {
    await inventaireService.mettreAJourPhoto(id, photoUrl);
    setVehicules(prev => prev.map(v =>
      v.id === id
        ? { ...v, photoUrl: photoUrl ?? undefined }
        : v
    ));
  };

  const supprimerVehicule = async (id: string) => {
    await inventaireService.supprimer(id);
    setVehicules(prev => prev.filter(v => v.id !== id));
  };

  return (
    <InventaireContext.Provider value={{
      vehicules,
      loading,
      importerVehicules,
      ajouterVehicule,
      marquerEnProduction,
      marquerDisponible,
      mettreAJourPhotoInventaire,
      supprimerVehicule,
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