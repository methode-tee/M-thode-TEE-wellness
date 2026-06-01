// MÉTHODE TEE — helper sécurisé codes d'accès
// Utilise ces fonctions côté front au lieu de lire directement la table access_codes.

async function mtVerifyAccessCodeSecure(code) {
  const client = initSupabase();
  if (!client) throw new Error("Supabase non configuré");

  const { data, error } = await client.rpc("verify_access_code", {
    input_code: code
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function mtConsumeAccessCodeSecure(code) {
  const client = initSupabase();
  if (!client) throw new Error("Supabase non configuré");

  const { data, error } = await client.rpc("consume_access_code", {
    input_code: code
  });

  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
