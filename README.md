# My Shop

A small online shop that runs on **GitHub + Cloudflare Pages**, with payments by **Stripe Checkout**.
No build step and no dependencies.

```
index.html            storefront (product grid + cart drawer)
success.html          shown after a successful payment
style.css, app.js     styling and cart logic
products.json         your catalog (edit this to add products)
functions/api/checkout.js   Cloudflare Pages Function that creates the Stripe session
```

## 1. Put it on GitHub

1. Create a new repository on github.com (e.g. `my-shop`).
2. Upload all files from this folder, keeping the `functions/api/` folder structure.

## 2. Get your Stripe key

1. Create a Stripe account and stay in **Test mode** for now.
2. In the Stripe dashboard go to Developers → API keys and copy the **Secret key** (`sk_test_...`).
   Never put this key in GitHub.

## 3. Deploy on Cloudflare Pages

1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.
2. Pick your repository.
3. Build settings: framework preset **None**, build command **empty**, output directory **`/`**.
4. After the first deploy, open the project → Settings → Variables and Secrets and add a
   secret named `STRIPE_SECRET_KEY` with your key. Redeploy.

Test with card `4242 4242 4242 4242`, any future date and any CVC.

## 4. Go live

1. Switch Stripe to live mode and replace `STRIPE_SECRET_KEY` with the live key (`sk_live_...`).
2. Add your own domain under the Pages project → Custom domains.
3. Add your legal pages (imprint, terms, returns, privacy) before taking real orders.

## Editing the shop

- **Products:** edit `products.json` (`id` must be unique, `price` in euros). Commit and Cloudflare redeploys automatically.
- **Product photos:** put images in an `images/` folder and use `"image": "/images/mug.jpg"`.
- **Shipping:** countries and flat rate are at the top of `functions/api/checkout.js`.
- **Order notifications:** Stripe emails you for each payment by default (Settings → Email notifications). Orders and shipping addresses appear in the Stripe dashboard under Payments.

## Security note

Prices are read from `products.json` on the server, so customers cannot change prices from the browser.
