import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { achatService, fromDB } from '../services/achatService';
import type { Achat } from '../types/achatTypes';

interface AchatContextType {
  achats: Achat[];
  loading: boolean;
  recharger: () => Promise<void>;
  creer: (a: Omit<Achat, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Achat>;
  mettreAJour: (id: string, updates: Partial<Achat>) => Promise<void>;
}

const AchatContext = createContext<AchatContextType | null>(null);

export const AchatProvider = ({ children }: { children: ReactNode }) => {
  const [achats, setAchats] = useState<Achat[]>([]);
  const [loading, setLoading] = useState(true);

  const recharger = async () => {
    const data = await achatService.getAll();
    setAchats(data);
  };

  useEffect(() => {
    achatService.getAll()
      .then(setAchats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('achats-realtime')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'prod_achats' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          const newA = fromDB(payload.new);
          setAchats(prev => prev.some(x => x.id === newA.id) ? prev : [newA, ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const updated = fromDB(payload.new);
          setAchats(prev => prev.map(x => x.id === updated.id ? updated : x));
        } else if (payload.eventType === 'DELETE') {
          setAchats(prev => prev.filter(x => x.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Heartbeat (pour TVs qui resteraient ouvertes)
  useEffect(() => {
    const t = setInterval(() => { supabase.from('prod_achats').select('id').limit(1); }, 25_000);
    return () => clearInterval(t);
  }, []);

  // Refresh on visibility change
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        achatService.getAll().then(setAchats).catch(console.error);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const creer = async (a: Omit<Achat, 'id' | 'createdAt' | 'updatedAt'>) => {
    const created = await achatService.creer(a);
    setAchats(prev => [created, ...prev]);
    return created;
  };

  const mettreAJour = async (id: string, updates: Partial<Achat>) => {
    await achatService.mettreAJour(id, updates);
    setAchats(prev => prev.map(a => a.id === id ? { ...a, ...updates } : a));
  };

  return (
    <AchatContext.Provider value={{ achats, loading, recharger, creer, mettreAJour }}>
      {children}
    </AchatContext.Provider>
  );
};

export const useAchats = () => {
  const ctx = useContext(AchatContext);
  if (!ctx) throw new Error('useAchats doit être utilisé dans AchatProvider');
  return ctx;
};
