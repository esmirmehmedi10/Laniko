// Cloudflare Pages Function: POST /api/checkout
// Creates a Stripe Checkout Session. Prices are read from products.json on the
// server, so the browser can never change what an item costs.

const SHIPPING_COUNTRIES = ["LU", "BE", "FR", "DE", "NL"]; // edit to taste
const SHIPPING_FLAT_CENTS = 500; // €5.00 flat rate
const SHIPPING_LABEL = "Standard shipping";
const MAX_QTY = 20;
// languages Stripe Checkout can show (Arabic is not one of them: Stripe picks from the browser then)
const STRIPE_LOCALES = { en: "en", de: "de", fr: "fr", pt: "pt", it: "it", es: "es", zh: "zh" };
const SHIPPING_LABELS = {
  en: "Standard shipping", de: "Standardversand", fr: "Livraison standard", pt: "Envio padrão",
  it: "Spedizione standard", es: "Envío estándar", ar: "الشحن العادي", zh: "标准配送",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_SECRET_KEY) {
    return json({ error: "Shop is not configured yet (missing STRIPE_SECRET_KEY)." }, 500);
  }

  let items, lang, gift, country;
  try {
    ({ items, lang, gift, country } = await request.json());
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (!Array.isArray(items) || items.length === 0 || items.length > 50) {
    return json({ error: "Your cart is empty." }, 400);
  }

  // Load the catalog from the site's own static assets
  const origin = new URL(request.url).origin;
  const catalogRes = await env.ASSETS.fetch(new URL("/products.json", origin));
  const catalog = await catalogRes.json();
  const byId = new Map(catalog.map((p) => [p.id, p]));

  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", `${origin}/success.html`);
  params.set("cancel_url", `${origin}/?canceled=1`);
  params.set("billing_address_collection", "auto");
  params.set("locale", STRIPE_LOCALES[lang] || "auto");
  params.set("phone_number_collection[enabled]", "true");
  // the customer chose a country in the shop: only that country is offered for delivery (if we deliver there)
  const ship = SHIPPING_COUNTRIES.includes(country) ? [country] : SHIPPING_COUNTRIES;
  ship.forEach((c, i) =>
    params.set(`shipping_address_collection[allowed_countries][${i}]`, c)
  );
  params.set("shipping_options[0][shipping_rate_data][type]", "fixed_amount");
  params.set("shipping_options[0][shipping_rate_data][display_name]", SHIPPING_LABELS[lang] || SHIPPING_LABEL);
  params.set("shipping_options[0][shipping_rate_data][fixed_amount][amount]", String(SHIPPING_FLAT_CENTS));
  params.set("shipping_options[0][shipping_rate_data][fixed_amount][currency]", "eur");

  let n = 0;
  for (const item of items) {
    const product = byId.get(item?.id);
    const qty = Number.parseInt(item?.quantity, 10);
    if (!product || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      return json({ error: "One of the items in your cart is no longer available." }, 400);
    }
    const p = `line_items[${n}]`;
    params.set(`${p}[quantity]`, String(qty));
    params.set(`${p}[price_data][currency]`, "eur");
    params.set(`${p}[price_data][unit_amount]`, String(Math.round(product.price * 100)));
    params.set(`${p}[price_data][product_data][name]`, product.name);
    if (product.description) {
      const prefix = product.kind === "set" ? "" : "Extrait de Parfum, 50 ml. ";
      params.set(`${p}[price_data][product_data][description]`, `${prefix}${product.description}`);
    }
    if (product.image) {
      const imageUrl = product.image.startsWith("/") ? origin + product.image : product.image;
      if (imageUrl.startsWith("https://")) {
        params.set(`${p}[price_data][product_data][images][0]`, imageUrl);
      }
    }
    n++;
  }

  // the Discovery Set is credited on a full bottle: the customer types the code from the card in the box at checkout
  // (create a coupon + promotion code for it in the Stripe dashboard)
  params.set("allow_promotion_codes", "true");

  // gift: the wrapping and the message travel with the order, so they can be packed with it
  if (gift && typeof gift === "object") {
    const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
    const wrap = ["ivory", "noir", "rouge"].includes(gift.wrap) ? gift.wrap : "ivory";
    params.set("metadata[gift]", "yes");
    params.set("metadata[gift_wrap]", wrap);
    params.set("metadata[gift_from]", clean(gift.from, 40));
    params.set("metadata[gift_message]", clean(gift.message, 240));
    params.set("payment_intent_data[metadata][gift]", "yes");
    params.set("payment_intent_data[metadata][gift_wrap]", wrap);
    params.set("payment_intent_data[metadata][gift_from]", clean(gift.from, 40));
    params.set("payment_intent_data[metadata][gift_message]", clean(gift.message, 240));
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  });
  const session = await res.json();

  if (!res.ok) {
    console.error("Stripe error", JSON.stringify(session));
    return json({ error: "Could not start checkout. Please try again." }, 502);
  }
  return json({ url: session.url });
}
