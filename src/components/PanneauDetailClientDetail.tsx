import { useState } from 'react';
import { useGarage } from '../contexts/GarageContext';
import { Item } from '../types/item.types';
import { GARAGES_COLONNES } from '../data/garageData';
import { PopupAssignationSlot } from './PopupAssignationSlot';

interface Props {
  item: Item;
  onClose: () => void;
}

export const PanneauDetailClientDetail = ({ item, onClose }: Props) => {
  const { toggleGarageAssignment, retirerVersAttente, terminerItem, terminerGarage, updateStationStatus } = useGarage();
  const [popupStation, setPopupStation] = useState<string | null>(null);

  const couleur = item.type === 'client' ? '#3b82f6' : item.type === 'eau' ? '#f97316' : '#22c55e';
  const icon    = item.type === 'client' ? '🔧' : item.type === 'eau' ? '🚒' : '🏷️';

  const getProchaineStation = (stationId: string): string | null => {
    const stations = item.progression ?? [];
    const idx = stations.findIndex(p => p.stationId === stationId);
    if (idx === -1 || idx >= stations.length - 1) return null;
    return stations[idx + 1].stationId;
  };

  const handleTerminerEtape = (stationId: string) => {
    updateStationStatus(item.id, stationId, 'termine');

    const prochaine = getProchaineStation(stationId);

    if (prochaine && prochaine !== 'vendu') {
      retirerVersAttente(item.id);
      setPopupStation(prochaine);
    } else {
      terminerItem(item.id);
    }
  };

  return (
    <div style={{
      width: 320, flexShrink: 0,
      borderLeft: '1px solid #e5e7eb',
      display: 'flex', flexDirection: 'column',
      background: 'white', overflowY: 'auto',
      position: 'relative',
    }}>
      <button
        onClick={onClose}
        style={{
          position: 'absolute', top: 12, right: 12,
          background: 'none', border: 'none',
          fontSize: 18, color: '#9ca3af', cursor: 'pointer',
        }}
      >✕</button>

      <div style={{ padding: '20px 16px', flex: 1 }}>

        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 20, color: couleur }}>
              #{item.numero}
            </span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
            {item.type === 'client' ? (item.nomClient || 'Client inconnu') : `${item.marque} ${item.modele} ${item.annee}`}
          </div>
          {item.vehicule && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
              🚛 {item.vehicule}
            </div>
          )}
          {item.descriptionTravail && (
            <div style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
              {item.descriptionTravail}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
            <StatutBadgeInline etat={item.etat} />
            {item.urgence && (
              <span style={{ fontSize: 11, fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: 4 }}>
                ⚡ URGENT
              </span>
            )}
            {item.slotId && (
              <span style={{ fontSize: 11, fontFamily: 'monospace', background: '#eff6ff', color: '#1d4ed8', padding: '3px 8px', borderRadius: 4 }}>
                Slot {item.slotId}
              </span>
            )}
          </div>
        </div>

        {item.telephone && (
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 12 }}>
            📞 {item.telephone}
          </div>
        )}

     

        {item.descriptionTravaux && (
          <div style={{
            background: '#f8fafc',
            border: '1px solid #e5e7eb',
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 12,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: '#64748b',
              marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Travaux à effectuer
            </div>
            <div style={{
              fontSize: 13, color: '#374151', lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
            }}>
              {item.descriptionTravaux}
            </div>
          </div>
        )}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, marginBottom: 16 }} />

        <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
          Garages planifiés
        </div>

   {(item.garageAssignments ?? [])
  .sort((a, b) => a.ordre - b.ordre)
  .map((assignment, idx) => {
    const garage = GARAGES_COLONNES.find(g => g.id === assignment.garageId);
    if (!garage) return null;

    return (
      <div key={assignment.garageId} style={{
        padding: '10px 12px', marginBottom: 6, borderRadius: 8,
        border: '1px solid #e5e7eb',
        borderLeft: `3px solid ${
          assignment.statut === 'termine'          ? '#22c55e' :
          assignment.statut === 'en-slot'          ? '#3b82f6' :
          assignment.statut === 'en-attente-slot'  ? '#f59e0b' : '#e5e7eb'
        }`,
        background: assignment.statut === 'en-slot' ? '#eff6ff' : 'white',
      }}>
        {/* Nom garage */}
        <div style={{ fontSize: 13, fontWeight: 600, color: garage.color, marginBottom: 8 }}>
          {idx + 1}. {garage.label}
        </div>

        {/* Boutons statut — comme dans VueAsana */}
        <div style={{ display: 'flex', gap: 4 }}>
          {([
            { id: 'en-attente-slot', label: '○ En attente' },
            { id: 'en-slot',         label: '● En cours'   },
            { id: 'termine',         label: '✓ Terminé'    },
          ] as const).map(s => {
            const isActive = assignment.statut === s.id;
            const bg = isActive
              ? s.id === 'termine'         ? '#22c55e'
              : s.id === 'en-slot'         ? '#3b82f6'
              : '#f59e0b'
              : '#f1f5f9';
            const color = isActive ? 'white' : '#9ca3af';

            return (
              <button
                key={s.id}
                onClick={() => {
                  toggleGarageAssignment(item.id, assignment.garageId);
                  // Mettre à jour le statut directement
                  setItems(prev => prev.map(i => {
                    if (i.id !== item.id) return i;
                    return {
                      ...i,
                      etat: s.id === 'en-slot' ? 'en-slot'
                          : s.id === 'termine' ? (
                            i.garageAssignments?.every(a =>
                              a.garageId === assignment.garageId
                                ? s.id === 'termine'
                                : a.statut === 'termine'
                            ) ? 'termine' : 'en-attente'
                          ) : 'en-attente',
                      garageAssignments: i.garageAssignments?.map(a =>
                        a.garageId === assignment.garageId
                          ? { ...a, statut: s.id }
                          : a
                      ),
                    };
                  }));
                }}
                style={{
                  flex: 1, padding: '5px 4px', fontSize: 10,
                  fontWeight: 600, borderRadius: 4, cursor: 'pointer',
                  border: 'none', background: bg, color,
                  transition: 'all 0.15s',
                }}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  })
}    

        <div style={{ marginTop: 10, marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>Ajouter un garage :</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GARAGES_COLONNES
              .filter(g => !(item.garageAssignments ?? []).find(a => a.garageId === g.id))
              .map(g => (
                <button
                  key={g.id}
                  onClick={() => toggleGarageAssignment(item.id, g.id)}
                  style={{
                    padding: '4px 10px', borderRadius: 5, cursor: 'pointer',
                    background: `${g.color}15`,
                    border: `1px solid ${g.color}44`,
                    color: g.color, fontSize: 11, fontWeight: 600,
                  }}
                >
                  + {g.labelCourt}
                </button>
              ))
            }
          </div>
        </div>

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {item.etat === 'en-slot' && (
            <button
              onClick={() => retirerVersAttente(item.id)}
              style={{
                padding: '9px', borderRadius: 8, border: 'none',
                background: '#fef3c7', color: '#92400e',
                fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              ⏸ Mettre en attente
            </button>
          )}
          <button
            onClick={() => terminerItem(item.id)}
            style={{
              padding: '9px', borderRadius: 8,
              border: '1px solid #22c55e', background: 'transparent',
              color: '#22c55e', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            ✓ Travail terminé
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Notes</div>
          <textarea
            rows={3}
            placeholder="Notes sur ce job..."
            style={{
              width: '100%', padding: 8, borderRadius: 6,
              border: '1px solid #d1d5db', fontSize: 12,
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        {item.type === 'eau' && item.progression && item.progression.length > 0 && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>
              Progression du camion à eau
            </div>
            {item.progression.map((prog, idx) => (
              <div key={prog.stationId} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px', marginBottom: 6, borderRadius: 8,
                border: '1px solid #e5e7eb',
                borderLeft: `3px solid ${
                  prog.status === 'termine' ? '#22c55e' :
                  prog.status === 'en-cours' ? '#3b82f6' : '#e5e7eb'
                }`,
                background: prog.status === 'en-cours' ? '#eff6ff' : 'white',
              }}>
                <span style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#f1f5f9', color: '#6b7280',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, flexShrink: 0,
                }}>
                  {idx + 1}
                </span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  {prog.stationId}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
                  background: prog.status === 'termine' ? '#dcfce7' :
                              prog.status === 'en-cours' ? '#dbeafe' : '#f1f5f9',
                  color: prog.status === 'termine' ? '#16a34a' :
                         prog.status === 'en-cours' ? '#1d4ed8' : '#9ca3af',
                }}>
                  {prog.status === 'termine' ? '✓ Terminé' :
                   prog.status === 'en-cours' ? 'En cours' : 'À faire'}
                </span>
                {prog.status === 'en-cours' && (
                  <button
                    onClick={() => handleTerminerEtape(prog.stationId)}
                    style={{
                      fontSize: 11, padding: '2px 6px', borderRadius: 4,
                      background: '#dcfce7', color: '#16a34a',
                      border: '1px solid #22c55e', cursor: 'pointer', fontWeight: 700,
                    }}
                    title="Marquer cette étape comme terminée"
                  >
                    ✓
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {popupStation && (
        <PopupAssignationSlot
          camion={item}
          prochaineStation={popupStation}
          onAssigned={() => setPopupStation(null)}
          onMettreEnAttente={() => setPopupStation(null)}
        />
      )}
    </div>
  );
};

const StatutBadgeInline = ({ etat }: { etat: string }) => {
  const config: Record<string, { label: string; bg: string; color: string }> = {
    'en-slot':    { label: 'En slot',    bg: '#dbeafe', color: '#1d4ed8' },
    'en-attente': { label: 'En attente', bg: '#fef3c7', color: '#92400e' },
    'termine':    { label: 'Terminé',    bg: '#dcfce7', color: '#166534' },
  };
  const c = config[etat] ?? { label: etat, bg: '#f1f5f9', color: '#6b7280' };
  return (
    <span style={{ fontSize: 11, fontWeight: 700, background: c.bg, color: c.color, padding: '3px 8px', borderRadius: 4 }}>
      {c.label}
    </span>
  );
};
