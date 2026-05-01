import { useState, useEffect, useContext } from 'react';
import { useMoteurs } from '../contexts/MoteurContext';
import { AuthContext } from '../contexts/AuthContext';
import { ENGINE_ETAPES, ENGINE_SLOTS, ENGINE_ZONES, getEngineEtape, getEngineSlot } from '../data/engineStations';
import { progressionMoteur } from '../types/engineTypes';
import type { Moteur, ProprietaireMoteur, EtapeMoteur, StatutEtapeMoteur } from '../types/engineTypes';
import { photoService } from '../services/photoService';
import { supabase } from '../lib/supabase';

interface ProfileLite { id: string; nom: string; departement?: string; }

export function PanneauDetailMoteur({ moteur, onClose }: { moteur: Moteur; onClose: () => void }) {
  const { mettreAJour, demarrerEtape, terminerEtape, sauterEtape, replanifierEtape, deplacer, archiver, supprimer } = useMoteurs();
  // useAuth optionnel : pas crasher si pas d'AuthProvider (cas /terrain mobile)
  const auth = useContext(AuthContext);
  const profile = auth?.profile ?? null;

  const [editing, setEditing] = useState(false);
  const [stkNumero, setStkNumero] = useState(moteur.stkNumero);
  const [workOrder, setWorkOrder] = useState(moteur.workOrder ?? '');
  const [marque, setMarque] = useState(moteur.marque ?? '');
  const [modele, setModele] = useState(moteur.modele ?? '');
  const [serie, setSerie] = useState(moteur.serie ?? '');
  const [annee, setAnnee] = useState(moteur.annee ? String(moteur.annee) : '');
  const [epa, setEpa] = useState(moteur.epa ?? '');
  const [ghg, setGhg] = useState(moteur.ghg ?? '');
  const [puissanceHp, setPuissanceHp] = useState(moteur.puissanceHp ? String(moteur.puissanceHp) : '');
  const [codeMoteur, setCodeMoteur] = useState(moteur.codeMoteur ?? '');
  const [proprietaire, setProprietaire] = useState<ProprietaireMoteur>(moteur.proprietaire);
  const [nomClient, setNomClient] = useState(moteur.nomClient ?? '');
  const [etatCommercial, setEtatCommercial] = useState(moteur.etatCommercial ?? '');
  const [notes, setNotes] = useState(moteur.notes ?? '');

  const [employes, setEmployes] = useState<ProfileLite[]>([]);
  const [employeChoisi, setEmployeChoisi] = useState<string>('');
  const [etapeAssign, setEtapeAssign] = useState<string | null>(null);
  const [confirmerSuppr, setConfirmerSuppr] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // Charger employés mécanique-moteur
  useEffect(() => {
    supabase
      .from('profiles')
      .select('id, nom, departement, role, actif')
      .eq('actif', true)
      .then(({ data }) => {
        const list = (data ?? [])
          .filter(p => p.role === 'employe' || p.role === 'gestion')
          .map(p => ({ id: p.id, nom: p.nom ?? 'Sans nom', departement: p.departement ?? undefined }));
        setEmployes(list);
      });
  }, []);

  const pct = progressionMoteur(moteur);
  const slot = moteur.posteCourant ? getEngineSlot(moteur.posteCourant) : null;
  const employeCourant = employes.find(e => e.id === moteur.employeCourant);

  const saveEdits = async () => {
    setErreur(null);
    try {
      const descParts = [
        marque.trim().toUpperCase(), modele.trim(), serie.trim(),
        epa.trim().toUpperCase(), ghg.trim().toUpperCase(),
        puissanceHp.trim() ? `${puissanceHp.trim()}HP` : '',
        codeMoteur.trim() ? `(${codeMoteur.trim()})` : '',
      ].filter(Boolean);

      await mettreAJour(moteur.id, {
        stkNumero: stkNumero.trim(),
        workOrder: workOrder.trim() || undefined,
        marque: marque.trim() ? marque.trim().toUpperCase() : undefined,
        modele: modele.trim() || undefined,
        serie: serie.trim() || undefined,
        annee: annee.trim() ? parseInt(annee.trim()) : undefined,
        epa: epa.trim() ? epa.trim().toUpperCase() : undefined,
        ghg: ghg.trim() ? ghg.trim().toUpperCase() : undefined,
        puissanceHp: puissanceHp.trim() ? parseInt(puissanceHp.trim()) : undefined,
        codeMoteur: codeMoteur.trim() || undefined,
        descriptionMoteur: descParts.join(' ') || undefined,
        proprietaire,
        nomClient: proprietaire === 'client' ? (nomClient.trim() || undefined) : undefined,
        etatCommercial: etatCommercial.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setEditing(false);
    } catch (e: any) {
      setErreur(String(e?.message ?? e));
    }
  };

  const cancelEdits = () => {
    setStkNumero(moteur.stkNumero);
    setWorkOrder(moteur.workOrder ?? '');
    setMarque(moteur.marque ?? '');
    setModele(moteur.modele ?? '');
    setSerie(moteur.serie ?? '');
    setAnnee(moteur.annee ? String(moteur.annee) : '');
    setEpa(moteur.epa ?? '');
    setGhg(moteur.ghg ?? '');
    setPuissanceHp(moteur.puissanceHp ? String(moteur.puissanceHp) : '');
    setCodeMoteur(moteur.codeMoteur ?? '');
    setProprietaire(moteur.proprietaire);
    setNomClient(moteur.nomClient ?? '');
    setEtatCommercial(moteur.etatCommercial ?? '');
    setNotes(moteur.notes ?? '');
    setEditing(false);
    setErreur(null);
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { alert('Max 10 MB'); return; }
    setUploadingPhoto(true);
    try {
      if (moteur.photoUrl) await photoService.supprimerPhoto(moteur.photoUrl);
      const url = await photoService.uploaderPhoto(file, 'inventaire');
      await mettreAJour(moteur.id, { photoUrl: url });
    } catch (err) {
      alert('Erreur upload photo : ' + String((err as any)?.message ?? err));
    } finally {
      setUploadingPhoto(false);
      e.target.value = '';
    }
  };

  const handleSupprimerPhoto = async () => {
    if (!moteur.photoUrl) return;
    await photoService.supprimerPhoto(moteur.photoUrl);
    await mettreAJour(moteur.id, { photoUrl: undefined });
  };

  const handleDemarrerEtape = async (etapeUuid: string) => {
    if (!employeChoisi) {
      alert("Choisis un mécano avant de démarrer l'étape");
      return;
    }
    await demarrerEtape(moteur.id, etapeUuid, employeChoisi);
    setEtapeAssign(null);
  };

  const isGestion = profile?.role === 'gestion';

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.4)',
      display: 'flex', justifyContent: 'flex-end',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 520, maxWidth: '100vw', height: '100dvh',
        background: 'white', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
        overflowY: 'auto',
        color: '#111827', fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        {/* Bouton X fixe */}
        <button onClick={onClose} style={{
          position: 'fixed', top: 12, right: 12, zIndex: 250,
          background: 'rgba(255,255,255,0.95)', border: '1px solid #e5e7eb',
          width: 36, height: 36, borderRadius: 8, fontSize: 18, fontWeight: 700,
          color: '#374151', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626'; e.currentTarget.style.borderColor = '#fca5a5'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.95)'; e.currentTarget.style.color = '#374151'; e.currentTarget.style.borderColor = '#e5e7eb'; }}
        >✕</button>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Header */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: '#7c3aed' }}>
                #{moteur.stkNumero}
              </span>
              <StatutBadge statut={moteur.statut} />
              {moteur.etatCommercial && (
                <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: '#fef3c7', color: '#92400e' }}>
                  {moteur.etatCommercial}
                </span>
              )}
            </div>
            <div style={{ fontSize: 14, color: '#374151', fontWeight: 600 }}>
              {moteur.descriptionMoteur || <em style={{ color: '#9ca3af' }}>Pas de description</em>}
            </div>
            {moteur.workOrder && (
              <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6b7280', marginTop: 3 }}>
                W/O {moteur.workOrder}
              </div>
            )}
          </div>

          {/* Photo */}
          <div>
            {moteur.photoUrl ? (
              <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
                <img src={moteur.photoUrl} alt={moteur.stkNumero} style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
                <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                  <label style={{ padding: '5px 10px', borderRadius: 6, cursor: 'pointer', background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: 11, fontWeight: 600 }}>
                    <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadPhoto} />
                    📷 Changer
                  </label>
                  <button onClick={handleSupprimerPhoto} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'rgba(239,68,68,0.85)', color: 'white', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>🗑</button>
                </div>
                {uploadingPhoto && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700 }}>
                    ⏳ Upload...
                  </div>
                )}
              </div>
            ) : (
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: 24, borderRadius: 10, border: '2px dashed #d1d5db',
                background: '#f8fafc', color: '#9ca3af', cursor: 'pointer',
              }}>
                <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUploadPhoto} />
                <span style={{ fontSize: 28 }}>📷</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{uploadingPhoto ? 'Upload...' : 'Ajouter une photo'}</span>
              </label>
            )}
          </div>

          {/* Édition rapide */}
          <Section title="Identification" right={
            !editing ? (
              <button onClick={() => setEditing(true)} style={btnLink}>✏️ Modifier</button>
            ) : (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={cancelEdits} style={{ ...btnLink, color: '#6b7280' }}>Annuler</button>
                <button onClick={saveEdits} style={{ ...btnLink, color: '#7c3aed', fontWeight: 700 }}>✓ Sauver</button>
              </div>
            )
          }>
            {!editing ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                <KV label="STK #" value={moteur.stkNumero} />
                <KV label="W/O" value={moteur.workOrder ?? '—'} />
                <KV label="Marque" value={moteur.marque ?? '—'} />
                <KV label="Modèle" value={moteur.modele ?? '—'} />
                <KV label="Série" value={moteur.serie ?? '—'} />
                <KV label="Année" value={moteur.annee ? String(moteur.annee) : '—'} />
                <KV label="EPA" value={moteur.epa ?? '—'} />
                <KV label="GHG" value={moteur.ghg ?? '—'} />
                <KV label="Force" value={moteur.puissanceHp ? `${moteur.puissanceHp} HP` : '—'} />
                <KV label="Code" value={moteur.codeMoteur ?? '—'} />
                <KV label="Propriétaire" value={moteur.proprietaire + (moteur.nomClient ? ` · ${moteur.nomClient}` : '')} />
                <KV label="État" value={moteur.etatCommercial ?? '—'} />
                <KV label="Notes" value={moteur.notes ?? '—'} multiline />
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input value={stkNumero} onChange={e => setStkNumero(e.target.value)} placeholder="STK #" style={inputStyle} />
                  <input value={workOrder} onChange={e => setWorkOrder(e.target.value)} placeholder="W/O" style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input value={marque} onChange={e => setMarque(e.target.value)} placeholder="Marque" list="moteur-marques" style={inputStyle} />
                  <input value={modele} onChange={e => setModele(e.target.value)} placeholder="Modèle" style={inputStyle} />
                </div>
                <datalist id="moteur-marques">
                  <option value="PACCAR" /><option value="CUMMINS" /><option value="DETROIT" /><option value="CATERPILLAR" /><option value="INTER" /><option value="MACK" /><option value="VOLVO" />
                </datalist>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input value={serie} onChange={e => setSerie(e.target.value)} placeholder="Série (CM2350...)" style={inputStyle} />
                  <input type="number" value={annee} onChange={e => setAnnee(e.target.value)} placeholder="Année" min={1980} max={2030} style={inputStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <input value={epa} onChange={e => setEpa(e.target.value)} placeholder="EPA" style={inputStyle} />
                  <input value={ghg} onChange={e => setGhg(e.target.value)} placeholder="GHG" style={inputStyle} />
                  <input type="number" value={puissanceHp} onChange={e => setPuissanceHp(e.target.value)} placeholder="HP" style={inputStyle} />
                </div>
                <input value={codeMoteur} onChange={e => setCodeMoteur(e.target.value)} placeholder="Code moteur (CMK, HEP...)" style={inputStyle} />
                <select value={proprietaire} onChange={e => setProprietaire(e.target.value as ProprietaireMoteur)} style={inputStyle}>
                  <option value="interne">Interne</option>
                  <option value="client">Client</option>
                  <option value="exportation">Exportation</option>
                  <option value="inventaire">Inventaire</option>
                </select>
                {proprietaire === 'client' && (
                  <input value={nomClient} onChange={e => setNomClient(e.target.value)} placeholder="Nom du client" style={inputStyle} />
                )}
                <input value={etatCommercial} onChange={e => setEtatCommercial(e.target.value)} placeholder="État (ex. VENDU URGENT)" style={inputStyle} />
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes" rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                {erreur && <div style={{ color: '#dc2626', fontSize: 12 }}>⚠ {erreur}</div>}
              </div>
            )}
          </Section>

          {/* Emplacement */}
          <Section title="Emplacement actuel">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 18 }}>📍</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: slot ? '#7c3aed' : '#9ca3af' }}>
                {slot ? slot.label : 'Aucun emplacement'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {ENGINE_ZONES.map(zone => (
                <div key={zone.id} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                    {zone.label}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                    {ENGINE_SLOTS.filter(s => s.zone === zone.id).map(s => {
                      const actif = moteur.posteCourant === s.id;
                      return (
                        <button key={s.id} onClick={() => deplacer(moteur.id, actif ? null : s.id)}
                          style={{
                            padding: '5px 10px', borderRadius: 6, fontSize: 12,
                            fontWeight: actif ? 700 : 500,
                            border: actif ? `2px solid ${zone.color}` : '1px solid #e5e7eb',
                            background: actif ? `${zone.color}15` : 'white',
                            color: actif ? zone.color : '#6b7280',
                            cursor: 'pointer',
                          }}>
                          {s.label} <span style={{ fontSize: 10, opacity: 0.6 }}>(cap. {s.capacite})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Plan de production */}
          <Section title="Plan de production" right={
            <span style={{ fontSize: 11, color: '#9ca3af' }}>
              {pct}% · {moteur.roadMap.filter(e => e.statut === 'termine').length}/{moteur.roadMap.length} faites
            </span>
          }>
            <div style={{ height: 6, background: '#e5e7eb', borderRadius: 3, overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b', transition: 'width 0.3s' }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {moteur.roadMap.map((etape) => (
                <EtapeCard key={etape.id} etape={etape}
                  employes={employes}
                  estAssigning={etapeAssign === etape.id}
                  employeChoisi={employeChoisi}
                  setEmployeChoisi={setEmployeChoisi}
                  onAssign={() => setEtapeAssign(etape.id)}
                  onCancelAssign={() => { setEtapeAssign(null); setEmployeChoisi(''); }}
                  onDemarrer={() => handleDemarrerEtape(etape.id)}
                  onTerminer={() => terminerEtape(moteur.id, etape.id)}
                  onSauter={() => sauterEtape(moteur.id, etape.id)}
                  onReplanifier={() => replanifierEtape(moteur.id, etape.id)}
                />
              ))}
            </div>
          </Section>

          {/* Tracking temps */}
          <Section title="Suivi temps">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Date entrée</div>
                <div style={{ color: '#374151', fontWeight: 600 }}>
                  {moteur.dateEntree ? new Date(moteur.dateEntree).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Date sortie</div>
                <div style={{ color: '#374151', fontWeight: 600 }}>
                  {moteur.dateSortie ? new Date(moteur.dateSortie).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Employé courant</div>
                <div style={{ color: '#374151', fontWeight: 600 }}>
                  {employeCourant?.nom ?? '—'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600 }}>Durée totale</div>
                <div style={{ color: '#374151', fontWeight: 600 }}>
                  {(() => {
                    const total = moteur.roadMap.reduce((acc, e) => acc + (e.dureeMinutes ?? 0), 0);
                    if (total === 0) return '—';
                    const h = Math.floor(total / 60);
                    const m = total % 60;
                    return h > 0 ? `${h}h ${m}min` : `${m} min`;
                  })()}
                </div>
              </div>
            </div>
          </Section>

          {/* Actions admin */}
          {isGestion && (
            <Section title="Actions">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {moteur.statut !== 'archive' && (
                  <button onClick={() => archiver(moteur.id)}
                    style={{ padding: '10px', borderRadius: 8, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    📦 Archiver le moteur
                  </button>
                )}
                {!confirmerSuppr ? (
                  <button onClick={() => setConfirmerSuppr(true)}
                    style={{ padding: '10px', borderRadius: 8, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>
                    🗑 Supprimer le moteur
                  </button>
                ) : (
                  <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 8, padding: 12 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#991b1b', marginBottom: 8 }}>Confirmer la suppression définitive ?</div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => setConfirmerSuppr(false)} style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', fontWeight: 600 }}>Annuler</button>
                      <button onClick={async () => { await supprimer(moteur.id); onClose(); }} style={{ flex: 1, padding: 8, borderRadius: 6, border: 'none', background: '#dc2626', color: 'white', cursor: 'pointer', fontWeight: 700 }}>Confirmer</button>
                    </div>
                  </div>
                )}
              </div>
            </Section>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Carte étape ───────────────────────────────────────────────────
function EtapeCard({ etape, employes, estAssigning, employeChoisi, setEmployeChoisi, onAssign, onCancelAssign, onDemarrer, onTerminer, onSauter, onReplanifier }: {
  etape: EtapeMoteur;
  employes: ProfileLite[];
  estAssigning: boolean;
  employeChoisi: string;
  setEmployeChoisi: (v: string) => void;
  onAssign: () => void;
  onCancelAssign: () => void;
  onDemarrer: () => void;
  onTerminer: () => void;
  onSauter: () => void;
  onReplanifier: () => void;
}) {
  const meta = getEngineEtape(etape.etapeId);
  if (!meta) return null;

  const employe = employes.find(e => e.id === etape.employeId);
  const cfg = STATUT_ETAPE_CFG[etape.statut];

  return (
    <div style={{
      border: `1px solid ${cfg.borderColor}`, borderRadius: 8, padding: 10,
      background: cfg.bg,
      display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18 }}>{meta.icon}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{meta.label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: cfg.badgeBg, color: cfg.badgeColor, textTransform: 'uppercase' }}>
          {cfg.label}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 11, color: '#6b7280' }}>#{etape.ordre}</span>
      </div>

      {(employe || etape.debut || etape.dureeMinutes) && (
        <div style={{ fontSize: 11, color: '#6b7280', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {employe && <span>👤 {employe.nom}</span>}
          {etape.debut && <span>⏱ Début {new Date(etape.debut).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}</span>}
          {etape.fin && <span>🏁 Fin {new Date(etape.fin).toLocaleString('fr-CA', { dateStyle: 'short', timeStyle: 'short' })}</span>}
          {etape.dureeMinutes !== undefined && (
            <span style={{ color: '#7c3aed', fontWeight: 700 }}>
              {etape.dureeMinutes >= 60 ? `${Math.floor(etape.dureeMinutes / 60)}h ${etape.dureeMinutes % 60}min` : `${etape.dureeMinutes} min`}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {etape.statut === 'planifie' && !estAssigning && (
          <>
            <button onClick={onAssign} style={btnAction('#3b82f6')}>▶ Démarrer</button>
            <button onClick={onSauter} style={btnAction('#9ca3af', true)}>⏭ Sauter</button>
          </>
        )}
        {etape.statut === 'planifie' && estAssigning && (
          <div style={{ display: 'flex', gap: 6, width: '100%', alignItems: 'center' }}>
            <select value={employeChoisi} onChange={e => setEmployeChoisi(e.target.value)}
              style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12, outline: 'none' }}>
              <option value="">— Choisir un mécano —</option>
              {employes.map(e => (
                <option key={e.id} value={e.id}>
                  {e.nom}{e.departement ? ` (${e.departement})` : ''}
                </option>
              ))}
            </select>
            <button onClick={onCancelAssign} style={btnAction('#9ca3af', true)}>Annuler</button>
            <button onClick={onDemarrer} disabled={!employeChoisi} style={{ ...btnAction('#22c55e'), opacity: employeChoisi ? 1 : 0.5, cursor: employeChoisi ? 'pointer' : 'not-allowed' }}>
              ✓ Confirmer
            </button>
          </div>
        )}
        {etape.statut === 'en-cours' && (
          <>
            <button onClick={onTerminer} style={btnAction('#22c55e')}>✓ Terminer</button>
            <button onClick={onReplanifier} style={btnAction('#9ca3af', true)}>↩ Annuler démarrage</button>
          </>
        )}
        {(etape.statut === 'termine' || etape.statut === 'saute') && (
          <button onClick={onReplanifier} style={btnAction('#9ca3af', true)}>↩ Re-planifier</button>
        )}
      </div>
    </div>
  );
}

// ── Helpers UI ───────────────────────────────────────────────────
const STATUT_ETAPE_CFG: Record<StatutEtapeMoteur, { label: string; bg: string; borderColor: string; badgeBg: string; badgeColor: string }> = {
  'planifie':  { label: 'Planifié',  bg: '#f8fafc', borderColor: '#e5e7eb', badgeBg: '#f3f4f6', badgeColor: '#6b7280' },
  'en-cours':  { label: 'En cours',  bg: '#eff6ff', borderColor: '#93c5fd', badgeBg: '#dbeafe', badgeColor: '#1e40af' },
  'termine':   { label: 'Terminé',   bg: '#f0fdf4', borderColor: '#86efac', badgeBg: '#dcfce7', badgeColor: '#166534' },
  'saute':     { label: 'Sauté',     bg: '#fefce8', borderColor: '#fcd34d', badgeBg: '#fef3c7', badgeColor: '#92400e' },
};

function StatutBadge({ statut }: { statut: Moteur['statut'] }) {
  const cfg = {
    'en-attente': { label: 'En attente', bg: '#fef3c7', color: '#92400e' },
    'en-cours':   { label: 'En cours',   bg: '#dbeafe', color: '#1e40af' },
    'pret':       { label: '✓ Prêt',     bg: '#dcfce7', color: '#166534' },
    'archive':    { label: 'Archivé',    bg: '#f3f4f6', color: '#6b7280' },
  }[statut];
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: cfg.bg, color: cfg.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {cfg.label}
    </span>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function KV({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: multiline ? 'flex-start' : 'center', fontSize: 13 }}>
      <span style={{ width: 100, flexShrink: 0, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ color: '#374151', fontWeight: 600, whiteSpace: multiline ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 6,
  border: '1px solid #d1d5db', fontSize: 13, outline: 'none',
  boxSizing: 'border-box', background: 'white', color: '#111827',
};

const btnLink: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, fontSize: 12, color: '#7c3aed', cursor: 'pointer', fontWeight: 600,
};

function btnAction(color: string, outline?: boolean): React.CSSProperties {
  return outline
    ? { padding: '6px 12px', borderRadius: 6, border: `1px solid ${color}`, background: 'white', color, fontWeight: 600, fontSize: 12, cursor: 'pointer' }
    : { padding: '6px 12px', borderRadius: 6, border: 'none', background: color, color: 'white', fontWeight: 700, fontSize: 12, cursor: 'pointer' };
}
