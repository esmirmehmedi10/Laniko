// Animates the smoke that is already in the product photo.
//
// A small raw-WebGL2 renderer draws the photo and, only where a hand-tuned mask says "smoke"
// (images/<id>-smoke.png), makes the picture flow slowly upwards and sideways (a classic
// flow-map warp). Everywhere else, including the logo and name at the top, the photo is
// reproduced pixel for pixel. Nothing is added to the picture.
//
// createSmokeBackground(...) returns null when WebGL2 or the shader is unavailable; the caller then
// simply keeps showing the still photo.

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uPlate;
uniform sampler2D uMask;
uniform sampler2D uNoise;
uniform float uTime;
uniform float uAmp;
in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 uv = vUv;
  float m = texture(uMask, uv).r;
  // slowly wandering direction field: mostly upwards, swirling a little sideways
  vec2 n1 = texture(uNoise, uv * vec2(1.4, 2.0) + vec2(uTime * 0.012, uTime * 0.020)).rg - 0.5;
  vec2 n2 = texture(uNoise, uv * vec2(3.1, 4.3) + vec2(uTime * -0.030, uTime * 0.042)).rg - 0.5;
  vec2 flow = vec2(n1.x * 2.0 + n2.x * 0.8, 0.55 + n1.y * 1.0 + n2.y * 0.5) * uAmp * m;
  // continuously evolving curl-like wobble so the wisps visibly twist and billow
  vec2 w = texture(uNoise, uv * vec2(2.2, 3.0) + vec2(uTime * 0.035, -uTime * 0.05)).rg - 0.5;
  vec2 w2 = texture(uNoise, uv * vec2(5.0, 6.5) + vec2(-uTime * 0.06, uTime * 0.075)).rg - 0.5;
  vec2 wob = (w * 0.05 + w2 * 0.018) * m;
  // two phases, cross-faded, so the motion never visibly resets
  float sp = 0.14;
  float p1 = fract(uTime * sp);
  float p2 = fract(uTime * sp + 0.5);
  float w1 = 1.0 - abs(2.0 * p1 - 1.0);
  vec3 a = texture(uPlate, uv - flow * p1 + wob).rgb;
  vec3 b = texture(uPlate, uv - flow * p2 + wob).rgb;
  vec3 c = mix(b, a, w1);
  c *= 1.0 + 0.10 * m * sin(uTime * 0.9 + n1.x * 9.0);
  outColor = vec4(c, 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("smoke shader:", gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}

// smooth tiling noise (two channels) generated on the CPU
function makeNoise(size = 256) {
  const g = 16; // lattice cells
  const lat = new Float32Array(g * g * 2);
  let seed = 1234567;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < lat.length; i++) lat[i] = rnd();
  const at = (x, y, c) => lat[((((y % g) + g) % g) * g + (((x % g) + g) % g)) * 2 + c];
  const data = new Uint8Array(size * size * 4);
  const f = (t) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x / size) * g, gy = (y / size) * g;
      const x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = f(gx - x0), fy = f(gy - y0);
      const i = (y * size + x) * 4;
      for (let c = 0; c < 2; c++) {
        const v0 = at(x0, y0, c) * (1 - fx) + at(x0 + 1, y0, c) * fx;
        const v1 = at(x0, y0 + 1, c) * (1 - fx) + at(x0 + 1, y0 + 1, c) * fx;
        data[i + c] = Math.round((v0 * (1 - fy) + v1 * fy) * 255);
      }
      data[i + 2] = 128; data[i + 3] = 255;
    }
  }
  return data;
}

export function createSmokeBackground(canvas, plateImg, maskImg, { amp = 0.16 } = {}) {
  let gl;
  try {
    gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
  } catch { gl = null; }
  if (!gl) return null;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error("smoke program:", gl.getProgramInfoLog(prog));
    return null;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const makeTex = (unit, wrap, mip) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    return t;
  };
  const texPlate = makeTex(0, gl.CLAMP_TO_EDGE, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, plateImg);
  gl.generateMipmap(gl.TEXTURE_2D);
  const texMask = makeTex(1, gl.CLAMP_TO_EDGE, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, maskImg);
  const texNoise = makeTex(2, gl.REPEAT, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, makeNoise(256));
  gl.uniform1i(gl.getUniformLocation(prog, "uPlate"), 0);
  gl.uniform1i(gl.getUniformLocation(prog, "uMask"), 1);
  gl.uniform1i(gl.getUniformLocation(prog, "uNoise"), 2);
  gl.uniform1f(gl.getUniformLocation(prog, "uAmp"), amp);
  const uTime = gl.getUniformLocation(prog, "uTime");

  const draw = (t) => {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  let raf = 0, t0 = 0, running = false, speed = 1;
  const frame = (now) => {
    if (!running) return;
    if (!t0) t0 = now;
    draw(((now - t0) / 1000) * speed);
    raf = requestAnimationFrame(frame);
  };

  return {
    draw,
    ok: gl.getError() === gl.NO_ERROR,
    resize(cssH, ar, dpr) {
      const h = Math.max(2, Math.round(cssH * dpr));
      const w = Math.max(2, Math.round(cssH * ar * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    },
    start() { if (!running) { running = true; raf = requestAnimationFrame(frame); } },
    stop() { running = false; cancelAnimationFrame(raf); },
    dispose() {
      running = false;
      cancelAnimationFrame(raf);
      const ext = gl.getExtension("WEBGL_lose_context");
      if (ext) ext.loseContext();
    },
  };
}
