import { VueAsana } from './VueAsana';
import { TOUTES_STATIONS_COMMUNES } from './VueCamionsEau';

export function VueCamionsDetail() {
  return (
    <VueAsana
      type="detail"
      toutesLesStations={TOUTES_STATIONS_COMMUNES}
      colonnesInfo={[
        { key: 'numero', label: 'Numéro',    width: 100 },
        { key: 'annee',  label: 'Année',     width: 70  },
        { key: 'marque', label: 'Marque',    width: 120 },
        { key: 'modele', label: 'Modèle',    width: 100 },
        { key: 'slot',   label: 'Slot',      width: 90  },
        { key: 'statut', label: 'Statut',    width: 110 },
      ]}
      config={{
        color: '#22c55e',
        icon: '🏷️',
        label: 'Camions détail',
      }}
    />
  );
}

function VueCamionsDetailOLD() {
  const { items, ajouterItem, toggleGarageAssignment } = useGarage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

  const details = items.filter(i => i.type === 'detail');
  const enAttente = details.filter(i => i.etat === 'en-attente');
  const enSlot    = details.filter(i => i.etat === 'en-slot');
  const termines  = details.filter(i => i.etat === 'termine');

  const selectedItem = items.find(i => i.id === selectedId) ?? null;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 24px', borderBottom: '1px solid #e5e7eb', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <StatPill label="En slot"    value={enSlot.length}    color="#22c55e" />
            <StatPill label="En attente" value={enAttente.length} color="#f59e0b" />
            <StatPill label="Terminés"   value={termines.length}  color="#94a3b8" />
          </div>
          <button
            onClick={() => setShowWizard(true)}
            style={{
              background: '#22c55e', color: 'white', border: 'none',
              borderRadius: 8, padding: '8px 20px',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            + Nouveau détail
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
            <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                <th style={thStyle(100)}>Numéro</th>
                <th style={thStyle(70)}>Année</th>
                <th style={thStyle(120)}>Marque</th>
                <th style={thStyle(100)}>Modèle</th>
                <th style={thStyle(200)}>Travaux</th>
                <th style={thStyle(90)}>Slot</th>
                <th style={thStyle(110)}>Statut</th>
                {GARAGES_COLONNES.map(g => (
                  <th key={g.id} style={{
                    ...thStyle(100),
                    color: g.color,
                    borderBottom: `2px solid ${g.color}44`,
                    whiteSpace: 'normal',
                    lineHeight: 1.3,
                  }}>
                    {g.label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {enAttente.length > 0 && (
                <>
                  <SectionHeader label="En attente de slot" color="#f59e0b" count={enAttente.length} />
                  {enAttente.map(item => (
                    <LigneDetail
                      key={item.id}
                      item={item}
                      selected={selectedId === item.id}
                      onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                      onToggleGarage={(garageId) => toggleGarageAssignment(item.id, garageId)}
                    />
                  ))}
                </>
              )}

              {enSlot.length > 0 && (
                <>
                  <SectionHeader label="Dans le garage" color="#22c55e" count={enSlot.length} />
                  {enSlot.map(item => (
                    <LigneDetail
                      key={item.id}
                      item={item}
                      selected={selectedId === item.id}
                      onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                      onToggleGarage={(garageId) => toggleGarageAssignment(item.id, garageId)}
                    />
                  ))}
                </>
              )}

              {termines.length > 0 && (
                <>
                  <SectionHeader label="Terminés / Vendus" color="#94a3b8" count={termines.length} />
                  {termines.map(item => (
                    <LigneDetail
                      key={item.id}
                      item={item}
                      selected={selectedId === item.id}
                      onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                      onToggleGarage={(garageId) => toggleGarageAssignment(item.id, garageId)}
                    />
                  ))}
                </>
              )}

              {details.length === 0 && (
                <tr>
                  <td colSpan={999} style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>🏷️</div>
                    <div style={{ fontSize: 16, fontWeight: 500 }}>Aucun camion détail</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>Clique sur "+ Nouveau détail" pour commencer</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedItem && (
        <PanneauDetailClientDetail
          item={selectedItem}
          onClose={() => setSelectedId(null)}
        />
      )}

      {showWizard && (
        <CreateWizardModal
          initialType="detail"
          onCreate={(item) => { ajouterItem(item); setShowWizard(false); }}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}

const LigneDetail = ({ item, selected, onClick, onToggleGarage }: {
  item: Item;
  selected: boolean;
  onClick: () => void;
  onToggleGarage: (garageId: string) => void;
}) => (
  <tr
    onClick={onClick}
    style={{
      borderBottom: '1px solid #f1f5f9',
      background: selected ? '#f0fdf4' : 'white',
      borderLeft: selected ? '3px solid #22c55e' : '3px solid transparent',
      cursor: 'pointer',
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc'; }}
    onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLTableRowElement).style.background = 'white'; }}
  >
    <td style={tdStyle}>
      <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>#{item.numero}</span>
    </td>
    <td style={tdStyle}>
      <span style={{ fontSize: 13 }}>{item.annee}</span>
    </td>
    <td style={tdStyle}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{item.marque}</span>
    </td>
    <td style={tdStyle}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{item.modele}</span>
    </td>
    <td style={tdStyle}>
      {item.descriptionTravaux
        ? <span style={{
            fontSize: 12, color: '#6b7280',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            lineHeight: 1.4,
            maxWidth: 200,
          }}>
            {item.descriptionTravaux}
          </span>
        : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
      }
    </td>
    <td style={tdStyle}>
      {item.slotId
        ? <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f0fdf4', color: '#166534', padding: '2px 8px', borderRadius: 4 }}>
            Slot {item.slotId}
          </span>
        : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>
      }
    </td>
    <td style={tdStyle}>
      <StatutBadge etat={item.etat} />
    </td>

    {GARAGES_COLONNES.map(garage => {
      const assignment = item.garageAssignments?.find(a => a.garageId === garage.id);
      return (
        <td
          key={garage.id}
          style={{ textAlign: 'center', padding: '8px 4px' }}
          onClick={e => { e.stopPropagation(); onToggleGarage(garage.id); }}
        >
          <CelluleGarage assignment={assignment} color={garage.color} />
        </td>
      );
    })}
  </tr>
);
