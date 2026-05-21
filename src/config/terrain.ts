// PIN d'accès à la vue terrain (téléphone / tablette)
// Configuré via la variable d'environnement VITE_TERRAIN_PIN (Netlify / .env local)
// Ne jamais mettre le PIN directement ici — modifier la variable dans Netlify.
export const TERRAIN_PIN: string = (import.meta.env.VITE_TERRAIN_PIN as string | undefined) ?? '';
