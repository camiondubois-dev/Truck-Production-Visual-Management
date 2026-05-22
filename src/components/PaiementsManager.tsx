// ════════════════════════════════════════════════════════════════
// PaiementsManager — Modal de gestion des paiements de ventes
//
// Affiche tous les vendus (prod_ventes statut='vendu') avec leur statut
// de paiement, montant reçu, solde à venir. Permet d'éditer chaque ligne.
// ════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import {
  paiementService,
  type VentePaiement, type StatutPaiement,
  STATUT_LABELS, STATUT_COLORS, STATUT_EMOJIS,
} from '../services/paiementService';

const fmt$ = (n: number | null | undefined) =>
  n == null ? '—' : new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n);

const STATUTS_VALIDES: StatutPaiement[] = ['non-paye', 'po', 'depot', 'partiel', 'paye'];

type FormState = {
  stockNumero:         string;
  prixVente:           number | null;
  statutPaiement:      StatutPaiement;
  montantRecu:         string;
  datePaiementComplet: string;
  notesPaiement:       string;
};

export function PaiementsManager({ onClose }: { onClose: () => void }) {
  const [vendus, setVendus] = useState<VentePaiement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<'tous' | StatutPaiement>('tous');
  const [recherche, setRecherche] = useState('');
  const [editForm, setEditForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const charger = async () => {
    setLoading(true);
    try {
      const data = await paiementService.getAllVendus();
      setVendus(data);
    } catch (e: any) {
      setErreur(e.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { charger(); }, []);

  const filtres = useMemo(() => {
    let result = filtre === 'tous' ? vendus : vendus.filter(v => v.statutPaiement === filtre);
    const q = recherche.trim().toLowerCase();
    if (q) {
      result = result.filter(v => v.stockNumero.toLowerCase().includes(q));
    }
    return result;
  }, [vendus, filtre, recherche]);

  // Compteurs par statut
  const counts = useMemo(() => {
    const c: Record<string, number> = { tous: vendus.length };
    for (const s of STATUTS_VALIDES) c[s] = 0;
    for (const v of vendus) c[v.statutPaiement] = (c[v.statutPaiement] ?? 0) + 1;
    return c;
  }, [vendus]);

  // Totaux
  const totaux = useMemo(() => {
    const recu = filtres.reduce((s, v) => s + v.montantRecu, 0);
    const aRecevoir = filtres.reduce((s, v) => s + v.soldeARecevoir, 0);
    const prixTotal = filtres.reduce((s, v) => s + (v.prixVente ?? 0), 0);
    return { recu, aRecevoir, prixTotal };
  }, [filtres]);

  const ouvrirEdition = (v: VentePaiement) => {
    setEditForm({
      stockNumero:         v.stockNumero,
      prixVente:           v.prixVente,
      statutPaiement:      v.statutPaiement,
      montantRecu:         String(v.montantRecu),
      datePaiementComplet: v.datePaiementComplet ?? '',
      notesPaiement:       v.notesPaiement ?? '',
    });
    setErreur(null);
  };

  const sauvegarder = async () => {
    if (!editForm) return;
    const montant = parseFloat(editForm.montantRecu);
    if (!Number.isFinite(montant) || montant < 0) {
      setErreur('Montant reçu invalide');
      return;
    }
    setSaving(true);
    try {
      await paiementService.mettreAJour(editForm.stockNumero, {
        statutPaiement:      editForm.statutPaiement,
        montantRecu:         montant,
        datePaiementComplet: editForm.datePaiementComplet || null,
        notesPaiement:       editForm.notesPaiement.trim() || null,
      });
      await charger();
      setEditForm(null);
    } catch (e: any) {
      setErreur(e.message ?? 'Erreur sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  // Raccourci : marquer comme payé en entier
  const marquerPaye = () => {
    if (!editForm || editForm.prixVente == null) return;
    setEditForm({
      ...editForm,
      statutPaiement:      'paye',
      montantRecu:         String(editForm.prixVente),
      datePaiementComplet: new Date().toISOString().slice(0, 10),
    });
  };

  // ─── Formulaire d'édition ──
  if (editForm) {
    const solde = editForm.prixVente != null
      ? Math.max(editForm.prixVente - (parseFloat(editForm.montantRecu) || 0), 0)
      : null;
    return (
      <Overlay onClose={() => setEditForm(null)}>
        <Modal>
          <Header titre={`✏️ Paiement #${editForm.stockNumero}`} onClose={() => setEditForm(null)} />
          <div style={{ padding: 20, display: 'grid', gap: 14 }}>
            {/* Aperçu prix + solde */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <ApercuCell label="Prix de vente" value={fmt$(editForm.prixVente)} color="white" />
              <ApercuCell label="Reçu" value={fmt$(parseFloat(editForm.montantRecu) || 0)} color="#22c55e" />
              <ApercuCell label="Solde" value={fmt$(solde)} color="#ef4444" bold />
            </div>

            <Champ label="Statut du paiement *">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {STATUTS_VALIDES.map(s => (
                  <button key={s}
                    onClick={() => setEditForm({ ...editForm, statutPaiement: s })}
                    style={{
                      padding: '8px 12px', borderRadius: 8, border: 'none',
                      background: editForm.statutPaiement === s ? STATUT_COLORS[s] : 'rgba(255,255,255,0.06)',
                      color: editForm.statutPaiement === s ? 'white' : 'rgba(255,255,255,0.7)',
                      fontWeight: editForm.statutPaiement === s ? 800 : 600,
                      fontSize: 12, cursor: 'pointer',
                    }}>
                    {STATUT_EMOJIS[s]} {STATUT_LABELS[s]}
                  </button>
                ))}
              </div>
            </Champ>

            <Champ label="Montant total reçu jusqu'à maintenant ($) *">
              <input
                type="number" step="0.01" min="0"
                value={editForm.montantRecu}
                onChange={e => setEditForm({ ...editForm, montantRecu: e.target.value })}
                style={inputStyle}
                placeholder="Ex: 50000"
              />
              {editForm.prixVente && (
                <button
                  onClick={marquerPaye}
                  style={{
                    marginTop: 6, padding: '6px 12px', borderRadius: 6, border: 'none',
                    background: '#22c55e22', color: '#22c55e', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}>
                  ✅ Marquer comme payé en entier ({fmt$(editForm.prixVente)})
                </button>
              )}
            </Champ>

            <Champ label="Date du paiement complet (laisse vide si pas encore)">
              <input
                type="date"
                value={editForm.datePaiementComplet}
                onChange={e => setEditForm({ ...editForm, datePaiementComplet: e.target.value })}
                style={inputStyle}
              />
            </Champ>

            <Champ label="Notes">
              <textarea
                value={editForm.notesPaiement}
                onChange={e => setEditForm({ ...editForm, notesPaiement: e.target.value })}
                style={{ ...inputStyle, height: 60, resize: 'vertical' }}
                placeholder="Ex: Chèque #1234, reste 5000 $ à venir le 30 juin"
              />
            </Champ>

            {erreur && (
              <div style={{ padding: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 8, color: '#fca5a5', fontSize: 13 }}>
                ⚠️ {erreur}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setEditForm(null)} disabled={saving} style={{ ...btnStyle, background: 'rgba(255,255,255,0.06)' }}>
                Annuler
              </button>
              <button onClick={sauvegarder} disabled={saving} style={{ ...btnStyle, background: '#22c55e', flex: 1 }}>
                {saving ? 'Sauvegarde…' : '💾 Sauvegarder'}
              </button>
            </div>
          </div>
        </Modal>
      </Overlay>
    );
  }

  // ─── Vue liste ──
  return (
    <Overlay onClose={onClose}>
      <Modal large>
        <Header titre="💰 Suivi des paiements" onClose={onClose} />

        {/* Recherche par numéro de stock */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)', position: 'relative' }}>
          <span style={{
            position: 'absolute', left: 28, top: '50%', transform: 'translateY(-50%)',
            fontSize: 14, color: 'rgba(255,255,255,0.4)', pointerEvents: 'none',
          }}>🔍</span>
          <input
            type="text"
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher par numéro de stock (ex: 35225)…"
            autoComplete="off"
            style={{
              width: '100%', padding: '10px 36px 10px 38px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: 'white',
              fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
              outline: 'none',
            }}
          />
          {recherche && (
            <button
              onClick={() => setRecherche('')}
              style={{
                position: 'absolute', right: 28, top: '50%', transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.08)', border: 'none', color: 'white',
                width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
          )}
        </div>

        {/* Filtres */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FiltreBtn label={`Tous (${counts.tous})`} actif={filtre === 'tous'} onClick={() => setFiltre('tous')} />
          {STATUTS_VALIDES.map(s => counts[s] > 0 && (
            <FiltreBtn key={s}
              label={`${STATUT_EMOJIS[s]} ${STATUT_LABELS[s]} (${counts[s]})`}
              actif={filtre === s}
              onClick={() => setFiltre(s)}
              color={STATUT_COLORS[s]}
            />
          ))}
        </div>

        {/* Totaux */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          <TotalCell label="Nb camions"      value={String(filtres.length)} />
          <TotalCell label="Prix total"      value={fmt$(totaux.prixTotal)} />
          <TotalCell label="Reçu"            value={fmt$(totaux.recu)}      color="#22c55e" />
          <TotalCell label="À recevoir"      value={fmt$(totaux.aRecevoir)} color="#ef4444" bold />
        </div>

        {/* Liste */}
        <div style={{ padding: 16, maxHeight: '55vh', overflowY: 'auto' }}>
          {loading ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 30 }}>Chargement…</div>
          ) : filtres.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: 30 }}>
              {recherche
                ? `Aucun camion ne correspond à "${recherche}"`
                : 'Aucun camion dans cette catégorie.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={thStyle}>Stock</th>
                  <th style={thStyle}>Statut</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Prix</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Reçu</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Solde</th>
                  <th style={thStyle}>Date pmt</th>
                  <th style={thStyle}></th>
                </tr>
              </thead>
              <tbody>
                {filtres.map(v => (
                  <tr key={v.stockNumero} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={tdStyle}><span style={{ color: '#a78bfa', fontWeight: 700 }}>#{v.stockNumero}</span></td>
                    <td style={tdStyle}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        padding: '3px 8px', borderRadius: 6,
                        background: `${STATUT_COLORS[v.statutPaiement]}22`,
                        color: STATUT_COLORS[v.statutPaiement],
                      }}>
                        {STATUT_EMOJIS[v.statutPaiement]} {STATUT_LABELS[v.statutPaiement]}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt$(v.prixVente)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#22c55e' }}>{fmt$(v.montantRecu)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: v.soldeARecevoir > 0 ? '#ef4444' : 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                      {fmt$(v.soldeARecevoir)}
                    </td>
                    <td style={tdStyle}>{v.datePaiementComplet ?? '—'}</td>
                    <td style={tdStyle}>
                      <button onClick={() => ouvrirEdition(v)} style={iconBtn}>✏️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>
    </Overlay>
  );
}

// ─── Sous-composants ──

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      {children}
    </div>
  );
}

function Modal({ children, large }: { children: React.ReactNode; large?: boolean }) {
  return (
    <div onClick={e => e.stopPropagation()} style={{
      width: '100%', maxWidth: large ? 1100 : 540, maxHeight: '92vh', background: '#1a1a2e',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      {children}
    </div>
  );
}

function Header({ titre, onClose }: { titre: string; onClose: () => void }) {
  return (
    <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800 }}>{titre}</div>
      <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.08)', color: 'white', fontSize: 14, cursor: 'pointer' }}>✕</button>
    </div>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {children}
    </div>
  );
}

function ApercuCell({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: bold ? 17 : 15, fontWeight: bold ? 900 : 800, color }}>{value}</div>
    </div>
  );
}

function TotalCell({ label, value, color, bold }: { label: string; value: string; color?: string; bold?: boolean }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px' }}>
      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: bold ? 17 : 15, fontWeight: bold ? 900 : 800, color: color ?? 'white' }}>{value}</div>
    </div>
  );
}

function FiltreBtn({ label, actif, onClick, color }: { label: string; actif: boolean; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: '6px 12px', borderRadius: 18, border: 'none',
      background: actif ? (color ?? '#8b5cf6') : 'rgba(255,255,255,0.08)',
      color: 'white', fontWeight: actif ? 800 : 600, fontSize: 11, cursor: 'pointer',
    }}>{label}</button>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'white',
  fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 10, border: 'none', color: 'white',
  fontWeight: 700, fontSize: 14, cursor: 'pointer',
};

const thStyle: React.CSSProperties = {
  padding: '8px 10px', textAlign: 'left', fontWeight: 600, borderBottom: '1px solid rgba(255,255,255,0.1)',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 10px', color: 'rgba(255,255,255,0.85)',
};

const iconBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 14,
};
