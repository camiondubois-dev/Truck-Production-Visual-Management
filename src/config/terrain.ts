// PIN d'accès à la vue terrain — géré via Supabase (même système que l'app Achats)
// Le PIN est validé par la fonction RPC get_profile_by_pin dans la base de données.
// Pour modifier le PIN : changer la valeur dans la table prod_acheteurs (colonne pin).
// Ce fichier est conservé pour rétrocompatibilité mais n'est plus utilisé directement.
export const TERRAIN_PIN = '';
