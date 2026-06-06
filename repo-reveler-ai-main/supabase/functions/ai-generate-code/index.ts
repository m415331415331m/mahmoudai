// Streaming AI code generation via Lovable AI Gateway
// Strongest model + auto-continuation when output is truncated
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are an elite full-stack web engineer building inside a live AI IDE (the user's "Lovable v2").
The user describes an app — you build a COMPLETE, REAL, RUNNABLE, MULTI-PAGE website from scratch.

═══ CRITICAL OUTPUT RULES (NON-NEGOTIABLE) ═══
1. Output PURE STATIC HTML + CSS + JS (NO npm, NO JSX, NO TypeScript, NO bundlers).
   Files run in a browser sandbox with ZERO server.
2. Build a REAL multi-page site with shared navigation:
   - index.html  (home / hero / featured)
   - about.html, services.html, pricing.html, contact.html, etc. as fits the request
   - style.css   — shared, modern, responsive, CSS variables, gradients, smooth animations
   - script.js   — shared vanilla JS (mobile nav toggle, smooth scroll, form handling, fade-in observers)
   - Every page <head> links style.css; every page <body> ends with <script src="script.js"></script>
   - Every page shares the same <header><nav> with links: <a href="index.html">, <a href="about.html"> etc.
   - Same <footer> on every page
3. Pages MUST link to each other (real <a href="page.html"> navigation, NOT # anchors).
4. SEO on EVERY page (mandatory):
   - <title> unique per page (under 60 chars, includes keyword)
   - <meta name="description"> unique (under 160 chars)
   - <meta name="viewport" content="width=device-width, initial-scale=1">
   - <meta charset="UTF-8">
   - Open Graph: og:title, og:description, og:type, og:image (Unsplash URL)
   - Twitter card: twitter:card="summary_large_image"
   - <link rel="canonical"> per page
   - JSON-LD structured data (Organization on home, WebPage on others)
   - Semantic HTML5: <header><nav><main><section><article><footer>
   - Single <h1> per page; logical heading hierarchy
   - alt="" on every <img>; loading="lazy" on non-hero images
   - lang="en" or "ar" on <html>; dir="rtl" for Arabic
5. Beautiful, professional design — real copy (NOT lorem ipsum), real Unsplash images
   (https://images.unsplash.com/photo-XXX?w=1200&q=80), gradients, shadows, hover effects, transitions.
6. NO placeholders, NO "// TODO", NO empty sections. Every file 100% complete & functional.
7. Aim for 6-10 files for a typical site (index + 4-6 inner pages + style.css + script.js).

═══ CONTINUATION PROTOCOL ═══
If you sense you may run out of tokens before finishing a file, end EXACTLY at a newline
between two characters of a string value (NEVER mid-escape). The next call will say "CONTINUE" — when you
see that, resume the JSON output byte-for-byte where you left off, no preamble, no markdown, no apology.

═══ OUTPUT FORMAT (STRICT) ═══
Part 1: 3-6 sentences explaining what you built — list the pages created and key features (visible to the user).
Then a line containing ONLY: ===FILES===
Part 2: A single JSON array of files:
[{"path":"index.html","content":"<!doctype html>...","language":"html"},{"path":"style.css","content":"...","language":"css"}]

JSON RULES:
- No markdown fences around the JSON.
- Properly escape: \\n for newlines, \\" for quotes, \\\\ for backslashes.
- Paths do NOT start with /.
- One continuous JSON array — start with [ end with ].`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prompt, currentFile, currentContent, files, model: modelOverride } = await req.json();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strongest default — escalates automatically on failure
    const primaryModel = modelOverride || "google/gemini-3.1-pro-preview";
    const fallbackModels = [
      "openai/gpt-5.5",
      "google/gemini-2.5-pro",
      "openai/gpt-5",
      "google/gemini-3-flash-preview",
    ];

    const context = files?.length
      ? `Existing project files. Preserve the same structure, visual direction, navigation, and naming unless the user asks to replace them. Continue from the current state instead of rebuilding unrelated work.\n\n${files.map((f: any) => `--- ${f.path} ---\n${String(f.content ?? "").slice(0, 6000)}`).join("\n\n")}\n\n${
          currentFile ? `User is editing: ${currentFile}\n\`\`\`\n${(currentContent ?? "").slice(0, 6000)}\n\`\`\`` : ""
        }`
      : "Empty project — build from scratch.";

    const baseMessages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `${context}\n\nUser request: ${prompt}\n\nBuild the COMPLETE multi-page app NOW. Real working code. No shortcuts.` },
    ];

    async function callModel(model: string, messages: any[]) {
      return await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, stream: true, max_tokens: 32000, messages }),
      });
    }

    // Try primary, then fallbacks until one returns a streaming body
    let upstream: Response | null = null;
    let usedModel = primaryModel;
    for (const m of [primaryModel, ...fallbackModels]) {
      const r = await callModel(m, baseMessages);
      if (r.ok && r.body) { upstream = r; usedModel = m; break; }
      if (r.status === 402) {
        return new Response(
          JSON.stringify({
            error: "AI_TEMPORARILY_UNAVAILABLE",
            message: "محرك البناء غير متاح الآن. تم حفظ محادثتك ويمكنك المتابعة من نفس المكان بعد قليل.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (r.status === 429) {
        return new Response(
          JSON.stringify({
            error: "RATE_LIMITED",
            message: "تم تجاوز الحد المسموح من الطلبات. حاول مجدداً بعد قليل.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      // Try next model on 429/5xx
    }

    if (!upstream) {
      return new Response(JSON.stringify({ error: "All AI models unavailable, retry shortly" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        const dec = new TextDecoder();
        let accumulated = "";
        let currentResponse: Response = upstream!;
        let currentMessages = baseMessages;
        let continuations = 0;
        const MAX_CONTINUATIONS = 3;

        async function pumpOne(resp: Response): Promise<string> {
          // Returns finish_reason ("stop" | "length" | "" | ...)
          const reader = resp.body!.getReader();
          let buf = "";
          let finishReason = "";
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buf += dec.decode(value, { stream: true });
              const lines = buf.split("\n");
              buf = lines.pop() ?? "";
              for (const line of lines) {
                const l = line.trim();
                if (!l.startsWith("data:")) continue;
                const data = l.slice(5).trim();
                if (data === "[DONE]") continue;
                try {
                  const j = JSON.parse(data);
                  const delta = j?.choices?.[0]?.delta?.content;
                  const fr = j?.choices?.[0]?.finish_reason;
                  if (fr) finishReason = fr;
                  if (delta) {
                    accumulated += delta;
                    controller.enqueue(enc.encode(delta));
                  }
                } catch { /* partial */ }
              }
            }
          } catch (e) {
            controller.enqueue(enc.encode(`\n[stream error: ${String(e)}]`));
          }
          return finishReason;
        }

        try {
          let finish = await pumpOne(currentResponse);
          // Auto-continue if truncated mid-output
          while (finish === "length" && continuations < MAX_CONTINUATIONS) {
            continuations++;
            currentMessages = [
              ...baseMessages,
              { role: "assistant", content: accumulated },
              { role: "user", content: "CONTINUE" },
            ];
            const r = await callModel(usedModel, currentMessages);
            if (!r.ok || !r.body) break;
            finish = await pumpOne(r);
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
        "X-Model-Used": usedModel,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
