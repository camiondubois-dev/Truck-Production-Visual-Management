import { useState, useEffect } from 'react';
import { useGarage } from '../hooks/useGarage';
import { EauIcon } from './EauIcon';
import { useAuth } from '../contexts/AuthContext';
import { TOUTES_STATIONS_COMMUNES } from '../data/mockData';
import { itemsService } from '../services/itemsService';
import type { Item } from '../types/item.types';

type FiltreType = 'tous' | 'eau' | 'client' | 'detail';

export function VueArchive() {
  const { reouvrirItem, supprimerItem } = useGarage();
  const [archives, setArchives] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtreType, setFiltreType] = useState<FiltreType>('tous');
  const [recherche, setRecherche] = useState('');
  const [confirmerReouverture, setConfirmerReouverture] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    itemsService.getAllArchives()
      .then(setArchives)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtres = archives.filter(i => {
    if (filtreType !== 'tous' && i.type !== filtreType) return false;
    if (recherche) {
      const q = recherche.toLowerCase();
      return (
        i.numero.toLowerCase().includes(q) ||
        i.label.toLowerCase().includes(q) ||
        i.nomClient?.toLowerCase().includes(q) ||
        i.marque?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const tries = [...filtres].sort((a, b) => {
    const dateA = a.dateArchive ?? a.dateCreation;
    const dateB = b.dateArchive ?? b.dateCreation;
    return dateB.localeCompare(dateA);
  });

  const selectedItem = tries.find(i => i.id === selectedId) ?? null;

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100dvh', background: '#f8fafc', fontSize: 18, color: '#9ca3af' }}>
      Chargement des archives...
    </div>
  );

  return (
    <div style={{ display: 'flex', height: '100dvh', background: '#f8fafc', overflow: 'hidden' }}>
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        marginRight: selectedItem ? 400 : 0,
        transition: 'margin-right 0.3s ease',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px', borderBottom: '2px solid #e5e7eb', background: 'white',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>📦</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#374151', margin: 0 }}>Archive</h1>
            <span style={{ background: '#6b7280', color: 'white', fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>
              {archives.length} job{archives.length !== 1 ? 's' : ''}
            </span>
          </div>
          <input
            type="text"
            placeholder="Rechercher par numéro, client, marque..."
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 13, width: 320, outline: 'none' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid #e5e7eb', background: 'white' }}>
          {[
            { id: 'tous'   as FiltreType, label: 'Tous',             icon: '📋' },
            { id: 'eau'    as FiltreType, label: 'Camions à eau',    icon: 'EAU_LOGO' },
            { id: 'client' as FiltreType, label: 'Clients externes', icon: '🔧' },
            { id: 'detail' as FiltreType, label: 'Camions détail',   icon: '🏷️' },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltreType(f.id)}
              style={{
                padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
                border: filtreType === f.id ? 'none' : '1px solid #e5e7eb',
                background: filtreType === f.id ? '#374151' : 'white',
                color: filtreType === f.id ? 'white' : '#6b7280',
                fontWeight: filtreType === f.id ? 700 : 400,
                fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {f.icon === 'EAU_LOGO' ? <EauIcon /> : f.icon} {f.label}
              {f.id !== 'tous' && (
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  background: filtreType === f.id ? 'rgba(255,255,255,0.3)' : '#f3f4f6',
                  color: filtreType === f.id ? 'white' : '#9ca3af',
                  padding: '1px 7px', borderRadius: 10,
                }}>
                  {archives.filter(i => i.type === f.id).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {tries.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>📦</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                {recherche ? 'Aucun résultat' : 'Aucun job archivé'}
              </div>
              <div style={{ fontSize: 14 }}>
                {recherche ? 'Essaie une autre recherche' : 'Les jobs livrés apparaîtront ici'}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tries.map(item => (
                <CarteArchive
                  key={item.id}
                  item={item}
                  selected={selectedId === item.id}
                  onClick={() => setSelectedId(selectedId === item.id ? null : item.id)}
                  confirmerReouverture={confirmerReouverture}
                  setConfirmerReouverture={setConfirmerReouverture}
                  onReouvrir={() => {
                    reouvrirItem(item.id);
                    setArchives(prev => prev.filter(a => a.id !== item.id));
                    setConfirmerReouverture(null);
                    setSelectedId(null);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedItem && (
        <PanneauDetailArchive
          item={selectedItem}
          onClose={() => setSelectedId(null)}
          onReouvrir={() => {
            reouvrirItem(selectedItem.id);
            setArchives(prev => prev.filter(a => a.id !== selectedItem.id));
            setSelectedId(null);
          }}
          onSupprimer={() => {
            setArchives(prev => prev.filter(a => a.id !== selectedItem.id));
            setSelectedId(null);
          }}
        />
      )}
    </div>
  );
}

function CarteArchive({ item, selected, onClick, confirmerReouverture, setConfirmerReouverture, onReouvrir }: {
  item: Item;
  selected: boolean;
  onClick: () => void;
  confirmerReouverture: string | null;
  setConfirmerReouverture: (id: string | null) => void;
  onReouvrir: () => void;
}) {
  const typeColor = item.type === 'eau' ? '#f97316' : item.type === 'client' ? '#3b82f6' : '#22c55e';
  const typeLabel = item.type === 'eau' ? 'Camion à eau' : item.type === 'client' ? 'Client externe' : 'Camion détail';
  const dateArchive = item.dateArchive
    ? new Date(item.dateArchive).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const isConfirming = confirmerReouverture === item.id;

  return (
    <div onClick={onClick}
      style={{
        background: selected ? '#f0fdf4' : 'white', borderRadius: 10,
        border: `1px solid ${selected ? '#22c55e' : '#e5e7eb'}`,
        borderLeft: `4px solid ${typeColor}`,
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16,
        cursor: 'pointer', transition: 'all 0.15s',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = 'white'; }}
    >
      <div style={{ fontSize: 28, flexShrink: 0 }}>{item.type === 'eau' ? <EauIcon /> : item.type === 'client' ? '🔧' : '🏷️'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: typeColor }}>#{item.numero}</span>
          <span style={{ fontSize: 11, background: `${typeColor}18`, color: typeColor, padding: '2px 8px', borderRadius: 10, fontWeight: 600 }}>{typeLabel}</span>
          {item.urgence && <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>⚡ URGENT</span>}
        </div>
        <div style={{ fontSize: 14, color: '#374151', fontWeight: 500, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.label}
        </div>
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af' }}>
          {item.nomClient && <span>👤 {item.nomClient}</span>}
          {item.marque && item.annee && <span>🚛 {item.marque} {item.annee}</span>}
          {dateArchive && <span>📅 Livré le {dateArchive}</span>}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {item.stationsActives.slice(0, 6).map(stationId => (
          <div key={stationId} title={TOUTES_STATIONS_COMMUNES.find(s => s.id === stationId)?.label ?? stationId}
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
        ))}
        {item.stationsActives.length > 6 && <span style={{ fontSize: 10, color: '#9ca3af' }}>+{item.stationsActives.length - 6}</span>}
      </div>
      <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
        {!isConfirming ? (
          <button onClick={(e) => { e.stopPropagation(); setConfirmerReouverture(item.id); }}
            style={{ padding: '7px 14px', borderRadius: 7, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.color = '#f97316'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; }}
          >
            🔄 Réouvrir
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#f97316', fontWeight: 600 }}>Confirmer?</span>
            <button onClick={(e) => { e.stopPropagation(); onReouvrir(); }}
              style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: '#f97316', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Oui
            </button>
            <button onClick={(e) => { e.stopPropagation(); setConfirmerReouverture(null); }}
              style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: 12, cursor: 'pointer' }}>
              Non
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PanneauDetailArchive({ item, onClose, onReouvrir, onSupprimer }: {
  item: Item;
  onClose: () => void;
  onReouvrir: () => void;
  onSupprimer: () => void;
}) {
  const [confirmerReouverture, setConfirmerReouverture] = useState(false);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);
  const { supprimerItem } = useGarage();
  const { profile: session } = useAuth();
  const isGestion = session?.role === 'gestion';
  const typeColor = item.type === 'eau' ? '#f97316' : item.type === 'client' ? '#3b82f6' : '#22c55e';
  const dateArchive = item.dateArchive
    ? new Date(item.dateArchive).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const dateCreation = new Date(item.dateCreation).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, width: 400, height: '100dvh', background: 'white', borderLeft: '1px solid #e5e7eb', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', overflowY: 'auto', zIndex: 150 }}>
      <div style={{ padding: 24 }}>
        <button onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
          onMouseEnter={e => (e.currentTarget.style.background = '#f3f4f6')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >✕</button>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: typeColor, marginBottom: 4 }}>#{item.numero}</div>
          <div style={{ fontSize: 15, color: '#374151', fontWeight: 500, marginBottom: 12 }}>{item.label}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>✓ ARCHIVÉ</span>
            {item.urgence && <span style={{ fontSize: 12, background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 4, fontWeight: 600 }}>⚡ URGENT</span>}
          </div>
        </div>

        <div style={{ background: '#f8fafc', borderRadius: 8, padding: '12px 14px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 13, color: '#6b7280' }}><span style={{ fontWeight: 600, color: '#374151' }}>Créé le : </span>{dateCreation}</div>
          {dateArchive && <div style={{ fontSize: 13, color: '#6b7280' }}><span style={{ fontWeight: 600, color: '#374151' }}>Livré le : </span>{dateArchive}</div>}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Étapes complétées</div>
          {item.stationsActives.map(stationId => {
            const station = TOUTES_STATIONS_COMMUNES.find(s => s.id === stationId);
            const prog = item.progression.find(p => p.stationId === stationId);
            const statut = prog?.status ?? 'non-commence';
            const statusColor = statut === 'termine' ? '#22c55e' : statut === 'en-cours' ? '#3b82f6' : '#e5e7eb';
            const statusLabel = statut === 'termine' ? '✓ Terminé' : statut === 'en-cours' ? '● En cours' : '○ Non commencé';
            return (
              <div key={stationId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', marginBottom: 6, borderRadius: 8, border: '1px solid #e5e7eb', borderLeft: `3px solid ${statusColor}`, background: statut === 'termine' ? '#f0fdf4' : 'white' }}>
                <div style={{ fontSize: 14, fontWeight: statut === 'termine' ? 600 : 400, color: '#374151' }}>{station?.label ?? stationId}</div>
                <span style={{ fontSize: 11, fontWeight: 700, color: statusColor, background: `${statusColor}18`, padding: '2px 8px', borderRadius: 4 }}>{statusLabel}</span>
              </div>
            );
          })}
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Informations</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
            {item.variante       && <div><span style={{ fontWeight: 600, color: '#374151' }}>Variante :</span> {item.variante}</div>}
            {item.marque         && <div><span style={{ fontWeight: 600, color: '#374151' }}>Marque :</span> {item.marque}</div>}
            {item.modele         && <div><span style={{ fontWeight: 600, color: '#374151' }}>Modèle :</span> {item.modele}</div>}
            {item.annee          && <div><span style={{ fontWeight: 600, color: '#374151' }}>Année :</span> {item.annee}</div>}
            {item.nomClient      && <div><span style={{ fontWeight: 600, color: '#374151' }}>Client :</span> {item.nomClient}</div>}
            {item.telephone      && <div><span style={{ fontWeight: 600, color: '#374151' }}>Téléphone :</span> {item.telephone}</div>}
            {item.descriptionTravail && <div><span style={{ fontWeight: 600, color: '#374151' }}>Travail :</span> {item.descriptionTravail}</div>}
            {item.descriptionTravaux && <div><span style={{ fontWeight: 600, color: '#374151' }}>Travaux :</span> {item.descriptionTravaux}</div>}
            {item.clientAcheteur && <div><span style={{ fontWeight: 600, color: '#374151' }}>Acheteur :</span> {item.clientAcheteur}</div>}
          </div>
        </div>

        {item.notes && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</div>
            <div style={{ fontSize: 13, color: '#6b7280', background: '#f8fafc', borderRadius: 8, padding: '10px 12px', lineHeight: 1.6 }}>{item.notes}</div>
          </div>
        )}

        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {!confirmerReouverture ? (
            <button onClick={() => setConfirmerReouverture(true)}
              style={{ width: '100%', padding: '11px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#f97316'; e.currentTarget.style.color = '#f97316'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e5e7eb'; e.currentTarget.style.color = '#6b7280'; }}
            >🔄 Réouvrir ce job</button>
          ) : (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#c2410c', marginBottom: 6 }}>⚠️ Confirmer la réouverture?</div>
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>Le job sera remis en attente avec toutes les étapes à refaire.</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setConfirmerReouverture(false)}
                  style={{ flex: 1, padding: '8px', borderRadius: 6, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 12 }}>
                  Annuler
                </button>
                <button onClick={onReouvrir}
                  style={{ flex: 1, padding: '8px', borderRadius: 6, border: 'none', background: '#f97316', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                  🔄 Réouvrir
                </button>
              </div>
            </div>
          )}

          {isGestion && (
            !confirmerSuppression ? (
              <button onClick={() => setConfirmerSuppression(true)}
                style={{ width: '100%', padding: '10px', borderRadius: 8, border: '1px solid #fca5a5', background: 'transparent', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >🗑 Supprimer définitivement</button>
            ) : (
              <div style={{ background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8, padding: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 6 }}>⚠️ Suppression définitive</div>
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
                    🗑 Supprimer
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
