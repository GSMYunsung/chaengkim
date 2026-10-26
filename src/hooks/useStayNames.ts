import { useCallback, useRef, useState } from 'react';
import { lookupPlaceName } from '../services/placeLookup';
import type { Stay } from '../types';

/**
 * Resolves nearby shop/landmark names for stays in the background. Screens render
 * right away with a fallback label and re-render as each name arrives.
 * Names are display state only (Kakao results can't be stored): they live as long as the screen
 * stays mounted, and each stay is asked for once in that time. A screen mounted again asks again.
 */
export function useStayNames() {
  const [names, setNames] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());

  const resolve = useCallback((stays: Stay[]) => {
    for (const st of stays) {
      if (asked.current.has(st.id)) continue;
      asked.current.add(st.id);
      lookupPlaceName(st.anchorLat, st.anchorLng).then(({ name, final }) => {
        if (name) setNames(prev => (prev[st.id] === name ? prev : { ...prev, [st.id]: name }));
        // The search failed and only the fallback address is shown: ask again on the next resolve.
        if (!final) asked.current.delete(st.id);
      });
    }
  }, []);

  return [names, resolve] as const;
}
