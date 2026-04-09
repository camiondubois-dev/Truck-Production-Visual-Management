import { Truck as TruckIcon, ArrowRight, Trash2 } from 'lucide-react';
import type { Slot, Truck } from '../lib/database.types';

interface SlotCardProps {
  slot: Slot & { truck: Truck | null };
  onAdvance?: (truckId: string) => void;
  onDelete?: (truckId: string) => void;
}

export function SlotCard({ slot, onAdvance, onDelete }: SlotCardProps) {
  const getStatusColor = (status: string | undefined) => {
    switch (status) {
      case 'in_progress':
        return 'bg-blue-500 border-blue-600';
      case 'waiting':
        return 'bg-yellow-500 border-yellow-600';
      case 'blocked':
        return 'bg-red-500 border-red-600';
      case 'done':
        return 'bg-green-500 border-green-600';
      default:
        return 'bg-gray-200 border-gray-300';
    }
  };

  const getStatusLabel = (status: string | undefined) => {
    switch (status) {
      case 'in_progress':
        return 'En cours';
      case 'waiting':
        return 'En attente';
      case 'blocked':
        return 'Bloqué';
      case 'done':
        return 'Terminé';
      default:
        return 'Vide';
    }
  };

  return (
    <div
      className={`relative border-2 rounded-lg p-3 min-h-[100px] transition-all ${
        slot.truck ? getStatusColor(slot.truck.status) : 'bg-gray-100 border-gray-300'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs font-bold text-white bg-black bg-opacity-30 px-2 py-1 rounded">
          {slot.slot_number}
        </span>
        {slot.truck && (
          <span className="text-xs font-medium text-white bg-black bg-opacity-30 px-2 py-1 rounded">
            {getStatusLabel(slot.truck.status)}
          </span>
        )}
      </div>

      {slot.truck ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-white">
            <TruckIcon className="w-5 h-5" />
            <span className="font-bold text-lg">{slot.truck.numero}</span>
          </div>

          <div className="flex items-center gap-1 text-xs text-white bg-black bg-opacity-30 px-2 py-1 rounded w-fit">
            <span className="font-semibold">{slot.truck.variant?.toUpperCase() || 'N/A'}</span>
          </div>

          {slot.truck.status !== 'done' && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => onAdvance?.(slot.truck!.id)}
                className="flex-1 flex items-center justify-center gap-1 bg-white text-gray-900 px-3 py-1.5 rounded font-medium text-sm hover:bg-gray-100 transition"
              >
                <ArrowRight className="w-4 h-4" />
                Avancer
              </button>
              <button
                onClick={() => onDelete?.(slot.truck!.id)}
                className="bg-white text-red-600 p-1.5 rounded hover:bg-red-50 transition"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400">
          <span className="text-sm">Disponible</span>
        </div>
      )}
    </div>
  );
}
