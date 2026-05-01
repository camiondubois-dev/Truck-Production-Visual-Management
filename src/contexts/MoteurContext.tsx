import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { moteurService, fromDB } from '../services/moteurService';
import type { Moteur } from '../types/engineTypes';

interface MoteurContextType {
  moteurs: Moteur[];
  loading: boolean;
  recharger: () => Promise<void>;
  creer: (m: Omit<Moteur, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Moteur>;
  mettreAJour: (id: string, updates: Partial<Moteur>) => Promise<void>;
  supprimer: (id: string) => Promise<void>;
  demarrerEtape: (moteurId: string, etapeUuid: string, employeId: string) => Promise<void>;
  terminerEtape: (moteurId: string, etapeUuid: string) => Promise<void>;
  sauterEtape: (moteurId: string, etapeUuid: string) => Promise<void>;
  replanifierEtape: (moteurId: string, etapeUuid: string) => Promise<void>;
  deplacer: (moteurId: string, poste: string | null) => Promise<void>;
  archiver: (moteurId: string) => Promise<void>;
}

const MoteurContext = createContext<MoteurContextType | null>(null);

export const MoteurProvider = ({ children }: { children: ReactNode }) => {
  const [moteurs, setMoteurs] = useState<Moteur[]>([]);
  const [loading, setLoading] = useState(true);

  const recharger = async () => {
    const data = await moteurService.getAll();
    setMoteurs(data);
  };

  useEffect(() => {
    moteurService.getAll()
      .then(setMoteurs)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('moteurs-realtime')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'prod_moteurs' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const newMoteur = fromDB(payload.new);
          setMoteurs(prev => prev.some(m => m.id === newMoteur.id) ? prev : [newMoteur, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = fromDB(payload.new);
          setMoteurs(prev => prev.map(m => m.id === updated.id ? updated : m));
        } else if (payload.eventType === 'DELETE') {
          setMoteurs(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Heartbeat keep-alive (TV, écrans permanents)
  useEffect(() => {
    const heartbeat = setInterval(() => {
      supabase.from('prod_moteurs').select('id').limit(1);
    }, 25_000);
    return () => clearInterval(heartbeat);
  }, []);

  // Recharge quand l'écran redevient visible
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        moteurService.getAll().then(setMoteurs).catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const creer = async (m: Omit<Moteur, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await moteurService.creer(m);
    setMoteurs(prev => [created, ...prev]);
    return created;
  };

  const mettreAJour = async (id: string, updates: Partial<Moteur>) => {
    await moteurService.mettreAJour(id, updates);
    setMoteurs(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const supprimer = async (id: string) => {
    await moteurService.supprimer(id);
    setMoteurs(prev => prev.filter(m => m.id !== id));
  };

  // Actions étapes — on recharge le moteur après l'action pour avoir l'état frais
  const apresAction = async (id: string) => {
    const updated = await moteurService.getById(id);
    if (updated) setMoteurs(prev => prev.map(m => m.id === id ? updated : m));
  };

  const demarrerEtape = async (moteurId: string, etapeUuid: string, employeId: string) => {
    await moteurService.demarrerEtape(moteurId, etapeUuid, employeId);
    await apresAction(moteurId);
  };
  const terminerEtape = async (moteurId: string, etapeUuid: string) => {
    await moteurService.terminerEtape(moteurId, etapeUuid);
    await apresAction(moteurId);
  };
  const sauterEtape = async (moteurId: string, etapeUuid: string) => {
    await moteurService.sauterEtape(moteurId, etapeUuid);
    await apresAction(moteurId);
  };
  const replanifierEtape = async (moteurId: string, etapeUuid: string) => {
    await moteurService.replanifierEtape(moteurId, etapeUuid);
    await apresAction(moteurId);
  };
  const deplacer = async (moteurId: string, poste: string | null) => {
    await moteurService.deplacer(moteurId, poste);
    await apresAction(moteurId);
  };
  const archiver = async (moteurId: string) => {
    await moteurService.archiver(moteurId);
    await apresAction(moteurId);
  };

  return (
    <MoteurContext.Provider value={{
      moteurs, loading, recharger,
      creer, mettreAJour, supprimer,
      demarrerEtape, terminerEtape, sauterEtape, replanifierEtape,
      deplacer, archiver,
    }}>
      {children}
    </MoteurContext.Provider>
  );
};

export const useMoteurs = () => {
  const ctx = useContext(MoteurContext);
  if (!ctx) throw new Error('useMoteurs doit être utilisé dans MoteurProvider');
  return ctx;
};
