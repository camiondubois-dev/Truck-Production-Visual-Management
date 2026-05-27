import { useState } from 'react';

// ════════════════════════════════════════════════════════════════════
// ─── Composant Guide d'importation pas-à-pas ────────────────────────
// ════════════════════════════════════════════════════════════════════
//
// Usage : <GuideAgendrix />  dans AgendrixImporter
//         <GuideCoutsHitrac /> dans CoutsImporter
//         etc.
//
// Images : placer les screenshots dans /public/guide/
// ════════════════════════════════════════════════════════════════════

interface EtapeGuide {
  numero: number;
  titre: string;
  description: React.ReactNode;
  image?: string;    // chemin relatif ex: '/guide/agendrix-step-1.png'
  note?: React.ReactNode;
}

// ─── Composant générique ─────────────────────────────────────────────

function GuideSection({
  etapes,
  couleur = '#f97316',
  defaultOuvert = true,
}: {
  etapes: EtapeGuide[];
  couleur?: string;
  defaultOuvert?: boolean;
}) {
  const [ouvert, setOuvert] = useState(defaultOuvert);

  return (
    <div style={{
      background: 'white',
      borderRadius: 14,
      border: `1px solid ${couleur}40`,
      marginBottom: 24,
      overflow: 'hidden',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      {/* ─── En-tête cliquable ──────────────────────────────────────── */}
      <button
        onClick={() => setOuvert(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          background: `${couleur}12`,
          border: 'none',
          borderBottom: ouvert ? `1px solid ${couleur}25` : 'none',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>📖</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
            Guide d'importation — pas-à-pas
          </span>
          <span style={{
            background: couleur,
            color: 'white',
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 9px',
            borderRadius: 10,
          }}>
            {etapes.length} étapes
          </span>
        </div>
        <span style={{ fontSize: 16, color: couleur, fontWeight: 700 }}>
          {ouvert ? '▲ Masquer' : '▼ Afficher'}
        </span>
      </button>

      {/* ─── Contenu du guide ───────────────────────────────────────── */}
      {ouvert && (
        <div style={{ padding: '24px 28px' }}>
          {etapes.map((etape, idx) => (
            <div
              key={etape.numero}
              style={{
                display: 'flex',
                gap: 20,
                marginBottom: idx < etapes.length - 1 ? 32 : 0,
                paddingBottom: idx < etapes.length - 1 ? 32 : 0,
                borderBottom: idx < etapes.length - 1 ? '1px solid #f1f5f9' : 'none',
              }}
            >
              {/* Numéro rond */}
              <div style={{
                flexShrink: 0,
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: couleur,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                fontWeight: 800,
                boxShadow: `0 2px 8px ${couleur}50`,
              }}>
                {etape.numero}
              </div>

              {/* Texte + image */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                  {etape.titre}
                </div>
                <div style={{ fontSize: 13, color: '#4b5563', lineHeight: 1.7 }}>
                  {etape.description}
                </div>

                {etape.note && (
                  <div style={{
                    marginTop: 10,
                    padding: '9px 13px',
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#92400e',
                    lineHeight: 1.5,
                  }}>
                    💡 {etape.note}
                  </div>
                )}

                {etape.image && (
                  <img
                    src={etape.image}
                    alt={etape.titre}
                    style={{
                      marginTop: 14,
                      width: '100%',
                      maxWidth: 720,
                      borderRadius: 10,
                      border: '2px solid #e5e7eb',
                      boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                      display: 'block',
                    }}
                    onError={e => {
                      // Si l'image n'est pas encore en place, afficher un placeholder
                      const img = e.currentTarget;
                      img.style.display = 'none';
                      const placeholder = img.nextSibling as HTMLElement | null;
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                )}
                {/* Placeholder si image manquante */}
                {etape.image && (
                  <div style={{
                    display: 'none',
                    marginTop: 14,
                    width: '100%',
                    maxWidth: 720,
                    height: 120,
                    borderRadius: 10,
                    border: '2px dashed #d1d5db',
                    background: '#f9fafb',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 6,
                    color: '#9ca3af',
                    fontSize: 12,
                  }}>
                    <span style={{ fontSize: 28 }}>🖼️</span>
                    <span>Image à venir</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── GUIDE AGENDRIX ──────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════

export function GuideAgendrix() {
  return (
    <GuideSection
      couleur="#f97316"
      defaultOuvert={true}
      etapes={[
        {
          numero: 1,
          titre: 'Ouvrir Agendrix et aller dans Rapports → Présences',
          description: (
            <>
              Connecte-toi sur <strong>app.agendrix.com</strong>. Dans le menu à
              gauche, clique sur l'icône <strong>Rapports</strong> (le graphique
              en bas). Sur la page Rapports, clique sur la carte{' '}
              <strong>Présences</strong> (celle du milieu, avec l'horloge) — elle
              contient les heures pointées.
            </>
          ),
          image: '/guide/agendrix-step-1.png',
        },
        {
          numero: 2,
          titre: 'Sélectionner "Entrées de temps" et "Dernière semaine"',
          description: (
            <>
              Sous <strong>Choisir le type</strong>, coche{' '}
              <strong>Entrées de temps</strong> (pas "Coût de main-d'œuvre" ni
              "Absentéisme"). Dans la section <strong>Plage de dates</strong>,
              ouvre le menu déroulant et choisis <strong>Dernière semaine</strong>.
            </>
          ),
          image: '/guide/agendrix-step-2.png',
          note: 'Toujours choisir "Dernière semaine" — ne jamais entrer une plage de dates personnalisée.',
        },
        {
          numero: 3,
          titre: 'Vérifier les options et cliquer sur Exporter',
          description: (
            <>
              Descends dans la page. Assure-toi que ces éléments sont bien
              sélectionnés :{' '}
              <strong>Journée entière ✓</strong>,{' '}
              <strong>Toutes les succursales</strong>,{' '}
              <strong>Toutes les positions</strong>. Ne coche aucune autre option
              (congés seulement, coûts, etc.). Clique sur le bouton{' '}
              <strong>Exporter</strong> (bouton rouge/rose en bas à gauche).
            </>
          ),
          image: '/guide/agendrix-step-3.png',
          note: 'Si tu vois "Grouper par employé" — NE PAS cocher. Ça change le format du fichier.',
        },
        {
          numero: 4,
          titre: 'Télécharger le fichier',
          description: (
            <>
              Une fenêtre <strong>Exportation des données</strong> s'ouvre.
              Clique sur le bouton <strong>Télécharger</strong>. Le fichier
              .xlsx se télécharge dans ton dossier Téléchargements. Tu peux
              aussi cliquer sur l'icône de téléchargement de ton navigateur
              (en haut à droite) pour retrouver le fichier.
            </>
          ),
          image: '/guide/agendrix-step-4.png',
        },
        {
          numero: 5,
          titre: 'Déposer le fichier dans l\'application',
          description: (
            <>
              Le fichier s'appelle{' '}
              <code
                style={{
                  background: '#f1f5f9',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                Agendrix_-_entrees-de-temps__AAAA-MM-JJ_au_AAAA-MM-JJ.xlsx
              </code>
              . Glisse ce fichier dans la zone de dépôt ci-dessous, ou clique
              dessus pour parcourir tes fichiers et le sélectionner.
            </>
          ),
          image: '/guide/agendrix-step-5.png',
          note: 'Ne renomme pas le fichier — l\'application détecte la période automatiquement à partir du nom.',
        },
      ]}
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── GUIDES HITRAC (à compléter avec screenshots iTrack) ────────────
// ════════════════════════════════════════════════════════════════════

export function GuideCoutsHitrac() {
  return (
    <GuideSection
      couleur="#3b82f6"
      defaultOuvert={false}
      etapes={[
        {
          numero: 1,
          titre: 'Ouvrir iTrack et aller dans Reports',
          description: <>Connecte-toi dans <strong>iTrack</strong>. Dans le menu principal, clique sur <strong>Reports</strong>.</>,
          image: '/guide/hitrac-couts-step-1.png',
        },
        {
          numero: 2,
          titre: 'Sélectionner le rapport "Vehicle Cost Detail"',
          description: <>Dans la liste des rapports, trouve et sélectionne <strong>Vehicle Cost Detail</strong>.</>,
          image: '/guide/hitrac-couts-step-2.png',
        },
        {
          numero: 3,
          titre: 'Configurer et exporter en CSV',
          description: <>Configure le rapport selon les filtres voulus, puis clique sur <strong>Export</strong> → <strong>CSV</strong>. Le fichier s'appelle <code>vehiclecostdetail.csv</code>.</>,
          image: '/guide/hitrac-couts-step-3.png',
          note: 'Format attendu : vehiclecostdetail.csv',
        },
        {
          numero: 4,
          titre: 'Déposer le fichier dans l\'application',
          description: <>Glisse le fichier <code>vehiclecostdetail.csv</code> dans la zone de dépôt ci-dessous.</>,
          image: '/guide/hitrac-couts-step-4.png',
        },
      ]}
    />
  );
}

export function GuideVentesEauDetail() {
  return (
    <GuideSection
      couleur="#0ea5e9"
      defaultOuvert={false}
      etapes={[
        {
          numero: 1,
          titre: 'Ouvrir iTrack et aller dans Reports',
          description: <>Dans <strong>iTrack</strong>, clique sur <strong>Reports</strong>.</>,
          image: '/guide/hitrac-ventes-step-1.png',
        },
        {
          numero: 2,
          titre: 'Sélectionner "Sales by Inventory Type"',
          description: <>Trouve et sélectionne le rapport <strong>Sales by Inventory Type</strong>.</>,
          image: '/guide/hitrac-ventes-eau-step-2.png',
        },
        {
          numero: 3,
          titre: 'Filtrer sur Inventory Type 9000',
          description: <>Filtre sur <strong>Inventory Type 9000 — Vehicle For Sale</strong>. Exporte en CSV (<code>salesbyinventorytype.csv</code>).</>,
          image: '/guide/hitrac-ventes-eau-step-3.png',
          note: 'Type 9000 = Camions eau et détail. Ne pas confondre avec 9025 (exportation).',
        },
        {
          numero: 4,
          titre: 'Déposer le fichier dans l\'application',
          description: <>Glisse le fichier CSV dans la zone de dépôt ci-dessous.</>,
        },
      ]}
    />
  );
}

export function GuideVentesExportation() {
  return (
    <GuideSection
      couleur="#7c3aed"
      defaultOuvert={false}
      etapes={[
        {
          numero: 1,
          titre: 'Ouvrir iTrack → Reports → Sales by Inventory Type',
          description: <>Dans <strong>iTrack</strong>, ouvre <strong>Reports</strong> et sélectionne <strong>Sales by Inventory Type</strong>.</>,
          image: '/guide/hitrac-ventes-step-1.png',
        },
        {
          numero: 2,
          titre: 'Filtrer sur Inventory Type 9025',
          description: <>Filtre sur <strong>Inventory Type 9025 — Export Vehicles</strong>. Exporte en CSV.</>,
          image: '/guide/hitrac-ventes-export-step-2.png',
          note: 'Type 9025 = camions vendus à l\'exportation uniquement.',
        },
        {
          numero: 3,
          titre: 'Déposer le fichier dans l\'application',
          description: <>Glisse le fichier CSV dans la zone de dépôt ci-dessous.</>,
        },
      ]}
    />
  );
}

export function GuideVentesEncan() {
  return (
    <GuideSection
      couleur="#f59e0b"
      defaultOuvert={false}
      etapes={[
        {
          numero: 1,
          titre: 'Ouvrir iTrack → Reports → Sales by Customer',
          description: <>Dans <strong>iTrack</strong>, ouvre <strong>Reports</strong> et sélectionne <strong>Sales by Customer</strong>.</>,
          image: '/guide/hitrac-ventes-step-1.png',
        },
        {
          numero: 2,
          titre: 'Filtrer sur le client encanteur (Ritchie Bros, etc.)',
          description: <>Dans les filtres, sélectionne le client encanteur (ex. <strong>Ritchie Bros</strong>). Exporte en CSV (<code>salesbycustomer.csv</code>).</>,
          image: '/guide/hitrac-encan-step-2.png',
          note: 'L\'application ignore automatiquement les pièces (suffixe -X) — tu n\'as pas à les retirer manuellement.',
        },
        {
          numero: 3,
          titre: 'Déposer le fichier dans l\'application',
          description: <>Glisse le fichier CSV dans la zone de dépôt ci-dessous.</>,
        },
      ]}
    />
  );
}

export function GuideVentesPieces() {
  return (
    <GuideSection
      couleur="#10b981"
      defaultOuvert={false}
      etapes={[
        {
          numero: 1,
          titre: 'Ouvrir Hightrack → Sales Orders (rapport par vendeur ou combiné)',
          description: <>Dans <strong>Hightrack</strong>, génère le rapport <strong>Sales Orders</strong>. Exporte en CSV.</>,
          image: '/guide/hitrac-pieces-step-1.png',
        },
        {
          numero: 2,
          titre: 'Télécharger le fichier CSV',
          description: <>Le rapport peut être <strong>combiné</strong> (avec colonne Counterperson) ou <strong>par vendeur</strong> (ancien format). Les deux sont acceptés.</>,
          image: '/guide/hitrac-pieces-step-2.png',
          note: 'Nouveau format (avec Counterperson) : sélectionne "Rapport combiné ✦" dans l\'application. Ancien format : sélectionne le vendeur correspondant.',
        },
        {
          numero: 3,
          titre: 'Déposer le fichier dans l\'application',
          description: <>Glisse le fichier CSV dans la zone de dépôt ci-dessous.</>,
        },
      ]}
    />
  );
}
