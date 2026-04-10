import { useState } from 'react';
import { SLOT_TO_GARAGE, GARAGE_TO_SLOTS } from '../data/garageData';
import { EauIcon } from './EauIcon';
import type { Item, Slot } from '../types/item.types';

interface StationConfig {
  id: string;
  label: string;
  color: string;
  ordre: number;
}

interface SlotOccupeModalProps {
  item: Item;
  slot: Slot;
  onRetirerAttente: (itemId: string) => void;
  onTerminerEtAvancer: (itemId: string) => void;
  onTerminer: (itemId: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
  stations?: StationConfig[];
  onUpdateStationStatus?: (itemId: string, stationId: string, status: string) => void;
  onAssignerSlot?: (itemId: string, slotId: string) => void;
  slotMap?: Record<string, Item>;
  departementId?: string;
}

function formatDateRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffDays > 0) return `${diffDays}j`;
  if (diffHours > 0) return `${diffHours}h`;
  return 'quelques minutes';
}

function ModalPDF({ doc, onClose }: { doc: { nom: string; base64: string }; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '90vw', height: '90vh', background: '#1a1814', borderRadius: 12,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)',
          background: '#111009', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📄</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{doc.nom}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { const l = document.createElement('a'); l.href = doc.base64; l.download = doc.nom; document.body.appendChild(l); l.click(); document.body.removeChild(l); }}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ⬇ Télécharger
            </button>
            <button onClick={onClose}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              ✕ Fermer
            </button>
          </div>
        </div>
        <iframe src={doc.base64} style={{ flex: 1, width: '100%', border: 'none', background: 'white' }} title={doc.nom} />
      </div>
    </div>
  );
}

function ModalPhoto({ url, numero, onClose }: { url: string; numero: string; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.92)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'relative', maxWidth: '90vw', maxHeight: '90vh',
        borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
      }}>
        <img src={url} alt={`Photo #${numero}`}
          style={{ maxWidth: '90vw', maxHeight: '85vh', objectFit: 'contain', display: 'block' }} />
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(0,0,0,0.6)', border: 'none',
          color: 'white', fontSize: 18, fontWeight: 700,
          cursor: 'pointer', borderRadius: 6, padding: '4px 10px',
        }}>✕</button>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'rgba(0,0,0,0.6)', padding: '8px 16px',
          color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600,
        }}>
          📷 #{numero}
        </div>
      </div>
    </div>
  );
}

export function SlotOccupeModal({
  item, slot, onRetirerAttente, onTerminerEtAvancer, onTerminer, onClose, position,
  stations, onUpdateStationStatus, onAssignerSlot, slotMap, departementId,
}: SlotOccupeModalProps) {
  const [pdfOuvert, setPdfOuvert] = useState<{ nom: string; base64: string } | null>(null);
  const [photoOuverte, setPhotoOuverte] = useState(false);

  const couleur = item.type === 'eau'    ? '#f97316'
                : item.type === 'client' ? '#3b82f6'
                : '#22c55e';

  const garageActuel = SLOT_TO_GARAGE[slot.id];
  const tousLesSlotsDuGarage = garageActuel ? (GARAGE_TO_SLOTS[garageActuel] ?? []) : [];
  const autresSlots = tousLesSlotsDuGarage.filter(s => s !== slot.id);

  const stationsActives = stations?.filter(s => {
    if (!item.stationsActives.includes(s.id)) return false;
    if (departementId) return s.id === departementId;
    return true;
  }) ?? [];

  const MODAL_WIDTH = 340;
  const MARGIN = 10;
  const MAX_HEIGHT = window.innerHeight - 2 * MARGIN;

  let left = position.x;
  let top = position.y;

  if (left + MODAL_WIDTH + MARGIN > window.innerWidth) left = position.x - MODAL_WIDTH - MARGIN;
  if (left < MARGIN) left = MARGIN;
  if (top + MAX_HEIGHT + MARGIN > window.innerHeight) top = MARGIN;
  if (top < MARGIN) top = MARGIN;

  const handleTerminer = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onUpdateStationStatus && item.stationActuelle) {
      onUpdateStationStatus(item.id, item.stationActuelle, 'termine');
    }
    // Vérifier s'il reste des étapes non terminées après celle-ci
    const etapesRestantes = item.stationsActives.filter(sid => {
      if (sid === item.stationActuelle) return false;
      const prog = item.progression?.find(p => p.stationId === sid);
      return prog?.status !== 'termine' && prog?.status !== 'non-requis';
    });
    if (etapesRestantes.length === 0) {
      // Dernière étape — archiver directement
      onTerminer(item.id);
    } else {
      // Il reste des étapes — mettre en attente pour la prochaine
      onTerminerEtAvancer(item.id);
    }
    onClose();
  };

  return (
    <>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'fixed', top, left, zIndex: 200,
        background: '#1a1814',
        border: `1px solid ${couleur}44`,
        borderRadius: 10, width: MODAL_WIDTH,
        height: `${MAX_HEIGHT}px`,
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
      }}>
        {/* Header fixe */}
        <div style={{ padding: 16, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {item.type === 'eau' ? <EauIcon /> : <span style={{ fontSize: 20 }}>{item.type === 'client' ? '🔧' : '🏷️'}</span>}
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: couleur, fontSize: 15 }}>
                #{item.numero}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
                Slot {slot.id}
                {item.dateEntreeSlot && ` · depuis ${formatDateRelative(item.dateEntreeSlot)}`}
              </div>
            </div>
            <button onClick={(e) => { e.stopPropagation(); onClose(); }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 16 }}>
              ✕
            </button>
          </div>

          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginBottom: 2 }}>{item.label}</div>
          {item.nomClient && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
              {item.nomClient}{item.telephone && ` · ${item.telephone}`}
            </div>
          )}
          {item.descriptionTravail && (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
              {item.descriptionTravail}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Zone scrollable */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>

          {/* PHOTO */}
          {item.photoUrl && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
              }}>
                📷 Photo
              </div>
              <div
                onClick={(e) => { e.stopPropagation(); setPhotoOuverte(true); }}
                style={{
                  position: 'relative', borderRadius: 8, overflow: 'hidden',
                  cursor: 'pointer', border: `1px solid ${couleur}44`,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.opacity = '0.85'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.opacity = '1'; }}
              >
                <img src={item.photoUrl} alt={`Photo #${item.numero}`}
                  style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'rgba(0,0,0,0)', transition: 'background 0.15s',
                }}>
                  <span style={{ fontSize: 28, opacity: 0.7 }}>🔍</span>
                </div>
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(0,0,0,0.5)', padding: '4px 8px',
                  fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: 600,
                }}>
                  Cliquer pour agrandir
                </div>
              </div>
            </div>
          )}

          {/* ÉTAPES */}
          {stationsActives.length > 0 && onUpdateStationStatus && (
            <div style={{ marginBottom: 12 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)',
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8,
              }}>
                {departementId ? 'Étape dans ce garage' : 'Étapes opérationnelles'}
              </div>
              {stationsActives.map((station) => {
                const prog = item.progression?.find(p => p.stationId === station.id);
                const statut = prog?.status ?? 'non-commence';
                const isActuelle = item.stationActuelle === station.id;
                const statusColor = statut === 'termine' ? '#22c55e'
                  : statut === 'en-cours' ? '#3b82f6'
                  : 'rgba(255,255,255,0.1)';

                return (
                  <div key={station.id} style={{
                    marginBottom: 6, padding: '8px 10px', borderRadius: 6,
                    border: `1px solid ${isActuelle ? station.color + '66' : 'rgba(255,255,255,0.08)'}`,
                    background: isActuelle ? `${station.color}15` : 'rgba(0,0,0,0.2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: isActuelle ? 700 : 400, color: isActuelle ? station.color : 'rgba(255,255,255,0.7)', flex: 1 }}>
                        {station.label}
                      </span>
                      {isActuelle && (
                        <span style={{ fontSize: 9, background: `${station.color}33`, color: station.color, padding: '1px 5px', borderRadius: 3, fontWeight: 700 }}>
                          ACTUELLE
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); onUpdateStationStatus!(item.id, station.id, 'non-commence'); }}
                        style={{ flex: 1, padding: '5px 2px', fontSize: 9, fontWeight: 600, borderRadius: 3, cursor: 'pointer', border: 'none', background: statut === 'non-commence' ? '#94a3b8' : 'rgba(255,255,255,0.08)', color: statut === 'non-commence' ? 'white' : 'rgba(255,255,255,0.35)' }}>
                        ○ À faire
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onUpdateStationStatus!(item.id, station.id, 'en-cours'); }}
                        style={{ flex: 1, padding: '5px 2px', fontSize: 9, fontWeight: 600, borderRadius: 3, cursor: 'pointer', border: 'none', background: statut === 'en-cours' ? '#3b82f6' : 'rgba(255,255,255,0.08)', color: statut === 'en-cours' ? 'white' : 'rgba(255,255,255,0.35)' }}>
                        ● En cours
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); onUpdateStationStatus!(item.id, station.id, 'termine'); onTerminerEtAvancer(item.id); onClose(); }}
                        style={{ flex: 1, padding: '5px 2px', fontSize: 9, fontWeight: 600, borderRadius: 3, cursor: 'pointer', border: 'none', background: statut === 'termine' ? '#22c55e' : 'rgba(255,255,255,0.08)', color: statut === 'termine' ? 'white' : 'rgba(255,255,255,0.35)' }}>
                        ✓ Terminé
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* CHANGER DE SLOT */}
          {autresSlots.length > 0 && onAssignerSlot && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                Changer de slot — {garageActuel?.replace(/-/g, ' ')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {autresSlots.map(slotId => {
                  const occupant = slotMap?.[slotId];
                  const estVide = !occupant;
                  return (
                    <button key={slotId}
                      onClick={(e) => { e.stopPropagation(); onAssignerSlot!(item.id, slotId); onClose(); }}
                      style={{
                        padding: '5px 10px', borderRadius: 5, cursor: 'pointer',
                        border: estVide ? '1px solid rgba(255,255,255,0.2)' : '1px solid rgba(255,100,60,0.4)',
                        background: estVide ? 'rgba(255,255,255,0.05)' : 'rgba(255,100,60,0.1)',
                        color: estVide ? 'rgba(255,255,255,0.7)' : 'rgba(255,150,100,0.8)',
                        fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
                      }}
                      title={occupant ? `Occupé par #${occupant.numero}` : 'Disponible'}
                    >
                      {slotId}{!estVide && ' ●'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* DOCUMENTS */}
          {item.documents && item.documents.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
                📎 Documents
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {item.documents.map(doc => (
                  <button key={doc.id}
                    onClick={(e) => { e.stopPropagation(); setPdfOuvert({ nom: doc.nom, base64: doc.base64 }); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', borderRadius: 6,
                      border: '1px solid rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'rgba(255,255,255,0.85)',
                      cursor: 'pointer', fontSize: 12,
                      fontWeight: 600, textAlign: 'left',
                      width: '100%', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>📄</span>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</span>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>👁 {doc.taille}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Actions fixes en bas */}
<div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
  <button onClick={(e) => { e.stopPropagation(); onRetirerAttente(item.id); onClose(); }}
    style={{ padding: '10px', borderRadius: 7, border: 'none', background: '#f59e0b', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
    ⏸ Mettre en attente — libérer le slot
  </button>
  <button onClick={handleTerminer}
    style={{ padding: '10px', borderRadius: 7, border: '1px solid #22c55e', background: 'transparent', color: '#22c55e', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
    ✓ Travail terminé — libérer le slot
  </button>
  <button onClick={(e) => {
    e.stopPropagation();
    if (onUpdateStationStatus) {
      item.stationsActives.forEach(sid => {
        const prog = item.progression.find(p => p.stationId === sid);
        if (prog?.status !== 'non-requis') {
          onUpdateStationStatus(item.id, sid, 'termine');
        }
      });
    }
    onClose();
   }}
            style={{ padding: '10px', borderRadius: 7, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
            ✅ Marquer comme prêt
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{ padding: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 12 }}>
            Fermer
          </button>
        </div>
      </div>
      {pdfOuvert && <ModalPDF doc={pdfOuvert} onClose={() => setPdfOuvert(null)} />}
      {photoOuverte && item.photoUrl && <ModalPhoto url={item.photoUrl} numero={item.numero} onClose={() => setPhotoOuverte(false)} />}
    </>
  );
}
