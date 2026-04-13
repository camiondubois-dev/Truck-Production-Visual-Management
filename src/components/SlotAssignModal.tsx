import { SLOT_TO_GARAGE, STATION_TO_GARAGE } from '../data/garageData';
import type { Item, Slot } from '../types/item.types';
import { EauIcon } from './EauIcon';

interface SlotAssignModalProps {
  slot: Slot;
  enAttente: {
    eau: Item[];
    client: Item[];
    detail: Item[];
  };
  onAssign: (itemId: string, slotId: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
  preSelectedItem?: Item;
  onJobTemporaire?: () => void;
  onChoisirInventaire?: () => void;
  itemOccupant?: Item;
  onRetirerOccupant?: (itemId: string) => void;
  onTerminerOccupant?: (itemId: string) => void;
}

export function SlotAssignModal({ slot, enAttente, onAssign, onClose, position, preSelectedItem, onJobTemporaire, onChoisirInventaire, itemOccupant, onRetirerOccupant, onTerminerOccupant }: SlotAssignModalProps) {

  // Trouver le garage de ce slot
  const garageSlot = SLOT_TO_GARAGE[slot.id];
if (itemOccupant) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: position.y, left: position.x, zIndex: 200,
        background: '#1a1814', border: '1px solid #ef4444',
        borderRadius: 10, padding: 16, width: 320,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}
    >
      <div style={{ fontFamily: 'monospace', color: '#ef4444', fontWeight: 700, marginBottom: 8, fontSize: 14 }}>
        ⚠️ Slot {slot.id} déjà occupé!
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 14 }}>
        Le camion <span style={{ color: '#f97316', fontWeight: 700 }}>#{itemOccupant.numero}</span> est déjà dans ce slot. Que voulez-vous faire?
      </div>
      <button
        onClick={() => { onRetirerOccupant?.(itemOccupant.id); onClose(); }}
        style={{ width: '100%', marginBottom: 8, padding: '10px', background: '#f59e0b', border: 'none', borderRadius: 7, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
      >
        ↩ Mettre #{itemOccupant.numero} en attente
      </button>
      <button
        onClick={() => { onTerminerOccupant?.(itemOccupant.id); onClose(); }}
        style={{ width: '100%', marginBottom: 8, padding: '10px', background: '#22c55e', border: 'none', borderRadius: 7, color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}
      >
        ✓ Terminer #{itemOccupant.numero} et libérer le slot
      </button>
      <button
        onClick={onClose}
        style={{ width: '100%', padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}
      >
        Annuler
      </button>
    </div>
  );
}
  // Filtrer seulement les items qui attendent dans CE garage
  const filtrerParGarage = (items: Item[]) =>
    items.filter(i => {
      const garageItem = i.dernierGarageId ?? STATION_TO_GARAGE[i.stationActuelle ?? ''];
      return garageItem === garageSlot;
    });

  const tous = [
    ...filtrerParGarage(enAttente.eau).map((i) => ({ ...i, couleur: '#f97316', icon: 'EAU_LOGO' })),
    ...filtrerParGarage(enAttente.client).map((i) => ({ ...i, couleur: '#3b82f6', icon: '🔧' })),
    ...filtrerParGarage(enAttente.detail).map((i) => ({ ...i, couleur: '#22c55e', icon: '🏷️' })),
  ];

  const tries = [...tous].sort((a, b) => (b.urgence ? 1 : 0) - (a.urgence ? 1 : 0));

  if (preSelectedItem) {
    const preSelectedWithColors = {
      ...preSelectedItem,
      couleur: preSelectedItem.type === 'eau' ? '#f97316' : preSelectedItem.type === 'client' ? '#3b82f6' : '#22c55e',
      icon: preSelectedItem.type === 'eau' ? 'EAU_LOGO' : preSelectedItem.type === 'client' ? '🔧' : '🏷️',
    };

    return (
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'fixed', top: position.y, left: position.x, zIndex: 200,
          background: '#1a1814', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: 10, padding: 16, width: 320,
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)', maxHeight: '80vh', overflow: 'auto',
        }}
      >
        <div style={{ fontFamily: 'monospace', color: '#ff6040', fontWeight: 700, marginBottom: 12, fontSize: 14 }}>
          Assigner #{preSelectedItem.numero} au slot {slot.id}?
        </div>

        <div style={{
          padding: '12px', borderRadius: 7, marginBottom: 12,
          background: `${preSelectedWithColors.couleur}20`,
          border: `2px solid ${preSelectedWithColors.couleur}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {preSelectedWithColors.icon === 'EAU_LOGO' ? <EauIcon /> : <span style={{ fontSize: 20 }}>{preSelectedWithColors.icon}</span>}
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: preSelectedWithColors.couleur, fontSize: 16 }}>
              #{preSelectedItem.numero}
            </span>
            {preSelectedItem.urgence && (
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 3 }}>
                URGENT
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>{preSelectedItem.label}</div>
        </div>

        <button
          onClick={() => { onAssign(preSelectedItem.id, slot.id); onClose(); }}
          style={{ width: '100%', marginBottom: 8, padding: '10px', background: preSelectedWithColors.couleur, border: 'none', borderRadius: 7, color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
        >
          ✓ Confirmer assignation
        </button>

        <button
          onClick={onClose}
          style={{ width: '100%', padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12 }}
        >
          Annuler
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed', top: position.y, left: position.x, zIndex: 200,
        background: '#1a1814', border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 10, padding: 16, width: 320,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)', maxHeight: '80vh', overflow: 'auto',
      }}
    >
      <div style={{ fontFamily: 'monospace', color: '#ff6040', fontWeight: 700, marginBottom: 4, fontSize: 14 }}>
        Slot {slot.id} — Qui met-on ici?
      </div>

      {/* Label du garage */}
      {garageSlot && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 12, fontFamily: 'monospace' }}>
          Garage : {garageSlot.replace(/-/g, ' ').toUpperCase()}
        </div>
      )}

      {tries.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '16px 0', fontSize: 13 }}>
          {garageSlot
            ? `Aucun item en attente pour ce garage`
            : 'Aucun item en attente'}
        </div>
      )}

      {tries.map((item) => (
        <div
          key={item.id}
          onClick={() => { onAssign(item.id, slot.id); onClose(); }}
          style={{
            padding: '10px 12px', borderRadius: 7, marginBottom: 6,
            background: `${item.couleur}15`,
            border: `1px solid ${item.urgence ? '#ef4444' : item.couleur + '44'}`,
            cursor: 'pointer', transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = `${item.couleur}25`)}
          onMouseLeave={(e) => (e.currentTarget.style.background = `${item.couleur}15`)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {item.icon === 'EAU_LOGO' ? <EauIcon /> : <span style={{ fontSize: 16 }}>{item.icon}</span>}
            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: item.couleur, fontSize: 13 }}>
              #{item.numero}
            </span>
            {item.urgence && (
              <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, background: '#fef3c7', color: '#92400e', padding: '2px 6px', borderRadius: 3 }}>
                URGENT
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginTop: 3 }}>{item.label}</div>
          {item.nomClient && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{item.nomClient}</div>
          )}
          {item.stationActuelle && (
            <div style={{ fontSize: 11, color: item.couleur, marginTop: 2, opacity: 0.8 }}>
              Étape : {item.stationActuelle}
            </div>
          )}
        </div>
      ))}

      {onChoisirInventaire && (
        <button
          onClick={() => { onChoisirInventaire(); }}
          style={{
            width: '100%', marginTop: 10, padding: '9px', borderRadius: 6,
            border: '1px solid rgba(99,179,237,0.4)', background: 'rgba(99,179,237,0.07)',
            color: 'rgba(147,210,255,0.85)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(99,179,237,0.14)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(99,179,237,0.07)')}
        >
          📋 Choisir depuis l'inventaire
        </button>
      )}

      {onJobTemporaire && (
        <button
          onClick={() => { onJobTemporaire(); }}
          style={{
            width: '100%', marginTop: 6, padding: '8px', borderRadius: 6,
            border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.04)',
            color: 'rgba(255,255,255,0.55)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
        >
          ⚙️ Job temporaire
        </button>
      )}

      <button
        onClick={onClose}
        style={{ width: '100%', marginTop: 6, padding: '6px', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12 }}
      >
        Annuler
      </button>
    </div>
  );
}
