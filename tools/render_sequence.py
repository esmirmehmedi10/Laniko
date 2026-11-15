"""Render the scroll-animation frames of every perfume (images/seq/<id>/NN.webp) and images/seq/<id>/meta.json (frame count, nozzle position).
The bottle turns once (36 frames), the cap lifts off (16 frames) and the spray button is pressed (4 frames).
Uses the viewer in a fixed pose (viewer.setPose). Needs playwright + a local three.js r160 (THREE_DIR).
usage: python3 tools/render_sequence.py [index ...]"""
import sys, os, json, math, http.server, threading, functools
import cv2, numpy as np
from playwright.sync_api import sync_playwright
R = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
T = os.environ.get("THREE_DIR", "/home/claude/mrdoob/three.js/")
DPR = 1.5
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", int(os.environ.get("PORT", "8851"))), functools.partial(H, directory=R))
threading.Thread(target=srv.serve_forever, daemon=True).start()
P = json.load(open(R + "/products.json"))
only = [int(a) for a in sys.argv[1:]] or range(len(P))
ease = lambda u: 1 - (1 - u) ** 3
LIFT, SLIDE, TILT = 0.85, 0.32, 0.38
poses = []
for k in range(36): poses.append(dict(yaw=k * math.pi * 2 / 36))
for j in range(16):
    u = (j + 1) / 16; e = ease(u)
    poses.append(dict(yaw=0, lift=LIFT * e, slide=SLIDE * u * u, tilt=TILT * u * u))
for pr in (0.4, 1.0, 1.0, 0.3):
    poses.append(dict(yaw=0, lift=LIFT, slide=SLIDE, tilt=TILT, press=pr))
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
        pg.goto("http://127.0.0.1:" + os.environ.get("PORT", "8851") + "/"); pg.wait_for_selector(".imgbtn")
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
        d = f"{R}/images/seq/{pr['id']}"; os.makedirs(d, exist_ok=True)
        for n, po in enumerate(poses):
            if os.path.exists(f"{d}/{n:02d}.webp") and n < len(poses) - 1 and os.environ.get("RESUME"): continue
            pg.evaluate("(po) => { window.__v.setPose(po); window.__v.renderNow(); }", po)
            pg.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))")
            pg.locator("#seqbox").screenshot(path=tmp)
            img = cv2.imread(tmp)
            cv2.imwrite(f"{d}/{n:02d}.webp", img, [cv2.IMWRITE_WEBP_QUALITY, 86])
        pg.evaluate("(po) => { window.__v.setPose(po); window.__v.renderNow(); }", poses[-2])
        nz = pg.evaluate("window.__v.nozzleScreen()")
        json.dump({"frames": len(poses), "nozzle": nz, "turn": 36, "cap": 16, "press": 4}, open(d + "/meta.json", "w"))
        print(pr["id"], len(poses), "frames", flush=True)
        pg.close()
    b.close()
