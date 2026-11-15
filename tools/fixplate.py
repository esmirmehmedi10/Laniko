"""Re-build the background behind the old bottle (plates-orig/<id>-bg.jpg -> images/<id>-bg.jpg).
 low frequencies : harmonic (Laplace) fill from everything around the hole  -> same colours / glow as the surroundings
 high frequencies: texture (silk folds, grain, haze) copied from the picture just above the hole, mirrored
                   (taken from the smoke-free base so no smoke gets copied)
usage: python3 tools/fixplate.py [orig_dir]   (run from the repo root; needs the original plates in orig_dir)"""
import cv2, numpy as np, sys, os
R = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ORIG = sys.argv[1] if len(sys.argv) > 1 else "/home/claude/work/plates-orig"
B = {  # measured on the original photos: size, body (l, r, top, bottom), cap (l, r, top)
 'blanc-royal':   dict(size=(380,506),body=(108,287,252,480),cap=(135,255,158)),
 'reve-paradoxe': dict(size=(400,500),body=(113,289,260,488),cap=(143,262,162)),
 'noir-prestige': dict(size=(379,506),body=(98,274,252,477),cap=(128,246,158)),
 'rouge-absolu':  dict(size=(374,498),body=(101,272,259,487),cap=(128,245,162)),
 'bleu-eternel':  dict(size=(375,499),body=(98,272,260,488),cap=(127,247,162)),
}
def harmonic(small, hole):
    known = (~hole).astype(np.float32)[..., None]
    est = np.zeros_like(small)
    for i, sg in enumerate((60, 30, 15, 8)):
        den = cv2.GaussianBlur(known, (0, 0), sg)[..., None]
        e = cv2.GaussianBlur(small * known, (0, 0), sg)[..., None] if False else cv2.GaussianBlur(small * known, (0, 0), sg) / np.maximum(den, 1e-3)
        est = np.where(den > (0.02 if i == 0 else 0.08), e, est)
    cur = np.where(hole[..., None], est, small)
    for _ in range(700):
        cur = np.where(hole[..., None], cv2.blur(cur, (3, 3)), small)
    return cur
for pid, d in B.items():
    plate = cv2.imread(f"{ORIG}/{pid}-bg.jpg"); H, W = plate.shape[:2]
    base = cv2.imread(f"{R}/images/{pid}-smoke-base.jpg")
    S = W / d['size'][0]; l, r, bt, bb = d['body']; cl, cr, ct = d['cap']
    pad = int(6 * S)
    cap = (int((cl - 4) * S) - pad, int((ct - 5) * S), int((cr + 4) * S) + pad, int(bt * S) + pad)   # top edge sits right under the name   # x0,y0,x1,y1
    side = int(2 * S)
    body = (int((l - 3.5) * S) - side, int((bt - 2.5) * S), int((r + 3.5) * S) + side, int(bb * S))   # sides hug the body: the real surroundings stay untouched
    m = np.zeros((H, W), np.uint8)
    mc = np.zeros((H, W), np.uint8); mb = np.zeros((H, W), np.uint8)
    x0, y0, x1, y1 = cap; mc[y0:y1, x0:x1] = 1
    x0, y0, x1, y1 = body; mb[y0:y1, x0:x1] = 1
    m = np.maximum(mc, mb)
    # low frequencies: for every row, blend the colours just left and right of the hole (keeps each row's own
    # brightness, so the glow / vignette continues straight across), smoothed down the rows
    rows = np.where(m.any(1))[0]
    xl = np.zeros(H, int); xr = np.zeros(H, int)
    for y in rows:
        xs = np.where(m[y])[0]; xl[y], xr[y] = xs.min(), xs.max() + 1
    pf = plate.astype(np.float32)
    Lc = np.zeros((H, 3), np.float32); Rc = np.zeros((H, 3), np.float32)
    ew = int(5 * S)
    for y in rows:
        Lc[y] = pf[y, max(0, xl[y] - 2 * ew):xl[y] - ew].mean(0)
        Rc[y] = pf[y, xr[y] + ew:min(W, xr[y] + 2 * ew)].mean(0)
    from scipy.ndimage import gaussian_filter1d
    sy = 7 * S
    y0r, y1r = rows.min(), rows.max() + 1
    Lc[y0r:y1r] = gaussian_filter1d(Lc[y0r:y1r], sy, axis=0, mode="nearest")
    Rc[y0r:y1r] = gaussian_filter1d(Rc[y0r:y1r], sy, axis=0, mode="nearest")
    low = pf.copy()
    for y in rows:
        n = xr[y] - xl[y]
        t = np.linspace(0, 1, n, dtype=np.float32)[:, None]; t = t * t * (3 - 2 * t) * 0.7 + t * 0.3
        low[y, xl[y]:xr[y]] = Lc[y] * (1 - t) + Rc[y] * t
    # deep inside (hidden behind the body, seen only when the bottle is tipped): smooth harmonic fill, no row bands
    k = 4
    small = cv2.resize(plate, (W // k, H // k), interpolation=cv2.INTER_AREA).astype(np.float32)
    hs = cv2.resize(m, (W // k, H // k), interpolation=cv2.INTER_NEAREST).astype(bool)
    harm = cv2.resize(harmonic(small, hs), (W, H), interpolation=cv2.INTER_CUBIC)
    yy = np.arange(H, dtype=np.float32)[:, None, None]
    wB = np.clip((yy - 0.30 * H) / (0.06 * H), 0, 1); wB = wB * wB * (3 - 2 * wB)
    low = low * (1 - wB) + harm * wB
    # texture donor: the picture just left and right of the hole (smoke-free base), mirrored into the hole and
    # cross-faded; only above the flowers, below that the smooth fill is used
    x0c, x1c = cap[0], cap[2]
    wd = x1c - x0c; half = wd // 2
    Ld = base[:, x0c - half:x0c][:, ::-1].astype(np.float32)        # left of the hole, flipped: continuous at the edge
    Rd = base[:, x1c:x1c + (wd - half)][:, ::-1].astype(np.float32)  # right of the hole, flipped
    t = np.linspace(0, 1, wd, dtype=np.float32)
    t = np.clip((t - 0.35) / 0.3, 0, 1); t = (t * t * (3 - 2 * t))[None, :, None]
    Lfull = np.concatenate([Ld, Ld[:, ::-1]], 1)[:, :wd]
    Rfull = np.concatenate([Rd[:, ::-1], Rd], 1)[:, -wd:] if Rd.shape[1] == wd - half else np.concatenate([Rd[:, ::-1], Rd], 1)[:, -wd:]
    donor_full = np.zeros((H, W, 3), np.float32)
    donor_full[:, x0c:x1c] = Lfull * (1 - t) + Rfull * t
    detail = cv2.GaussianBlur(donor_full, (0, 0), 1.2) - cv2.GaussianBlur(donor_full, (0, 0), 28)
    detail[:, : x0c + 8] = 0; detail[:, x1c - 8:] = 0
    ylim = int(0.335 * H)
    detail[ylim:] *= np.clip(1 - (np.arange(ylim, H) - ylim)[:, None, None] / (0.04 * H), 0, 1)
    detail[: cap[1]] = 0
    # hole interior (cap zone) gets full detail; deeper (hidden behind the body) gets a calmer version
    wt = np.zeros((H, W), np.float32); wt[cap[1]:cap[3], cap[0]:cap[2]] = 1; wt[body[1]:body[3], body[0]:body[2]] = np.maximum(wt[body[1]:body[3], body[0]:body[2]], 0.55)
    filled = low + detail * wt[..., None] * 0.0
    # grain like the rest of the picture
    hp = plate.astype(np.float32) - cv2.GaussianBlur(plate.astype(np.float32), (0, 0), 1.5)
    sigma = float(hp[int(0.30 * H):int(0.36 * H), int(0.35 * W):int(0.65 * W)].std()) if False else float(hp[:int(0.25 * H), :int(0.1 * W)].std())
    filled += np.random.default_rng(5).normal(0, min(sigma, 3.0), filled.shape).astype(np.float32) * 0.6
    def feather(mk, sx, sy):
        a_ = cv2.GaussianBlur(mk.astype(np.float32), (0, 0), sigmaX=sx, sigmaY=sy)
        return np.clip((a_ - 0.1) / 0.7, 0, 1)
    ac = feather(mc, 9 * S, 1.8 * S)          # above the shoulder: wide, soft sides so there is no visible box
    ab = feather(mb, 1.6 * S, 1.8 * S)         # around the body: tight
    a = np.maximum(ac, np.maximum(ab, cv2.erode(mb, np.ones((int(3 * S), int(3 * S)), np.uint8)).astype(np.float32)))[..., None]
    out = np.clip(plate.astype(np.float32) * (1 - a) + filled * a, 0, 255).astype(np.uint8)
    cv2.imwrite(f"{R}/images/{pid}-bg.jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(pid, "grain", round(sigma, 2), flush=True)
