// ════════════════════════════════════════════════════════════════
// Notes Vocales — Enregistrement + lecture audio pour les achats
// Stocké dans prod_achats_photos avec tag = 'vocal'
// ════════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { achatService } from '../services/achatService';
import type { AchatPhoto } from '../types/achatTypes';

const COULEUR = '#10b981';
const COULEUR_ROUGE = '#ef4444';

async function uploaderAudio(blob: Blob, acheteurId: string): Promise<string> {
  const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('webm') ? 'webm' : 'mp4';
  const nomFichier = `inventaire/vocal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;

  const { error } = await supabase.storage
    .from('camions-photos')
    .upload(nomFichier, blob, { cacheControl: '3600', upsert: false, contentType: blob.type });

  if (error) throw error;

  const { data } = supabase.storage.from('camions-photos').getPublicUrl(nomFichier);
  return data.publicUrl;
}

function formaterDuree(secondes: number): string {
  const m = Math.floor(secondes / 60).toString().padStart(2, '0');
  const s = Math.floor(secondes % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function tempsRelatif(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return new Date(iso).toLocaleDateString('fr-CA', { month: 'short', day: 'numeric' });
}

// ── Lecteur audio compact ─────────────────────────────────────────
function LecteurAudio({ url, label }: { url: string; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [joue, setJoue] = useState(false);
  const [progression, setProgression] = useState(0);
  const [duree, setDuree] = useState(0);
  const [charge, setCharge] = useState(false);

  const toggleLecture = async () => {
    const a = audioRef.current;
    if (!a) return;
    if (joue) {
      a.pause();
    } else {
      setCharge(true);
      try { await a.play(); } catch {}
      setCharge(false);
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '12px 14px', borderRadius: 12,
      background: '#f0fdf4', border: '1px solid #bbf7d0',
    }}>
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setJoue(true)}
        onPause={() => setJoue(false)}
        onEnded={() => { setJoue(false); setProgression(0); }}
        onTimeUpdate={e => setProgression((e.currentTarget.currentTime / (e.currentTarget.duration || 1)) * 100)}
        onLoadedMetadata={e => setDuree(e.currentTarget.duration)}
      />

      <button onClick={toggleLecture}
        style={{
          width: 44, height: 44, borderRadius: '50%', border: 'none',
          background: COULEUR, color: 'white', fontSize: 18,
          cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
        {charge ? '⏳' : joue ? '⏸' : '▶'}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#065f46', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          🎙 {label}
        </div>
        <div style={{ height: 4, background: '#d1fae5', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progression}%`, background: COULEUR, transition: 'width 0.1s', borderRadius: 2 }} />
        </div>
        {duree > 0 && (
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3 }}>
            {formaterDuree(audioRef.current?.currentTime ?? 0)} / {formaterDuree(duree)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Composant principal ───────────────────────────────────────────
export function NotesVocales({
  achatId,
  uploadedBy,
  canRecord = true,
}: {
  achatId: string;
  uploadedBy: string;
  canRecord?: boolean;
}) {
  const [notes, setNotes] = useState<AchatPhoto[]>([]);
  const [enregistrement, setEnregistrement] = useState(false);
  const [dureeEnreg, setDureeEnreg] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sauvegarde, setSauvegarde] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const chargerNotes = async () => {
    const photos = await achatService.getPhotos(achatId);
    setNotes(photos.filter(p => p.tag === 'vocal'));
  };

  useEffect(() => {
    chargerNotes();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [achatId]);

  const demarrerEnregistrement = async () => {
    setErreur(null);
    setAudioBlob(null);
    setAudioUrl(null);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

      // Choisir le meilleur format supporté
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mr;

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setEnregistrement(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mr.start(100);
      setEnregistrement(true);
      setDureeEnreg(0);
      timerRef.current = setInterval(() => setDureeEnreg(d => d + 1), 1000);
    } catch (e: any) {
      setErreur('Impossible d\'accéder au microphone. Vérifie les permissions dans les réglages du téléphone.');
    }
  };

  const arreterEnregistrement = () => {
    mediaRecorderRef.current?.stop();
  };

  const annulerEnregistrement = () => {
    mediaRecorderRef.current?.stop();
    setAudioBlob(null);
    setAudioUrl(null);
    if (timerRef.current) clearInterval(timerRef.current);
    setEnregistrement(false);
    setDureeEnreg(0);
  };

  const sauvegarderNote = async () => {
    if (!audioBlob) return;
    setSauvegarde(true);
    setErreur(null);
    try {
      const url = await uploaderAudio(audioBlob, uploadedBy);
      await achatService.ajouterPhoto(achatId, url, 'vocal', uploadedBy);
      setAudioBlob(null);
      setAudioUrl(null);
      await chargerNotes();
    } catch (e: any) {
      setErreur('Erreur lors de la sauvegarde. Réessaie.');
    } finally {
      setSauvegarde(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* Notes existantes */}
      {notes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map((n, i) => (
            <LecteurAudio
              key={n.id}
              url={n.url}
              label={`Note #${i + 1} · ${tempsRelatif(n.uploadedAt)}`}
            />
          ))}
        </div>
      )}

      {/* Aperçu enregistrement terminé */}
      {audioUrl && !enregistrement && (
        <div style={{ padding: '14px', borderRadius: 12, background: '#fef9c3', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 10 }}>
            🎙 Écouter avant de sauvegarder
          </div>
          <audio controls src={audioUrl} style={{ width: '100%', height: 40 }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button onClick={sauvegarderNote} disabled={sauvegarde}
              style={{
                flex: 1, padding: '14px', borderRadius: 12, border: 'none',
                background: sauvegarde ? '#e5e7eb' : COULEUR,
                color: sauvegarde ? '#9ca3af' : 'white',
                fontSize: 16, fontWeight: 800, cursor: sauvegarde ? 'not-allowed' : 'pointer',
              }}>
              {sauvegarde ? '⏳ Sauvegarde…' : '✓ Sauvegarder'}
            </button>
            <button onClick={() => { setAudioBlob(null); setAudioUrl(null); }}
              style={{ padding: '14px 16px', borderRadius: 12, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
              🗑
            </button>
          </div>
        </div>
      )}

      {/* Bouton enregistrer / enregistrement en cours */}
      {canRecord && !audioBlob && (
        <div>
          {enregistrement ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '20px', borderRadius: 16, background: '#fef2f2', border: '2px solid #fca5a5' }}>
              {/* Animation pulsation */}
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: COULEUR_ROUGE,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pulse 1s infinite',
                boxShadow: '0 0 0 8px rgba(239,68,68,0.2)',
              }}>
                <span style={{ fontSize: 32 }}>🎙</span>
              </div>
              <style>{`@keyframes pulse { 0%,100%{box-shadow:0 0 0 8px rgba(239,68,68,0.2)} 50%{box-shadow:0 0 0 16px rgba(239,68,68,0.08)} }`}</style>
              <div style={{ fontSize: 24, fontWeight: 900, color: COULEUR_ROUGE, fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em' }}>
                {formaterDuree(dureeEnreg)}
              </div>
              <div style={{ fontSize: 14, color: '#ef4444', fontWeight: 600 }}>Enregistrement en cours…</div>
              <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                <button onClick={annulerEnregistrement}
                  style={{ flex: 1, padding: '14px', borderRadius: 12, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>
                  ✕ Annuler
                </button>
                <button onClick={arreterEnregistrement}
                  style={{ flex: 1, padding: '14px', borderRadius: 12, border: 'none', background: COULEUR_ROUGE, color: 'white', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
                  ⏹ Arrêter
                </button>
              </div>
            </div>
          ) : (
            <button onClick={demarrerEnregistrement}
              style={{
                width: '100%', padding: '16px', borderRadius: 14,
                border: '2px dashed #d1d5db',
                background: 'white', color: '#374151',
                fontSize: 17, fontWeight: 700, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
              <span style={{ fontSize: 24 }}>🎙</span>
              Enregistrer une note vocale
            </button>
          )}
        </div>
      )}

      {erreur && (
        <div style={{ padding: 12, borderRadius: 10, background: '#fee2e2', color: '#991b1b', fontSize: 14, fontWeight: 600 }}>
          ⚠ {erreur}
        </div>
      )}

      {notes.length === 0 && !canRecord && (
        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: '12px 0' }}>
          Aucune note vocale
        </div>
      )}
    </div>
  );
}
