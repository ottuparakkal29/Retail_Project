import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type AuthRequest = 'login' | 'signup' | null;

type NavigationContextValue = {
  query: string;
  setQuery: (query: string) => void;
  district: string;
  setDistrict: (district: string) => void;
  authRequest: AuthRequest;
  setAuthRequest: (request: AuthRequest) => void;
};

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const [district, setDistrict] = useState('');
  const [authRequest, setAuthRequest] = useState<AuthRequest>(null);
  const value = useMemo(
    () => ({ query, setQuery, district, setDistrict, authRequest, setAuthRequest }),
    [query, district, authRequest],
  );
  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigationState() {
  const context = useContext(NavigationContext);
  if (!context) throw new Error('useNavigationState must be used within NavigationProvider');
  return context;
}
