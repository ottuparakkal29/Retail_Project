export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getSupabaseConfig() {
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRoleKey) {
    throw new Error("Supabase Edge Function environment is not configured.");
  }
  return { url, anonKey, serviceRoleKey };
}

export async function authenticateUser(request: Request) {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return null;

  const { url, anonKey } = getSupabaseConfig();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!response.ok) return null;

  const user = await response.json();
  return typeof user.id === "string" ? { id: user.id } : null;
}

export async function getCustomerProfileId(userId: string): Promise<string | null> {
  const { url, serviceRoleKey } = getSupabaseConfig();
  const params = new URLSearchParams({
    select: "id",
    auth_user_id: `eq.${userId}`,
    role: "eq.customer",
    limit: "1",
  });
  const response = await fetch(`${url}/rest/v1/profiles?${params}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    },
  });
  if (!response.ok) throw new Error("Could not verify the customer profile.");
  const rows = await response.json();
  return Array.isArray(rows) && typeof rows[0]?.id === "string" ? rows[0].id : null;
}
