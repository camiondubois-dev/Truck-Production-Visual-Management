import { useState, useEffect } from 'react';
import { useGarage } from '../hooks/useGarage';
import { supabase } from '../lib/supabase';
import { EauIcon } from './EauIcon';
import type { Item, EtatCommercial } from '../types/item.types';

type FiltreType = 'tous' | 'eau' | 'client' | 'detail';

export function VuePrets() {
  const { items, archiverItem, mettreAJourItem } = useGarage();
  const [idsPrets, setIdsPrets] = useState<Set<string>>(new Set());
  const [filtreType, setFiltreType] = useState<FiltreType>('tous');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('prod_inventaire')
      .select('id')
      .eq('est_pret', true)
      .then(({ data }) => {
        if (data) setIdsPrets(new Set(data.map((r: { id: string }) => r.id)));
      });
  }, []);

  const prets = items.filter(i => i.etat !== 'termine' && i.inventaireId && idsPrets.has(i.inventaireId));

  const filtres = prets
    .filter(i => filtreType === 'tous' || i.type === filtreType)
    .sort((a, b) => {
      if (a.dateLivraisonPlanifiee && !b.dateLivraisonPlanifiee) return -1;
      if (!a.dateLivraisonPlanifiee && b.dateLivraisonPlanifiee) return 1;
      if (a.dateLivraisonPlanifiee && b.dateLivraisonPlanifiee) return a.dateLivraisonPlanifiee.localeCompare(b.dateLivraisonPlanifiee);
      return 0;
    });

  const selectedItem = filtres.find(i => i.id === selectedId) ?? null;
  const aVendre = prets.filter(i => !i.etatCommercial || i.etatCommercial === 'non-vendu').length;
  const aLivrer = prets.filter(i => i.etatCommercial === 'vendu' || i.etatCommercial === 'reserve').length;

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f8fafc', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', marginRight: selectedItem ? 400 : 0, transition: 'margin-right 0.3s ease' }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: '2px solid #e5e7eb', background: 'white' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 28 }}>✅</span>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#374151', margin: 0 }}>Prêts</h1>
            <span style={{ background: '#22c55e', color: 'white', fontSize: 13, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>
              {prets.length} véhicule{prets.length !== 1 ? 's' : ''}
            </span>
            {aVendre > 0 && <span style={{ background: '#f59e0b', color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>🏷️ {aVendre} à vendre</span>}
            {aLivrer > 0 && <span style={{ background: '#3b82f6', color: 'white', fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 12 }}>🚛 {aLivrer} à livrer</span>}
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
              {f.label} <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>{prets.filter(i => f.id === 'tous' || i.type === f.id).length}</span>
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
              {filtres.map(item => {
                const typeColor = item.type === 'eau' ? '#f97316' : item.type === 'client' ? '#3b82f6' : '#22c55e';
                const isSelected = selectedId === item.id;
                const statut = !item.etatCommercial || item.etatCommercial === 'non-vendu'
                  ? { label: '🏷️ À vendre', bg: '#fef3c7', color: '#92400e' }
                  : item.etatCommercial === 'reserve'
                  ? { label: '🔒 Réservé', bg: '#eff6ff', color: '#1d4ed8' }
                  : { label: '✓ Vendu', bg: '#dcfce7', color: '#166534' };
                return (
                  <div key={item.id} onClick={() => setSelectedId(isSelected ? null : item.id)}
                    style={{ background: isSelected ? '#f0fdf4' : 'white', borderRadius: 10, border: `1px solid ${isSelected ? '#22c55e' : '#e5e7eb'}`, borderLeft: `4px solid ${typeColor}`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 0.15s' }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = '#f8fafc'; }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLDivElement).style.background = 'white'; }}
                  >
                    <div style={{ fontSize: 28, flexShrink: 0 }}>{item.type === 'eau' ? <EauIcon /> : item.type === 'client' ? '🔧' : '🏷️'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 16, color: typeColor }}>#{item.numero}</span>
                        <span style={{ fontSize: 11, background: statut.bg, color: statut.color, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{statut.label}</span>
                        {item.clientAcheteur && <span style={{ fontSize: 11, color: '#6b7280' }}>— {item.clientAcheteur}</span>}
                      </div>
                      <div style={{ fontSize: 14, color: '#374151', fontWeight: 500, marginBottom: 4 }}>{item.label}</div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: '#9ca3af' }}>
                        {item.marque && item.annee && <span>🚛 {item.marque} {item.annee}</span>}
                        {item.dateLivraisonPlanifiee && <span style={{ color: '#1d4ed8', fontWeight: 600 }}>📅 Livraison : {new Date(item.dateLivraisonPlanifiee).toLocaleDateString('fr-CA')}</span>}
                      </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); archiverItem(item.id); }}
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

      {selectedItem && (
        <PanneauDetailPret
          item={selectedItem}
          onClose={() => setSelectedId(null)}
          onArchiver={() => { archiverItem(selectedItem.id); setSelectedId(null); }}
          onMettreAJour={mettreAJourItem}
        />
      )}
    </div>
  );
}

function PanneauDetailPret({ item, onClose, onArchiver, onMettreAJour }: {
  item: Item;
  onClose: () => void;
  onArchiver: () => void;
  onMettreAJour: (id: string, patch: Partial<Item>) => void;
}) {
  const typeColor = item.type === 'eau' ? '#f97316' : item.type === 'client' ? '#3b82f6' : '#22c55e';
  const etatCommercial = item.etatCommercial ?? 'non-vendu';

  return (
    <div style={{ position: 'fixed', right: 0, top: 0, width: 400, height: '100vh', background: 'white', borderLeft: '1px solid #e5e7eb', boxShadow: '-4px 0 24px rgba(0,0,0,0.1)', overflowY: 'auto', zIndex: 150 }}>
      <div style={{ padding: 24 }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#9ca3af' }}>✕</button>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: typeColor, marginBottom: 4 }}>#{item.numero}</div>
          <div style={{ fontSize: 15, color: '#374151', marginBottom: 12 }}>{item.label}</div>
          <span style={{ fontSize: 12, background: '#dcfce7', color: '#166534', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>✅ Prêt</span>
        </div>

        {(item.type === 'eau' || item.type === 'detail') && (
          <div style={{ marginBottom: 20, padding: '14px', borderRadius: 10, background: '#f8fafc', border: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Statut commercial</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {([
                { val: 'non-vendu' as EtatCommercial, label: 'À vendre', icon: '🏷️', color: '#f59e0b' },
                { val: 'reserve'   as EtatCommercial, label: 'Réservé',  icon: '🔒', color: '#3b82f6' },
                { val: 'vendu'     as EtatCommercial, label: 'Vendu',    icon: '✓',  color: '#22c55e' },
              ]).map(({ val, label, icon, color }) => (
                <button key={val} onClick={() => onMettreAJour(item.id, { etatCommercial: val })}
                  style={{ flex: 1, padding: '8px 4px', borderRadius: 8, cursor: 'pointer', border: etatCommercial === val ? `2px solid ${color}` : '1px solid #e5e7eb', background: etatCommercial === val ? `${color}15` : 'white', color: etatCommercial === val ? color : '#9ca3af', fontWeight: etatCommercial === val ? 700 : 400, fontSize: 11, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {(etatCommercial === 'reserve' || etatCommercial === 'vendu') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <input type="text" value={item.clientAcheteur ?? ''} onChange={e => onMettreAJour(item.id, { clientAcheteur: e.target.value || undefined })} placeholder="Nom du client" style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                <div>
                  <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>📅 Date de livraison planifiée</label>
                  <input type="date" value={item.dateLivraisonPlanifiee ?? ''} onChange={e => onMettreAJour(item.id, { dateLivraisonPlanifiee: e.target.value || undefined })} style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Informations</div>
          <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 2 }}>
            {item.variante  && <div><span style={{ fontWeight: 600, color: '#374151' }}>Variante :</span> {item.variante}</div>}
            {item.marque    && <div><span style={{ fontWeight: 600, color: '#374151' }}>Marque :</span> {item.marque}</div>}
            {item.modele    && <div><span style={{ fontWeight: 600, color: '#374151' }}>Modèle :</span> {item.modele}</div>}
            {item.annee     && <div><span style={{ fontWeight: 600, color: '#374151' }}>Année :</span> {item.annee}</div>}
            {item.nomClient && <div><span style={{ fontWeight: 600, color: '#374151' }}>Client :</span> {item.nomClient}</div>}
            {item.telephone && <div><span style={{ fontWeight: 600, color: '#374151' }}>Téléphone :</span> {item.telephone}</div>}
            {item.dateLivraisonPlanifiee && <div><span style={{ fontWeight: 600, color: '#374151' }}>Livraison planifiée :</span> {new Date(item.dateLivraisonPlanifiee).toLocaleDateString('fr-CA')}</div>}
          </div>
        </div>

        <button onClick={onArchiver} style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          🏁 Livrer & Archiver
        </button>
      </div>
    </div>
  );
}
