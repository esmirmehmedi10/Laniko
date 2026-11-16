"""Render the scroll-animation frames of every perfume (images/seq/<id>/NN.webp) and images/seq/<id>/meta.json.
The film has four parts:  the bottle turns once (TURN frames) -> the camera pushes in and tilts down onto the cap (PUSH)
-> the cap lifts off and flies out of the picture while the camera keeps closing in (LIFT) -> the spray button is pressed (PRESS).
During PUSH / LIFT / PRESS the camera is steered so that the spray nozzle stays at a fixed place in the picture.
meta.json also holds, for every frame, the nozzle position, the spray direction (camera space) and the zoom: the page draws the mist from it.
Uses the viewer in a fixed pose (viewer.setPose). Needs playwright + a local three.js r160 (THREE_DIR).
usage: [PORT=8851] [RESUME=1] python3 tools/render_sequence.py [index ...]"""
import sys, os, json, math, http.server, threading, functools
import cv2
from playwright.sync_api import sync_playwright
R = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
T = os.environ.get("THREE_DIR", "/home/claude/mrdoob/three.js/")
DPR = 1.2
PORT = int(os.environ.get("PORT", "8851"))
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), functools.partial(H, directory=R))
threading.Thread(target=srv.serve_forever, daemon=True).start()
P = json.load(open(R + "/products.json"))
only = [int(a) for a in sys.argv[1:]] or range(len(P))

TURN, PUSH, LIFT, PRESS = 90, 40, 70, 40       # 240 frames in all
sm = lambda u: u * u * (3 - 2 * u)
mix = lambda a, b, u: a + (b - a) * u
YAW0, YAW1, YAW2 = 0.0, 0.30, 0.42            # the bottle turns a little so that the nozzle points to the right and slightly away: the spray flies over the dark background
PIT1, PIT2 = 0.40, 0.47                        # looking down onto the cap
ZOOM1, ZOOM2, ZOOM3 = 1.9, 2.6, 2.85
NZ0, NZ1, NZ2 = (0.50, 0.375), (0.42, 0.41), (0.33, 0.43)   # where the nozzle sits in the picture (fractions)
LIFT_UP, LIFT_SIDE, LIFT_TILT = 1.9, 1.0, 1.1
def press_at(j):       # button goes down quickly, stays, then comes back up slowly
    u = j / (PRESS - 1)
    if u < 0.2: return sm(u / 0.2) * 0.97 + 0.03
    if u < 0.5: return 1.0
    return max(0.0, 1 - sm((u - 0.5) / 0.5)) * 0.97 + 0.03 * (1 - u)
PRESS_CURVE = [press_at(j) for j in range(PRESS)]

poses = []   # (pose dict, target nozzle position or None)
for k in range(TURN): poses.append((dict(yaw=k * math.pi * 2 / TURN), None))
for j in range(1, PUSH + 1):
    u = j / PUSH; e = sm(u)
    poses.append((dict(yaw=mix(YAW0, YAW1, e), pitch=PIT1 * e, zoom=mix(1, ZOOM1, e)), (mix(NZ0[0], NZ1[0], e), mix(NZ0[1], NZ1[1], e))))
for j in range(1, LIFT + 1):
    u = j / LIFT; e = sm(u); f = u ** 1.2
    poses.append((dict(yaw=mix(YAW1, YAW2, e), pitch=mix(PIT1, PIT2, e), zoom=mix(ZOOM1, ZOOM2, e),
                       lift=LIFT_UP * f, slide=LIFT_SIDE * f, tilt=LIFT_TILT * f ** 1.1),
                  (mix(NZ1[0], NZ2[0], e), mix(NZ1[1], NZ2[1], e))))
for j, pr in enumerate(PRESS_CURVE):
    u = (j + 1) / PRESS
    poses.append((dict(yaw=YAW2, pitch=PIT2, zoom=mix(ZOOM2, ZOOM3, u), lift=LIFT_UP, slide=LIFT_SIDE, tilt=LIFT_TILT, press=pr), NZ2))
NF = len(poses)

os.makedirs(R + "/images/seq", exist_ok=True)
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for i in only:
        pr = P[i]; tmp = f"/tmp/seq-{pr['id']}.png"
        pg = b.new_page(viewport={"width": 600, "height": 800}, device_scale_factor=DPR, reduced_motion="reduce")
        pg.on("pageerror", lambda e: print("PAGEERR", e))
        pg.add_init_script("window.LANIKO_FRAME={bw:0.42,bottom:0.72}")
        pg.route("https://cdn.jsdelivr.net/npm/three@0.160.0/**", lambda r: r.fulfill(body=open(T + r.request.url.split("three@0.160.0/")[1], "rb").read(), content_type="text/javascript"))
        pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
        pg.goto(f"http://127.0.0.1:{PORT}/"); pg.wait_for_selector(".imgbtn")
        pg.evaluate("""async (prod) => {
            document.querySelectorAll('.lang-gate,.promo-back').forEach(e => e.remove());
            const box = document.createElement('div');
            box.id = 'seqbox'; box.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:800px;z-index:99999;background:#000';
            document.body.appendChild(box);
            const mod = await import('/viewer.js');
            window.__v = mod.createBottleViewer(box, prod);
            window.__v.setPose({ yaw: 0 });
        }""", pr)
        pg.wait_for_function("window.__v && window.__v.nozzleScreen() !== null", timeout=60000)
        pg.wait_for_timeout(4000)
        pg.evaluate("window.__v.pause()")      # draw only on demand: much faster than drawing every frame
        meas = lambda po: pg.evaluate("(po) => { window.__v.setPose(po); window.__v.renderNow(); return window.__v.nozzleScreen(); }", po)
        # how far the nozzle moves in the picture for one unit of pan (calibrated once)
        base = dict(yaw=YAW1, pitch=PIT1, zoom=ZOOM1)
        n0 = meas(base); nx = meas(dict(base, panX=1)); ny = meas(dict(base, panY=1))
        jx, jy = nx["x"] - n0["x"], ny["y"] - n0["y"]
        print("jacobian", jx, jy, flush=True)
        d = f"{R}/images/seq/{pr['id']}"; os.makedirs(d, exist_ok=True)
        nzs = []; panX = panY = 0.0
        for n, (po, tgt) in enumerate(poses):
            po = dict(po)
            if tgt is not None:
                for _ in range(4):
                    po["panX"], po["panY"] = panX, panY
                    nz = meas(po)
                    ex, ey = tgt[0] - nz["x"], tgt[1] - nz["y"]
                    if abs(ex) < 0.002 and abs(ey) < 0.002: break
                    panX += ex / jx; panY += ey / jy
                po["panX"], po["panY"] = panX, panY
            nz = meas(po); nzs.append([round(nz[k], 4) for k in ("x", "y", "ux", "uy", "uz")] + [round(po.get("zoom", 1), 3)])
            if os.path.exists(f"{d}/{n:02d}.webp") and os.environ.get("RESUME") and n < NF - 1: continue
            pg.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            pg.locator("#seqbox").screenshot(path=tmp)
            img = cv2.imread(tmp)
            cv2.imwrite(f"{d}/{n:02d}.webp", img, [cv2.IMWRITE_WEBP_QUALITY, 78])
        for f in os.listdir(d):
            if f.endswith(".webp") and int(f[:2]) >= NF: os.remove(f"{d}/{f}")
        json.dump({"v": 2, "frames": NF, "turn": TURN, "push": PUSH, "lift": LIFT, "press": PRESS, "nz": nzs}, open(d + "/meta.json", "w"))
        print(pr["id"], NF, "frames", flush=True)
        pg.close()
    b.close()
