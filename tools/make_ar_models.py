"""Builds light AR versions of the bottle models: models/ar/<id>-v2.glb
Why: the display model carries a 3200x4654 label texture (about 59 MB on the phone's GPU) and a bottom logo nobody sees in AR.
AR needs fast loading and fast start, so here the textures are scaled down, indices use 16 bits and the hidden base logo is dropped.
Run from the repo root:  python3 tools/make_ar_models.py"""
import io, json, struct, sys, os
from PIL import Image

TEX_MAX = 1024          # longest texture side (px)
DROP = {"Base_logo"}    # meshes nobody sees in AR (bottom of the bottle)
COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}

def read_glb(path):
    b = open(path, "rb").read()
    jl = struct.unpack("<I", b[12:16])[0]
    j = json.loads(b[20:20 + jl])
    off = 20 + jl + 8
    return j, b[off:]

def accessor_bytes(j, bin_, a):
    bv = j["bufferViews"][a["bufferView"]]
    size = COMP[a["componentType"]][1] * NCOMP[a["type"]] * a["count"]
    assert "byteStride" not in bv or bv["byteStride"] in (0, COMP[a["componentType"]][1] * NCOMP[a["type"]]), "interleaved data not supported"
    start = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    return bin_[start:start + size]

def build(src, dst):
    j, bin_ = read_glb(src)
    for n in j["nodes"]:
        if "mesh" in n and j["meshes"][n["mesh"]].get("name") in DROP:
            del n["mesh"]
    used = {n["mesh"] for n in j["nodes"] if "mesh" in n}
    out = bytearray(); views = []; accs = []

    def add_view(data, target=None):
        while len(out) % 4: out.append(0)
        v = {"buffer": 0, "byteOffset": len(out), "byteLength": len(data)}
        if target: v["target"] = target
        out.extend(data); views.append(v); return len(views) - 1

    def add_acc(old, data, ctype, target):
        a = {"bufferView": add_view(data, target), "componentType": ctype, "count": old["count"], "type": old["type"]}
        for k in ("min", "max", "normalized"):
            if k in old: a[k] = old[k]
        accs.append(a); return len(accs) - 1

    for mi, m in enumerate(j["meshes"]):
        if mi not in used: continue
        for p in m["primitives"]:
            for k, ai in list(p["attributes"].items()):
                a = j["accessors"][ai]
                p["attributes"][k] = add_acc(a, accessor_bytes(j, bin_, a), a["componentType"], 34962)
            if "indices" in p:
                a = j["accessors"][p["indices"]]
                raw = accessor_bytes(j, bin_, a)
                fmt, sz = COMP[a["componentType"]]
                vals = struct.unpack("<%d%s" % (a["count"], fmt), raw)
                if max(vals) < 65535:
                    p["indices"] = add_acc(a, struct.pack("<%dH" % len(vals), *vals), 5123, 34963)
                else:
                    p["indices"] = add_acc(a, raw, a["componentType"], 34963)
    # drop meshes that are no longer used, renumber
    remap = {}; meshes = []
    for mi, m in enumerate(j["meshes"]):
        if mi in used: remap[mi] = len(meshes); meshes.append(m)
    for n in j["nodes"]:
        if "mesh" in n: n["mesh"] = remap[n["mesh"]]
    j["meshes"] = meshes
    # images: smaller, JPEG when there is no transparency
    for im in j["images"]:
        bv = j["bufferViews"][im["bufferView"]]
        data = bin_[bv.get("byteOffset", 0):bv.get("byteOffset", 0) + bv["byteLength"]]
        img = Image.open(io.BytesIO(data)); img.load()
        s = min(1.0, TEX_MAX / max(img.size))
        if s < 1: img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
        opaque = img.mode in ("RGB", "L") or (img.mode == "RGBA" and img.getchannel("A").getextrema()[0] == 255)
        buf = io.BytesIO()
        if opaque: img.convert("RGB").save(buf, "JPEG", quality=88, optimize=True); im["mimeType"] = "image/jpeg"
        else: img.save(buf, "PNG", optimize=True); im["mimeType"] = "image/png"
        im["bufferView"] = add_view(buf.getvalue())
    j["accessors"] = accs; j["bufferViews"] = views
    while len(out) % 4: out.append(0)
    j["buffers"] = [{"byteLength": len(out)}]
    js = json.dumps(j, separators=(",", ":")).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    body = bytes(out) + b"\0" * ((4 - len(out) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(body)
    with open(dst, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack("<II", len(body), 0x004E4942)); f.write(body)
    return total

if __name__ == "__main__":
    os.makedirs("models/ar", exist_ok=True)
    for f in sorted(os.listdir("models")):
        if f.endswith(".glb"):
            dst = "models/ar/" + f[:-4] + "-v2.glb"
            a = os.path.getsize("models/" + f); t = build("models/" + f, dst)
            print(f"{f}: {a//1024} KB -> {t//1024} KB")
