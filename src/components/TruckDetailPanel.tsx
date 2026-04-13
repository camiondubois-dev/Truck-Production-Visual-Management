import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Truck } from '../types/progression.types';
import { STATIONS } from '../data/progressionData';

interface TruckDetailPanelProps {
  truck: Truck;
  onClose: () => void;
  onToggleSubTask: (stationId: string, subTaskId: string) => void;
  onCompleteStation: (stationId: string) => void;
  scrollToStationId?: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'en-cours': { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  'en-attente': { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  'bloque': { bg: '#fee2e2', text: '#991b1b', border: '#ef4444' },
  'pret': { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
  'livre': { bg: '#e5e7eb', text: '#374151', border: '#6b7280' },
};

export function TruckDetailPanel({
  truck,
  onClose,
  onToggleSubTask,
  onCompleteStation,
  scrollToStationId,
}: TruckDetailPanelProps) {
  const stationRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (scrollToStationId && stationRefs.current[scrollToStationId]) {
      stationRefs.current[scrollToStationId]?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [scrollToStationId]);

  const statusConfig = STATUS_COLORS[truck.status];

  const completedStations = truck.progression.filter((p) => p.status === 'termine').length;
  const totalStations = STATIONS.length;
  const progressPercent = Math.round((completedStations / totalStations) * 100);

  const currentStationIndex = STATIONS.findIndex((s) => s.id === truck.stationActuelle);
  const currentStationLabel = STATIONS.find((s) => s.id === truck.stationActuelle)?.label;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 360,
        height: '100dvh',
        background: '#ffffff',
        borderLeft: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        zIndex: 100,
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          background: '#ffffff',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#111827', lineHeight: 1.2 }}>
              #{truck.numero}
            </div>
            <div style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>
              {truck.annee} {truck.marque} {truck.modele}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: statusConfig.bg,
            border: `1px solid ${statusConfig.border}`,
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            color: statusConfig.text,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}
        >
          {truck.status}
        </div>
      </div>

      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f9fafb',
          flexShrink: 0,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          Section active ({currentStationIndex + 1}/{totalStations})
        </div>
        <div
          style={{
            padding: '8px 12px',
            background: '#3b82f6',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
            color: '#ffffff',
            marginBottom: 12,
          }}
        >
          {currentStationLabel}
        </div>

        <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6 }}>
          Progression globale
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
            <div
              style={{
                width: `${progressPercent}%`,
                height: '100%',
                background: '#22c55e',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#22c55e' }}>{progressPercent}%</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
        {STATIONS.map((station) => {
          const progress = truck.progression.find((p) => p.stationId === station.id);
          if (!progress) return null;

          const allSubTasksDone = progress.subTasks.every((t) => t.done);
          const isEnCours = progress.status === 'en-cours';
          const isTermine = progress.status === 'termine';

          return (
            <div
              key={station.id}
              ref={(el) => (stationRefs.current[station.id] = el)}
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #f3f4f6',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: isEnCours ? 700 : isTermine ? 400 : 400,
                    color: isTermine ? '#9ca3af' : '#111827',
                    textDecoration: isTermine ? 'line-through' : 'none',
                  }}
                >
                  {station.label}
                </div>
                {isTermine && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#22c55e',
                      background: '#dcfce7',
                      border: '1px solid #22c55e',
                      padding: '2px 8px',
                      borderRadius: 3,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Terminé
                  </span>
                )}
                {isEnCours && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#3b82f6',
                      background: '#dbeafe',
                      border: '1px solid #3b82f6',
                      padding: '2px 8px',
                      borderRadius: 3,
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    En cours
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {progress.subTasks.map((task) => (
                  <label
                    key={task.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      cursor: isEnCours ? 'pointer' : 'default',
                      padding: '6px 0',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => {
                        if (isEnCours) {
                          onToggleSubTask(station.id, task.id);
                        }
                      }}
                      disabled={!isEnCours}
                      style={{
                        width: 18,
                        height: 18,
                        cursor: isEnCours ? 'pointer' : 'default',
                        accentColor: '#3b82f6',
                      }}
                    />
                    <span
                      style={{
                        fontSize: 13,
                        color: task.done ? '#9ca3af' : isEnCours ? '#374151' : '#d1d5db',
                        textDecoration: task.done ? 'line-through' : 'none',
                      }}
                    >
                      {task.label}
                    </span>
                  </label>
                ))}
              </div>

              {isEnCours && allSubTasksDone && (
                <button
                  onClick={() => onCompleteStation(station.id)}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    padding: '10px 16px',
                    background: '#22c55e',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#16a34a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#22c55e')}
                >
                  ✓ Marquer comme terminé
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
