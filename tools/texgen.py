import os,sys,json,base64,http.server,threading,functools
from playwright.sync_api import sync_playwright
R='/home/claude/laniko/'; T='/home/claude/mrdoob/three.js/'
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8792),functools.partial(H,directory=R)); threading.Thread(target=srv.serve_forever,daemon=True).start()
P=json.load(open(R+'products.json'))
def hx(c): return '#%02x%02x%02x'%tuple(c)
paper={'blanc-royal':[217,180,144],'reve-paradoxe':[3,34,1],'noir-prestige':[12,10,5],'rouge-absolu':[69,3,3],'bleu-eternel':[2,14,42]}
ink={'blanc-royal':[120,84,24]}
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page()
    pg.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**',lambda r:r.fulfill(body=open(T+r.request.url.split('three@0.160.0/')[1],'rb').read(),content_type='text/javascript'))
    pg.route('https://fonts.g*/**',lambda r:r.abort())
    pg.goto('http://127.0.0.1:8792/'); pg.wait_for_timeout(500)
    print(pg.evaluate("document.fonts.check('600 40px \"Cormorant Garamond\"')"))
    for pr in [q for q in P if q['id'] in paper]:
        pr=dict(pr); pr['labelColor']=hx(paper[pr['id']]); pr['labelInk']=hx(ink.get(pr['id'],[228,203,141]))
        for mode,scale in (('color',2.0),('orm',1.0),('emit',1.0)):
            url=pg.evaluate("""async ([pr,mode,scale])=>{const m=await import('/viewer.js'); await document.fonts.load('600 40px "Cormorant Garamond"'); return m.drawLabel(pr,mode,scale).toDataURL('image/png');}""",[pr,mode,scale])
            open(f'tex/{pr["id"]}-{mode}.png','wb').write(base64.b64decode(url.split(',')[1]))
        print(pr['id'],'ok')
    b.close()
