'use client';

import { useState, useEffect, useCallback } from 'react';

const HISTORY_KEY = 'pep_research_history';
const HISTORY_LIMIT = 8;

export function useSearchHistory() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        setRecent(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const addHistory = useCallback((term: string) => {
    if (!term) return;
    setRecent(prev => {
      const updated = [term, ...prev.filter((x) => x !== term)].slice(0, HISTORY_LIMIT);
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  return { recent, addHistory };
}
