'use client';

import React, { createContext, useContext, useState } from 'react';

type AdminLoaderContextType = {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
};

const AdminLoaderContext = createContext<AdminLoaderContextType>({
  isLoading: true,
  setLoading: () => {},
});

export const useAdminLoader = () => useContext(AdminLoaderContext);

export function AdminLoaderProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <AdminLoaderContext.Provider value={{ isLoading, setLoading: setIsLoading }}>
      {children}
    </AdminLoaderContext.Provider>
  );
}

