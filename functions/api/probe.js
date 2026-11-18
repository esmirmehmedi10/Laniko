// TEMPORARY probe: which third-party text-to-speech models answer through the AI binding?
export async function onRequestGet({ env }) {
  const out = {};
  const tries = [
    ["openai/gpt-4o-mini-tts", { input: "Hallo, das ist ein Test.", voice: "coral", instructions: "soft", response_format: "mp3" }],
    ["openai/gpt-4o-mini-tts", { text: "Hallo, das ist ein Test.", voice: "coral" }],
    ["openai/tts-1", { input: "Hallo", voice: "nova" }],
    ["elevenlabs/eleven_multilingual_v2", { text: "Hallo, das ist ein Test." }],
    ["@cf/deepgram/aura-2-de", { text: "Hallo, das ist ein Test." }],
    ["@cf/deepgram/aura-2-it", { text: "Ciao, questo è un test." }],
    ["@cf/deepgram/aura-2-fr", { text: "Bonjour, ceci est un test." }],
    ["@cf/deepgram/aura-2-pt", { text: "Olá, isto é um teste." }],
  ];
  for (const [model, input] of tries) {
    try {
      const r = await env.AI.run(model, input, { gateway: { id: "default" } });
      out[model + " " + Object.keys(input).join(",")] = "OK " + (r && r.getReader ? "stream" : typeof r);
    } catch (e) { out[model + " " + Object.keys(input).join(",")] = String(e && e.message || e).slice(0, 240); }
  }
  return new Response(JSON.stringify(out, null, 1), { headers: { "content-type": "application/json" } });
}
