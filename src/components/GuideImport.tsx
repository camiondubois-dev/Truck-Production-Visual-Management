import { useState, useEffect, useCallback } from 'react';

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

// ─── Lightbox plein écran ─────────────────────────────────────────────

interface ImageLightbox { src: string; titre: string; numero: number }

function Lightbox({ images, index, onClose, onNav }: {
  images: ImageLightbox[];
  index: number;
  onClose: () => void;
  onNav: (i: number) => void;
}) {
  const img = images[index];

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowRight' && index < images.length - 1) onNav(index + 1);
    if (e.key === 'ArrowLeft'  && index > 0)                  onNav(index - 1);
  }, [index, images.length, onClose, onNav]);

  useEffect(() => {
    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [handleKey]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.92)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      {/* Bouton fermer */}
      <button onClick={onClose} style={{
        position: 'absolute', top: 18, right: 22,
        background: 'rgba(255,255,255,0.12)', border: 'none', color: 'white',
        fontSize: 24, width: 42, height: 42, borderRadius: '50%',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        lineHeight: 1,
      }}>✕</button>

      {/* Légende */}
      <div style={{
        position: 'absolute', top: 22, left: 0, right: 0,
        textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 13,
        pointerEvents: 'none',
      }}>
        Étape {img.numero} — {img.titre}
        <span style={{ marginLeft: 12, opacity: 0.5 }}>
          {index + 1} / {images.length}
        </span>
      </div>

      {/* Flèche gauche */}
      {index > 0 && (
        <button onClick={e => { e.stopPropagation(); onNav(index - 1); }} style={{
          position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
          fontSize: 28, width: 52, height: 52, borderRadius: '50%',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        >‹</button>
      )}

      {/* Image */}
      <img
        src={img.src}
        alt={img.titre}
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw', maxHeight: '85vh',
          borderRadius: 10,
          boxShadow: '0 8px 48px rgba(0,0,0,0.6)',
          objectFit: 'contain',
        }}
      />

      {/* Flèche droite */}
      {index < images.length - 1 && (
        <button onClick={e => { e.stopPropagation(); onNav(index + 1); }} style={{
          position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
          background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white',
          fontSize: 28, width: 52, height: 52, borderRadius: '50%',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.28)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.15)')}
        >›</button>
      )}

      {/* Points de navigation en bas */}
      {images.length > 1 && (
        <div style={{
          position: 'absolute', bottom: 20, left: 0, right: 0,
          display: 'flex', justifyContent: 'center', gap: 8,
        }}>
          {images.map((_, i) => (
            <button key={i} onClick={e => { e.stopPropagation(); onNav(i); }} style={{
              width: i === index ? 22 : 8, height: 8, borderRadius: 4,
              background: i === index ? 'white' : 'rgba(255,255,255,0.35)',
              border: 'none', cursor: 'pointer', padding: 0,
              transition: 'all 0.2s',
            }} />
          ))}
        </div>
      )}

      {/* Hint clavier */}
      <div style={{
        position: 'absolute', bottom: 44, left: 0, right: 0,
        textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11,
        pointerEvents: 'none',
      }}>
        ← → pour naviguer · Échap pour fermer
      </div>
    </div>
  );
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
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Liste ordonnée des images avec leur contexte (pour la navigation lightbox)
  const images: ImageLightbox[] = etapes
    .filter(e => !!e.image)
    .map(e => ({ src: e.image!, titre: e.titre, numero: e.numero }));

  // Index dans le tableau `images` pour une étape donnée
  const imageIdx = (etape: EtapeGuide) =>
    images.findIndex(img => img.src === etape.image && img.numero === etape.numero);

  return (
    <>
      <div style={{
        background: 'white',
        borderRadius: 14,
        border: `1px solid ${couleur}40`,
        marginBottom: 24,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        {/* ─── En-tête cliquable ────────────────────────────────────── */}
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
              background: couleur, color: 'white',
              fontSize: 11, fontWeight: 700,
              padding: '2px 9px', borderRadius: 10,
            }}>
              {etapes.length} étapes
            </span>
          </div>
          <span style={{ fontSize: 16, color: couleur, fontWeight: 700 }}>
            {ouvert ? '▲ Masquer' : '▼ Afficher'}
          </span>
        </button>

        {/* ─── Contenu ──────────────────────────────────────────────── */}
        {ouvert && (
          <div style={{ padding: '24px 28px' }}>
            {etapes.map((etape, idx) => (
              <div
                key={etape.numero}
                style={{
                  display: 'flex', gap: 20,
                  marginBottom: idx < etapes.length - 1 ? 32 : 0,
                  paddingBottom: idx < etapes.length - 1 ? 32 : 0,
                  borderBottom: idx < etapes.length - 1 ? '1px solid #f1f5f9' : 'none',
                }}
              >
                {/* Numéro rond */}
                <div style={{
                  flexShrink: 0, width: 38, height: 38, borderRadius: '50%',
                  background: couleur, color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17, fontWeight: 800,
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
                      marginTop: 10, padding: '9px 13px',
                      background: '#fffbeb', border: '1px solid #fde68a',
                      borderRadius: 8, fontSize: 12, color: '#92400e', lineHeight: 1.5,
                    }}>
                      💡 {etape.note}
                    </div>
                  )}

                  {/* Image cliquable */}
                  {etape.image && (
                    <div style={{ marginTop: 14, position: 'relative', display: 'inline-block', maxWidth: '100%' }}>
                      <img
                        src={etape.image}
                        alt={etape.titre}
                        onClick={() => setLightboxIdx(imageIdx(etape))}
                        style={{
                          width: '100%', maxWidth: 820,
                          borderRadius: 10,
                          border: `2px solid ${couleur}40`,
                          boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
                          display: 'block',
                          cursor: 'zoom-in',
                          transition: 'box-shadow 0.15s, transform 0.15s',
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLImageElement).style.boxShadow = '0 8px 28px rgba(0,0,0,0.18)';
                          (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.005)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLImageElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.10)';
                          (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)';
                        }}
                        onError={e => {
                          const img = e.currentTarget;
                          img.style.display = 'none';
                          const ph = img.parentElement?.nextElementSibling as HTMLElement | null;
                          if (ph) ph.style.display = 'flex';
                        }}
                      />
                      {/* Hint zoom */}
                      <div style={{
                        position: 'absolute', bottom: 8, right: 10,
                        background: 'rgba(0,0,0,0.55)', color: 'white',
                        fontSize: 11, fontWeight: 600,
                        padding: '3px 8px', borderRadius: 6,
                        pointerEvents: 'none',
                      }}>
                        🔍 Cliquer pour agrandir
                      </div>
                    </div>
                  )}
                  {/* Placeholder si image manquante */}
                  {etape.image && (
                    <div style={{
                      display: 'none', marginTop: 14,
                      width: '100%', maxWidth: 820, height: 120, borderRadius: 10,
                      border: '2px dashed #d1d5db', background: '#f9fafb',
                      alignItems: 'center', justifyContent: 'center',
                      flexDirection: 'column', gap: 6, color: '#9ca3af', fontSize: 12,
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

      {/* ─── Lightbox ─────────────────────────────────────────────────── */}
      {lightboxIdx !== null && (
        <Lightbox
          images={images}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onNav={setLightboxIdx}
        />
      )}
    </>
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
          titre: 'Ouvrir iTrack → Report Viewer → Inventory → Vehicle Cost Detail',
          description: (
            <>
              Ouvre <strong>iTrack Enterprise</strong>. Dans le menu de gauche, clique sur{' '}
              <strong>Report Viewer</strong>. Dans la liste, déroule la section{' '}
              <strong>Inventory</strong>. Clique sur <strong>Vehicle Cost Detail</strong>{' '}
              (il se met en surbrillance bleue). Paramètres en bas :{' '}
              Part Type = <strong>9025 : Export Vehicles</strong>,{' '}
              Store = <strong>1 : Camions A & R Dubois inc.</strong>,{' '}
              Sort By = <strong>Stock #</strong>. Clique sur <strong>Preview</strong>.
            </>
          ),
          image: '/guide/hitrac-couts-step-1.png',
        },
        {
          numero: 2,
          titre: 'Répéter pour les camions eau/détail (Part Type 9000)',
          description: (
            <>
              Reviens au Report Selector. Change Part Type à{' '}
              <strong>9000 : Vehicle For Sale</strong>, garde Store et Sort By identiques.
              Clique sur <strong>Preview</strong>.
            </>
          ),
          image: '/guide/hitrac-couts-step-2.png',
          note: 'Tu fais 2 exports séparés (9000 puis 9025) et tu les importes l\'un après l\'autre dans l\'application.',
        },
        {
          numero: 3,
          titre: 'Exporter en CSV depuis Crystal Report Viewer',
          description: (
            <>
              Dans Crystal Report Viewer, clique sur l'icône <strong>Exporter</strong>{' '}
              (feuille avec flèche, barre d'outils en haut). La fenêtre "Exporter" s'ouvre.{' '}
              Choisis Format = <strong>Valeurs délimitées par des caractères (CSV)</strong>,{' '}
              Destination = <strong>Fichier disque</strong>. Clique <strong>OK</strong>{' '}
              et sauvegarde sous le nom <code>vehiclecostdetail.csv</code>.
            </>
          ),
          image: '/guide/hitrac-export-csv.png',
        },
        {
          numero: 4,
          titre: 'Déposer le fichier dans l\'application',
          description: (
            <>
              Glisse le fichier <code>vehiclecostdetail.csv</code> dans la zone de dépôt
              ci-dessous. L'application montre un aperçu des changements avant de confirmer.
            </>
          ),
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
          titre: 'Ouvrir iTrack → Report Viewer → Sales By Inventory Type',
          description: (
            <>
              Dans <strong>iTrack</strong>, clique sur <strong>Report Viewer</strong> dans
              le menu. Déroule la section <strong>Sales</strong>. Sélectionne{' '}
              <strong>Sales By Inventory Type</strong> (il se met en surbrillance bleue).
            </>
          ),
        },
        {
          numero: 2,
          titre: 'Paramètres : Part Type 9000, Show Detail = True',
          description: (
            <>
              Dans les paramètres en bas, configure :{' '}
              <strong>Start Date / End Date</strong> = période souhaitée,{' '}
              <strong>Store</strong> = 1 : Camions A & R Dubois inc.,{' '}
              <strong>Part Type = 9000 : Vehicle For Sale</strong>,{' '}
              <strong>Show Detail = True</strong>. Clique sur <strong>Preview</strong>.
            </>
          ),
          image: '/guide/hitrac-ventes-eau-step-1.png',
          note: 'Part Type 9000 = camions eau et détail seulement. Ne pas confondre avec 9025 (exportation).',
        },
        {
          numero: 3,
          titre: 'Exporter en CSV depuis Crystal Report Viewer',
          description: (
            <>
              Dans Crystal Report Viewer, clique sur l'icône <strong>Exporter</strong>.
              La fenêtre "Exporter" s'ouvre. Choisis Format ={' '}
              <strong>Valeurs délimitées par des caractères (CSV)</strong>,{' '}
              Destination = <strong>Fichier disque</strong>. Clique <strong>OK</strong>{' '}
              et sauvegarde le fichier <code>salesbyinventorytype.csv</code>.
            </>
          ),
          image: '/guide/hitrac-export-csv.png',
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
          titre: 'Ouvrir iTrack → Report Viewer → Sales By Inventory Type',
          description: (
            <>
              Dans <strong>iTrack</strong>, clique sur <strong>Report Viewer</strong>.
              Déroule la section <strong>Sales</strong> et sélectionne{' '}
              <strong>Sales By Inventory Type</strong>.
            </>
          ),
        },
        {
          numero: 2,
          titre: 'Paramètres : Part Type 9025, Show Detail = True',
          description: (
            <>
              Configure les paramètres :{' '}
              <strong>Start Date / End Date</strong> = période souhaitée,{' '}
              <strong>Store</strong> = 1 : Camions A & R Dubois inc.,{' '}
              <strong>Part Type = 9025 : Export Vehicles</strong>,{' '}
              <strong>Show Detail = True</strong>. Clique sur <strong>Preview</strong>.
            </>
          ),
          image: '/guide/hitrac-ventes-export-step-1.png',
          note: 'Part Type 9025 = camions exportation seulement. Différent du 9000 (eau/détail).',
        },
        {
          numero: 3,
          titre: 'Exporter en CSV depuis Crystal Report Viewer',
          description: (
            <>
              Dans Crystal Report Viewer, clique sur l'icône <strong>Exporter</strong>.
              Choisis Format ={' '}
              <strong>Valeurs délimitées par des caractères (CSV)</strong>,{' '}
              Destination = <strong>Fichier disque</strong>. Clique <strong>OK</strong>{' '}
              et sauvegarde le fichier <code>salesbyinventorytype.csv</code>.
            </>
          ),
          image: '/guide/hitrac-export-csv.png',
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

export function GuideVentesEncan() {
  return (
    <GuideSection
      couleur="#f59e0b"
      defaultOuvert={false}
      etapes={[
        {
          numero: 1,
          titre: 'Ouvrir iTrack → Report Viewer → Sales → Sales By Customer',
          description: (
            <>
              Dans <strong>iTrack</strong>, clique sur <strong>Report Viewer</strong>.
              Déroule la section <strong>Sales</strong> et sélectionne{' '}
              <strong>Sales By Customer</strong>.
            </>
          ),
        },
        {
          numero: 2,
          titre: 'Paramètres : sélectionner le client encanteur et Mode = Line Item',
          description: (
            <>
              Configure les paramètres :{' '}
              <strong>Start Date / End Date</strong> = période souhaitée,{' '}
              <strong>Store</strong> = 1 : Camions A & R Dubois inc.,{' '}
              <strong>Customer = 10395 : RITCHIE BROS AUC.CANADA LTD</strong>{' '}
              (ou autre encanteur),{' '}
              <strong>Customer Type = All Types</strong>,{' '}
              <strong>Mode = Line Item</strong>. Clique sur <strong>Preview</strong>.
            </>
          ),
          image: '/guide/hitrac-encan-step-1.png',
          note: 'L\'application ignore automatiquement les pièces (lignes suffixe -X) — tu n\'as pas à les retirer manuellement du fichier.',
        },
        {
          numero: 3,
          titre: 'Exporter en CSV depuis Crystal Report Viewer',
          description: (
            <>
              Dans Crystal Report Viewer, clique sur l'icône <strong>Exporter</strong>.
              Choisis Format ={' '}
              <strong>Valeurs délimitées par des caractères (CSV)</strong>,{' '}
              Destination = <strong>Fichier disque</strong>. Clique <strong>OK</strong>{' '}
              et sauvegarde le fichier <code>salesbycustomer.csv</code>.
            </>
          ),
          image: '/guide/hitrac-export-csv.png',
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

export function GuideVentesPieces() {
  return (
    <GuideSection
      couleur="#10b981"
      defaultOuvert={false}
      etapes={[
        {
          numero: 1,
          titre: 'Ouvrir iTrack → Transaction List',
          description: (
            <>
              Dans <strong>iTrack</strong>, clique sur <strong>Transaction List</strong> dans
              le menu de gauche. La liste de toutes les transactions s'ouvre.
            </>
          ),
        },
        {
          numero: 2,
          titre: 'Appliquer les filtres : Inventory + Closed + Invoice + This Week',
          description: (
            <>
              Dans "Filter results by", assure-toi que ces filtres sont actifs :{' '}
              <strong>Source = Inventory ✓</strong>,{' '}
              <strong>Closed ✓</strong>,{' '}
              <strong>Date = This Week</strong> (ou la période souhaitée),{' '}
              <strong>Document Type = Invoice</strong>. Dans "Fields to display" à droite,
              la colonne <strong>Counterperson</strong> doit être visible. Clique sur{' '}
              <strong>Search</strong> pour charger les résultats.
            </>
          ),
          image: '/guide/hitrac-pieces-step-1.png',
          note: 'La colonne Counterperson dans le CSV permet à l\'application d\'identifier automatiquement le vendeur — pas besoin de le sélectionner manuellement.',
        },
        {
          numero: 3,
          titre: 'Exporter → Export to CSV (with raw values)',
          description: (
            <>
              En bas à droite de la liste, clique sur la flèche à côté du bouton{' '}
              <strong>Export</strong>. Choisis{' '}
              <strong>Export to CSV (with raw values)</strong> — pas "formatted values".
              Sauvegarde le fichier CSV.
            </>
          ),
          image: '/guide/hitrac-pieces-step-1.png',
          note: 'Toujours choisir "with raw values" — le format "formatted values" ajoute des guillemets et des séparateurs qui peuvent causer des erreurs.',
        },
        {
          numero: 4,
          titre: 'Déposer le fichier dans l\'application',
          description: (
            <>
              Glisse le fichier CSV dans la zone de dépôt ci-dessous. Le système
              détecte automatiquement le format et identifie chaque vendeur via la
              colonne Counterperson.
            </>
          ),
        },
      ]}
    />
  );
}

// ════════════════════════════════════════════════════════════════════
// ─── GUIDE LABOR LOG (Heures M.O. iTrack) ───────────────────────────
// ════════════════════════════════════════════════════════════════════

export function GuideLaborLog() {
  return (
    <GuideSection
      couleur="#a78bfa"
      defaultOuvert={false}
      etapes={[
        {
          numero: 1,
          titre: 'Ouvrir iTrack → Report Viewer → Administration → Labor Log By Employee',
          description: (
            <>
              Dans <strong>iTrack</strong>, clique sur <strong>Report Viewer</strong> dans
              le menu de gauche. Dans la liste des rapports, déroule la section{' '}
              <strong>Administration</strong>. Clique sur{' '}
              <strong>Labor Log By Employee</strong> (il se met en surbrillance bleue).
            </>
          ),
        },
        {
          numero: 2,
          titre: 'Configurer les paramètres et cliquer Preview',
          description: (
            <>
              Dans les paramètres en bas, configure :{' '}
              <strong>Start Date</strong> = lundi de la semaine à importer,{' '}
              <strong>End Date</strong> = dimanche de la même semaine,{' '}
              <strong>Store = 1 : Camions A & R Dubois inc.</strong>,{' '}
              <strong>Work Order Type = All Work Order Types</strong>,{' '}
              <strong>User = All Users</strong>,{' '}
              <strong>User Group = Everyone</strong>,{' '}
              <strong>User GL Department = All User GL Departments</strong>,{' '}
              <strong>Summarize By = WO</strong>. Clique sur <strong>Preview</strong>.
            </>
          ),
          image: '/guide/hitrac-laborlog-step-1.png',
          note: 'Toujours importer une semaine complète du lundi au dimanche. Le paramètre "Summarize By = WO" est obligatoire.',
        },
        {
          numero: 3,
          titre: 'Exporter en CSV depuis Crystal Report Viewer',
          description: (
            <>
              Crystal Report Viewer s'ouvre avec le rapport. Clique sur l'icône{' '}
              <strong>Exporter</strong> dans la barre d'outils (feuille avec flèche).
              Dans la fenêtre "Exporter" : Format ={' '}
              <strong>Valeurs délimitées par des caractères (CSV)</strong>,{' '}
              Destination = <strong>Fichier disque</strong>. Clique <strong>OK</strong>{' '}
              et sauvegarde le fichier.
            </>
          ),
          image: '/guide/hitrac-export-csv.png',
        },
        {
          numero: 4,
          titre: 'Déposer le fichier dans l\'application',
          description: (
            <>
              Glisse le fichier CSV dans la zone de dépôt ci-dessous. L'application
              associe automatiquement chaque employé iTrack à son code Acomba.
            </>
          ),
        },
      ]}
    />
  );
}
