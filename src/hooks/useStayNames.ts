import { useCallback, useState } from 'react';
import { lookupPlaceName } from '../services/placeLookup';
import type { Stay } from '../types';

/**
 * Resolves nearby shop/landmark names for stays in the background. Screens render
 * right away with a fallback label and re-render as each name arrives.
 */
export function useStayNames() {
  const [names, setNames] = useState<Record<string, string>>({});

  const resolve = useCallback((stays: Stay[]) => {
    for (const st of stays) {
      lookupPlaceName(st.anchorLat, st.anchorLng).then(name => {
        if (name) setNames(prev => (prev[st.id] === name ? prev : { ...prev, [st.id]: name }));
      });
    }
  }, []);

  return [names, resolve] as const;
}
