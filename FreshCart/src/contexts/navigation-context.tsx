import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type AuthRequest = 'login' | 'signup' | null;

type NavigationContextValue = {
  query: string;
  setQuery: (query: string) => void;
  district: string;
  setDistrict: (district: string) => void;
  taluk: string;
  setTaluk: (taluk: string) => void;
  village: string;
  setVillage: (village: string) => void;
  authRequest: AuthRequest;
  setAuthRequest: (request: AuthRequest) => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('');
  const [taluk, setTaluk] = useState('');
  const [village, setVillage] = useState('');
  const [authRequest, setAuthRequest] = useState<AuthRequest>(null);
  const value = useMemo(
    () => ({ query, setQuery, district, setDistrict, taluk, setTaluk, village, setVillage, authRequest, setAuthRequest }),
    [query, district, taluk, village, authRequest],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigationState() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigationState must be used within NavigationProvider');
  return context;
}
