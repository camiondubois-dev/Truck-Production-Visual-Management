import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  email: string;
  nom?: string;
  role: 'gestion' | 'planification' | 'employe';
  departement?: string;
  actif: boolean;
}

export const authService = {
  async connexion(email: string, motDePasse: string): Promise<Profile> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email, password: motDePasse,
    });

    console.log('Auth result:', data, error);

    if (error) throw error;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    console.log('Profile result:', profile, profileError);

    if (profileError) throw profileError;
    if (!profile.actif) throw new Error('Compte désactivé');

    return profile as Profile;
  },

  async deconnexion(): Promise<void> {
    await supabase.auth.signOut();
  },

  async getProfileActuel(): Promise<Profile | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    console.log('getProfileActuel:', profile, error);

    return profile as Profile ?? null;
  },
};