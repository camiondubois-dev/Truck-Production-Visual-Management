import { supabase } from '../lib/supabase';

export async function logEntreeGarage(itemId: string, garageId: string, slotId?: string) {
  const { data, error } = await supabase
    .from('prod_time_logs')
    .insert({ item_id: itemId, garage_id: garageId, slot_id: slotId ?? null })
    .select()
    .maybeSingle();
  return { data, error };
}

export async function logSortieGarage(itemId: string, garageId: string) {
  const { data: log } = await supabase
    .from('prod_time_logs')
    .select('*')
    .eq('item_id', itemId)
    .eq('garage_id', garageId)
    .is('heure_sortie', null)
    .maybeSingle();

  if (!log) return { error: 'Log introuvable' };

  const sortie = new Date();
  const dureeMinutes = Math.round(
    (sortie.getTime() - new Date(log.heure_entree).getTime()) / 60000
  );

  return supabase
    .from('prod_time_logs')
    .update({ heure_sortie: sortie.toISOString(), duree_minutes: dureeMinutes })
    .eq('id', log.id);
}

export async function logJobTemporaire(params: {
  typeJob: string;
  titre: string;
  garageId: string;
  slotId: string;
  heureEntree: string;
}) {
  const sortie = new Date();
  const dureeMinutes = Math.round(
    (sortie.getTime() - new Date(params.heureEntree).getTime()) / 60000
  );
  return supabase.from('prod_time_logs').insert({
    item_id: null,
    type_job: params.typeJob,
    titre: params.titre,
    garage_id: params.garageId,
    slot_id: params.slotId,
    heure_entree: params.heureEntree,
    heure_sortie: sortie.toISOString(),
    duree_minutes: dureeMinutes,
  });
}

export async function getStatsByGarage() {
  const { data } = await supabase
    .from('prod_time_logs')
    .select('garage_id, duree_minutes')
    .not('duree_minutes', 'is', null);

  const stats: Record<string, { total: number; count: number }> = {};
  data?.forEach(({ garage_id, duree_minutes }) => {
    if (!stats[garage_id]) stats[garage_id] = { total: 0, count: 0 };
    stats[garage_id].total += duree_minutes;
    stats[garage_id].count++;
  });

  return Object.entries(stats).map(([garage, { total, count }]) => ({
    garage,
    moyenne_minutes: Math.round(total / count),
    total_passages: count,
  }));
}
