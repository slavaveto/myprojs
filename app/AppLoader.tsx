'use client';

import React, { createContext, useContext, useState } from 'react';

type AppLoaderContextType = {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
};

const AppLoaderContext = createContext<AppLoaderContextType>({
  isLoading: true,
  setLoading: () => {},
});

export const useAppLoader = () => useContext(AppLoaderContext);

export function AppLoaderProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <AppLoaderContext.Provider value={{ isLoading, setLoading: setIsLoading }}>
      {children}
    </AppLoaderContext.Provider>
  );
}

