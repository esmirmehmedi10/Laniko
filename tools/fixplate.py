import cv2, numpy as np, sys, time
from skimage.restoration import inpaint_biharmonic
B={
 'blanc-royal':   dict(size=(380,506),body=(108,287,252,480),cap=(135,255,158)),
 'reve-paradoxe': dict(size=(400,500),body=(113,289,260,488),cap=(143,262,162)),
 'noir-prestige': dict(size=(379,506),body=(98,274,252,477),cap=(128,246,158)),
 'rouge-absolu':  dict(size=(374,498),body=(101,272,259,487),cap=(128,245,162)),
 'bleu-eternel':  dict(size=(375,499),body=(98,272,260,488),cap=(127,247,162)),
}
for pid,d in B.items():
    t0=time.time()
    plate=cv2.imread(f'plates-orig/{pid}-bg.jpg'); H,W=plate.shape[:2]
    S=W/d['size'][0]; l,r,bt,bb=d['body']; cl,cr,ct=d['cap']
    # hole = where the old bottle (cap + body) used to be, with a generous margin
    m=np.zeros((H,W),np.uint8)
    pad=10*S
    cv2.rectangle(m,(int((cl-4)*S-pad),int((ct-5)*S-pad)),(int((cr+4)*S+pad),int(bt*S)),1,-1)
    cv2.rectangle(m,(int((l-3.5)*S-pad),int((bt-6)*S-pad)),(int((r+3.5)*S+pad),int(bb*S)),1,-1)
    k=4
    small=cv2.resize(plate,(W//k,H//k),interpolation=cv2.INTER_AREA)
    ms=cv2.resize(m,(W//k,H//k),interpolation=cv2.INTER_NEAREST).astype(bool)
    # harmonic (Laplace) fill: smooth continuation of the colours around the hole, multi-scale then relaxed
    known=(~ms).astype(np.float32)[...,None]
    sm=small.astype(np.float32)
    est=np.zeros_like(sm)
    for sg in (60,30,15,8):
        num=cv2.GaussianBlur(sm*known,(0,0),sg); den=cv2.GaussianBlur(known,(0,0),sg)[...,None] if known.ndim==3 else cv2.GaussianBlur(known,(0,0),sg)
        e=num/np.maximum(den,1e-3)
        est=np.where((den>0.02)&(est==0),e,est) if sg==60 else np.where(den>0.08,e,est)
    cur=np.where(ms[...,None],est,sm)
    for it in range(600):
        nb=cv2.blur(cur,(3,3))
        cur=np.where(ms[...,None],nb,sm)
    fill=cur
    fill=cv2.resize(fill,(W,H),interpolation=cv2.INTER_CUBIC)
    # a soft feathered alpha: fully replaced in the middle, blended on a wide border
    a=cv2.GaussianBlur(m.astype(np.float32),(0,0),pad*0.45)
    a=np.clip((a-0.15)/0.7,0,1)
    a=np.maximum(a,cv2.erode(m,np.ones((int(pad),)*2)).astype(np.float32))
    a=a[...,None]
    grain=np.random.default_rng(3).normal(0,2.0,plate.shape).astype(np.float32)
    out=plate.astype(np.float32)*(1-a)+(fill+grain)*a
    cv2.imwrite(f'/home/claude/laniko/images/{pid}-bg.jpg',np.clip(out,0,255).astype(np.uint8),[cv2.IMWRITE_JPEG_QUALITY,90])
    cv2.imwrite(f'fp-{pid}.png',cv2.resize(np.hstack([plate,np.clip(out,0,255).astype(np.uint8)]),(1000,H*500//W)))
    print(pid,round(time.time()-t0,1),flush=True)
