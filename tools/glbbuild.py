import numpy as np, json, struct, sys
W=0.060  # metres: 1 "unit" below = body width 60 mm
BW,BD,BH=1.0,0.55,1.235     # body width / depth / height, proportions measured from the photos of the real bottle
R_EDGE=0.02

def srgb2lin(c): c=np.array(c,float)/255; return np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4)

def smoothstep(a,b,x): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)

def axis_grid(h,r,narc,nmid):
    i=h-r
    th=np.linspace(0,np.pi/4,narc+1); outer=i+r*np.tan(th)
    mid=np.linspace(-i,i,nmid+2)[1:-1]
    return np.concatenate([-outer[::-1],mid,outer])

def grid_mesh(g1,g2,fn):
    """fn(a,b)->(pos Nx3, nrm Nx3). returns pos,nrm,idx"""
    A,B=np.meshgrid(g1,g2,indexing='ij'); pos,nrm=fn(A.ravel(),B.ravel())
    n1,n2=len(g1),len(g2); idx=[]
    for i in range(n1-1):
        for j in range(n2-1):
            a=i*n2+j; b=a+1; c=a+n2; d=c+1; idx+= [a,c,b,b,c,d]
    return pos,nrm,np.array(idx,np.uint32)

def fix_winding(pos,nrm,idx):
    t=idx.reshape(-1,3); p0,p1,p2=pos[t[:,0]],pos[t[:,1]],pos[t[:,2]]
    gn=np.cross(p1-p0,p2-p0); vn=nrm[t[:,0]]+nrm[t[:,1]]+nrm[t[:,2]]
    flip=(gn*vn).sum(1)<0; t=t.copy(); t[flip]=t[flip][:,[0,2,1]]; return t.ravel()

# ---- body: rounded box (sharp-ish edges like the real bottle), shallow round dish on top, recessed panel underneath
HX,HY,HZ=BW/2,BH/2,BD/2
def dish_h(x,z,R0=0.15,R1=0.22,depth=0.013):
    rho=np.sqrt(x*x+z*z); return -depth*(1-smoothstep(R0,R1,rho))
def base_h(x,z,depth=0.012,inset=0.075,wall=0.022):
    sd=np.maximum(np.abs(x)-(HX-inset),np.abs(z)-(HZ-inset)); return depth*(1-smoothstep(0,wall,sd))

def box_face(axis,sign,fine):
    hs=[HX,HY,HZ]; free=[a for a in range(3) if a!=axis]
    g=[axis_grid(hs[a],R_EDGE,8,(90 if fine and a==0 else 50 if fine and a==2 else 12) if a!=1 else 30) for a in free]
    inner=np.array(hs)-R_EDGE
    def fn(u,v):
        p=np.zeros((len(u),3)); p[:,axis]=sign*hs[axis]; p[:,free[0]]=u; p[:,free[1]]=v
        c=np.clip(p,-inner,inner); d=p-c; n=d/np.linalg.norm(d,axis=1)[:,None]; pos=c+n*R_EDGE
        if axis==1 and fine:
            x,z=pos[:,0],pos[:,2]; e=1e-4
            f=dish_h if sign>0 else base_h
            h=f(x,z); fx=(f(x+e,z)-f(x-e,z))/(2*e); fz=(f(x,z+e)-f(x,z-e))/(2*e)
            inside=(np.abs(d[:,0])<1e-9)&(np.abs(d[:,2])<1e-9)
            pos[:,1]+=np.where(inside,h,0)
            nn=np.stack([-fx,np.full_like(fx,1.0),-fz],1) if sign>0 else np.stack([fx,np.full_like(fx,-1.0),fz],1)
            nn/=np.linalg.norm(nn,axis=1)[:,None]; n=np.where(inside[:,None],nn,n)
        return pos,n
    return grid_mesh(g[0],g[1],fn)

def make_body():
    P=[];N=[];I=[];off=0
    for axis in range(3):
        for sign in (1,-1):
            p,n,i=box_face(axis,sign,fine=(axis==1)); i=fix_winding(p,n,i)
            P.append(p);N.append(n);I.append(i+off);off+=len(p)
    pos=np.concatenate(P);nrm=np.concatenate(N);idx=np.concatenate(I).astype(np.uint32)
    pos[:,1]+=HY  # sit on the floor
    return pos,nrm,idx

# ---- gold collar + sprayer cap (lathe)
def arc(cx,cy,r,a0,a1,n=8): a=np.radians(np.linspace(a0,a1,n)); return [(cx+r*np.cos(t),cy+r*np.sin(t)) for t in a]
CAPK=0.80; CAPH=0.88  # cap scale vs. first version (real cap is much smaller than the bottle body)
def collar_strips():
    s=[]
    s.append([(0.17,0.0),(0.17,0.020)])                                   # base lip, vertical
    s.append([(0.17,0.020),(0.158,0.032)])                                # lip chamfer
    s.append([(0.158,0.032),(0.158,0.190)]+arc(0.150,0.190,0.008,0,90))   # lower collar, rounded shoulder
    s.append([(0.150,0.198),(0.137,0.198)])                               # shoulder, flat
    s.append([(0.137,0.198),(0.137,0.362)]+arc(0.125,0.362,0.012,0,90)[1:]) # sprayer cap wall + rounded top edge
    s.append([(0.125,0.374),(0.0,0.374)])                                 # flat top
    return [[(x*CAPK,y*CAPH) for x,y in st] for st in s]
def make_lathe(y0,seg=256):
    P=[];N=[];I=[];off=0
    for pts in collar_strips():
        pts=np.array(pts); n=len(pts)
        t=np.zeros_like(pts)
        for k in range(n): t[k]=pts[min(k+1,n-1)]-pts[max(k-1,0)]
        t/=np.linalg.norm(t,axis=1)[:,None]; nr=np.stack([t[:,1],-t[:,0]],1)
        for s in range(seg+1):
            ph=2*np.pi*s/seg; c,sn=np.cos(ph),np.sin(ph)
            for k in range(n):
                P.append((pts[k,0]*c,pts[k,1]+y0,pts[k,0]*sn)); N.append((nr[k,0]*c,nr[k,1],nr[k,0]*sn))
        ii=[]
        for s in range(seg):
            for k in range(n-1):
                a=off+s*n+k; b=a+1; c_=a+n; d=c_+1; ii+=[a,b,c_,b,d,c_]
        I.append(np.array(ii,np.uint32)); off+=(seg+1)*n
    pos=np.array(P);nrm=np.array(N);idx=np.concatenate(I)
    return pos,nrm,fix_winding(pos,nrm,idx)

def make_label(w=0.74,bottom=0.07):
    h=w*2327/1600; z=BD/2+0.0006
    pos=np.array([[-w/2,bottom,z],[w/2,bottom,z],[-w/2,bottom+h,z],[w/2,bottom+h,z]],float)
    nrm=np.tile([0,0,1.0],(4,1)); uv=np.array([[0,1],[1,1],[0,0],[1,0]],float)
    return pos,nrm,uv,np.array([0,1,2,2,1,3],np.uint32)

# ---- GLB writer
class GLB:
    def __init__(s): s.bin=bytearray(); s.views=[]; s.acc=[]; s.j={"asset":{"version":"2.0","generator":"Laniko bottle builder"},"scene":0,"scenes":[{"nodes":[0]}],"nodes":[],"meshes":[],"materials":[],"textures":[],"images":[],"samplers":[{"magFilter":9729,"minFilter":9987,"wrapS":33071,"wrapT":33071}],"accessors":[],"bufferViews":[],"extensionsUsed":["KHR_materials_clearcoat"]}
    def _view(s,data,target=None):
        while len(s.bin)%4: s.bin.append(0)
        o=len(s.bin); s.bin+=data; v={"buffer":0,"byteOffset":o,"byteLength":len(data)}
        if target: v["target"]=target
        s.j["bufferViews"].append(v); return len(s.j["bufferViews"])-1
    def accessor(s,arr,comp,typ,target,minmax=False):
        v=s._view(arr.tobytes(),target); a={"bufferView":v,"componentType":comp,"count":int(len(arr)),"type":typ}
        if minmax: a["min"]=arr.min(0).tolist(); a["max"]=arr.max(0).tolist()
        s.j["accessors"].append(a); return len(s.j["accessors"])-1
    def image(s,path):
        v=s._view(open(path,'rb').read()); s.j["images"].append({"bufferView":v,"mimeType":"image/png"})
        s.j["textures"].append({"sampler":0,"source":len(s.j["images"])-1}); return len(s.j["textures"])-1
    def mesh(s,name,pos,nrm,idx,mat,uv=None):
        at={"POSITION":s.accessor(pos.astype(np.float32),5126,"VEC3",34962,True),"NORMAL":s.accessor(nrm.astype(np.float32),5126,"VEC3",34962)}
        if uv is not None: at["TEXCOORD_0"]=s.accessor(uv.astype(np.float32),5126,"VEC2",34962)
        ind=s.accessor(idx.astype(np.uint32).reshape(-1,1),5125,"SCALAR",34963)
        s.j["meshes"].append({"name":name,"primitives":[{"attributes":at,"indices":ind,"material":mat}]})
        s.j["nodes"].append({"name":name,"mesh":len(s.j["meshes"])-1}); return len(s.j["nodes"])-1
    def save(s,path,root_name):
        kids=list(range(0,len(s.j["nodes"])))
        s.j["nodes"].append({"name":root_name,"children":kids}); s.j["scenes"][0]["nodes"]=[len(s.j["nodes"])-1]
        s.j["buffers"]=[{"byteLength":len(s.bin)}]
        js=json.dumps(s.j,separators=(',',':')).encode(); js+=b' '*((4-len(js)%4)%4)
        b=bytes(s.bin)+b'\0'*((4-len(s.bin)%4)%4)
        out=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(b))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(b),b'BIN\0')+b
        open(path,'wb').write(out); return len(out)

def build(pid,body_rgb,out):
    g=GLB()
    tc=g.image(f'tex/{pid}-color.png'); to=g.image(f'tex/{pid}-orm.png'); te=g.image(f'tex/{pid}-emit.png')
    g.j["materials"]=[
      {"name":"Body_glossy_white","pbrMetallicRoughness":{"baseColorFactor":srgb2lin(body_rgb).tolist()+[1],"metallicFactor":0,"roughnessFactor":0.16},
       "extensions":{"KHR_materials_clearcoat":{"clearcoatFactor":0.6,"clearcoatRoughnessFactor":0.04}}},
      {"name":"Gold_polished","pbrMetallicRoughness":{"baseColorFactor":srgb2lin([255,206,108]).tolist()+[1],"metallicFactor":1,"roughnessFactor":0.1}},
      {"name":"Label_print","pbrMetallicRoughness":{"baseColorTexture":{"index":tc},"metallicRoughnessTexture":{"index":to},"metallicFactor":1,"roughnessFactor":1},
       "emissiveTexture":{"index":te},"emissiveFactor":[0.4,0.4,0.4]}]
    sc=W
    p,n,i=make_body(); g.mesh("Body",p*sc,n,i,0)
    y_top=BH-0.013
    p,n,i=make_lathe(y_top); g.mesh("Collar_and_cap",p*sc,n,i,1)
    p,n,uv,i=make_label(); g.mesh("Label",p*sc,n,i,2,uv)
    return g.save(out,"Laniko_"+pid)

if __name__=='__main__':
    W_=[246,244,240]
    body={k:W_ for k in ['blanc-royal','reve-paradoxe','noir-prestige','rouge-absolu','bleu-eternel']}
    import os; os.makedirs('out',exist_ok=True)
    for k,v in body.items(): print(k,build(k,v,f'out/{k}.glb')//1024,'KB')
