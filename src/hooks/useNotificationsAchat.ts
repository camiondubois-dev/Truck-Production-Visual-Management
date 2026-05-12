// ════════════════════════════════════════════════════════════════
// Hook — Notifications achat en temps réel pour un utilisateur
// ════════════════════════════════════════════════════════════════
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { achatService } from '../services/achatService';
import type { NotificationAchat } from '../types/achatTypes';

export function useNotificationsAchat(profileId: string) {
  const [notifications, setNotifications] = useState<NotificationAchat[]>([]);
  const [loading, setLoading] = useState(true);

  const charger = useCallback(async () => {
    if (!profileId) return;
    try {
      // Charger les 30 dernières (lues + non lues) pour l'historique
      const { data, error } = await supabase
        .from('prod_achats_notifications')
        .select('*')
        .eq('destinataire_id', profileId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      setNotifications((data ?? []).map((row: any) => ({
        id: row.id,
        destinataireId: row.destinataire_id,
        achatId: row.achat_id,
        type: row.type,
        message: row.message ?? undefined,
        lu: row.lu ?? false,
        emailEnvoye: row.email_envoye ?? false,
        createdAt: row.created_at,
        luAt: row.lu_at ?? undefined,
      })));
    } catch (e) {
      console.error('useNotificationsAchat:', e);
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  useEffect(() => {
    charger();

    // Abonnement temps réel Supabase
    const channel = supabase
      .channel(`notifs-achat-${profileId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'prod_achats_notifications',
        filter: `destinataire_id=eq.${profileId}`,
      }, (payload) => {
        const row = payload.new as any;
        const notif: NotificationAchat = {
          id: row.id,
          destinataireId: row.destinataire_id,
          achatId: row.achat_id,
          type: row.type,
          message: row.message ?? undefined,
          lu: row.lu ?? false,
          emailEnvoye: row.email_envoye ?? false,
          createdAt: row.created_at,
          luAt: row.lu_at ?? undefined,
        };
        setNotifications(prev => [notif, ...prev]);

        // Notification navigateur si l'app est en arrière-plan
        if (document.visibilityState === 'hidden' && 'Notification' in window && Notification.permission === 'granted') {
          new Notification('Camion Dubois — Achats', {
            body: notif.message ?? labelTypeNotif(notif.type),
            icon: '/icons/icon-192.png',
            tag: notif.achatId, // évite les doublons pour le même camion
          });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profileId, charger]);

  const marquerLue = async (notifId: string) => {
    await achatService.marquerLue(notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, lu: true, luAt: new Date().toISOString() } : n));
  };

  const marquerToutesLues = async () => {
    const nonLues = notifications.filter(n => !n.lu);
    await Promise.all(nonLues.map(n => achatService.marquerLue(n.id)));
    setNotifications(prev => prev.map(n => ({ ...n, lu: true, luAt: n.luAt ?? new Date().toISOString() })));
  };

  const nonLues = notifications.filter(n => !n.lu);

  return { notifications, nonLues, loading, marquerLue, marquerToutesLues, recharger: charger };
}

export function labelTypeNotif(type: string): string {
  const labels: Record<string, string> = {
    'nouveau-camion':         '🚛 Nouveau camion entré — à évaluer',
    'evaluation-soumise':     '📊 Évaluation soumise — à approuver',
    'a-approuver':            '⚖ Camion prêt pour approbation',
    'approuve':               '✅ Camion approuvé — prêt à offrir',
    'offre-faite':            '📤 Offre envoyée au vendeur',
    'contre-offre':           '🔄 Contre-offre reçue du vendeur',
    'acceptee':               '🎉 Offre acceptée — à finaliser',
    'refusee':                '❌ Offre refusée',
    'achete-a-payer':         '💰 Camion acheté — paiement requis',
    'paye':                   '✓ Paiement confirmé — à ramasser',
    'arrive':                 '📍 Camion arrivé — à transférer',
    'transfere-inventaire':   '🏭 Transféré à l\'inventaire',
    'annule':                 '🚫 Opportunité annulée',
  };
  return labels[type] ?? `Mise à jour : ${type}`;
}

/** Demande la permission navigateur pour les notifications push */
export async function demanderPermissionNotifications(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}
