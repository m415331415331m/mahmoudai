// Test an API key by calling the provider's lightweight endpoint
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function testKey(provider: string, key: string): Promise<{ ok: boolean; info?: string; error?: string }> {
  try {
    switch (provider) {
      case "openai": {
        const r = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
        const j = await r.json();
        return { ok: true, info: `${(j.data ?? []).length} models` };
      }
      case "anthropic": {
        const r = await fetch("https://api.anthropic.com/v1/models", {
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01" },
        });
        if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
        const j = await r.json();
        return { ok: true, info: `${(j.data ?? []).length} models` };
      }
      case "google": {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`);
        if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
        const j = await r.json();
        return { ok: true, info: `${(j.models ?? []).length} models` };
      }
      case "groq": {
        const r = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
        const j = await r.json();
        return { ok: true, info: `${(j.data ?? []).length} models` };
      }
      case "github": {
        const r = await fetch("https://api.github.com/user", {
          headers: { Authorization: `Bearer ${key}`, "User-Agent": "lovable-test" },
        });
        if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
        const j = await r.json();
        return { ok: true, info: `@${j.login}` };
      }
      case "vercel": {
        const r = await fetch("https://api.vercel.com/v2/user", {
          headers: { Authorization: `Bearer ${key}` },
        });
        if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
        const j = await r.json();
        return { ok: true, info: j?.user?.username ?? "ok" };
      }
      default:
        return { ok: false, error: "Unknown provider" };
    }
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { provider, key } = await req.json();
    if (!provider || !key) {
      return new Response(JSON.stringify({ ok: false, error: "Missing provider or key" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await testKey(provider, key);
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
