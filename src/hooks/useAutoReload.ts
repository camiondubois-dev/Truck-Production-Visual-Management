import { useEffect, useRef } from 'react';

const INTERVALLE_MS = 2 * 60 * 1000; // vérification toutes les 2 minutes

async function fetchVersionActuelle(): Promise<string> {
  const res = await fetch('/index.html?_=' + Date.now(), { cache: 'no-store' });
  const html = await res.text();
  // Le hash Vite est dans le src du bundle JS principal
  const match = html.match(/src="\/assets\/index-[^"]+\.js"/);
  return match?.[0] ?? '';
}

export function useAutoReload() {
  const versionInitiale = useRef<string | null>(null);

  useEffect(() => {
    // Capturer la version au chargement
    fetchVersionActuelle()
      .then(v => { versionInitiale.current = v; })
      .catch(() => {});

    const verifier = async () => {
      try {
        const derniere = await fetchVersionActuelle();
        if (versionInitiale.current && derniere && derniere !== versionInitiale.current) {
          window.location.reload();
        }
      } catch {
        // Réseau indisponible — on réessaie au prochain intervalle
      }
    };

    const t = setInterval(verifier, INTERVALLE_MS);
    return () => clearInterval(t);
  }, []);
}
