import { X, AlertCircle } from 'lucide-react';
import { STATUS_CONFIG, getStepIcon } from '../data/garageData';
import type { TruckData } from '../types/garage.types';

interface TruckDetailDrawerProps {
  truck: TruckData | null;
  onClose: () => void;
  onAdvance?: (truckId: string) => void;
  onBlock?: (truckId: string) => void;
}

export function TruckDetailDrawer({ truck, onClose, onAdvance, onBlock }: TruckDetailDrawerProps) {
  if (!truck) return null;

  const statusConfig = STATUS_CONFIG[truck.status];

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-80 bg-[#1a1814] border-l border-white border-opacity-15 z-50 shadow-2xl overflow-y-auto">
        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-3xl font-bold text-white font-mono tracking-wider">
                #{truck.id}
              </h2>
              <div className="flex gap-2 mt-2">
                <span className="px-2 py-1 text-xs font-semibold bg-blue-500 bg-opacity-20 text-blue-400 rounded">
                  {truck.type}
                </span>
                <span className="px-2 py-1 text-xs font-semibold bg-purple-500 bg-opacity-20 text-purple-400 rounded">
                  {truck.variant}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition p-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="bg-[#222018] rounded-lg p-4 border border-white border-opacity-10">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{getStepIcon(truck.etape)}</span>
                <div className="flex-1">
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Étape actuelle</p>
                  <p className="text-white font-semibold">{truck.etape}</p>
                </div>
              </div>
            </div>

            <div className="bg-[#222018] rounded-lg p-4 border border-white border-opacity-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Statut</p>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shadow-lg"
                      style={{
                        backgroundColor: statusConfig.dot,
                        boxShadow: `0 0 8px ${statusConfig.dot}`,
                      }}
                    />
                    <span
                      className="font-semibold"
                      style={{ color: statusConfig.color }}
                    >
                      {statusConfig.label}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">
                    Durée actuelle
                  </p>
                  <p className="text-2xl font-bold text-white">
                    {truck.jours}
                    <span className="text-sm text-gray-400 ml-1">jour{truck.jours > 1 ? 's' : ''}</span>
                  </p>
                </div>
              </div>
            </div>

            {truck.status === 'bloque' && (
              <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 font-semibold text-sm">Camion bloqué</p>
                    <p className="text-red-300 text-xs mt-1">
                      Ce camion nécessite une attention particulière avant de pouvoir avancer.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4">
            <button
              onClick={() => onAdvance?.(truck.id)}
              disabled={truck.status === 'bloque'}
              className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-semibold py-3 rounded-lg transition"
            >
              <span>✓</span>
              Avancer l'étape
            </button>

            {truck.status !== 'bloque' && (
              <button
                onClick={() => onBlock?.(truck.id)}
                className="w-full flex items-center justify-center gap-2 bg-transparent border-2 border-red-500 text-red-400 hover:bg-red-500 hover:bg-opacity-10 font-semibold py-3 rounded-lg transition"
              >
                <AlertCircle className="w-4 h-4" />
                Marquer bloqué
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-white border-opacity-10">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
              Informations slot
            </p>
            <p className="text-white font-mono text-sm">Slot: {truck.slotId}</p>
          </div>
        </div>
      </div>
    </>
  );
}
