"""Re-make the product pictures (images/<id>.jpg) from the viewer: the .glb bottle on its backdrop, exactly as the
viewer shows it at rest. Needs playwright + a local copy of three.js r160 (offline sandbox: the CDN request is
answered from THREE_DIR). usage: python3 tools/render_photos.py [index ...]"""
import sys, os, json, http.server, threading, functools
import cv2
from playwright.sync_api import sync_playwright
R = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
T = os.environ.get("THREE_DIR", "/home/claude/mrdoob/three.js/")
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 8841), functools.partial(H, directory=R))
threading.Thread(target=srv.serve_forever, daemon=True).start()
P = json.load(open(R + "/products.json"))
only = [int(a) for a in sys.argv[1:]] or range(len(P))
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
    for i in only:
        pr = P[i]
        pg = b.new_page(viewport={"width": 600, "height": 800}, device_scale_factor=2.5, reduced_motion="reduce")
        pg.on("pageerror", lambda e: print("PAGEERR", e))
        pg.route("https://cdn.jsdelivr.net/npm/three@0.160.0/**", lambda r: r.fulfill(body=open(T + r.request.url.split("three@0.160.0/")[1], "rb").read(), content_type="text/javascript"))
        pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
        pg.goto("http://127.0.0.1:8841/"); pg.wait_for_selector(".imgbtn")
        pg.add_style_tag(content=".viewer-head,.viewer-foot,.viewer-hint{display:none!important}")
        pg.locator(".imgbtn").nth(i).click()
        pg.wait_for_timeout(12000)
        pg.screenshot(path=f"/tmp/ph-{i}.png")
        img = cv2.imread(f"/tmp/ph-{i}.png")
        cv2.imwrite(R + "/" + pr["image"].split("?")[0], img, [cv2.IMWRITE_JPEG_QUALITY, 93])
        print(pr["id"], img.shape, flush=True)
        pg.close()
    b.close()
