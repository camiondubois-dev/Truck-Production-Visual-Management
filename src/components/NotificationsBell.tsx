// ════════════════════════════════════════════════════════════════
// Cloche Notifications — module achats
// ════════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { useNotificationsAchat, labelTypeNotif, demanderPermissionNotifications } from '../hooks/useNotificationsAchat';

const COULEUR = '#10b981';

function tempsRelatif(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const j = Math.floor(h / 24);
  return `Il y a ${j}j`;
}

export function NotificationsBell({
  profileId,
  onOuvrirAchat,
}: {
  profileId: string;
  onOuvrirAchat?: (achatId: string) => void;
}) {
  const { notifications, nonLues, marquerLue, marquerToutesLues } = useNotificationsAchat(profileId);
  const [ouvert, setOuvert] = useState(false);
  const [permDemandee, setPermDemandee] = useState(false);

  // Demander permission notifications au premier clic si pas encore demandée
  const handleOuvrir = async () => {
    setOuvert(v => !v);
    if (!permDemandee && 'Notification' in window && Notification.permission === 'default') {
      setPermDemandee(true);
      await demanderPermissionNotifications();
    }
  };

  // Fermer en cliquant ailleurs
  useEffect(() => {
    if (!ouvert) return;
    const handler = () => setOuvert(false);
    setTimeout(() => document.addEventListener('click', handler), 50);
    return () => document.removeEventListener('click', handler);
  }, [ouvert]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Bouton cloche */}
      <button
        onClick={handleOuvrir}
        style={{
          background: ouvert ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.08)',
          border: ouvert ? `1px solid ${COULEUR}` : '1px solid rgba(255,255,255,0.15)',
          width: 44, height: 44, borderRadius: 12,
          color: ouvert ? COULEUR : 'white',
          fontSize: 20, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', flexShrink: 0,
          transition: 'all 0.15s',
        }}>
        🔔
        {nonLues.length > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            background: '#ef4444', color: 'white',
            borderRadius: 10, minWidth: 20, height: 20,
            fontSize: 11, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '0 5px',
            border: '2px solid #0f172a',
          }}>
            {nonLues.length > 9 ? '9+' : nonLues.length}
          </span>
        )}
      </button>

      {/* Panneau notifications */}
      {ouvert && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0,
            zIndex: 300,
            background: 'white',
            boxShadow: '0 8px 40px rgba(0,0,0,0.20)',
            borderBottom: `3px solid ${COULEUR}`,
            maxHeight: '70dvh',
            display: 'flex', flexDirection: 'column',
          }}>
          {/* Entête */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 16px 12px',
            borderBottom: '1px solid #f1f5f9',
          }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>🔔 Notifications</div>
              {nonLues.length > 0 && (
                <div style={{ fontSize: 13, color: '#ef4444', fontWeight: 600, marginTop: 2 }}>
                  {nonLues.length} non lue{nonLues.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {nonLues.length > 0 && (
                <button
                  onClick={marquerToutesLues}
                  style={{ fontSize: 13, color: COULEUR, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, padding: '6px 10px', borderRadius: 8, background: `${COULEUR}12` }}>
                  Tout lire
                </button>
              )}
              <button onClick={() => setOuvert(false)}
                style={{ background: '#f1f5f9', border: 'none', width: 36, height: 36, borderRadius: 10, fontSize: 18, cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ✕
              </button>
            </div>
          </div>

          {/* Liste */}
          <div style={{ overflowY: 'auto', flex: 1, WebkitOverflowScrolling: 'touch' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '40px 16px', textAlign: 'center', color: '#94a3b8' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>🔕</div>
                <div style={{ fontSize: 15, fontWeight: 600 }}>Aucune notification</div>
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.lu) marquerLue(n.id);
                    if (onOuvrirAchat) onOuvrirAchat(n.achatId);
                    setOuvert(false);
                  }}
                  style={{
                    display: 'flex', gap: 12, padding: '14px 16px',
                    borderBottom: '1px solid #f8fafc',
                    background: n.lu ? 'white' : '#f0fdf4',
                    cursor: 'pointer',
                    transition: 'background 0.1s',
                  }}>
                  {/* Pastille non-lue */}
                  <div style={{ paddingTop: 3, flexShrink: 0 }}>
                    <div style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: n.lu ? '#e2e8f0' : COULEUR,
                      marginTop: 2,
                    }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: n.lu ? 500 : 700, color: '#0f172a', lineHeight: 1.4 }}>
                      {n.message || labelTypeNotif(n.type)}
                    </div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 3 }}>
                      {tempsRelatif(n.createdAt)}
                    </div>
                  </div>
                  <div style={{ fontSize: 18, color: '#cbd5e1', flexShrink: 0, alignSelf: 'center' }}>›</div>
                </div>
              ))
            )}
          </div>

          {/* Footer info permission */}
          {'Notification' in window && Notification.permission !== 'granted' && (
            <div
              onClick={demanderPermissionNotifications}
              style={{
                padding: '12px 16px',
                background: '#fffbeb', borderTop: '1px solid #fde68a',
                fontSize: 13, color: '#92400e', fontWeight: 600,
                cursor: 'pointer', textAlign: 'center',
              }}>
              📲 Activer les notifications push →
            </div>
          )}
        </div>
      )}
    </div>
  );
}
