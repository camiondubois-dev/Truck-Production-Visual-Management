import { useState } from 'react';
import { useGarage } from '../hooks/useGarage';
import { EauIcon } from './EauIcon';
import { useAuth } from '../contexts/AuthContext';
import { useInventaire } from '../contexts/InventaireContext';
import { CreateWizardModal } from './CreateWizardModal';
import { PopupAssignationSlot } from './PopupAssignationSlot';
import { getStatutEffectif, toutesEtapesCompletees } from '../utils/progressionUtils';
import { photoService } from '../services/photoService';
import { inventaireService } from '../services/inventaireService';
import type { Item, TypeItem, Document, EtatCommercial } from '../types/item.types';
import { useClients } from '../contexts/ClientContext';

interface StationConfig {
  id: string;
  label: string;
  labelCourt: string;
  color: string;
  ordre: number;
}

interface ColonneInfo {
  key: string;
  label: string;
  width: number;
}

interface VueAsanaProps {
  type: TypeItem;
  toutesLesStations: StationConfig[];
  colonnesInfo: ColonneInfo[];
  config: {
    color: string;
    icon: string;
    label: string;
  };
}

function BadgeCommercial({ etat, client }: { etat?: EtatCommercial; client?: string }) {
  if (!etat || etat === 'non-vendu') return null;
  const cfg = etat === 'vendu'
    ? { bg: '#dcfce7', color: '#166534', label: client ? `✓ Vendu — ${client}` : '✓ Vendu' }
    : etat === 'location'
    ? { bg: '#ede9fe', color: '#6d28d9', label: client ? `🔑 Location — ${client}` : '🔑 Location' }
    : { bg: '#fef3c7', color: '#92400e', label: client ? `🔒 Réservé — ${client}` : '🔒 Réservé' };
  return (
    <span style={{ fontSize: 11, background: cfg.bg, color: cfg.color, padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>
      {cfg.label}
    </span>
  );
}

export function VueAsana({ type, toutesLesStations, colonnesInfo, config }: VueAsanaProps) {
  const { items, ajouterItem, updateStationStatus } = useGarage();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [showTermines, setShowTermines] = useState(false);

  const sortByNumero = (arr: typeof items) =>
    [...arr].sort((a, b) => {
      const numA = parseInt(a.numero?.replace(/\D/g, '') ?? '0') || 0;
      const numB = parseInt(b.numero?.replace(/\D/g, '') ?? '0') || 0;
      return numA - numB;
    });

  const mesItems = items.filter((i) => i.type === type);
  const enAttente = sortByNumero(mesItems.filter((i) => i.etat === 'en-attente'));
  const enSlot = sortByNumero(mesItems.filter((i) => i.etat === 'en-slot'));
  const termines = sortByNumero(mesItems.filter((i) => i.etat === 'termine'));
  const selectedItem = items.find((i) => i.id === selectedId) ?? null;

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#f8fafc' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginRight: selectedItem ? 360 : 0, transition: 'margin-right 0.3s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '2px solid #e5e7eb', background: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {config.icon === 'EAU_LOGO' ? <EauIcon /> : <span style={{ fontSize: 28 }}>{config.icon}</span>}
              <h1 style={{ fontSize: 22, fontWeight: 700, color: config.color, margin: 0 }}>{config.label}</h1>
            </div>
            <StatPill label="En slot" value={enSlot.length} color="#3b82f6" />
            <StatPill label="En attente" value={enAttente.length} color="#f59e0b" />
            <StatPill label="Terminés" value={termines.length} color="#22c55e" />
          </div>
          <button onClick={() => setShowModal(true)}
            style={{ background: config.color, color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Nouveau
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
          {mesItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>{config.icon === 'EAU_LOGO' ? <EauIcon /> : config.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Aucun item pour l'instant</div>
              <div style={{ fontSize: 14 }}>Clique sur "+ Nouveau" pour commencer</div>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
              <thead style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                  {colonnesInfo.map((col) => (
                    <th key={col.key} style={{
                      width: col.width, textAlign: 'left', padding: '12px 16px',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: '#6b7280',
                    }}>{col.label}</th>
                  ))}
                  {toutesLesStations.map((s) => (
                    <th key={s.id} style={{
                      width: 110, textAlign: 'center', padding: '10px 6px',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                      textTransform: 'uppercase', color: s.color,
                      borderBottom: `3px solid ${s.color}`,
                      whiteSpace: 'normal', lineHeight: 1.4,
                      verticalAlign: 'bottom', minWidth: 100,
                    }}>{s.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enAttente.length > 0 && (
                  <>
                    <SectionHeader label="En attente de slot" color="#f59e0b" count={enAttente.length} />
                    {enAttente.map((item) => (
                      <LigneItem key={item.id} item={item} stations={toutesLesStations} colonnesInfo={colonnesInfo}
                        selected={selectedId === item.id}
                        onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                        onStationStatusChange={updateStationStatus} />
                    ))}
                  </>
                )}
                {enSlot.length > 0 && (
                  <>
                    <SectionHeader label="Dans le garage" color="#3b82f6" count={enSlot.length} />
                    {enSlot.map((item) => (
                      <LigneItem key={item.id} item={item} stations={toutesLesStations} colonnesInfo={colonnesInfo}
                        selected={selectedId === item.id}
                        onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                        onStationStatusChange={updateStationStatus} />
                    ))}
                  </>
                )}
                {termines.length > 0 && (
                  <>
                    <SectionHeader
                      label={showTermines ? 'Terminés (cliquer pour masquer)' : `Terminés (${termines.length})`}
                      color="#22c55e" count={termines.length}
                      onClick={() => setShowTermines(!showTermines)} clickable />
                    {showTermines && termines.map((item) => (
                      <LigneItem key={item.id} item={item} stations={toutesLesStations} colonnesInfo={colonnesInfo}
                        selected={selectedId === item.id}
                        onClick={() => setSelectedId(item.id === selectedId ? null : item.id)}
                        onStationStatusChange={updateStationStatus} />
                    ))}
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {selectedItem && (
        <PanneauDetail
          item={selectedItem} stations={toutesLesStations}
          onClose={() => setSelectedId(null)}
          onStationStatusChange={updateStationStatus}
          onSupprimer={() => setSelectedId(null)}
        />
      )}

      {showModal && (
        <CreateWizardModal
          initialType={type}
          onClose={() => setShowModal(false)}
          onCreate={(item) => {
            const typeVue = type;
            const typeItem = item.type;
            if ((typeVue === 'eau' && typeItem === 'detail') || (typeVue === 'detail' && typeItem === 'eau')) {
              const destLabel = typeVue === 'eau' ? 'eau' : 'détail';
              const srcLabel = typeVue === 'eau' ? 'détail' : 'eau';
              const confirme = window.confirm(`Ce camion est destiné à ${srcLabel}. Voulez-vous changer sa destination pour ${destLabel}?`);
              if (confirme) {
                ajouterItem({ ...item, type: typeVue });
              } else {
                ajouterItem(item);
              }
            } else {
              ajouterItem(item);
            }
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 13, color: '#6b7280' }}>{label}</span>
      <span style={{ background: color, color: 'white', fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 12, minWidth: 24, textAlign: 'center' }}>
        {value}
      </span>
    </div>
  );
}

function SectionHeader({ label, color, count, onClick, clickable }: {
  label: string; color: string; count: number; onClick?: () => void; clickable?: boolean;
}) {
  return (
    <tr onClick={onClick} style={{ cursor: clickable ? 'pointer' : 'default' }}>
      <td colSpan={999} style={{
        padding: '10px 16px', background: '#f8fafc',
        borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb',
        fontSize: 12, fontWeight: 700, color, letterSpacing: '0.05em',
      }}>
        {label}
        {!clickable && (
          <span style={{ marginLeft: 10, background: color, color: 'white', fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
            {count}
          </span>
        )}
      </td>
    </tr>
  );
}

interface LigneItemProps {
  item: Item;
  stations: StationConfig[];
  colonnesInfo: ColonneInfo[];
  selected: boolean;
  onClick: () => void;
  onStationStatusChange: (itemId: string, stationId: string, status: string) => void;
}

function LigneItem({ item, stations, colonnesInfo, selected, onClick }: LigneItemProps) {
  return (
    <tr onClick={onClick}
      style={{
        borderBottom: '1px solid #f1f5f9',
        background: selected ? '#eff6ff' : 'white',
        borderLeft: selected ? '3px solid #3b82f6' : '3px solid transparent',
        cursor: 'pointer', transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { if (!selected) e.currentTarget.style.background = '#f8fafc'; }}
      onMouseLeave={(e) => { if (!selected) e.currentTarget.style.background = 'white'; }}
    >
      {colonnesInfo.map((col) => (
        <td key={col.key} style={{ padding: '14px 16px', fontSize: 13 }}>
          <ColonneValeur item={item} colKey={col.key} />
        </td>
      ))}
      {stations.map((s) => {
        const estActive = item.stationsActives.includes(s.id);
        const prog = item.progression?.find((p) => p.stationId === s.id);
        return (
          <td key={s.id} style={{ textAlign: 'center', padding: '8px 4px' }}>
            {estActive
              ? <CelluleStation item={item} stationId={s.id} stations={stations} prog={prog} />
              : <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f1f5f9', margin: '0 auto', opacity: 0.4 }} />
            }
          </td>
        );
      })}
    </tr>
  );
}

function ColonneValeur({ item, colKey }: { item: Item; colKey: string }) {
  switch (colKey) {
    case 'numero':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14 }}>#{item.numero}</span>
          {item.etatCommercial && item.etatCommercial !== 'non-vendu' && (
            <BadgeCommercial etat={item.etatCommercial} client={item.clientAcheteur} />
          )}
          {item.dateLivraisonPlanifiee && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, width: 'fit-content', background: '#eff6ff', color: '#1d4ed8' }}>
              📅 {new Date(item.dateLivraisonPlanifiee).toLocaleDateString('fr-CA')}
            </span>
          )}
          {item.type === 'eau' && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, width: 'fit-content',
              background: (item as any).aUnReservoir ? '#dcfce7' : '#fff7ed',
              color: (item as any).aUnReservoir ? '#166534' : '#c2410c',
            }}>
              {(item as any).aUnReservoir ? '💧 Réservoir' : '⚠️ Sans réservoir'}
            </span>
          )}
        </div>
      );
    case 'annee':   return <span style={{ color: '#6b7280' }}>{item.annee}</span>;
    case 'marque':  return <span style={{ fontWeight: 600 }}>{item.marque}</span>;
    case 'modele':  return <span style={{ color: '#6b7280' }}>{item.modele}</span>;
    case 'client':  return <span style={{ fontWeight: 600 }}>{item.nomClient}</span>;
    case 'travail': return <span style={{ color: '#6b7280', fontSize: 12 }}>{item.descriptionTravail}</span>;
    case 'slot':
      return item.slotId ? (
        <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: 4, fontWeight: 600 }}>
          Slot {item.slotId}
        </span>
      ) : <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>;
    case 'statut':  return <StatusBadge etat={item.etat} />;
    case 'urgence':
      return item.urgence ? (
        <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>URGENT</span>
      ) : null;
    default: return null;
  }
}

function StatusBadge({ etat }: { etat: string }) {
  const cfg = {
    'en-attente': { bg: '#fef3c7', color: '#92400e', label: 'En attente' },
    'en-slot':    { bg: '#dbeafe', color: '#1e40af', label: 'En slot' },
    'termine':    { bg: '#dcfce7', color: '#166534', label: 'Terminé' },
  }[etat] || { bg: '#f3f4f6', color: '#374151', label: etat };
  return (
    <span style={{ fontSize: 11, background: cfg.bg, color: cfg.color, padding: '4px 10px', borderRadius: 4, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.02em' }}>
      {cfg.label}
    </span>
  );
}

function CelluleStation({ item, stationId, stations, prog }: {
  item: Item; stationId: string; stations: StationConfig[];
  prog?: { status: string; subTasks?: any[] };
}) {
  const statutEffectif = getStatutEffectif(item, stationId, stations);

  if (statutEffectif === 'non-requis') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Non requis">
        <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f1f5f9', border: '1px solid #d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 11, fontWeight: 700 }}>✕</div>
      </div>
    );
  }
  if (statutEffectif === 'termine') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#dcfce7', border: '2px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a', fontSize: 13, fontWeight: 700 }}>✓</div>
      </div>
    );
  }
  if (statutEffectif === 'saute') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title="Étape sautée">
        <div style={{ fontSize: 18, lineHeight: 1 }}>⚠️</div>
        <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>SAUTÉ</span>
      </div>
    );
  }
  if (statutEffectif === 'en-cours') {
    const subTasks = prog?.subTasks ?? [];
    const done = subTasks.filter((t) => t.done).length;
    const total = subTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
        <div style={{ width: 34, height: 34, borderRadius: 6, background: '#dbeafe', border: '2px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🚛</div>
        {total > 0 && (
          <>
            <div style={{ width: 38, height: 3, background: '#e5e7eb', borderRadius: 2 }}>
              <div style={{ width: `${pct}%`, height: '100%', background: '#3b82f6', borderRadius: 2 }} />
            </div>
            <span style={{ fontSize: 10, color: '#6b7280' }}>{done}/{total}</span>
          </>
        )}
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e5e7eb' }} />
    </div>
  );
}

function ModalPDF({ doc, onClose }: { doc: { nom: string; base64: string }; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '90vw', height: '90vh', background: '#1a1814', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: '#111009', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>📄</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{doc.nom}</span>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => { const l = document.createElement('a'); l.href = doc.base64; l.download = doc.nom; document.body.appendChild(l); l.click(); document.body.removeChild(l); }}
              style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              ⬇ Télécharger
            </button>
            <button onClick={onClose} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✕ Fermer</button>
          </div>
        </div>
        <iframe src={doc.base64} style={{ flex: 1, width: '100%', border: 'none', background: 'white' }} title={doc.nom} />
      </div>
    </div>
  );
}

function PanneauDetail({ item, stations, onClose, onStationStatusChange, onSupprimer }: {
  item: Item; stations: StationConfig[];
  onClose: () => void;
  onStationStatusChange: (itemId: string, stationId: string, status: string) => void;
  onSupprimer: () => void;
}) {
  const [popupStation, setPopupStation] = useState<string | null>(null);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const [confirmerRetourInventaire, setConfirmerRetourInventaire] = useState(false);
  const [pdfOuvert, setPdfOuvert] = useState<{ nom: string; base64: string } | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const { retirerVersAttente, supprimerItem, archiverItem, ajouterDocument, supprimerDocument, mettreAJourItem } = useGarage();
  const { marquerDisponible, mettreAJourPhotoInventaire } = useInventaire();
  const { profile: session } = useAuth();
  const { clients } = useClients();
  const { items: tousLesItems } = useGarage();
  const clientLie = item.clientId ? clients.find(c => c.id === item.clientId) : null;
  const jobsClient = item.clientId ? tousLesItems.filter(i => i.clientId === item.clientId && i.id !== item.id) : [];
  const typeColor = item.type === 'eau' ? '#f97316' : item.type === 'client' ? '#3b82f6' : '#22c55e';
  const isGestion = session?.role === 'gestion';

  const toutesTerminees = toutesEtapesCompletees(item);
  const montrerCommercial = item.type === 'eau' || item.type === 'detail';
  const etatCommercial = item.etatCommercial ?? 'non-vendu';

  const changerEtatCommercial = (val: EtatCommercial) => {
    mettreAJourItem(item.id, {
      etatCommercial: val,
      clientAcheteur: val === 'non-vendu' ? undefined : item.clientAcheteur,
    });
  };

  const changerClientAcheteur = (nom: string) => {
    mettreAJourItem(item.id, { clientAcheteur: nom || undefined });
  };

  const handleRetourInventaire = async () => {
    if (item.inventaireId) await marquerDisponible(item.inventaireId);
    await supprimerItem(item.id);
    onSupprimer();
    onClose();
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    if (fichier.size > 10 * 1024 * 1024) { alert('Max 10 MB'); return; }
    setUploadingPhoto(true);
    try {
      if (item.photoUrl) await photoService.supprimerPhoto(item.photoUrl);
      const url = await photoService.uploaderPhoto(fichier, 'items');
      await mettreAJourItem(item.id, { photoUrl: url });
      if (item.inventaireId) await mettreAJourPhotoInventaire(item.inventaireId, url);
    } catch (err) {
      console.error('Erreur upload photo:', err);
      alert("Erreur lors de l'upload de la photo");
    } finally {
      setUploadingPhoto(false);
    }
    e.target.value = '';
  };

  const handleSupprimerPhoto = async () => {
    if (!item.photoUrl) return;
    await photoService.supprimerPhoto(item.photoUrl);
    await mettreAJourItem(item.id, { photoUrl: undefined });
    if (item.inventaireId) await mettreAJourPhotoInventaire(item.inventaireId, null);
  };

  return (
    <>
      <div onClick={(e) => e.stopPropagation()} style={{
        position: 'fixed', right: 0, top: 0, width: 360, height: '100vh',
        background: 'white', borderLeft: '1px solid #e5e7eb',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', overflowY: 'auto', zIndex: 150,
      }}>
        <div style={{ padding: 20 }}>
          <button onClick={onClose}
            style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
          >✕</button>

          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: typeColor, marginBottom: 6 }}>#{item.numero}</div>
            <div style={{ fontSize: 15, color: '#374151', marginBottom: 12 }}>{item.label}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <StatusBadge etat={item.etat} />
              {item.slotId && (
                <span style={{ fontSize: 12, background: '#eff6ff', color: '#1d4ed8', padding: '3px 10px', borderRadius: 4, fontWeight: 600, fontFamily: 'monospace' }}>
                  Slot {item.slotId}
                </span>
              )}
              {item.urgence && (
                <span style={{ fontSize: 12, background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: 4, fontWeight: 600 }}>URGENT</span>
              )}
              <BadgeCommercial etat={item.etatCommercial} client={item.clientAcheteur} />
              {item.inventaireId && (
                <span style={{ fontSize: 11, background: '#f0fdf4', color: '#166534', padding: '3px 10px', borderRadius: 4, fontWeight: 600, border: '1px solid #86efac' }}>
                  📋 Depuis inventaire
                </span>
              )}
            </div>
          </div>

          {/* Photo */}
          <div style={{ marginBottom: 20 }}>
            {item.photoUrl ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <img src={item.photoUrl} alt={`Photo ${item.numero}`}
                  style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                  <label style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11, fontWeight: 600 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadPhoto} />
                    📷 Changer
                  </label>
                  <button onClick={handleSupprimerPhoto}
                    style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', background: 'rgba(239,68,68,0.8)', color: 'white', border: 'none', fontSize: 11, fontWeight: 600 }}>
                    🗑
                  </button>
                </div>
                {uploadingPhoto && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14 }}>
                    ⏳ Upload en cours...
                  </div>
                )}
              </div>
            ) : (
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '24px', borderRadius: 10,
                border: '2px dashed #d1d5db', background: '#f8fafc',
                color: '#9ca3af', cursor: 'pointer', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = typeColor; (e.currentTarget as HTMLLabelElement).style.color = typeColor; }}
              onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLLabelElement).style.color = '#9ca3af'; }}
              >
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadPhoto} />
                <span style={{ fontSize: 32 }}>📷</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>
                  {uploadingPhoto ? '⏳ Upload en cours...' : 'Ajouter une photo'}
                </span>
                <span style={{ fontSize: 11 }}>JPG, PNG, WEBP · max 10 MB</span>
              </label>
            )}
          </div>

          {/* Statut commercial */}
          {montrerCommercial && (
            <div style={{ marginBottom: 20, padding: '14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Statut commercial
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: etatCommercial !== 'non-vendu' ? 10 : 0 }}>
                {([
                  { val: 'non-vendu' as EtatCommercial, label: 'Non vendu', icon: '○',  color: '#6b7280' },
                  { val: 'reserve'   as EtatCommercial, label: 'Réservé',   icon: '🔒', color: '#f59e0b' },
                  { val: 'vendu'     as EtatCommercial, label: 'Vendu',     icon: '✓',  color: '#22c55e' },
                  { val: 'location'  as EtatCommercial, label: 'Location',  icon: '🔑', color: '#7c3aed' },
                ]).map(({ val, label, icon, color }) => (
                  <button key={val} onClick={() => changerEtatCommercial(val)}
                    style={{
                      flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                      border: etatCommercial === val ? `2px solid ${color}` : '1px solid #e5e7eb',
                      background: etatCommercial === val ? `${color}15` : 'white',
                      color: etatCommercial === val ? color : '#9ca3af',
                      fontWeight: etatCommercial === val ? 700 : 400,
                      fontSize: 11, transition: 'all 0.15s',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{icon}</span>
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              {(etatCommercial === 'reserve' || etatCommercial === 'vendu' || etatCommercial === 'location') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input type="text" value={item.clientAcheteur ?? ''} onChange={e => changerClientAcheteur(e.target.value)}
                    placeholder="Nom du client (optionnel)"
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                      📅 Date de livraison planifiée
                    </label>
                    <input
                      type="date"
                      value={item.dateLivraisonPlanifiee ?? ''}
                      onChange={e => mettreAJourItem(item.id, { dateLivraisonPlanifiee: e.target.value || undefined })}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Étapes opérationnelles */}
          {item.stationsActives && item.stationsActives.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Étapes opérationnelles
              </div>
              {item.stationsActives.map((stationId) => {
                const prog = item.progression?.find(p => p.stationId === stationId);
                const station = stations.find(s => s.id === stationId);
                if (!prog || !station) return null;
                const estNonRequis = prog.status === 'non-requis';
                const statusColor = estNonRequis ? '#e5e7eb'
                  : prog.status === 'termine' ? '#22c55e'
                  : prog.status === 'en-cours' ? '#3b82f6'
                  : '#e5e7eb';
                return (
                  <div key={stationId} style={{
                    padding: '12px', marginBottom: 8, borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    background: estNonRequis ? '#f9fafb' : prog.status === 'en-cours' ? '#eff6ff' : 'white',
                    borderLeft: `3px solid ${statusColor}`,
                    opacity: estNonRequis ? 0.65 : 1, transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: estNonRequis ? '#9ca3af' : '#111827', textDecoration: estNonRequis ? 'line-through' : 'none' }}>
                      {station.label}
                      {estNonRequis && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 400, fontStyle: 'italic', textDecoration: 'none' }}>— non requis</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 3 }}>
                      {([
                        { val: 'non-commence' as const, label: '○ À faire',    activeBg: '#94a3b8' },
                        { val: 'en-cours'     as const, label: '● En cours',   activeBg: '#3b82f6' },
                        { val: 'termine'      as const, label: '✓ Terminé',    activeBg: '#22c55e' },
                        { val: 'non-requis'   as const, label: '✕ Non requis', activeBg: '#6b7280' },
                      ]).map(({ val, label, activeBg }) => {
                        const isActive = prog.status === val;
                        return (
                          <button key={val}
                            onClick={() => {
                              if (val === 'en-cours') {
                                onStationStatusChange(item.id, stationId, 'en-cours');
                                retirerVersAttente(item.id);
                                setPopupStation(stationId);
                              } else if (val === 'termine') {
                                onStationStatusChange(item.id, stationId, 'termine');
                                if (stationId === 'livraison') {
                                  mettreAJourItem(item.id, {
                                    dateLivraisonReelle: new Date().toISOString(),
                                    dateArchive: new Date().toISOString(),
                                  });
                                  archiverItem(item.id);
                                  onClose();
                                } else {
                                  retirerVersAttente(item.id);
                                }
                              } else {
                                onStationStatusChange(item.id, stationId, val);
                              }
                            }}
                            style={{
                              flex: 1, padding: '6px 2px', fontSize: 9,
                              fontWeight: 600, borderRadius: 4, cursor: 'pointer',
                              border: 'none',
                              background: isActive ? activeBg : '#f1f5f9',
                              color: isActive ? 'white' : '#9ca3af',
                              transition: 'all 0.15s', whiteSpace: 'nowrap',
                            }}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                    {stationId === 'livraison' && (
                      <div style={{ marginTop: 8 }}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>
                          📅 Date de livraison planifiée
                        </label>
                        <input
                          type="date"
                          value={item.dateLivraisonPlanifiee ?? ''}
                          onChange={e => mettreAJourItem(item.id, { dateLivraisonPlanifiee: e.target.value || undefined })}
                          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Informations */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Informations</label>
            <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.8 }}>
              {item.variante    && <div><span style={{ fontWeight: 600 }}>Variante:</span> {item.variante}</div>}
              {item.marque      && <div><span style={{ fontWeight: 600 }}>Marque:</span> {item.marque}</div>}
              {item.modele      && <div><span style={{ fontWeight: 600 }}>Modèle:</span> {item.modele}</div>}
              {item.annee       && <div><span style={{ fontWeight: 600 }}>Année:</span> {item.annee}</div>}
              {item.nomClient   && <div><span style={{ fontWeight: 600 }}>Client:</span> {item.nomClient}</div>}
              {item.telephone   && <div><span style={{ fontWeight: 600 }}>Téléphone:</span> {item.telephone}</div>}
              {item.stationActuelle && <div><span style={{ fontWeight: 600 }}>Station actuelle:</span> {item.stationActuelle}</div>}
            </div>
          </div>

          {/* Fiche client */}
          {clientLie && (
            <div style={{ marginBottom: 20, padding: 14, borderRadius: 10, background: '#f0f9ff', border: '1px solid #bae6fd' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0369a1', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                👤 Fiche client
              </div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 2 }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>{clientLie.nom}</div>
                {clientLie.telephone && <div>📞 {clientLie.telephone}</div>}
                {clientLie.email     && <div>✉️ {clientLie.email}</div>}
                {clientLie.adresse   && <div>📍 {clientLie.adresse}</div>}
              </div>
              {jobsClient.length > 0 && (
                <div style={{ marginTop: 12, borderTop: '1px solid #bae6fd', paddingTop: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#0369a1', marginBottom: 8 }}>
                    Historique — {jobsClient.length} job{jobsClient.length > 1 ? 's' : ''} antérieur{jobsClient.length > 1 ? 's' : ''}
                  </div>
                  {jobsClient.map(j => {
                    const etatCfg = {
                      'en-attente': { bg: '#fef3c7', color: '#92400e', label: 'En attente' },
                      'en-slot':    { bg: '#dbeafe', color: '#1e40af', label: 'En slot' },
                      'termine':    { bg: '#dcfce7', color: '#166534', label: 'Terminé' },
                    }[j.etat] || { bg: '#f3f4f6', color: '#374151', label: j.etat };
                    return (
                      <div key={j.id} style={{ padding: '8px 10px', borderRadius: 6, marginBottom: 6, background: 'white', border: '1px solid #e0f2fe', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            #{j.numero} — {j.descriptionTravail ?? j.label}
                          </div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>
                            {new Date(j.dateCreation).toLocaleDateString('fr-CA')}
                            {j.vehicule && ` · ${j.vehicule}`}
                          </div>
                        </div>
                        <span style={{ fontSize: 10, background: etatCfg.bg, color: etatCfg.color, padding: '2px 8px', borderRadius: 10, fontWeight: 700, flexShrink: 0 }}>
                          {etatCfg.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {jobsClient.length === 0 && (
                <div style={{ marginTop: 10, fontSize: 11, color: '#0369a1', fontStyle: 'italic' }}>
                  Premier job pour ce client
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 8 }}>Notes</label>
            <textarea rows={4} placeholder="Notes sur ce camion..." defaultValue={item.notes || ''}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, resize: 'vertical', fontFamily: 'system-ui, -apple-system, sans-serif' }} />
          </div>

          {/* Documents */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>📎 Documents</span>
              <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 400 }}>{item.documents?.length ?? 0}/3</span>
            </div>
            {(item.documents ?? []).map(doc => (
              <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 6, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f8fafc' }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>📄</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.nom}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{doc.taille} · {new Date(doc.dateUpload).toLocaleDateString('fr-CA')}</div>
                </div>
                <button onClick={() => setPdfOuvert({ nom: doc.nom, base64: doc.base64 })}
                  style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  👁 Voir
                </button>
                <button onClick={() => supprimerDocument(item.id, doc.id)}
                  style={{ padding: '4px 8px', borderRadius: 5, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                  🗑
                </button>
              </div>
            ))}
            {(item.documents?.length ?? 0) < 3 && (
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px', borderRadius: 8, border: '1.5px dashed #d1d5db', background: 'white', color: '#6b7280', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
                onMouseEnter={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = '#3b82f6'; (e.currentTarget as HTMLLabelElement).style.color = '#3b82f6'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLLabelElement).style.borderColor = '#d1d5db'; (e.currentTarget as HTMLLabelElement).style.color = '#6b7280'; }}
              >
                <input type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) { alert('Le fichier ne doit pas dépasser 10 MB'); return; }
                    const reader = new FileReader();
                    reader.onload = () => {
                      const base64 = reader.result as string;
                      const tailleKB = Math.round(file.size / 1024);
                      const taille = tailleKB > 1024 ? `${(tailleKB / 1024).toFixed(1)} MB` : `${tailleKB} KB`;
                      const nouveauDoc: Document = { id: `doc-${Date.now()}`, nom: file.name, taille, dateUpload: new Date().toISOString(), base64 };
                      ajouterDocument(item.id, nouveauDoc);
                    };
                    reader.readAsDataURL(file);
                    e.target.value = '';
                  }}
                />
                + Ajouter un document PDF
              </label>
            )}
            {(item.documents?.length ?? 0) >= 3 && (
              <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '8px' }}>Maximum 3 documents atteint</div>
            )}
          </div>
{/* Marquer comme prêt */}
{!toutesTerminees && (
  <div style={{ marginBottom: 16 }}>
    <button
      onClick={() => {
        const nouvelleProgression = item.progression.map(p => ({
          ...p,
          status: 'termine' as const,
        }));
        mettreAJourItem(item.id, { progression: nouvelleProgression });
      }}
      style={{
        width: '100%', padding: '12px', borderRadius: 8, border: 'none',
        background: '#22c55e', color: 'white', fontWeight: 700,
        fontSize: 14, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      ✅ Marquer comme prêt
    </button>
    <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 6 }}>
      Coche toutes les étapes comme terminées
    </div>
  </div>
)}
          {/* Livrer & Archiver */}
          {toutesTerminees && (
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => { archiverItem(item.id); onClose(); }}
                style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                🏁 Livrer & Archiver ce job
              </button>
              <div style={{ fontSize: 11, color: '#6b7280', textAlign: 'center', marginTop: 6 }}>
                Toutes les étapes sont complétées ou non requises
              </div>
            </div>
          )}

          {/* Retour inventaire */}
          {item.inventaireId && item.etat !== 'termine' && (
            <div style={{ marginBottom: 16 }}>
              {!confirmerRetourInventaire ? (
                <button onClick={() => setConfirmerRetourInventaire(true)}
                  style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #3b82f6', background: 'transparent', color: '#3b82f6', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#eff6ff'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                >
                  ↩ Retourner à l'inventaire
                </button>
              ) : (
                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 6 }}>Retourner ce véhicule à l'inventaire?</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>Le job sera supprimé et le véhicule redeviendra disponible dans l'inventaire.</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmerRetourInventaire(false)}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                      Annuler
                    </button>
                    <button onClick={handleRetourInventaire}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#3b82f6', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                      ↩ Confirmer
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Supprimer */}
          {isGestion && (
            <div style={{ borderTop: '1px solid #fee2e2', paddingTop: 16 }}>
              {!confirmerSuppression ? (
                <button onClick={() => setConfirmerSuppression(true)}
                  style={{ width: '100%', padding: '10px', borderRadius: 7, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  🗑 Supprimer ce camion
                </button>
              ) : (
                <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>⚠️ Confirmer la suppression</div>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>
                    <strong>#{item.numero} — {item.label}</strong><br />Cette action est irréversible.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setConfirmerSuppression(false)}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                      Annuler
                    </button>
                    <button onClick={() => { supprimerItem(item.id); onSupprimer(); onClose(); }}
                      style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#ef4444', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                      🗑 Supprimer définitivement
                    </button>
                  </div>
                </div>
              )}
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

      {pdfOuvert && <ModalPDF doc={pdfOuvert} onClose={() => setPdfOuvert(null)} />}
    </>
  );
}
