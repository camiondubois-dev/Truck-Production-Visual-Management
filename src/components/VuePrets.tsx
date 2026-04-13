import { useState } from 'react';
import { useInventaire } from '../contexts/InventaireContext';
import { useGarage } from '../hooks/useGarage';
import { EauIcon } from './EauIcon';
import type { VehiculeInventaire } from '../types/inventaireTypes';

type FiltreType = 'tous' | 'eau' | 'client' | 'detail';
type FiltreCommercial = 'tous' | 'a-vendre' | 'a-livrer' | 'location';

function getLabelVehicule(v: VehiculeInventaire): string {
  if (v.type === 'client') {
    return [v.nomClient, v.vehicule].filter(Boolean).join(' — ') || 'Job client';
  }
  return [v.marque, v.modele, v.annee].filter(Boolean).join(' ') ||
    (v.type === 'detail' ? 'Camion détail' : 'Camion à eau');
}

export function VuePrets() {
  const { vehicules, mettreAJourCommercial, archiverVehicule } = useInventaire();
  const { items, archiverItem } = useGarage();
  const [filtreType, setFiltreType] = useState<FiltreType>('tous');
  const [filtreCommercial, setFiltreCommercial] = useState<FiltreCommercial>('tous');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const prets = vehicules.filter(v => v.estPret === true);

  const filtres = prets
    .filter(v => filtreType === 'tous' || v.type === filtreType)
    .filter(v => {
      if (filtreCommercial === 'tous') return true;
      if (filtreCommercial === 'a-vendre') return !v.etatCommercial || v.etatCommercial === 'non-vendu';
      if (filtreCommercial === 'a-livrer') return v.etatCommercial === 'vendu' || v.etatCommercial === 'reserve';
      if (filtreCommercial === 'location') return v.etatCommercial === 'location';
      return true;
    })
    .sort((a, b) => {
      if (a.dateLivraisonPlanifiee && !b.dateLivraisonPlanifiee) return -1;
      if (!a.dateLivraisonPlanifiee && b.dateLivraisonPlanifiee) return 1;
      if (a.dateLivraisonPlanifiee && b.dateLivraisonPlanifiee)
        return a.dateLivraisonPlanifiee.localeCompare(b.dateLivraisonPlanifiee);
      return 0;
    });

  const selectedVehicule = filtres.find(v => v.id === selectedId) ?? null;
  const aVendre = prets.filter(v => !v.etatCommercial || v.etatCommercial === 'non-vendu').length;
  const aLivrer = prets.filter(v => v.etatCommercial === 'vendu' || v.etatCommercial === 'reserve').length;
  const enLocation = prets.filter(v => v.etatCommercial === 'location').length;

  const handleArchiver = async (vehicule: VehiculeInventaire) => {
    await archiverVehicule(vehicule.id);
    // Aussi archiver le job actif dans prod_items si applicable
    const jobActif = items.find(i => i.inventaireId === vehicule.id && i.etat !== 'termine');
    if (jobActif) await archiverItem(jobActif.id);
    setSelectedId(null);
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#f8fafc', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: selectedVehicule ? 400 : 0, transition: 'margin-right 0.3s ease' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '2px solid #e5e7eb', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>✅</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#374151', margin: 0 }}>Prêts</h1>
            <span style={{ background: '#22c55e', color: 'white', fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>
              {prets.length} véhicule{prets.length !== 1 ? 's' : ''}
            </span>
            {([
              { id: 'a-vendre' as FiltreCommercial, label: `🏷️ ${aVendre} à vendre`,   bg: '#f59e0b', count: aVendre },
              { id: 'a-livrer' as FiltreCommercial, label: `🚛 ${aLivrer} à livrer`,    bg: '#3b82f6', count: aLivrer },
              { id: 'location' as FiltreCommercial, label: `🔑 ${enLocation} en location`, bg: '#7c3aed', count: enLocation },
            ]).filter(f => f.count > 0).map(f => (
              <button key={f.id} onClick={() => setFiltreCommercial(filtreCommercial === f.id ? 'tous' : f.id)}
                style={{ background: f.bg, color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', opacity: filtreCommercial !== 'tous' && filtreCommercial !== f.id ? 0.5 : 1, outline: filtreCommercial === f.id ? '2px solid white' : 'none', outlineOffset: 1, transition: 'all 0.15s' }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '12px 24px', borderBottom: '1px solid #e5e7eb', background: 'white' }}>
          {([
            { id: 'tous'   as FiltreType, label: 'Tous' },
            { id: 'eau'    as FiltreType, label: 'Camions à eau' },
            { id: 'detail' as FiltreType, label: 'Camions détail' },
            { id: 'client' as FiltreType, label: 'Jobs clients' },
          ]).map(f => (
            <button key={f.id} onClick={() => setFiltreType(f.id)}
              style={{ padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 12, border: filtreType === f.id ? 'none' : '1px solid #e5e7eb', background: filtreType === f.id ? '#22c55e' : 'white', color: filtreType === f.id ? 'white' : '#6b7280', fontWeight: filtreType === f.id ? 700 : 400 }}>
              {f.label} <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>{prets.filter(v => f.id === 'tous' || v.type === f.id).length}</span>
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {filtres.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Aucun véhicule prêt</div>
              <div style={{ fontSize: 14 }}>Cliquez sur "Marquer comme prêt" dans le panneau d'un camion</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filtres.map(vehicule => {
                const typeColor = vehicule.type === 'eau' ? '#f97316' : vehicule.type === 'client' ? '#3b82f6' : '#22c55e';
                const isSelected = selectedId === vehicule.id;
                const etat = vehicule.etatCommercial ?? 'non-vendu';
                const statut = etat === 'non-vendu'
                  ? { label: '🏷️ À vendre',  bg: '#fef3c7', color: '#92400e' }
                  : etat === 'reserve'
                  ? { label: '🔒 Réservé',    bg: '#eff6ff', color: '#1d4ed8' }
                  : etat === 'location'
                  ? { label: '🔑 Location',   bg: '#ede9fe', color: '#6d28d9' }
                  : { label: '✓ Vendu',       bg: '#dcfce7', color: '#166534' };
                return (
                  <div key={vehicule.id} onClick={() => setSelectedId(isSelected ? null : vehicule.id)}
                    style={{ background: isSelected ? '#f0fdf4' : 'white', borderRadius: 10, border: `1px solid ${isSelected ? '#22c55e' : '#e5e7eb'}`, borderLeft: `4px solid ${typeColor}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'white'; }}
                  >
                    <div style={{ fontSize: 28, flexShrink: 0 }}>{vehicule.type === 'eau' ? <EauIcon /> : vehicule.type === 'client' ? '🔧' : '🏷️'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: typeColor }}>#{vehicule.numero}</span>
                        <span style={{ fontSize: 11, background: statut.bg, color: statut.color, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{statut.label}</span>
                        {vehicule.clientAcheteur && <span style={{ fontSize: 11, color: '#6b7280' }}>— {vehicule.clientAcheteur}</span>}
                        {vehicule.type === 'eau' && (
                          vehicule.aUnReservoir
                            ? <span style={{ fontSize: 10, background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>✅ Réservoir</span>
                            : <span style={{ fontSize: 10, background: '#fff7ed', color: '#c2410c', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>⚠️ Sans réservoir</span>
                        )}
                      </div>
                      <div style={{ fontSize: 14, color: '#374151', fontWeight: 500, marginBottom: 4 }}>{getLabelVehicule(vehicule)}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af' }}>
                        {vehicule.marque && vehicule.annee && <span>🚛 {vehicule.marque} {vehicule.annee}</span>}
                        {vehicule.dateLivraisonPlanifiee && <span style={{ color: '#1d4ed8', fontWeight: 600 }}>📅 Livraison : {new Date(vehicule.dateLivraisonPlanifiee).toLocaleDateString('fr-CA')}</span>}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); handleArchiver(vehicule); }}
                      style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer', flexShrink: 0 }}>
                      🏁 Archiver
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedVehicule && (
        <PanneauDetailPret
          vehicule={selectedVehicule}
          onClose={() => setSelectedId(null)}
          onArchiver={() => handleArchiver(selectedVehicule)}
          onMettreAJourCommercial={mettreAJourCommercial}
        />
      )}
    </div>
  );
}

function PanneauDetailPret({ vehicule, onClose, onArchiver, onMettreAJourCommercial }: {
  vehicule: VehiculeInventaire;
  onClose: () => void;
  onArchiver: () => void;
  onMettreAJourCommercial: (id: string, etatCommercial: 'non-vendu' | 'reserve' | 'vendu' | 'location', dateLivraisonPlanifiee: string | null, clientAcheteur: string | null) => Promise<void>;
}) {
  const typeColor = vehicule.type === 'eau' ? '#f97316' : vehicule.type === 'client' ? '#3b82f6' : '#22c55e';
  const etatCommercial = vehicule.etatCommercial ?? 'non-vendu';

  const setEtat = (val: 'non-vendu' | 'reserve' | 'vendu' | 'location') => {
    onMettreAJourCommercial(vehicule.id, val, vehicule.dateLivraisonPlanifiee ?? null, vehicule.clientAcheteur ?? null);
  };
  const setClient = (val: string) => {
    onMettreAJourCommercial(vehicule.id, etatCommercial, vehicule.dateLivraisonPlanifiee ?? null, val || null);
  };
  const setDate = (val: string) => {
    onMettreAJourCommercial(vehicule.id, etatCommercial, val || null, vehicule.clientAcheteur ?? null);
  };

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, width: 400, height: '100dvh', background: 'white', borderLeft: '1px solid #e5e7eb', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', overflowY: 'auto', zIndex: 150 }}>
      <div style={{ padding: 24 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>

        {vehicule.photoUrl && (
          <div style={{ marginBottom: 20, borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
            <img src={vehicule.photoUrl} alt={`Photo #${vehicule.numero}`} style={{ width: '100%', height: 180, objectFit: 'cover', display: 'block' }} />
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: typeColor, marginBottom: 4 }}>#{vehicule.numero}</div>
          <div style={{ fontSize: 15, color: '#374151', marginBottom: 12 }}>{getLabelVehicule(vehicule)}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>✅ Prêt</span>
            {vehicule.type === 'eau' && (
              vehicule.aUnReservoir
                ? <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>✅ Réservoir</span>
                : <span style={{ fontSize: 12, background: '#fff7ed', color: '#c2410c', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>⚠️ Sans réservoir</span>
            )}
          </div>
        </div>

        {(vehicule.type === 'eau' || vehicule.type === 'detail') && (
          <div style={{ marginBottom: 20, padding: '14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Statut commercial</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {([
                { val: 'non-vendu' as const, label: 'À vendre', icon: '🏷️', color: '#f59e0b' },
                { val: 'reserve'   as const, label: 'Réservé',  icon: '🔒', color: '#3b82f6' },
                { val: 'vendu'     as const, label: 'Vendu',    icon: '✓',  color: '#22c55e' },
                { val: 'location'  as const, label: 'Location', icon: '🔑', color: '#7c3aed' },
              ]).map(({ val, label, icon, color }) => (
                <button key={val} onClick={() => setEtat(val)}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer', border: etatCommercial === val ? `2px solid ${color}` : '1px solid #e5e7eb', background: etatCommercial === val ? `${color}15` : 'white', color: etatCommercial === val ? color : '#9ca3af', fontWeight: etatCommercial === val ? 700 : 400, fontSize: 11, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {(etatCommercial === 'reserve' || etatCommercial === 'vendu' || etatCommercial === 'location') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="text" value={vehicule.clientAcheteur ?? ''} onChange={e => setClient(e.target.value)} placeholder="Nom du client" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>📅 Date de livraison planifiée</label>
                  <input type="date" value={vehicule.dateLivraisonPlanifiee ?? ''} onChange={e => setDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Informations</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
            {vehicule.variante       && <div><span style={{ fontWeight: 600, color: '#374151' }}>Variante :</span> {vehicule.variante}</div>}
            {vehicule.marque         && <div><span style={{ fontWeight: 600, color: '#374151' }}>Marque :</span> {vehicule.marque}</div>}
            {vehicule.modele         && <div><span style={{ fontWeight: 600, color: '#374151' }}>Modèle :</span> {vehicule.modele}</div>}
            {vehicule.annee          && <div><span style={{ fontWeight: 600, color: '#374151' }}>Année :</span> {vehicule.annee}</div>}
            {vehicule.nomClient      && <div><span style={{ fontWeight: 600, color: '#374151' }}>Client :</span> {vehicule.nomClient}</div>}
            {vehicule.telephone      && <div><span style={{ fontWeight: 600, color: '#374151' }}>Téléphone :</span> {vehicule.telephone}</div>}
            {vehicule.dateLivraisonPlanifiee && <div><span style={{ fontWeight: 600, color: '#374151' }}>Livraison planifiée :</span> {new Date(vehicule.dateLivraisonPlanifiee).toLocaleDateString('fr-CA')}</div>}
          </div>
        </div>

        <button onClick={onArchiver} style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          🏁 Livrer & Archiver
        </button>
      </div>
    </div>
  );
}
