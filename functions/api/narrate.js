// Cloudflare Pages Function: POST /api/narrate   { lang, ids, speaker }  ->  audio/mpeg
// A natural neural voice (Cloudflare Workers AI) reads the "About us" story. It needs the Workers AI binding named AI
// (Cloudflare Pages > laniko > Settings > Bindings > Add > Workers AI, variable name AI). Without it this answers 501 and
// the page falls back to the phone's own voice.
//
// Only the story's own sentences can be read: the browser sends the text KEYS (ab1, abTag ...), and the sentences are
// looked up here in i18n-about.js. Every finished recording is stored at the edge for a year, so each sentence is
// generated once per voice and language, no matter how many visitors listen.

const EN = ["luna", "athena", "helena", "thalia", "aurora", "ophelia"];                 // Deepgram Aura-2 English (female voices)
const ES = ["carina", "celeste", "diana", "selena", "estrella"];                           // Deepgram Aura-2 Spanish (female voices)
const MELO = { fr: "fr", zh: "zh" };                                                       // MeloTTS (French, Chinese)
const SPEAKERS = { en: EN, es: ES };
const KEY_OK = /^ab(?:\d{1,2}|Tag|End1|End2)$/;

const err = (status, error) => new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

// pull one language's strings out of i18n-about.js
function stringsFor(src, lang) {
  const start = src.search(new RegExp(`\\n\\s*${lang}:\\s*\\{`));
  if (start < 0) return {};
  const rest = src.slice(start + 1);
  const next = rest.slice(1).search(/\n {2}[a-z]{2}:\s*\{/);
  const block = next < 0 ? rest : rest.slice(0, next + 1);
  const out = {};
  for (const m of block.matchAll(/(\w+):\s*"((?:[^"\\]|\\.)*)"/g)) { try { out[m[1]] = JSON.parse('"' + m[2] + '"'); } catch { /* skip */ } }
  return out;
}

const hex = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function toBytes(out) {
  if (out && typeof out.getReader === "function") return new Uint8Array(await new Response(out).arrayBuffer());
  if (out instanceof ArrayBuffer) return new Uint8Array(out);
  if (typeof out === "string") return b64(out);
  if (out && typeof out.audio === "string") return b64(out.audio);
  throw new Error("unexpected audio output");
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.AI) return err(501, "not configured");
  const origin = new URL(request.url).origin, from = request.headers.get("Origin");
  if (from && from !== origin) return err(403, "forbidden");

  let lang, ids, speaker;
  try { ({ lang, ids, speaker } = await request.json()); } catch { return err(400, "bad request"); }
  if (!["en", "es", "fr", "zh"].includes(lang) || !Array.isArray(ids) || !ids.length || ids.length > 3 || !ids.every((k) => KEY_OK.test(k))) return err(400, "bad request");
  const voice = SPEAKERS[lang] ? (SPEAKERS[lang].includes(speaker) ? speaker : SPEAKERS[lang][0]) : "default";

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`${origin}/__narrate/${lang}/${voice}/${await hex(ids.join(","))}`);
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return hit; }

  const srcRes = await env.ASSETS.fetch(new URL("/i18n-about.js", origin));
  const strings = stringsFor(await srcRes.text(), lang);
  const text = ids.map((k) => strings[k]).filter(Boolean).join(lang === "zh" ? "" : " ")
    .replace(/laniko/gi, "Laniko").replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim();
  if (!text) return err(404, "no text");

  let bytes;
  try {
    if (lang === "en" || lang === "es") {
      const run = (extra) => env.AI.run(lang === "en" ? "@cf/deepgram/aura-2-en" : "@cf/deepgram/aura-2-es", { text, encoding: "mp3", ...extra });
      try { bytes = await toBytes(await run({ speaker: voice })); } catch { bytes = await toBytes(await run({})); }       // unknown speaker name: use the model's default
    } else {
      bytes = await toBytes(await env.AI.run("@cf/myshell-ai/melotts", { prompt: text, lang: MELO[lang] }));
    }
  } catch (e) { return err(502, "voice failed"); }

  const res = new Response(bytes, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
  if (cache) { const put = cache.put(cacheKey, res.clone()); if (waitUntil) waitUntil(put); else await put; }
  return res;
}
