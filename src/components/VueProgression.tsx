import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { TruckDetailPanel } from './TruckDetailPanel';
import { CreateWizardModal } from './CreateWizardModal';
import { useProgression } from '../hooks/useProgression';
import { STATIONS } from '../data/progressionData';
import type { Truck, StationProgress } from '../types/progression.types';
import type { Item } from '../types/item.types';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  'en-cours': { bg: '#dbeafe', text: '#1e40af' },
  'en-attente': { bg: '#fef3c7', text: '#92400e' },
  'bloque': { bg: '#fee2e2', text: '#991b1b' },
  'pret': { bg: '#d1fae5', text: '#065f46' },
  'livre': { bg: '#e5e7eb', text: '#374151' },
  'vendu': { bg: '#dcfce7', text: '#22c55e' },
};

interface CellProgressionProps {
  prog: StationProgress;
  isActuelle: boolean;
  stationId: string;
}

function CellProgression({ prog, isActuelle, stationId }: CellProgressionProps) {
  if (stationId === 'vendu') {
    if (prog.status === 'termine') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: '#22c55e',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            ✓
          </div>
        </div>
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e5e7eb' }} />
      </div>
    );
  }

  if (prog.status === 'termine') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#dcfce7',
            border: '2px solid #22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#16a34a',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          ✓
        </div>
      </div>
    );
  }

  if (prog.status === 'en-cours') {
    const doneCount = prog.subTasks.filter((t) => t.done).length;
    const totalCount = prog.subTasks.length;
    const pct = Math.round((doneCount / totalCount) * 100);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 6,
            background: '#dbeafe',
            border: '2px solid #3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          🚛
        </div>
        <div style={{ width: 40, height: 4, background: '#e5e7eb', borderRadius: 2 }}>
          <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: 2 }} />
        </div>
        <span style={{ fontSize: 10, color: '#6b7280', fontFamily: 'monospace', fontWeight: 600 }}>
          {doneCount}/{totalCount}
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e5e7eb' }} />
    </div>
  );
}

interface StatsCardProps {
  label: string;
  count: number;
  color: string;
}

function StatsCard({ label, count, color }: StatsCardProps) {
  return (
    <div
      style={{
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div style={{ fontSize: 12, color: '#6b7280', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{count}</div>
    </div>
  );
}

export function VueProgression() {
  const { trucks, toggleSubTask, completeStation } = useProgression();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [scrollToStationId, setScrollToStationId] = useState<string | undefined>(undefined);
  const [showWizard, setShowWizard] = useState(false);

  const filteredTrucks = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return trucks;

    return trucks.filter(
      (truck) =>
        truck.numero.toLowerCase().includes(query) ||
        truck.marque.toLowerCase().includes(query) ||
        truck.modele.toLowerCase().includes(query) ||
        STATIONS.find((s) => s.id === truck.stationActuelle)?.label.toLowerCase().includes(query)
    );
  }, [trucks, searchQuery]);

  const selectedTruck = trucks.find((t) => t.id === selectedTruckId);

  const stats = useMemo(() => {
    const enCours = trucks.filter((t) => t.status === 'en-cours').length;
    const enAttente = trucks.filter((t) => t.status === 'en-attente').length;
    const bloques = trucks.filter((t) => t.status === 'bloque').length;
    const prets = trucks.filter((t) => t.status === 'pret').length;
    const total = trucks.length;

    return { enCours, enAttente, bloques, prets, total };
  }, [trucks]);

  const handleRowClick = (truck: Truck) => {
    setSelectedTruckId(truck.id);
    setScrollToStationId(undefined);
  };

  const handleCellClick = (truck: Truck, stationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedTruckId(truck.id);
    setScrollToStationId(stationId);
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#f8fafc' }}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          marginRight: selectedTruck ? 360 : 0,
          transition: 'margin-right 0.3s ease',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            background: '#ffffff',
            borderBottom: '1px solid #e5e7eb',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#111827', margin: 0 }}>
              Progression des camions
            </h1>
            <button
              onClick={() => setShowWizard(true)}
              style={{
                padding: '8px 16px',
                background: '#f97316',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              + Nouveau
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
            <StatsCard label="En cours" count={stats.enCours} color="#3b82f6" />
            <StatsCard label="En attente" count={stats.enAttente} color="#f59e0b" />
            <StatsCard label="Bloqués" count={stats.bloques} color="#ef4444" />
            <StatsCard label="Prêts" count={stats.prets} color="#22c55e" />
            <StatsCard label="Total actifs" count={stats.total} color="#6b7280" />
          </div>

          <div style={{ position: 'relative' }}>
            <Search
              size={18}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }}
            />
            <input
              type="text"
              placeholder="Rechercher par numéro, marque ou modèle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 16px 10px 40px',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                fontSize: 14,
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => (e.target.style.borderColor = '#3b82f6')}
              onBlur={(e) => (e.target.style.borderColor = '#d1d5db')}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 14,
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th
                  style={{
                    width: 200,
                    padding: '12px 16px',
                    background: '#ffffff',
                    borderBottom: '2px solid #e5e7eb',
                    textAlign: 'left',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Camion
                </th>
                <th
                  style={{
                    width: 100,
                    padding: '12px 16px',
                    background: '#ffffff',
                    borderBottom: '2px solid #e5e7eb',
                    textAlign: 'center',
                    fontSize: 12,
                    fontWeight: 600,
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}
                >
                  Statut
                </th>
                {STATIONS.map((station) => (
                  <th
                    key={station.id}
                    style={{
                      width: 110,
                      padding: '12px 4px',
                      background: '#ffffff',
                      borderBottom: '2px solid #e5e7eb',
                      textAlign: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: station.color,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      verticalAlign: 'bottom',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.3,
                    }}
                  >
                    {station.labelCourt}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTrucks.map((truck, idx) => {
                const isSelected = truck.id === selectedTruckId;
                const statusConfig = STATUS_COLORS[truck.status];
                const isVendu = truck.status === 'vendu';

                return (
                  <tr
                    key={truck.id}
                    onClick={() => handleRowClick(truck)}
                    style={{
                      background: isVendu
                        ? '#f0fdf4'
                        : isSelected
                        ? '#eff6ff'
                        : idx % 2 === 0
                        ? '#ffffff'
                        : '#f8fafc',
                      borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                      opacity: isVendu ? 0.6 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = isVendu ? '#f0fdf4' : '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        e.currentTarget.style.background = isVendu
                          ? '#f0fdf4'
                          : idx % 2 === 0
                          ? '#ffffff'
                          : '#f8fafc';
                    }}
                  >
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          color: isVendu ? '#6b7280' : '#111827',
                          fontSize: 14,
                        }}
                      >
                        #{truck.numero}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
                        {truck.marque} {truck.modele}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          background: statusConfig.bg,
                          color: statusConfig.text,
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {truck.status}
                      </span>
                    </td>
                    {STATIONS.map((station) => {
                      const prog = truck.progression.find((p) => p.stationId === station.id);
                      if (!prog) return <td key={station.id} />;

                      const isActuelle = truck.stationActuelle === station.id;

                      return (
                        <td
                          key={station.id}
                          onClick={(e) => {
                            if (prog.status === 'en-cours') {
                              handleCellClick(truck, station.id, e);
                            }
                          }}
                          style={{
                            padding: '12px 8px',
                            borderBottom: '1px solid #f3f4f6',
                            textAlign: 'center',
                            cursor: prog.status === 'en-cours' ? 'pointer' : 'default',
                          }}
                        >
                          <CellProgression prog={prog} isActuelle={isActuelle} stationId={station.id} />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredTrucks.length === 0 && (
            <div
              style={{
                padding: '60px 24px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: 14,
              }}
            >
              Aucun camion trouvé
            </div>
          )}
        </div>
      </div>

      {selectedTruck && (
        <TruckDetailPanel
          truck={selectedTruck}
          onClose={() => {
            setSelectedTruckId(null);
            setScrollToStationId(undefined);
          }}
          onToggleSubTask={(stationId, subTaskId) => toggleSubTask(selectedTruck.id, stationId, subTaskId)}
          onCompleteStation={(stationId) => completeStation(selectedTruck.id, stationId)}
          scrollToStationId={scrollToStationId}
        />
      )}

      {showWizard && (
        <CreateWizardModal
          onClose={() => setShowWizard(false)}
          onCreate={(item) => {
            console.log('Nouveau item créé:', item);
            setShowWizard(false);
          }}
        />
      )}
    </div>
  );
}
