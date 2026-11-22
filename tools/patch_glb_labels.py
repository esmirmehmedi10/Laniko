"""Swap the label textures (color / orm / emit, in this order) inside the finished .glb models for freshly drawn ones, keeping
the geometry and everything else. Use it after the label wording in viewer.js changes:
  1. python3 tools/texgen.py   (writes tex/<id>-color|orm|emit.png from viewer.js drawLabel)
  2. python3 tools/patch_glb_labels.py tex models/*.glb          (the id is taken from the file name)
usage: patch_glb_labels.py <tex-dir> <model.glb> [...]"""
import sys, os, json, struct

def patch(path, texdir):
    pid = os.path.basename(path).split(".")[0].replace("-v1", "")
    b = open(path, "rb").read()
    jl, _ = struct.unpack("<I4s", b[12:20]); j = json.loads(b[20:20 + jl]); off = 20 + jl
    bl, _ = struct.unpack("<I4s", b[off:off + 8]); bin0 = b[off + 8:off + 8 + bl]
    views = [bin0[v.get("byteOffset", 0):v.get("byteOffset", 0) + v["byteLength"]] for v in j["bufferViews"]]
    imgs = j["images"]
    for k, mode in enumerate(("color", "orm", "emit")):
        if k >= len(imgs): break
        views[imgs[k]["bufferView"]] = open(f"{texdir}/{pid}-{mode}.png", "rb").read()
    out = bytearray()
    for i, d in enumerate(views):
        while len(out) % 4: out.append(0)
        j["bufferViews"][i]["byteOffset"] = len(out); j["bufferViews"][i]["byteLength"] = len(d); out += d
    j["buffers"][0]["byteLength"] = len(out)
    js = json.dumps(j, separators=(",", ":")).encode(); js += b" " * ((4 - len(js) % 4) % 4)
    bb = bytes(out) + b"\0" * ((4 - len(out) % 4) % 4)
    res = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(js) + 8 + len(bb)) + struct.pack("<I4s", len(js), b"JSON") + js + struct.pack("<I4s", len(bb), b"BIN\0") + bb
    open(path, "wb").write(res); return len(res)

if __name__ == "__main__":
    for p in sys.argv[2:]: print(p, patch(p, sys.argv[1]) // 1024, "KB")
