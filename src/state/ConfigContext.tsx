import { createContext, PropsWithChildren, useContext } from 'react';
import type { Config } from '../config';

const ConfigContext = createContext<Config | null>(null);

export const ConfigProvider = ({ value, children }: PropsWithChildren<{ value: Config }>) => (
  <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>
);

export const useConfig = () => {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error('ConfigContext is not available');
  }
  return ctx;
};
