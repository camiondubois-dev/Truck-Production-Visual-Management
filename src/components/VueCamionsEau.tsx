import { VueAsana } from './VueAsana';
import { TOUTES_STATIONS_COMMUNES as STATIONS_FROM_DATA } from '../data/mockData';

// Re-export depuis mockData.ts — source unique de vérité
export { TOUTES_STATIONS_COMMUNES } from '../data/mockData';

export function VueCamionsEau() {
  return (
    <VueAsana
      type="eau"
      toutesLesStations={STATIONS_FROM_DATA}
      colonnesInfo={[
        { key: 'numero', label: 'Numéro',  width: 100 },
        { key: 'annee',  label: 'Année',   width: 70  },
        { key: 'marque', label: 'Marque',  width: 120 },
        { key: 'modele', label: 'Modèle',  width: 100 },
        { key: 'slot',   label: 'Slot',    width: 90  },
        { key: 'statut', label: 'Statut',  width: 110 },
      ]}
      config={{
        color: '#f97316',
        icon: '🚒',
        label: 'Camions à eau',
      }}
    />
  );
}