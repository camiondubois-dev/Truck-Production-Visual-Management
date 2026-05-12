// Edge Function — Envoie un email aux approbateurs quand un camion est soumis
// Déclenchée depuis le frontend via supabase.functions.invoke()
// Utilise Resend (resend.com) pour l'envoi d'emails

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!;
const SUPABASE_URL   = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { achatId, acheteurNom, camionLabel, prixDemande, lieuLocalisation } = await req.json();

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Récupérer les emails des approbateurs
    const { data: approbateurs } = await supabase
      .from('profiles')
      .select('id, nom, email')
      .or('roles_achat.cs.{approbateur-vente},roles_achat.cs.{approbateur-pieces}');

    if (!approbateurs || approbateurs.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const appUrl = 'https://truck-production.netlify.app/achats';
    const prixFormate = prixDemande
      ? new Intl.NumberFormat('fr-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(prixDemande)
      : 'Non spécifié';

    let sent = 0;
    for (const appro of approbateurs) {
      if (!appro.email) continue;

      const html = `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:520px;margin:32px auto;background:white;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#0f172a;padding:28px 28px 20px;border-bottom:4px solid #10b981;">
      <div style="font-size:13px;color:#10b981;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px;">Camion Dubois · Module Achats</div>
      <div style="font-size:22px;font-weight:900;color:white;">🚛 Nouveau camion à approuver</div>
    </div>

    <!-- Corps -->
    <div style="padding:24px 28px;">
      <div style="font-size:15px;color:#374151;margin-bottom:20px;line-height:1.5;">
        Bonjour <strong>${appro.nom ?? 'approbateur'}</strong>,<br>
        <strong>${acheteurNom}</strong> a soumis une nouvelle opportunité d'achat qui attend ton approbation.
      </div>

      <!-- Camion card -->
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-left:5px solid #10b981;border-radius:10px;padding:18px;margin-bottom:20px;">
        <div style="font-size:20px;font-weight:900;color:#0f172a;margin-bottom:10px;">${camionLabel}</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr>
            <td style="color:#9ca3af;font-weight:600;text-transform:uppercase;font-size:11px;padding:4px 0;width:110px;">Prix demandé</td>
            <td style="color:#0f172a;font-weight:800;font-size:16px;">${prixFormate}</td>
          </tr>
          ${lieuLocalisation ? `<tr>
            <td style="color:#9ca3af;font-weight:600;text-transform:uppercase;font-size:11px;padding:4px 0;">Lieu</td>
            <td style="color:#374151;font-weight:600;">${lieuLocalisation}</td>
          </tr>` : ''}
          <tr>
            <td style="color:#9ca3af;font-weight:600;text-transform:uppercase;font-size:11px;padding:4px 0;">Soumis par</td>
            <td style="color:#374151;font-weight:600;">${acheteurNom}</td>
          </tr>
        </table>
      </div>

      <!-- Bouton -->
      <a href="${appUrl}" style="display:block;background:#10b981;color:white;text-decoration:none;text-align:center;padding:16px;border-radius:12px;font-size:16px;font-weight:800;letter-spacing:0.02em;">
        👉 Ouvrir l'app pour approuver
      </a>

      <div style="margin-top:16px;font-size:12px;color:#9ca3af;text-align:center;">
        Entre ton PIN dans l'app · Vas dans "🎯 Mes actions"
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:14px 28px;border-top:1px solid #e5e7eb;">
      <div style="font-size:11px;color:#9ca3af;text-align:center;">Camion Dubois — Système de gestion des achats</div>
    </div>
  </div>
</body>
</html>`;

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Camion Dubois Achats <onboarding@resend.dev>',
          to: [appro.email],
          subject: `🚛 À approuver : ${camionLabel} — ${prixFormate}`,
          html,
        }),
      });
      sent++;
    }

    return new Response(JSON.stringify({ sent }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
