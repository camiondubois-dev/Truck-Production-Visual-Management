import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Client } from '../types/clientTypes';
import { clientService } from '../services/clientService';

interface ClientContextType {
  clients: Client[];
  loading: boolean;
  ajouterClient: (client: Client) => Promise<void>;
  importerClients: (clients: Client[]) => Promise<void>;  // ← AJOUT
  mettreAJourClient: (id: string, patch: Partial<Client>) => Promise<void>;
  supprimerClient: (id: string) => Promise<void>;
  rechercherClients: (nom: string) => Client[];
}

const ClientContext = createContext<ClientContextType | null>(null);

export const ClientProvider = ({ children }: { children: ReactNode }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    clientService.getAll()
      .then(setClients)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const ajouterClient = async (client: Client) => {
    await clientService.ajouter(client);
    setClients(prev => [...prev, client].sort((a, b) => a.nom.localeCompare(b.nom)));
  };

  // ← AJOUT
  const importerClients = async (nouveaux: Client[]) => {
    await clientService.importerPlusieurs(nouveaux);
    const updated = await clientService.getAll();
    setClients(updated);
  };

  const mettreAJourClient = async (id: string, patch: Partial<Client>) => {
    await clientService.mettreAJour(id, patch);
    setClients(prev => prev.map(c => c.id !== id ? c : { ...c, ...patch }));
  };

  const supprimerClient = async (id: string) => {
    await clientService.supprimer(id);
    setClients(prev => prev.filter(c => c.id !== id));
  };

  const rechercherClients = (nom: string): Client[] => {
    if (!nom.trim()) return clients.slice(0, 8);
    const q = nom.toLowerCase();
    return clients
      .filter(c => c.nom.toLowerCase().includes(q))
      .slice(0, 8);
  };

  return (
    <ClientContext.Provider value={{
      clients, loading,
      ajouterClient,
      importerClients,  // ← AJOUT
      mettreAJourClient,
      supprimerClient,
      rechercherClients,
    }}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClients = () => {
  const ctx = useContext(ClientContext);
  if (!ctx) throw new Error('useClients doit être utilisé dans ClientProvider');
  return ctx;
};