import { SlotCard } from './SlotCard';
import type { StationWithSlots } from '../hooks/useGarage';

interface StationCardProps {
  station: StationWithSlots;
  onAdvance?: (truckId: string) => void;
  onDelete?: (truckId: string) => void;
}

export function StationCard({ station, onAdvance, onDelete }: StationCardProps) {
  const getStationTypeIcon = (type: string) => {
    switch (type) {
      case 'external':
        return '🔧';
      case 'checkpoint':
        return '✓';
      case 'external_optional':
        return '⚠️';
      default:
        return '🏭';
    }
  };

  const occupiedSlots = station.slots.filter((slot) => slot.truck).length;

  return (
    <div className="bg-white rounded-xl shadow-lg border-2 border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-slate-700 to-slate-900 text-white p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{getStationTypeIcon(station.type)}</span>
              <h3 className="text-lg font-bold">{station.name}</h3>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="bg-white bg-opacity-20 px-2 py-1 rounded">
                Capacité: {occupiedSlots}/{station.capacity}
              </span>
              {station.type === 'external_optional' && (
                <span className="bg-yellow-500 text-black px-2 py-1 rounded font-semibold">
                  OPTIONNEL
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {station.slots.map((slot) => (
            <SlotCard key={slot.id} slot={slot} onAdvance={onAdvance} onDelete={onDelete} />
          ))}
        </div>

        {station.slots.length === 0 && (
          <div className="text-center text-gray-500 py-8">Aucun slot configuré</div>
        )}
      </div>
    </div>
  );
}
