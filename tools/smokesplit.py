"""Split each background plate into (a) a smoke-free base picture and (b) a smoke-only layer.
   base + layer == original plate, so the viewer can move only the layer (smoke) and leave
   flowers, props, silk and the logo untouched.
   usage: python3 tools/smokesplit.py            (run from the repo root)"""
import cv2, json, numpy as np, os
R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
IMG = os.path.join(R, "images")
# Where the smoke is, per picture: (x0, x1, y0, y1, r0) as fractions of the plate. r0 = how coloured the light
# may be and still count as smoke (low for the golden incense smoke). Outside these boxes nothing ever moves, so
# flowers, fruit, wood, crystals and silk stay still. Inside them only light that brightens all three colours
# (= smoke) is taken, so the rose / silk inside a box also stays still.
ZONES = {
    "blanc-royal":   [(0.00, 0.31, 0.00, 0.42, 0.30), (0.68, 1.00, 0.08, 0.46, 0.30)],
    "reve-paradoxe": [(0.00, 0.32, 0.00, 0.37, 0.22), (0.70, 1.00, 0.35, 0.46, 0.08)],
    "noir-prestige": [(0.00, 0.31, 0.26, 0.47, 0.25), (0.70, 1.00, 0.38, 0.52, 0.12)],
    "rouge-absolu":  [(0.00, 0.32, 0.00, 0.46, 0.30), (0.74, 1.00, 0.40, 0.57, 0.14)],
    "bleu-eternel":  [(0.00, 0.33, 0.00, 0.37, 0.30)],
}
def build(pid):
    plate = cv2.imread(f"{IMG}/{pid}-bg.jpg")
    H, W = plate.shape[:2]
    h, w = H // 2, W // 2
    small = cv2.resize(plate, (w, h), interpolation=cv2.INTER_AREA).astype(np.float32)
    zone = np.zeros((h, w), np.float32)
    r0map = np.full((h, w), 0.30, np.float32)
    for x0, x1, y0, y1, r0 in ZONES[pid]:
        zone[int(y0 * h): int(y1 * h), int(x0 * w): int(x1 * w)] = 1
        r0map[int(y0 * h): int(y1 * h), int(x0 * w): int(x1 * w)] = r0
    zone[: int(0.27 * h), int(0.21 * w): int(0.79 * w)] = 0   # never touch the logo / name
    zone[int(0.33 * h):, int(0.28 * w): int(0.72 * w)] = 0    # nor the (re-built) background behind the bottle
    zone = cv2.GaussianBlur(zone, (0, 0), 10)
    r0map = cv2.GaussianBlur(r0map, (0, 0), 10)
    m = zone
    # smoke is light that is (almost) colourless: take the weakest colour channel and remove everything
    # that is wider than a wisp (lower envelope), what is left is the smoke
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (131, 131))
    env = np.stack([cv2.GaussianBlur(cv2.dilate(cv2.erode(small[..., c], k), k), (0, 0), 34) for c in range(3)], 2)
    resid = np.clip(small - env, 0, None)                      # light above the smooth background, per colour
    mn = small.min(2)
    envm = cv2.GaussianBlur(cv2.dilate(cv2.erode(mn, k), k), (0, 0), 34)
    white = np.clip((mn - envm) / 14.0, 0, 1)                  # 1 where all three colours brightened = smoke
    white = cv2.GaussianBlur(white, (0, 0), 2.0)
    rb = cv2.GaussianBlur(resid, (0, 0), 3)
    ratio = rb.min(2) / (rb.max(2) + 2.0)                       # smoke is nearly colourless, silk / flowers are coloured
    colourless = np.clip((ratio - r0map) / 0.17, 0, 1)
    layer = resid * (white * colourless * m)[..., None]
    layer = cv2.GaussianBlur(layer, (0, 0), 1.0)
    layer = np.minimum(layer, small)
    print(pid, "layer max", layer.max().round(), "coverage %.1f%%" % (100 * (layer.max(2) > 6).mean()))
    up = cv2.resize(layer, (W, H), interpolation=cv2.INTER_CUBIC)
    base = np.clip(plate.astype(np.float32) - up, 0, 255).astype(np.uint8)
    cv2.imwrite(f"{IMG}/{pid}-smoke-base.jpg", base, [cv2.IMWRITE_JPEG_QUALITY, 90])
    cv2.imwrite(f"{IMG}/{pid}-smoke-layer.png", np.clip(layer, 0, 255).astype(np.uint8))
if __name__ == "__main__":
    for pid in ZONES: build(pid)
