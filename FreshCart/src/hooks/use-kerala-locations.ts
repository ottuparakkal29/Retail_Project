import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export type KeralaLocation = {
  district: string;
  taluk: string;
  village: string;
};

async function fetchKeralaLocations(): Promise<KeralaLocation[]> {
  const [firstPage, secondPage] = await Promise.all([
    supabase
      .from('kerala_locations')
      .select('district, taluk, village')
      .range(0, 999),
    supabase
      .from('kerala_locations')
      .select('district, taluk, village')
      .range(1000, 1999),
  ]);
  if (firstPage.error) throw firstPage.error;
  if (secondPage.error) throw secondPage.error;

  return [...(firstPage.data ?? []), ...(secondPage.data ?? [])]
    .map((location) => ({
      district: String(location.district ?? '').trim(),
      taluk: String(location.taluk ?? '').trim(),
      village: String(location.village ?? '').trim(),
    }))
    .filter((location) => location.district && location.taluk && location.village)
    .sort((first, second) =>
      first.district.localeCompare(second.district) ||
      first.taluk.localeCompare(second.taluk) ||
      first.village.localeCompare(second.village),
    );
}

export function useKeralaLocations() {
  const [locations, setLocations] = useState<KeralaLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void fetchKeralaLocations()
      .then((rows) => {
        if (active) setLocations(rows);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : 'Unable to load Kerala districts, taluks, and villages.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return { locations, loading, error };
}
