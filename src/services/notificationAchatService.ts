// ════════════════════════════════════════════════════════════════
// Service — Envoi automatique de notifications achat
// Crée les notifications en DB pour les bons utilisateurs
// selon le changement de statut.
// ════════════════════════════════════════════════════════════════
import { supabase } from '../lib/supabase';
import type { StatutAchat, RoleAchat } from '../types/achatTypes';

interface ProfileCible {
  id: string;
  rolesAchat: RoleAchat[];
}

// Charger tous les profils ayant des rôles achat
async function getProfilesAvecRoles(): Promise<ProfileCible[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, roles_achat')
    .not('roles_achat', 'is', null);
  if (error) {
    console.error('notificationAchatService.getProfilesAvecRoles:', error);
    return [];
  }
  return (data ?? [])
    .filter((p: any) => Array.isArray(p.roles_achat) && p.roles_achat.length > 0)
    .map((p: any) => ({ id: p.id, rolesAchat: p.roles_achat as RoleAchat[] }));
}

function profilesAvecRole(profiles: ProfileCible[], ...roles: RoleAchat[]): string[] {
  return profiles
    .filter(p => roles.some(r => p.rolesAchat.includes(r)))
    .map(p => p.id);
}

async function creer(destinataireId: string, achatId: string, type: string, message: string): Promise<void> {
  const { error } = await supabase
    .from('prod_achats_notifications')
    .insert({ destinataire_id: destinataireId, achat_id: achatId, type, message });
  if (error) console.error('creerNotification:', error);
}

// ── Règles de notification par transition de statut ──────────────
// Appelé après chaque changement de statut.
// achateurId = créateur de l'achat (pour les notifications personnelles)
export async function notifierChangementStatut(
  achatId: string,
  nouveauStatut: StatutAchat,
  acheteurId: string,
  camionLabel: string, // ex: "2019 Kenworth T680"
): Promise<void> {
  const profiles = await getProfilesAvecRoles();

  switch (nouveauStatut) {

    case 'evaluation-initiale': {
      // Nouveau camion entré → notifier tous les évaluateurs finaux + approbateurs
      const cibles = profilesAvecRole(profiles, 'evaluateur-final', 'approbateur-pieces', 'approbateur-vente');
      const acheteurs = profilesAvecRole(profiles, 'acheteur-principal', 'acheteur-secondaire');
      // Notifier les autres acheteurs aussi (info)
      const tous = [...new Set([...cibles, ...acheteurs])].filter(id => id !== acheteurId);
      await Promise.all(tous.map(id =>
        creer(id, achatId, 'nouveau-camion', `🚛 Nouveau camion entré : ${camionLabel}`)
      ));
      break;
    }

    case 'evaluation-finale': {
      // Évaluation initiale complétée → notifier évaluateurs finaux
      const cibles = profilesAvecRole(profiles, 'evaluateur-final');
      await Promise.all(cibles.map(id =>
        creer(id, achatId, 'evaluation-soumise', `📊 ${camionLabel} — Évaluation initiale soumise, en attente d'évaluation finale`)
      ));
      break;
    }

    case 'a-approuver': {
      // Prêt pour approbation → notifier approbateurs
      const cibles = profilesAvecRole(profiles, 'approbateur-pieces', 'approbateur-vente');
      await Promise.all(cibles.map(id =>
        creer(id, achatId, 'a-approuver', `⚖ ${camionLabel} — Prêt pour votre approbation`)
      ));
      break;
    }

    case 'approuve-a-offrir': {
      // Approuvé → notifier l'acheteur créateur
      await creer(acheteurId, achatId, 'approuve', `✅ ${camionLabel} — Approuvé ! Tu peux faire ton offre au vendeur.`);
      break;
    }

    case 'contre-offre': {
      // Contre-offre reçue → notifier approbateurs + acheteur
      const cibles = profilesAvecRole(profiles, 'approbateur-pieces', 'approbateur-vente');
      const tous = [...new Set([...cibles, acheteurId])];
      await Promise.all(tous.map(id =>
        creer(id, achatId, 'contre-offre', `🔄 ${camionLabel} — Contre-offre reçue du vendeur`)
      ));
      break;
    }

    case 'acceptee': {
      // Offre acceptée → notifier paiement admin + approbateurs
      const cibles = profilesAvecRole(profiles, 'paiement-admin', 'approbateur-pieces', 'approbateur-vente');
      await Promise.all([...new Set(cibles)].map(id =>
        creer(id, achatId, 'acceptee', `🎉 ${camionLabel} — Offre acceptée ! Paiement et récupération à coordonner.`)
      ));
      break;
    }

    case 'achete-a-payer-a-ramasser': {
      // Acheté — attente paiement → notifier paiement admin
      const cibles = profilesAvecRole(profiles, 'paiement-admin');
      await Promise.all(cibles.map(id =>
        creer(id, achatId, 'achete-a-payer', `💰 ${camionLabel} — Acheté. Paiement requis avant ramassage.`)
      ));
      break;
    }

    case 'paye-a-ramasser': {
      // Payé → notifier acheteur + conducteurs
      const conducteurs = profilesAvecRole(profiles, 'conducteur');
      const tous = [...new Set([acheteurId, ...conducteurs])];
      await Promise.all(tous.map(id =>
        creer(id, achatId, 'paye', `✓ ${camionLabel} — Payé ! Prêt pour le ramassage / towing.`)
      ));
      break;
    }

    case 'arrive': {
      // Arrivé → notifier inventaire admin
      const cibles = profilesAvecRole(profiles, 'inventaire-admin');
      await Promise.all(cibles.map(id =>
        creer(id, achatId, 'arrive', `📍 ${camionLabel} — Arrivé au garage. Transfert à l'inventaire requis.`)
      ));
      break;
    }

    case 'transferee-inventaire': {
      // Transféré → info à tous les rôles clés
      const cibles = profilesAvecRole(profiles, 'acheteur-principal', 'approbateur-pieces', 'approbateur-vente');
      await Promise.all([...new Set(cibles)].map(id =>
        creer(id, achatId, 'transfere-inventaire', `🏭 ${camionLabel} — Transféré à l'inventaire avec succès !`)
      ));
      break;
    }

    case 'refusee': {
      // Refusée → notifier acheteur
      await creer(acheteurId, achatId, 'refusee', `❌ ${camionLabel} — Offre refusée par le vendeur.`);
      break;
    }

    case 'annulee': {
      // Annulée → notifier tous les rôles principaux
      const cibles = profilesAvecRole(profiles, 'acheteur-principal', 'evaluateur-final', 'approbateur-pieces', 'approbateur-vente');
      await Promise.all([...new Set(cibles)].map(id =>
        creer(id, achatId, 'annule', `🚫 ${camionLabel} — Opportunité annulée.`)
      ));
      break;
    }
  }
}
