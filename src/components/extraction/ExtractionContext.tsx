import React, { createContext, useContext } from 'react';
import { ExtractionState } from './types';

export const ExtractionContext = createContext<ExtractionState | null>(null);

export const useExtractionContext = (): ExtractionState => {
  const ctx = useContext(ExtractionContext);
  if (!ctx) throw new Error('useExtractionContext must be used within ExtractionContext.Provider');
  return ctx;
};
