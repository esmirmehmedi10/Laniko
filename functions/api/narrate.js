// Cloudflare Pages Function: POST /api/narrate   { lang, ids }  ->  audio/mpeg
// A natural neural voice reads the "About us" story.
//  1. Best: OpenAI "gpt-4o-mini-tts", ONE soft storyteller voice for all 8 languages. It needs the secret OPENAI_API_KEY
//     (Cloudflare Pages > laniko > Settings > Variables and Secrets, type Secret).
//  2. Otherwise Cloudflare Workers AI (binding named AI): Deepgram Aura-2 for English and Spanish, MeloTTS for French and
//     Chinese (Cloudflare retires MeloTTS on 2026-11-20).
//  3. Otherwise this answers 501/400 and the page falls back to the phone's own voice.
//
// Only the story's own sentences can be read: the browser sends the text KEYS (ab1, abTag ...), and the sentences are
// looked up here in i18n-about.js. Every finished recording is stored at the edge for a year, so each sentence is
// generated once per voice and language, no matter how many visitors listen.

const VOICE = { en: "luna", es: "estrella" };                                                // one soft, friendly narrator: Deepgram Aura-2 "Luna" (English) and "Estrella" (Spanish)
const MELO = { fr: "fr", zh: "zh" };                                                       // MeloTTS (French, Chinese)
const ALL = ["en", "de", "fr", "pt", "it", "es", "ar", "zh"], LANG_NAME = { en: "English", de: "German", fr: "French", pt: "European Portuguese", it: "Italian", es: "Spanish (neutral Latin-American/Spain)", ar: "Modern Standard Arabic", zh: "Mandarin Chinese" };
const OPENAI_VOICE = "coral";
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
  if (!env.AI && !env.OPENAI_API_KEY) return err(501, "not configured");
  const origin = new URL(request.url).origin, from = request.headers.get("Origin");
  if (from && from !== origin) return err(403, "forbidden");

  let lang, ids;
  try { ({ lang, ids } = await request.json()); } catch { return err(400, "bad request"); }
  const hasOpenAI = !!env.OPENAI_API_KEY;
  if (!(hasOpenAI ? ALL : ["en", "es", "fr", "zh"]).includes(lang) || !Array.isArray(ids) || !ids.length || ids.length > 3 || !ids.every((k) => KEY_OK.test(k))) return err(400, "bad request");
  const voice = hasOpenAI ? OPENAI_VOICE : VOICE[lang] || "default";

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`${origin}/__narrate/${lang}/${voice}/${await hex(ids.join(","))}`);
  if (cache) { const hit = await cache.match(cacheKey); if (hit) return hit; }

  const srcRes = await env.ASSETS.fetch(new URL("/i18n-about.js", origin));
  const strings = stringsFor(await srcRes.text(), lang);
  const text = ids.map((k) => strings[k]).filter(Boolean).join(lang === "zh" ? "" : " ")
    .replace(/laniko/gi, "Laniko").replace(/[—–]/g, ", ").replace(/\s+/g, " ").trim();
  if (!text) return err(404, "no text");

  let bytes, usedAI = !hasOpenAI, fallback = false;
  if (hasOpenAI) {
    try {
      const r = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST", headers: { Authorization: "Bearer " + env.OPENAI_API_KEY, "content-type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini-tts", voice: OPENAI_VOICE, response_format: "mp3", input: text,
          instructions: `Voice: a soft, warm, gentle woman telling a fairytale in a quiet room. Tone: calm, intimate and a little dreamy, tender and kind, never formal, never a news reader, never dramatic. ` +
            `Pace: slow and unhurried, with soft pauses between sentences. Language: ${LANG_NAME[lang]}, with a natural native accent. The brand name "Laniko" is one word, said lah-NEE-koh.`,
        }),
      });
      if (r.ok) bytes = new Uint8Array(await r.arrayBuffer());
      else if (r.status === 401 || r.status === 403) { if (!env.AI || !["en", "es", "fr", "zh"].includes(lang)) return err(501, "voice key rejected"); usedAI = true; fallback = true; }    // bad key: use Cloudflare's voices instead (and do not store them under the OpenAI voice)
      else return err(502, "voice failed");
    } catch { return err(502, "voice failed"); }
  }
  if (!bytes && usedAI) try {
    if (lang === "en" || lang === "es") {
      const run = (extra) => env.AI.run(lang === "en" ? "@cf/deepgram/aura-2-en" : "@cf/deepgram/aura-2-es", { text, encoding: "mp3", ...extra });
      const aura = VOICE[lang];
      try { bytes = await toBytes(await run({ speaker: aura })); } catch { bytes = await toBytes(await run({})); }       // unknown speaker name: use the model's default
    } else {
      bytes = await toBytes(await env.AI.run("@cf/myshell-ai/melotts", { prompt: text, lang: MELO[lang] }));
    }
  } catch (e) { return err(502, "voice failed"); }

  const wav = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46;            // MeloTTS answers with WAV, Aura with MP3
  const res = new Response(bytes, { headers: { "Content-Type": wav ? "audio/wav" : "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
  if (cache && !fallback) { const put = cache.put(cacheKey, res.clone()); if (waitUntil) waitUntil(put); else await put; }
  return res;
}
