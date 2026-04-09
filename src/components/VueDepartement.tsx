import { useAuth } from '../contexts/AuthContext';
import { useGarage } from '../contexts/GarageContext';
import { useEffect, useState } from 'react';
import { SlotOccupeModal } from './SlotOccupeModal';
import { SlotAssignModal } from './SlotAssignModal';
import { TOUTES_STATIONS_COMMUNES } from '../data/mockData';
import type { Item } from '../types/item.types';

interface DepartementConfig {
  label: string;
  icon: string;
  color: string;
  cols: number;
  slots: string[];
}

const DEPARTEMENTS_CONFIG: Record<string, DepartementConfig> = {
  'soudure-generale':    { label: 'Soudure générale',      icon: '🔥', color: '#f97316', cols: 1, slots: ['17'] },
  'mecanique-generale':  { label: 'Mécanique générale',    icon: '🔧', color: '#3b82f6', cols: 2, slots: ['9A', '10A', '9B', '10B'] },
  'mecanique-moteur':    { label: 'Mécanique moteur',      icon: '⚙️', color: '#3b82f6', cols: 3, slots: ['11', '12', '13', '16', '15', '14'] },
  'sous-traitants':      { label: 'Sous-traitants',        icon: '🤝', color: '#a855f7', cols: 2, slots: ['S-01', 'S-02', 'S-03', 'S-04', 'S-05', 'S-06'] },
  'soudure-specialisee': { label: 'Soudure camions à eau', icon: '💧', color: '#f97316', cols: 2, slots: ['5', '6', '4', '3'] },
  'peinture':            { label: 'Peinture',              icon: '🎨', color: '#6b7280', cols: 2, slots: ['7', '8', '2', '1'] },
};

type ModalState =
  | { type: 'occupe'; item: Item; slot: { id: string }; position: { x: number; y: number } }
  | { type: 'assign'; slot: { id: string }; position: { x: number; y: number } }
  | null;

// ── Badge commercial ──────────────────────────────────────────

function BadgeCommercialSlot({ item }: { item: Item }) {
  if (!item.etatCommercial || item.etatCommercial === 'non-vendu') return null;

  const isVendu = item.etatCommercial === 'vendu';
  const color = isVendu ? '#ef4444' : '#f59e0b';
  const label = isVendu
    ? `✓ VENDU${item.clientAcheteur ? ` — ${item.clientAcheteur}` : ''}`
    : `🔒 RÉSERVÉ${item.clientAcheteur ? ` — ${item.clientAcheteur}` : ''}`;

  return (
    <div style={{
      marginTop: 10,
      padding: '6px 12px',
      borderRadius: 6,
      background: `${color}22`,
      border: `2px solid ${color}`,
      color,
      fontWeight: 800,
      fontSize: 13,
      textAlign: 'center',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>
      {label}
    </div>
  );
}

export const VueDepartement = () => {
  const { profile, deconnexion } = useAuth();
  const {
    items, slotMap, enAttente,
    updateStationStatus, assignerSlot,
    retirerVersAttente, terminerItem,
    terminerEtAvancer,
  } = useGarage();

  const [modeTV, setModeTV] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [modalState, setModalState] = useState<ModalState>(null);
  const [pdfOuvert, setPdfOuvert] = useState<{ nom: string; base64: string } | null>(null);

  const dept = DEPARTEMENTS_CONFIG[profile?.departement ?? ''];

  useEffect(() => {
    if (!modeTV) return;
    const interval = setInterval(() => setLastRefresh(new Date()), 30000);
    return () => clearInterval(interval);
  }, [modeTV]);

  if (!dept) return null;

  const itemsEnAttente = items.filter(item => {
    if (item.etat !== 'en-attente') return false;
    if (item.dernierGarageId) return item.dernierGarageId === profile?.departement;
    return false;
  });

  const handleSlotClick = (e: React.MouseEvent, slotId: string) => {
    if (modeTV) return;
    e.stopPropagation();

    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
    let x = rect.right + 10;
    let y = rect.top;
    if (x + 360 > window.innerWidth) x = rect.left - 370;
    if (y + 500 > window.innerHeight) y = window.innerHeight - 510;

    const item = slotMap[slotId];
    if (item) {
      setModalState({ type: 'occupe', item, slot: { id: slotId }, position: { x, y } });
    } else {
      setModalState({ type: 'assign', slot: { id: slotId }, position: { x, y } });
    }
  };

  const ouvrirDoc = (e: React.MouseEvent, doc: { nom: string; base64: string }) => {
    e.stopPropagation();
    setPdfOuvert(doc);
  };

  return (
    <div
      onClick={() => setModalState(null)}
      style={{
        width: '100vw', height: '100vh',
        background: '#0d0c08',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* ── HEADER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: `2px solid ${dept.color}44`,
        background: '#111009',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            onClick={(e) => { e.stopPropagation(); deconnexion(); }}
            title="Retour au menu principal"
            style={{ cursor: 'pointer', flexShrink: 0, transition: 'opacity 0.15s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.7'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
          >
            <img
              src="/logo-camions-dubois-_-noir-bleu-1.png"
              alt="Camions Dubois"
              style={{ height: 34, objectFit: 'contain', filter: 'brightness(0) invert(1)' }}
            />
          </div>

          <div style={{ width: 1, height: 32, background: 'rgba(255,255,255,0.1)' }} />

          <span style={{ fontSize: 28 }}>{dept.icon}</span>
          <div>
            <div style={{
              fontFamily: 'monospace', fontSize: 22, fontWeight: 700,
              color: dept.color, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>
              {dept.label}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
              {modeTV
                ? `Actualisation auto · ${lastRefresh.toLocaleTimeString('fr-CA')}`
                : 'Mode interactif — cliquez sur un slot pour modifier'
              }
            </div>
          </div>
        </div>

        {!modeTV ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={(e) => { e.stopPropagation(); setModeTV(true); }}
              style={{
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 12,
              }}
            >
              📺 Mode TV
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); deconnexion(); }}
              style={{
                padding: '8px 16px', borderRadius: 8, background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.3)', cursor: 'pointer', fontSize: 12,
              }}
            >
              ← Changer
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); setModeTV(false); }}
            style={{
              padding: '6px 14px', borderRadius: 8, background: 'transparent',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 11,
            }}
          >
            Sortir mode TV
          </button>
        )}
      </div>

      {/* ── GRILLE DES SLOTS ── */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: `repeat(${dept.cols}, 1fr)`,
        gap: 16, padding: 20,
        overflow: 'auto',
        minHeight: 0,
      }}>
        {dept.slots.map(slotId => {
          const item = slotMap[slotId];
          const typeColor = item
            ? item.type === 'eau'    ? '#f97316'
            : item.type === 'client' ? '#3b82f6'
            : '#22c55e'
            : null;

          // Couleur de bordure — priorité: vendu > urgent > type
          const borderColor = item
            ? item.etatCommercial === 'vendu'   ? '#ef4444'
            : item.etatCommercial === 'reserve' ? '#f59e0b'
            : item.urgence                      ? '#ef4444'
            : typeColor!
            : 'rgba(255,255,255,0.1)';

          return (
            <div
              key={slotId}
              onClick={(e) => handleSlotClick(e, slotId)}
              style={{
                background: item ? `${typeColor}18` : '#1a1814',
                border: item
                  ? `2px solid ${borderColor}`
                  : '1px dashed rgba(255,255,255,0.1)',
                borderRadius: 12,
                display: 'flex', flexDirection: 'column',
                padding: 20,
                cursor: modeTV ? 'default' : 'pointer',
                transition: 'all 0.15s',
                overflow: 'hidden',
              }}
              onMouseEnter={e => {
                if (!modeTV) (e.currentTarget as HTMLDivElement).style.opacity = '0.85';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.opacity = '1';
              }}
            >
              <div style={{
                fontFamily: 'monospace', fontSize: 14,
                fontWeight: 700, color: '#ff6040', marginBottom: 8,
              }}>
                #{slotId}
              </div>

              {item ? (
                <>
                  <div style={{
                    fontSize: 11, fontWeight: 700,
                    color: typeColor!, letterSpacing: '0.08em', marginBottom: 8,
                  }}>
                    {item.type === 'eau'     ? '🚒 CAMION À EAU'
                     : item.type === 'client' ? '🔧 CLIENT EXT.'
                     : '🏷️ DÉTAIL'}
                  </div>

                  <div style={{
                    fontFamily: 'monospace', fontSize: 48,
                    fontWeight: 700, color: 'white',
                    lineHeight: 1, marginBottom: 8,
                  }}>
                    {item.numero}
                  </div>

                  <div style={{
                    fontSize: 18, color: 'rgba(255,255,255,0.7)',
                    marginBottom: 12, lineHeight: 1.3,
                  }}>
                    {item.type === 'client'
                      ? item.nomClient
                      : `${item.marque} ${item.modele} ${item.annee}`}
                  </div>

                  {item.stationActuelle && (
                    <div style={{
                      fontSize: 14, color: dept.color,
                      fontWeight: 600, marginBottom: 8,
                    }}>
                      Étape : {
                        TOUTES_STATIONS_COMMUNES.find(s => s.id === item.stationActuelle)?.label
                        ?? item.stationActuelle
                      }
                    </div>
                  )}

                  {/* ── BADGE COMMERCIAL ── */}
                  <BadgeCommercialSlot item={item} />

                  {/* ── DOCUMENTS ── */}
                  {item.documents && item.documents.length > 0 && (
                    <div style={{
                      marginTop: 10,
                      borderTop: '1px solid rgba(255,255,255,0.1)',
                      paddingTop: 10,
                      display: 'flex', flexDirection: 'column', gap: 6,
                    }}>
                      <div style={{
                        fontSize: 10, color: 'rgba(255,255,255,0.4)',
                        fontWeight: 700, letterSpacing: '0.08em',
                        textTransform: 'uppercase', marginBottom: 2,
                      }}>
                        📎 Documents
                      </div>
                      {item.documents.map(doc => (
                        <button
                          key={doc.id}
                          onClick={(e) => ouvrirDoc(e, doc)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '7px 10px', borderRadius: 6,
                            border: '1px solid rgba(255,255,255,0.15)',
                            background: 'rgba(255,255,255,0.05)',
                            color: 'rgba(255,255,255,0.85)',
                            cursor: 'pointer', fontSize: 12,
                            fontWeight: 600, textAlign: 'left',
                            width: '100%', transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                          }}
                        >
                          <span style={{ fontSize: 18, flexShrink: 0 }}>📄</span>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.nom}
                          </span>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>
                            👁 {doc.taille}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {item.urgence && (
                    <div style={{
                      marginTop: 10, background: '#ef444420',
                      border: '1px solid #ef4444', borderRadius: 6,
                      padding: '6px 12px', color: '#ef4444',
                      fontWeight: 700, fontSize: 14, textAlign: 'center',
                    }}>
                      ⚡ URGENT
                    </div>
                  )}

                  {!modeTV && (
                    <div style={{
                      marginTop: 10, fontSize: 10,
                      color: 'rgba(255,255,255,0.2)', textAlign: 'center',
                    }}>
                      Cliquer pour modifier
                    </div>
                  )}
                </>
              ) : (
                <div style={{
                  flex: 1, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.15)',
                  fontSize: 20, fontWeight: 500,
                }}>
                  Disponible
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── FILE D'ATTENTE ── */}
      {itemsEnAttente.length > 0 && (
        <div style={{
          borderTop: `1px solid ${dept.color}33`,
          padding: '10px 20px',
          background: 'rgba(0,0,0,0.3)',
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#f59e0b',
            fontFamily: 'monospace', letterSpacing: '0.08em', flexShrink: 0,
          }}>
            ⏳ EN ATTENTE ({itemsEnAttente.length})
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {itemsEnAttente.map(item => (
              <div
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation();
                  const slotVide = dept.slots.find(s => !slotMap[s]);
                  if (slotVide) {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    setModalState({
                      type: 'assign',
                      slot: { id: slotVide },
                      position: { x: rect.right + 10, y: rect.top },
                    });
                  }
                }}
                style={{
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.4)',
                  borderRadius: 6, padding: '4px 12px',
                  fontFamily: 'monospace', fontWeight: 700,
                  fontSize: 13, color: '#f59e0b', cursor: 'pointer',
                }}
              >
                #{item.numero}
                {item.urgence && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: '#ef4444' }}>URG</span>
                )}
                {item.etatCommercial === 'vendu' && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: '#ef4444', fontWeight: 700 }}>VENDU</span>
                )}
                {item.etatCommercial === 'reserve' && (
                  <span style={{ marginLeft: 6, fontSize: 10, color: '#f59e0b', fontWeight: 700 }}>RÉS.</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {modalState?.type === 'occupe' && (
        <SlotOccupeModal
          item={slotMap[modalState.slot.id] ?? modalState.item}
          slot={modalState.slot}
          onRetirerAttente={retirerVersAttente}
          onTerminerEtAvancer={terminerEtAvancer}
          onTerminer={terminerItem}
          onClose={() => setModalState(null)}
          position={modalState.position}
          stations={TOUTES_STATIONS_COMMUNES}
          onUpdateStationStatus={updateStationStatus}
          onAssignerSlot={assignerSlot}
          slotMap={slotMap}
          departementId={profile?.departement}
        />
      )}

      {modalState?.type === 'assign' && (
        <SlotAssignModal
          slot={modalState.slot}
          enAttente={enAttente}
          onAssign={(itemId, slotId) => {
            assignerSlot(itemId, slotId);
            setModalState(null);
          }}
          onClose={() => setModalState(null)}
          position={modalState.position}
        />
      )}

      {/* ── MODAL APERÇU PDF ── */}
      {pdfOuvert && (
        <div
          onClick={() => setPdfOuvert(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 500,
            background: 'rgba(0,0,0,0.85)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90vw', height: '90vh',
              background: '#1a1814', borderRadius: 12,
              display: 'flex', flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              background: '#111009', flexShrink: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 20 }}>📄</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>
                  {pdfOuvert.nom}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = pdfOuvert.base64;
                    link.download = pdfOuvert.nom;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: 'transparent',
                    color: 'rgba(255,255,255,0.6)',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  ⬇ Télécharger
                </button>
                <button
                  onClick={() => setPdfOuvert(null)}
                  style={{
                    padding: '6px 14px', borderRadius: 6,
                    border: 'none', background: '#ef4444',
                    color: 'white', fontSize: 12,
                    fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ✕ Fermer
                </button>
              </div>
            </div>
            <iframe
              src={pdfOuvert.base64}
              style={{ flex: 1, width: '100%', border: 'none', background: 'white' }}
              title={pdfOuvert.nom}
            />
          </div>
        </div>
      )}
    </div>
  );
};