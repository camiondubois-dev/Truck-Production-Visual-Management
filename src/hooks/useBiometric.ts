// ════════════════════════════════════════════════════════════════
// Biométrie Web (WebAuthn) — Face ID / Touch ID / Empreinte
// Standard W3C — supporté sur iOS Safari 16+, Android Chrome, etc.
// Usage : appKey = 'terrain' | 'finance'  (namespaces séparés)
// ════════════════════════════════════════════════════════════════

const KEY_SUFFIX = '_biometric_cred';

// ─── Encodage Base64url (format requis par WebAuthn) ────────────────────────

function b64Encode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64Decode(s: string): Uint8Array {
  const b = s.replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array([...atob(b)].map(c => c.charCodeAt(0)));
}

// ─── API publique ────────────────────────────────────────────────────────────

/** Vérifie si WebAuthn avec authentificateur platform (Face ID, Touch ID…) est disponible. */
export async function isBiometricSupported(): Promise<boolean> {
  if (!window.PublicKeyCredential) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/** Vérifie si un credential biométrique est déjà enregistré pour cette app. */
export function isBiometricRegistered(appKey: string): boolean {
  return !!localStorage.getItem(appKey + KEY_SUFFIX);
}

/** Supprime le credential enregistré (désactivation de Face ID). */
export function removeBiometric(appKey: string): void {
  localStorage.removeItem(appKey + KEY_SUFFIX);
}

/**
 * Enregistre Face ID / Touch ID pour cette app.
 * Déclenche la prompt biométrique de l'OS.
 * Retourne true si l'enregistrement a réussi.
 */
export async function registerBiometric(appKey: string): Promise<boolean> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId    = crypto.getRandomValues(new Uint8Array(16));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: 'Camions Dubois',
          id: window.location.hostname,
        },
        user: {
          id:          userId,
          name:        `${appKey}@camionsdubois`,
          displayName: 'Camions Dubois',
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7   },  // ES256  (Face ID / Touch ID)
          { type: 'public-key', alg: -257 },  // RS256  (fallback)
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',  // appareil local seulement
          userVerification:        'required',  // biométrie obligatoire
          residentKey:             'preferred',
        },
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null;

    if (!credential) return false;

    // Sauvegarder l'identifiant du credential (pas de clé privée — elle reste dans la puce)
    localStorage.setItem(appKey + KEY_SUFFIX, b64Encode(credential.rawId));
    return true;
  } catch (e: any) {
    // L'utilisateur a annulé ou Face ID non disponible
    if (e?.name !== 'NotAllowedError') console.error('[biometric] register:', e);
    return false;
  }
}

/**
 * Authentifie via Face ID / Touch ID.
 * Déclenche la prompt biométrique de l'OS.
 * Retourne true si le visage / l'empreinte est reconnu.
 */
export async function authenticateWithBiometric(appKey: string): Promise<boolean> {
  const credIdStr = localStorage.getItem(appKey + KEY_SUFFIX);
  if (!credIdStr) return false;

  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const credId    = b64Decode(credIdStr);

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [{ id: credId, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60_000,
      },
    }) as PublicKeyCredential | null;

    return !!assertion;
  } catch (e: any) {
    if (e?.name !== 'NotAllowedError') console.error('[biometric] auth:', e);
    return false;
  }
}
