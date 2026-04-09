import { createContext, useContext, useState, ReactNode } from 'react';

export type Role = 'gestion' | 'planificateur' | 'employe';

export interface UserSession {
  role: Role;
  departement?: string;
  modeTV?: boolean;
}

interface RoleContextType {
  session: UserSession | null;
  setSession: (session: UserSession) => void;
  clearSession: () => void;
}

const RoleContext = createContext<RoleContextType | null>(null);

export const RoleProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<UserSession | null>(null);

  const clearSession = () => setSession(null);

  return (
    <RoleContext.Provider value={{ session, setSession, clearSession }}>
      {children}
    </RoleContext.Provider>
  );
};

export const useRole = () => {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
};
