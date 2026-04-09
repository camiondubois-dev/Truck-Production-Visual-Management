import { useGarage } from '../contexts/GarageContext';
import { Item } from '../types/item.types';
import { EauIcon } from './EauIcon';
import { STATION_TO_SLOTS, STATION_LABEL } from '../data/garageData';

interface Props {
  camion: Item;
  prochaineStation: string;
  onAssigned: () => void;
  onMettreEnAttente: () => void;
}

export const PopupAssignationSlot = ({
  camion,
  prochaineStation,
  onAssigned,
  onMettreEnAttente
}: Props) => {
  const { items, assignerSlot, retirerVersAttente } = useGarage();

  const slotsGarage = STATION_TO_SLOTS[prochaineStation] ?? [];
  const stationLabel = STATION_LABEL[prochaineStation] ?? prochaineStation;

  const slotsAvecEtat = slotsGarage.map(slotId => {
    const occupant = items.find(i => i.slotId === slotId && i.id !== camion.id);
    return { slotId, occupant };
  });

  const handleChoisirSlot = (slotId: string, occupant?: Item) => {
    if (occupant) {
      retirerVersAttente(occupant.id);
    }
    assignerSlot(camion.id, slotId);
    onAssigned();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'white', borderRadius: 16,
        width: 480, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
      }}>

        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #e5e7eb',
          background: '#f8fafc',
        }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>
            Prochaine étape
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
            {stationLabel}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontFamily: 'monospace', fontWeight: 700,
              color: '#f97316', fontSize: 14,
            }}>
              #{camion.numero}
            </span>
            <span style={{ fontSize: 13, color: '#6b7280' }}>
              {camion.marque} {camion.modele} {camion.annee}
            </span>
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 8 }}>
            Choisissez un slot — cliquer sur un slot occupé déplacera l'occupant en attente.
          </div>
        </div>

        <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
          {slotsGarage.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: '20px 0' }}>
              Aucun slot fixe pour cette étape.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
            }}>
              {slotsAvecEtat.map(({ slotId, occupant }) => {
                const estOccupe = !!occupant;
                const couleurOccupant = occupant?.type === 'eau'    ? '#f97316'
                                      : occupant?.type === 'client' ? '#3b82f6'
                                      : '#22c55e';

                return (
                  <div
                    key={slotId}
                    onClick={() => handleChoisirSlot(slotId, occupant)}
                    style={{
                      borderRadius: 10,
                      border: estOccupe
                        ? `2px solid ${couleurOccupant}66`
                        : '2px dashed #d1d5db',
                      background: estOccupe
                        ? `${couleurOccupant}0d`
                        : '#f8fafc',
                      padding: '14px 10px',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s',
                      position: 'relative',
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.transform = 'translateY(-2px)';
                      el.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget as HTMLDivElement;
                      el.style.transform = 'translateY(0)';
                      el.style.boxShadow = 'none';
                    }}
                  >
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#ff6040',
                      marginBottom: 6,
                    }}>
                      #{slotId}
                    </div>

                    {estOccupe ? (
                      <>
                        <div style={{ fontSize: 20, marginBottom: 4 }}>
                          {occupant!.type === 'eau' ? <EauIcon /> : occupant!.type === 'client' ? '🔧' : '🏷️'}
                        </div>
                        <div style={{
                          fontFamily: 'monospace',
                          fontWeight: 700,
                          fontSize: 13,
                          color: couleurOccupant,
                          marginBottom: 2,
                        }}>
                          #{occupant!.numero}
                        </div>
                        <div style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.3 }}>
                          {occupant!.marque} {occupant!.modele}
                        </div>
                        <div style={{
                          marginTop: 8,
                          fontSize: 9, fontWeight: 700,
                          background: '#fef3c7', color: '#92400e',
                          padding: '2px 6px', borderRadius: 4,
                          display: 'inline-block',
                        }}>
                          → En attente
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 24, marginBottom: 4, color: '#d1d5db' }}>○</div>
                        <div style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>
                          Disponible
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8fafc',
        }}>
          <button
            onClick={onMettreEnAttente}
            style={{
              padding: '8px 18px', borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: 'white', color: '#6b7280',
              fontSize: 13, cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            ⏸ Mettre en attente sans slot
          </button>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>
            {slotsAvecEtat.filter(s => !s.occupant).length} slot(s) disponible(s)
          </div>
        </div>
      </div>
    </div>
  );
};
