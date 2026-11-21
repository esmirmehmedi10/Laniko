// Cloudflare Pages Function: POST /api/narrate   { lang, ids }  ->  audio/mpeg
// A natural neural voice reads the "About us" story.
//  1. Best: OpenAI "gpt-4o-mini-tts", ONE soft storyteller voice for all 8 languages. It needs the secret OPENAI_API_KEY
//     (Cloudflare Pages > laniko > Settings > Variables and Secrets, type Secret).
//  2. Otherwise Cloudflare Workers AI (binding named AI): Deepgram Aura-2 for English and Spanish only (no other realistic voice there).
//  3. Languages without a realistic voice get no Listen button: GET /api/narrate?lang=xx tells the page whether one exists.
//
// Only the story's own sentences can be read: the browser sends the text KEYS (ab1, abTag ...), and the sentences are
// looked up here in i18n-about.js. Every finished recording is stored at the edge for a year, so each sentence is
// generated once per voice and language, no matter how many visitors listen.

const VOICE = { en: "hera", es: "selena" };                                             // soft narrators: Deepgram Aura-2 "Pandora" (English: smooth, calm, melodic; the page lifts her pitch a little) and "Estrella" (Spanish)
// how each line should feel (used by the OpenAI voice, which can act): the story goes from a hushed opening to a warm, radiant close
const MOOD = { abTag: "a low, sultry whisper, close to the ear, the first words of a seduction", ab1: "slow, velvety and intimate, savouring every word", ab2: "breathy and sensual, almost a murmur, lingering on 'identity' and 'signature'", ab3: "husky, warm and quietly confident",
  ab4: "sensual and breathy, as if describing a touch on bare skin", ab5: "low, smooth and self-assured, a knowing half-smile", ab6: "teasing and playful, then dropping into a silky whisper", ab7: "smoky, defiant and alluring, a wicked little smile in the voice",
  ab8: "deeply intimate, a soft shiver in the voice", ab9: "slow and precise, every syllable caressed", ab10: "low, calm and magnetic", ab11: "dreamy, languid and sensual, like waking beside someone", ab12: "confident and seductive, voice dropping low",
  ab13: "a hushed, intoxicating secret whispered right at the ear", abEnd1: "husky and inviting, a smile you can hear", abEnd2: "slow, low and lingering, a final breathy whisper that stays with you" };
const ALL = ["en", "de", "fr", "pt", "it", "es", "ar", "zh"], LANG_NAME = { en: "English", de: "German", fr: "French", pt: "European Portuguese", it: "Italian", es: "Spanish (neutral Latin-American/Spain)", ar: "Modern Standard Arabic", zh: "Mandarin Chinese" };
const OPENAI_VOICE = "coral";                                                           // OpenAI's soft, light, higher female voice
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

const supported = (env) => env.OPENAI_API_KEY ? ALL : env.AI ? ["en", "es"] : [];
export async function onRequestGet({ request, env }) {
  const lang = new URL(request.url).searchParams.get("lang");
  return new Response(JSON.stringify({ voice: supported(env).includes(lang) }), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function onRequestPost({ request, env, waitUntil }) {
  if (!env.AI && !env.OPENAI_API_KEY) return err(501, "not configured");
  const origin = new URL(request.url).origin, from = request.headers.get("Origin");
  if (from && from !== origin) return err(403, "forbidden");

  let lang, ids;
  try { ({ lang, ids } = await request.json()); } catch { return err(400, "bad request"); }
  const hasOpenAI = !!env.OPENAI_API_KEY;
  if (!supported(env).includes(lang) || !Array.isArray(ids) || !ids.length || ids.length > 3 || !ids.every((k) => KEY_OK.test(k))) return err(400, "bad request");
  const voice = hasOpenAI ? OPENAI_VOICE : VOICE[lang] || "default";

  const cache = typeof caches !== "undefined" ? caches.default : null;
  const cacheKey = new Request(`${origin}/__narrate/v3/${lang}/${voice}/${await hex(ids.join(","))}`);      // v2: earlier recordings may have been made with the default voice
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
          instructions: `Voice: a real, warm, low-pitched woman with a husky, velvety, slightly breathy voice, speaking very close to the microphone, as if whispering to one person in a dim, candle-lit room. Sensual, intimate and seductive, in the way a luxury perfume film is: elegant, confident, alluring and tasteful, never explicit, never vulgar, never cartoonish. A soft audible breath before the first word and between phrases is welcome. Let the voice drop and linger on the ends of sentences, smile with the words, and let a little smoky roughness come through. Never robotic, never formal, never a news reader or customer-service voice, never loud. ` +
            `This line should sound: ${ids.map((k) => MOOD[k]).filter(Boolean).join("; ") || "low, sultry and intimate"}. ` +
            `Pace: very slow and unhurried, with long, silky pauses between sentences. Language: ${LANG_NAME[lang]}, with a natural native accent. The brand name "Laniko" is one word, said lah-NEE-koh.`,
        }),
      });
      if (r.ok) bytes = new Uint8Array(await r.arrayBuffer());
      else if (r.status === 401 || r.status === 403) { if (!env.AI || !["en", "es"].includes(lang)) return err(501, "voice key rejected"); usedAI = true; fallback = true; }    // bad key: use Cloudflare's voices instead (and do not store them under the OpenAI voice)
      else return err(502, "voice failed");
    } catch { return err(502, "voice failed"); }
  }
  const slow = text.replace(/([.!?])\s+(?=\S)/g, "$1.. ");                                  // Aura cannot be directed, so slow, lingering pauses are made with punctuation
  if (!bytes && usedAI) try {
    const run = (extra) => env.AI.run(lang === "en" ? "@cf/deepgram/aura-2-en" : "@cf/deepgram/aura-2-es", { text: slow, encoding: "mp3", ...extra });
    // always the same speaker: if a try fails, try the SAME speaker again (never the model's default voice, which would sound different)
    let last;
    for (let k = 0; k < 3 && !bytes; k++) { try { bytes = await toBytes(await run({ speaker: VOICE[lang] })); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 400 * (k + 1))); } }
    if (!bytes) throw last || new Error("no audio");
  } catch (e) { return err(502, "voice failed: " + String((e && e.message) || e).slice(0, 200)); }

  const wav = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46;            // MeloTTS answers with WAV, Aura with MP3
  const res = new Response(bytes, { headers: { "Content-Type": wav ? "audio/wav" : "audio/mpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
  if (cache && !fallback) { const put = cache.put(cacheKey, res.clone()); if (waitUntil) waitUntil(put); else await put; }
  return res;
}
