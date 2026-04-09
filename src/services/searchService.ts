import { supabase } from '../lib/supabase';

export async function searchTable(
  table: string,
  query: string,
  columns: string[]
): Promise<any[]> {
  if (!query.trim()) {
    const { data } = await supabase.from(table as any).select('*');
    return data || [];
  }

  const filters = columns
    .map(col => `${col}.ilike.%${query}%`)
    .join(',');

  const { data, error } = await supabase
    .from(table as any)
    .select('*')
    .or(filters);

  if (error) console.error(error);
  return data || [];
}
