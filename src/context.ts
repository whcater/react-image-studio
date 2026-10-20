import { createContext, useContext } from 'react';
import type { StudioApi } from './hooks/useImageStudio.js';

const StudioContext = createContext<StudioApi | null>(null);

export const StudioProvider = StudioContext.Provider;

export function useStudio(): StudioApi {
  const api = useContext(StudioContext);
  if (!api) throw new Error('react-image-studio: components must be rendered inside <ImageStudio>');
  return api;
}
