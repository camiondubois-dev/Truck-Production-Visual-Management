// ════════════════════════════════════════════════════════════════
// LaborLogImporter — Wizard d'import du Labor Log iTrack
//
// Étapes :
//   1. Choisir le fichier CSV
//   2. Parser + afficher diff (employés nouveaux, WO nouveaux, etc.)
//   3. Confirmer → exécution
//   4. Rapport final
// ════════════════════════════════════════════════════════════════

import { useState, useRef } from 'react';
import {
  parseLaborLog, buildLaborDiff, executeLaborImport, enrichirAvecCamions,
  CAMION_STATUT_LABELS, CAMION_STATUT_COLORS, CAMION_STATUT_EMOJIS,
  type LaborLogParse, type LaborDiff, type LaborImportResult, type CamionStatut,
  type ValidationMsg,
} from '../services/laborLogImportService';

const fmt = (n: number) => new Intl.NumberFormat('fr-CA', { maximumFractionDigits: 2 }).format(n);

type Etape = 'choisir' | 'preview' | 'confirmation' | 'resultat';

export function LaborLogImporter() {
  const [etape,    setEtape]    = useState<Etape>('choisir');
  const [fileName, setFileName] = useState<string>('');
  const [parse,    setParse]    = useState<LaborLogParse | null>(null);
  const [diff,     setDiff]     = useState<LaborDiff | null>(null);
  const [result,   setResult]   = useState<LaborImportResult | null>(null);
  const [busy,     setBusy]     = useState(false);
  const [erreur,   setErreur]   = useState<string | null>(null);
  const [tauxFacturation, setTauxFacturation] = useState<string>('140');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    setBusy(true); setErreur(null);
    try {
      const text = await file.text();
      const p = parseLaborLog(text);
      if (p.entries.length === 0) {
        setErreur('Aucune entrée valide détectée dans le fichier.');
        setBusy(false);
        return;
      }
      // Enrichir avec le statut des camions (inventaire / vendu / pièces / inconnu)
      const enriched = await enrichirAvecCamions(p.entries);
      const pEnrichi: LaborLogParse = { ...p, entries: enriched };
      const d = await buildLaborDiff(pEnrichi);
      setFileName(file.name);
      setParse(pEnrichi);
      setDiff(d);
      setEtape('preview');
    } catch (e: any) {
      setErreur(`Erreur de lecture : ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const lancerImport = async () => {
    if (!parse) return;
    const taux = parseFloat(tauxFacturation);
    if (!Number.isFinite(taux) || taux < 0) {
      setErreur('Taux horaire facturé invalide.');
      return;
    }
    setBusy(true); setErreur(null);
    try {
      const r = await executeLaborImport(parse, fileName, taux);
      setResult(r);
      setEtape('resultat');
    } catch (e: any) {
      setErreur(`Erreur d'import : ${e.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setEtape('choisir');
    setFileName(''); setParse(null); setDiff(null); setResult(null); setErreur(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ═══ Étape 1 : Choisir fichier ═══
  if (etape === 'choisir') {
    return (
      <div style={card}>
        <div style={titreSection}>⏰ Importer un Labor Log iTrack</div>
        <p style={{ color: '#6b7280', fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>
          Sélectionne un export <strong>"Labor Log By Employee"</strong> au format CSV.
          L'import va :
          <br />• Créer/mettre à jour les <strong>Work Orders</strong> (interne vs externe)
          <br />• Créer automatiquement les <strong>employés inconnus</strong> (tu pourras ajuster leur taux dans <em>Administration → Employés</em>)
          <br />• <strong>Remplacer toutes les heures</strong> de la période détectée dans le fichier
        </p>

        <div style={{
          border: '2px dashed #d1d5db', borderRadius: 12, padding: 30, textAlign: 'center',
          background: '#f9fafb', cursor: 'pointer', marginBottom: 16,
        }} onClick={() => fileRef.current?.click()}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Clique pour choisir un fichier CSV
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
            Ex: laborlogbyemployee.csv
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {erreur && <Erreur message={erreur} />}
        {busy && <div style={{ color: '#3b82f6', fontSize: 13 }}>Analyse du fichier…</div>}
      </div>
    );
  }

  // ═══ Étape 2 : Preview / Diff ═══
  if (etape === 'preview' && parse && diff) {
    const internes = parse.entries.filter(e => e.typeNormalise === 'interne');
    const externes = parse.entries.filter(e => e.typeNormalise === 'externe');
    const heuresInternes = internes.reduce((s, e) => s + e.heures, 0);
    const heuresExternes = externes.reduce((s, e) => s + e.heures, 0);

    return (
      <div style={card}>
        <div style={titreSection}>📋 Aperçu de l'import</div>
        <div style={{ background: '#eff6ff', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
          📄 <strong>{fileName}</strong>
          {parse.periodeDebut && parse.periodeFin && (
            <> · Période <strong>{parse.periodeDebut}</strong> → <strong>{parse.periodeFin}</strong></>
          )}
        </div>

        {/* Validations métier (erreurs bloquantes + avertissements) */}
        {parse.validations.length > 0 && (
          <div style={{ marginBottom: 16, display: 'grid', gap: 8 }}>
            {parse.validations.map((v, i) => <ValidationBox key={i} validation={v} />)}
          </div>
        )}

        {/* Bloc Employés */}
        <BlocStat
          titre="👥 Employés"
          ligne1={`${diff.employesConnus} déjà connus`}
          ligne2={`${diff.employesNouveaux.length} nouveaux (auto-créés avec taux=0)`}
          alerte={diff.employesNouveaux.length > 0}
        />
        {diff.employesNouveaux.length > 0 && (
          <div style={{ background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#92400e' }}>
            <strong>⚠️ {diff.employesNouveaux.length} employés vont être créés sans taux horaire :</strong>
            <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 11 }}>
              {diff.employesNouveaux.join(', ')}
            </div>
            <div style={{ marginTop: 8, fontStyle: 'italic' }}>
              Tu pourras ajuster leur nom et taux horaire dans <strong>Administration → Employés</strong> après l'import.
            </div>
          </div>
        )}

        {/* Bloc Work Orders */}
        <BlocStat
          titre="🔧 Work Orders"
          ligne1={`${diff.wosExistants} mis à jour`}
          ligne2={`${diff.wosNouveaux} nouveaux créés`}
        />

        {/* Bloc Heures */}
        <BlocStat
          titre="⏰ Heures"
          ligne1={`${diff.heuresAImporter} entrées à importer (${fmt(diff.totalHeuresImport)} h au total)`}
          ligne2={diff.heuresExistantes > 0
            ? `⚠️ ${diff.heuresExistantes} entrées existantes dans cette période vont être REMPLACÉES`
            : 'Aucune donnée existante dans cette période'}
          alerte={diff.heuresExistantes > 0}
        />

        {/* Répartition interne/externe */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ background: '#dbeafe', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#1e40af', fontWeight: 700 }}>🏭 INTERNE (camions)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#1e3a8a', marginTop: 4 }}>{fmt(heuresInternes)} h</div>
            <div style={{ fontSize: 11, color: '#1e40af', marginTop: 2 }}>{internes.length} entrées · {new Set(internes.map(e => e.woNumero)).size} WO</div>
          </div>
          <div style={{ background: '#fce7f3', borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: '#9d174d', fontWeight: 700 }}>🔧 EXTERNE (clients)</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#831843', marginTop: 4 }}>{fmt(heuresExternes)} h</div>
            <div style={{ fontSize: 11, color: '#9d174d', marginTop: 2 }}>{externes.length} entrées · {new Set(externes.map(e => e.woNumero)).size} WO</div>
          </div>
        </div>

        {/* Détail des heures internes par statut camion */}
        {internes.length > 0 && (() => {
          const statuts: CamionStatut[] = ['inventaire', 'vendu', 'travaux_pieces', 'inconnu'];
          const stats = statuts.map(s => {
            const sub = internes.filter(e => e.camionStatut === s);
            return {
              statut: s,
              nbEntries: sub.length,
              nbWo:      new Set(sub.map(e => e.woNumero)).size,
              heures:    sub.reduce((tot, e) => tot + e.heures, 0),
            };
          }).filter(s => s.nbEntries > 0);

          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                🏭 Détail des heures internes par destination
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 8 }}>
                {stats.map(s => (
                  <div key={s.statut} style={{
                    background: `${CAMION_STATUT_COLORS[s.statut]}15`,
                    border: `1px solid ${CAMION_STATUT_COLORS[s.statut]}40`,
                    borderRadius: 8, padding: 10,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: CAMION_STATUT_COLORS[s.statut] }}>
                      {CAMION_STATUT_EMOJIS[s.statut]} {CAMION_STATUT_LABELS[s.statut].toUpperCase()}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: '#111827', marginTop: 4 }}>
                      {fmt(s.heures)} h
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                      {s.nbWo} WO · {s.nbEntries} entrées
                    </div>
                  </div>
                ))}
              </div>
              {stats.find(s => s.statut === 'inconnu') && (
                <div style={{ fontSize: 11, color: '#dc2626', marginTop: 6 }}>
                  ⚠️ Stock(s) inconnu(s) : numéro(s) numérique(s) absent(s) de prod_inventaire et prod_ventes. À vérifier.
                </div>
              )}
            </div>
          );
        })()}

        {parse.erreurs.length > 0 && (
          <div style={{ background: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#991b1b' }}>
            {parse.erreurs.map((e, i) => <div key={i}>⚠️ {e}</div>)}
          </div>
        )}

        {/* Liste détaillée (collapsible) */}
        <details style={{ marginBottom: 20 }}>
          <summary style={{ cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', padding: '8px 0' }}>
            ▶ Voir le détail des {parse.entries.length} entrées
          </summary>
          <div style={{ marginTop: 10, maxHeight: 350, overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead style={{ background: '#f9fafb', position: 'sticky', top: 0 }}>
                <tr style={{ color: '#6b7280' }}>
                  <th style={th}>Employé</th>
                  <th style={th}>WO</th>
                  <th style={th}>Type</th>
                  <th style={th}>Client / Stock</th>
                  <th style={th}>Camion</th>
                  <th style={{ ...th, textAlign: 'right' }}>Heures</th>
                </tr>
              </thead>
              <tbody>
                {parse.entries.map((e, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={td}><span style={{ fontFamily: 'monospace', color: '#0ea5e9' }}>{e.employeCode}</span></td>
                    <td style={td}><span style={{ fontFamily: 'monospace' }}>{e.woNumero}</span></td>
                    <td style={td}>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                        background: e.typeNormalise === 'interne' ? '#dbeafe' : '#fce7f3',
                        color:      e.typeNormalise === 'interne' ? '#1e40af' : '#9d174d',
                      }}>{e.typeNormalise}</span>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', color: '#6b7280' }}>{e.customerOrPart}</td>
                    <td style={td}>
                      {e.typeNormalise === 'interne' && e.camionStatut ? (
                        <div>
                          <span style={{
                            fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                            background: `${CAMION_STATUT_COLORS[e.camionStatut]}20`,
                            color:      CAMION_STATUT_COLORS[e.camionStatut],
                            whiteSpace: 'nowrap',
                          }}>
                            {CAMION_STATUT_EMOJIS[e.camionStatut]} {CAMION_STATUT_LABELS[e.camionStatut]}
                          </span>
                          {(e.camionMarque || e.camionModele) && (
                            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>
                              {[e.camionAnnee, e.camionMarque, e.camionModele].filter(Boolean).join(' ')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#d1d5db', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{fmt(e.heures)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>

        {/* Taux horaire facturé + aperçu revenus calculés */}
        {(() => {
          const taux = parseFloat(tauxFacturation) || 0;
          const totalHeures = parse.entries.reduce((s, e) => s + e.heures, 0);
          const revenuTotal = totalHeures * taux;
          const revenuInterne = parse.entries.filter(e => e.typeNormalise === 'interne').reduce((s, e) => s + e.heures * taux, 0);
          const revenuExterne = parse.entries.filter(e => e.typeNormalise === 'externe').reduce((s, e) => s + e.heures * taux, 0);
          return (
            <div style={{
              background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 10, padding: 16, marginBottom: 20,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                💵 Taux horaire facturé (revenu)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <label style={{ fontSize: 13, color: '#166534', fontWeight: 600 }}>Taux ($/h) :</label>
                <input
                  type="number" step="0.01" min="0"
                  value={tauxFacturation}
                  onChange={ev => setTauxFacturation(ev.target.value)}
                  style={{
                    padding: '8px 12px', border: '1px solid #86efac', borderRadius: 6,
                    fontSize: 16, fontWeight: 700, color: '#166534', background: 'white',
                    width: 110, textAlign: 'right',
                  }}
                />
                <span style={{ fontSize: 12, color: '#6b7280' }}>
                  s'applique à <strong>tous les WO</strong> de cet import (défaut: 140 $)
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <ChiffreCard label="Revenu total facturable" value={revenuTotal} color="#16a34a" sub={`${totalHeures.toFixed(1)} h × ${taux.toFixed(2)} $`} />
                <ChiffreCard label="dont WO internes"        value={revenuInterne} color="#0ea5e9" />
                <ChiffreCard label="dont WO externes"        value={revenuExterne} color="#ec4899" />
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 8, fontStyle: 'italic' }}>
                💡 Ce taux est sauvegardé par WO et réutilisé pour calculer le profit sur la M.O.
                Tu peux ajuster un WO individuellement plus tard si besoin.
              </div>
            </div>
          );
        })()}

        {erreur && <Erreur message={erreur} />}

        {(() => {
          const aDesErreurs = parse.validations.some(v => v.niveau === 'erreur');
          return (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={reset} disabled={busy} style={btnSecondary}>← Annuler</button>
              <button onClick={lancerImport} disabled={busy || aDesErreurs}
                style={{
                  ...btnPrimary, flex: 1,
                  background: aDesErreurs ? '#9ca3af' : btnPrimary.background,
                  cursor: aDesErreurs ? 'not-allowed' : 'pointer',
                }}
                title={aDesErreurs ? 'Corrige les erreurs avant d\'importer' : undefined}
              >
                {busy ? 'Import en cours…' : aDesErreurs ? '❌ Import bloqué (voir erreurs)' : '✅ Confirmer et importer'}
              </button>
            </div>
          );
        })()}
      </div>
    );
  }

  // ═══ Étape 4 : Résultat ═══
  if (etape === 'resultat' && result) {
    const succes = result.erreurs.length === 0;
    return (
      <div style={card}>
        <div style={{ ...titreSection, color: succes ? '#16a34a' : '#dc2626' }}>
          {succes ? '✅ Import réussi' : '⚠️ Import terminé avec erreurs'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 20 }}>
          <Resume label="Employés créés"     value={result.employesCrees}      color="#3b82f6" />
          <Resume label="WO nouveaux"        value={result.wosCrees}           color="#22c55e" />
          <Resume label="WO mis à jour"      value={result.wosMisAJour}        color="#f59e0b" />
          <Resume label="Heures supprimées"  value={result.heuresSupprimees}   color="#9ca3af" />
          <Resume label="Heures insérées"    value={result.heuresInserees}     color="#22c55e" />
        </div>

        {result.erreurs.length > 0 && (
          <div style={{ background: '#fee2e2', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: '#991b1b' }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>{result.erreurs.length} erreur(s) :</div>
            {result.erreurs.map((e, i) => <div key={i} style={{ marginBottom: 2 }}>• {e}</div>)}
          </div>
        )}

        {result.employesCrees > 0 && (
          <div style={{ background: '#fef3c7', borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 13, color: '#92400e' }}>
            💡 <strong>{result.employesCrees} employés ont été auto-créés</strong> sans taux horaire.
            <br />
            Va dans <strong>Administration → Employés</strong> pour leur attribuer un nom complet et un taux horaire.
          </div>
        )}

        <button onClick={reset} style={btnPrimary}>📥 Importer un autre fichier</button>
      </div>
    );
  }

  return null;
}

// ─── Sous-composants ──────────────────────────────────────────────

function BlocStat({ titre, ligne1, ligne2, alerte }: { titre: string; ligne1: string; ligne2?: string; alerte?: boolean }) {
  return (
    <div style={{
      background: alerte ? '#fef3c7' : '#f9fafb',
      border: `1px solid ${alerte ? '#fbbf24' : '#e5e7eb'}`,
      borderRadius: 8, padding: 12, marginBottom: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: alerte ? '#92400e' : '#374151', marginBottom: 4 }}>{titre}</div>
      <div style={{ fontSize: 13, color: '#374151' }}>{ligne1}</div>
      {ligne2 && <div style={{ fontSize: 13, color: alerte ? '#92400e' : '#6b7280', marginTop: 2 }}>{ligne2}</div>}
    </div>
  );
}

function Erreur({ message }: { message: string }) {
  return (
    <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12, marginBottom: 12, color: '#991b1b', fontSize: 13 }}>
      ⚠️ {message}
    </div>
  );
}

function ValidationBox({ validation }: { validation: ValidationMsg }) {
  const styles = {
    erreur:        { bg: '#fee2e2', border: '#fca5a5', color: '#991b1b', icon: '🚫', label: 'Erreur — import bloqué' },
    avertissement: { bg: '#fef3c7', border: '#fbbf24', color: '#92400e', icon: '⚠️',  label: 'Avertissement'        },
    info:          { bg: '#dbeafe', border: '#93c5fd', color: '#1e40af', icon: 'ℹ️',  label: 'Info'                 },
  }[validation.niveau];
  return (
    <div style={{ background: styles.bg, border: `1px solid ${styles.border}`, borderRadius: 8, padding: '10px 14px', fontSize: 13, color: styles.color }}>
      <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {styles.icon} {styles.label}
      </div>
      <div>{validation.message}</div>
    </div>
  );
}

function Resume({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
    </div>
  );
}

function ChiffreCard({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  const fmt$ = new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
  return (
    <div style={{ background: 'white', border: '1px solid #d1fae5', borderRadius: 8, padding: 10 }}>
      <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color }}>{fmt$.format(value)}</div>
      {sub && <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'white', borderRadius: 12, padding: 24,
  border: '1px solid #e5e7eb', maxWidth: 900, margin: '0 auto',
};
const titreSection: React.CSSProperties = {
  fontSize: 18, fontWeight: 800, color: '#111827', marginBottom: 16,
};
const th: React.CSSProperties = { padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 10, textTransform: 'uppercase' };
const td: React.CSSProperties = { padding: '8px 10px', color: '#374151' };
const btnPrimary: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 8, border: 'none',
  background: '#22c55e', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '10px 16px', borderRadius: 8, border: '1px solid #e5e7eb',
  background: 'white', color: '#374151', fontWeight: 600, fontSize: 14, cursor: 'pointer',
};
