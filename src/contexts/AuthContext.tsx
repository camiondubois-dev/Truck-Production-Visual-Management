import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { authService } from '../services/authService';
import type { Profile } from '../services/authService';

interface AuthContextType {
  profile: Profile | null;
  loading: boolean;
  connexion: (email: string, motDePasse: string) => Promise<void>;
  deconnexion: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier si une session existe déjà
    authService.getProfileActuel()
      .then(setProfile)
      .catch(() => setProfile(null))
      .finally(() => setLoading(false));

    // Écouter les changements de session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setProfile(null);
      } else if (event === 'SIGNED_IN' && session) {
        const p = await authService.getProfileActuel();
        setProfile(p);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const connexion = async (email: string, motDePasse: string) => {
    const p = await authService.connexion(email, motDePasse);
    setProfile(p);
  };

  const deconnexion = async () => {
    await authService.deconnexion();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ profile, loading, connexion, deconnexion }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
};