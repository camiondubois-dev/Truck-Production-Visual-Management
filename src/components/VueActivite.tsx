import { useState, useEffect, useCallback } from 'react';
import { activiteService, type PresenceRecord, type ActiviteRecord } from '../services/activiteService';
import { PAGE_LABELS } from '../hooks/useActiviteTracker';

const ONLINE_SEUIL_MS  = 3 * 60 * 1000;   // 3 min = en ligne
const RECENTE_SEUIL_MS = 24 * 60 * 60 * 1000; // 24h = récemment actif

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  'gestion':       { label: 'Gestion',       color: '#6366f1' },
  'planification': { label: 'Planification', color: '#f59e0b' },
  'employe':       { label: 'Employé',       color: '#22c55e' },
  'tv':            { label: 'Acheteur (PIN)', color: '#10b981' },
  'acheteur':      { label: 'Acheteur',      color: '#10b981' },
};

const APP_LABELS: Record<string, string> = {
  'desktop':       'Bureau',
  'mobile-achats': 'Mobile',
  'terrain':       'Terrain',
  'tv':            'TV',
};

function tempsDepuis(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60)  return `il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

function formatHeure(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

function il_y_a_7_jours(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

// ── Carte utilisateur (temps réel) ───────────────────────────────
function CartePresence({ record, enLigne }: { record: PresenceRecord; enLigne: boolean }) {
  const roleInfo = ROLE_LABELS[record.utilisateur_role] ?? { label: record.utilisateur_role, color: '#94a3b8' };
  const initiale = record.utilisateur_nom.charAt(0).toUpperCase();

  return (
    <div style={{
      background: enLigne ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
      border: `1px solid ${enLigne ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 14, padding: '16px 18px',
      display: 'flex', gap: 14, alignItems: 'flex-start',
      opacity: enLigne ? 1 : 0.5,
    }}>
      {/* Avatar */}
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: enLigne ? `${roleInfo.color}30` : 'rgba(255,255,255,0.05)',
        border: `2px solid ${enLigne ? roleInfo.color : 'rgba(255,255,255,0.1)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 17, fontWeight: 800, color: enLigne ? roleInfo.color : 'rgba(255,255,255,0.3)',
      }}>
        {initiale}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {/* Dot en ligne */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: enLigne ? '#10b981' : '#6b7280',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: 15, fontWeight: 700, color: 'white' }}>
            {record.utilisateur_nom}
          </span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 6,
            background: `${roleInfo.color}20`, color: roleInfo.color,
            textTransform: 'uppercase', letterSpacing: '0.05em',
          }}>
            {roleInfo.label}
          </span>
        </div>

        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>
          {record.page_label}
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
            {APP_LABELS[record.app] ?? record.app}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)' }}>·</span>
          <span style={{ fontSize: 11, color: enLigne ? 'rgba(16,185,129,0.8)' : 'rgba(255,255,255,0.3)' }}>
            {enLigne ? tempsDepuis(record.updated_at) : `Vu ${tempsDepuis(record.updated_at)}`}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Onglet Temps réel ─────────────────────────────────────────────
function OngletTempsReel() {
  const [presence, setPresence] = useState<PresenceRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const charger = useCallback(async () => {
    const data = await activiteService.getPresence();
    setPresence(data);
    setLastRefresh(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    charger();
    const t = setInterval(charger, 15_000);
    return () => clearInterval(t);
  }, [charger]);

  const maintenant = Date.now();
  const enLigne    = presence.filter(p => maintenant - new Date(p.updated_at).getTime() < ONLINE_SEUIL_MS);
  const recents    = presence.filter(p => {
    const diff = maintenant - new Date(p.updated_at).getTime();
    return diff >= ONLINE_SEUIL_MS && diff < RECENTE_SEUIL_MS;
  });

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Chargement…</div>;
  }

  return (
    <div>
      {/* Titre + refresh */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: '#10b981',
            boxShadow: '0 0 8px #10b981',
          }} />
          <span style={{ fontSize: 16, fontWeight: 700, color: 'white' }}>
            {enLigne.length === 0 ? 'Personne en ligne' :
             enLigne.length === 1 ? '1 utilisateur en ligne' :
             `${enLigne.length} utilisateurs en ligne`}
          </span>
        </div>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>
          Rafraîchi {tempsDepuis(lastRefresh.toISOString())}
        </span>
      </div>

      {/* En ligne */}
      {enLigne.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 32 }}>
          {enLigne.map(r => <CartePresence key={r.utilisateur_nom} record={r} enLigne={true} />)}
        </div>
      )}

      {enLigne.length === 0 && (
        <div style={{
          padding: '40px 0', textAlign: 'center',
          color: 'rgba(255,255,255,0.25)', fontSize: 14, marginBottom: 24,
        }}>
          Aucun utilisateur actif en ce moment
        </div>
      )}

      {/* Récemment actifs */}
      {recents.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Récemment actifs (dernières 24h)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
            {recents.map(r => <CartePresence key={r.utilisateur_nom} record={r} enLigne={false} />)}
          </div>
        </>
      )}
    </div>
  );
}

// ── Onglet Historique ─────────────────────────────────────────────
function OngletHistorique() {
  const [logs, setLogs]           = useState<ActiviteRecord[]>([]);
  const [loading, setLoading]     = useState(false);
  const [dateDebut, setDateDebut] = useState(il_y_a_7_jours());
  const [dateFin, setDateFin]     = useState(aujourdhui());
  const [filtreUser, setFiltreUser]     = useState('');
  const [filtrePage, setFiltrePage]     = useState('');
  const [utilisateurs, setUtilisateurs] = useState<string[]>([]);

  const charger = useCallback(async () => {
    setLoading(true);
    const [data, users] = await Promise.all([
      activiteService.getHistorique({ dateDebut, dateFin, utilisateur: filtreUser || undefined, pageId: filtrePage || undefined }),
      activiteService.getUtilisateursDistincts(),
    ]);
    setLogs(data);
    setUtilisateurs(users);
    setLoading(false);
  }, [dateDebut, dateFin, filtreUser, filtrePage]);

  useEffect(() => { charger(); }, [charger]);

  const pagesDisponibles = [...new Set(Object.entries(PAGE_LABELS).map(([id, label]) => ({ id, label })))];

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, color: 'white',
    padding: '7px 10px', fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
    outline: 'none',
  };

  return (
    <div>
      {/* Filtres */}
      <div style={{
        display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center',
        marginBottom: 20, padding: '14px 16px',
        background: 'rgba(255,255,255,0.03)', borderRadius: 12,
        border: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Du</span>
          <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={inputStyle} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Au</span>
          <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={inputStyle} />
        </div>

        <select value={filtreUser} onChange={e => setFiltreUser(e.target.value)} style={inputStyle}>
          <option value="">Tous les utilisateurs</option>
          {utilisateurs.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <select value={filtrePage} onChange={e => setFiltrePage(e.target.value)} style={inputStyle}>
          <option value="">Toutes les pages</option>
          {pagesDisponibles.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>

        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>
          {loading ? 'Chargement…' : `${logs.length} entrée${logs.length !== 1 ? 's' : ''}`}
        </div>
      </div>

      {/* Table */}
      <div style={{ borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '160px 1fr 1fr 180px 90px',
          padding: '10px 16px', background: 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          {['Date / Heure', 'Utilisateur', 'Page', 'Application', 'Rôle'].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 'calc(100vh - 320px)', overflowY: 'auto' }}>
          {loading && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>Chargement…</div>
          )}
          {!loading && logs.length === 0 && (
            <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 14 }}>
              Aucune activité pour cette période
            </div>
          )}
          {!loading && logs.map((log, i) => {
            const roleInfo = ROLE_LABELS[log.utilisateur_role] ?? { label: log.utilisateur_role, color: '#94a3b8' };
            return (
              <div key={log.id} style={{
                display: 'grid', gridTemplateColumns: '160px 1fr 1fr 180px 90px',
                padding: '10px 16px',
                background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: 13, color: 'white', fontVariantNumeric: 'tabular-nums', fontFamily: 'monospace' }}>
                    {formatHeure(log.created_at)}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                    {formatDate(log.created_at)}
                  </div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>
                  {log.utilisateur_nom}
                </div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>
                  {log.page_label}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {APP_LABELS[log.app] ?? log.app}
                </div>
                <div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 5,
                    background: `${roleInfo.color}20`, color: roleInfo.color,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────
export function VueActivite() {
  const [onglet, setOnglet] = useState<'realtime' | 'historique'>('realtime');

  const btnOnglet = (id: 'realtime' | 'historique', label: string) => (
    <button
      onClick={() => setOnglet(id)}
      style={{
        padding: '8px 20px', borderRadius: 8, cursor: 'pointer',
        fontSize: 13, fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
        background: onglet === id ? 'rgba(6,182,212,0.15)' : 'transparent',
        border: onglet === id ? '1px solid rgba(6,182,212,0.4)' : '1px solid rgba(255,255,255,0.08)',
        color: onglet === id ? '#06b6d4' : 'rgba(255,255,255,0.45)',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{
      height: '100%', overflowY: 'auto',
      background: '#0f0e0b', padding: '28px 32px',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {/* En-tête */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: 'white' }}>
          👁️ Activité utilisateurs
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
          Qui travaille en ce moment et historique de navigation
        </p>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {btnOnglet('realtime',   '🟢 En ligne maintenant')}
        {btnOnglet('historique', '📅 Historique')}
      </div>

      {onglet === 'realtime'   && <OngletTempsReel />}
      {onglet === 'historique' && <OngletHistorique />}
    </div>
  );
}
