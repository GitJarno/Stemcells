// The page's characters, drawn by one layer: an atlas of every glyph set once
// in the brand's monospace, and one quad a character, instanced. Blocks, bars
// and box lines are drawn by rule, not from the font, so they meet edge to
// edge on every system. Without WebGL2 the same marks go to a 2D canvas.

import { density } from "./form.ts";

export type Rgb = readonly [number, number, number];

export const INK: Rgb = [237, 233, 224];
export const NIGHT: Rgb = [11, 11, 12];
/** Input's amber, and nothing else's. */
export const AMBER: Rgb = [253, 190, 72];

const FONT =
  'ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const RULED = "█▓▒░▁▂▃▄▅▆▇▀▌▐─│┌┐└┘├┤┬┴┼·•";
const TYPED = (() => {
  let all = "";
  for (let code = 33; code < 127; code++) all += String.fromCharCode(code);
  return `${all}→←↑↓↵✓×…˙`;
})();
const CHARS = TYPED + RULED;
const INDEX = new Map([...CHARS].map((ch, n) => [ch, n]));

/** An atlas cell, its padding (so a glyph's neighbours stay out of its mips), and the cells a row. */
const CW = 32,
  CH = 64,
  PAD = 4,
  COLS = 16;
const SW = CW + PAD * 2,
  SH = CH + PAD * 2;
const ROWS = Math.ceil(CHARS.length / COLS);

/** A ruled glyph's rectangles, in cell fractions: x, y, width, height, ink. */
function ruled(ch: string): readonly (readonly [number, number, number, number, number])[] {
  const t = 0.09,
    mx = 0.5 - t,
    my = 0.5 - t / 2,
    w = t * 2,
    h = t;
  const left = [0, my, 0.5 + t, h, 1] as const,
    right = [mx, my, 0.5 + t, h, 1] as const,
    up = [mx, 0, w, 0.5 + t / 2, 1] as const,
    down = [mx, my, w, 0.5 + t / 2, 1] as const;
  const bar = "▁▂▃▄▅▆▇".indexOf(ch);
  if (bar >= 0) return [[0, 1 - (bar + 1) / 8, 1, (bar + 1) / 8, 1]];
  switch (ch) {
    case "█":
      return [[0, 0, 1, 1, 1]];
    case "▓":
      return [[0, 0, 1, 1, 0.72]];
    case "▒":
      return [[0, 0, 1, 1, 0.46]];
    case "░":
      return [[0, 0, 1, 1, 0.22]];
    case "▀":
      return [[0, 0, 1, 0.5, 1]];
    case "▌":
      return [[0, 0, 0.5, 1, 1]];
    case "▐":
      return [[0.5, 0, 0.5, 1, 1]];
    case "─":
      return [[0, my, 1, h, 1]];
    case "│":
      return [[mx, 0, w, 1, 1]];
    case "┌":
      return [right, down];
    case "┐":
      return [left, down];
    case "└":
      return [right, up];
    case "┘":
      return [left, up];
    case "├":
      return [[mx, 0, w, 1, 1], right];
    case "┤":
      return [[mx, 0, w, 1, 1], left];
    case "┬":
      return [[0, my, 1, h, 1], down];
    case "┴":
      return [[0, my, 1, h, 1], up];
    case "┼":
      return [
        [0, my, 1, h, 1],
        [mx, 0, w, 1, 1],
      ];
    case "·":
      return [[0.5 - 0.11, 0.5 - 0.055, 0.22, 0.11, 1]];
    case "•":
      return [[0.5 - 0.2, 0.5 - 0.1, 0.4, 0.2, 1]];
    default:
      return [];
  }
}

let atlas: HTMLCanvasElement | undefined;
function atlasOf(): HTMLCanvasElement {
  if (atlas !== undefined) return atlas;
  const canvas = document.createElement("canvas");
  canvas.width = COLS * SW;
  canvas.height = ROWS * SH;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#fff";
  context.textAlign = "center";
  context.textBaseline = "alphabetic";
  context.font = `500 ${CH * 0.8}px ${FONT}`;
  [...CHARS].forEach((ch, n) => {
    const x = (n % COLS) * SW + PAD,
      y = Math.floor(n / COLS) * SH + PAD;
    if (RULED.includes(ch)) {
      for (const [rx, ry, rw, rh, ink] of ruled(ch)) {
        context.globalAlpha = ink;
        context.fillRect(x + rx * CW, y + ry * CH, rw * CW, rh * CH);
      }
      context.globalAlpha = 1;
    } else {
      context.save();
      context.beginPath();
      context.rect(x, y, CW, CH);
      context.clip();
      context.fillText(ch, x + CW / 2, y + CH * 0.76);
      context.restore();
    }
  });
  atlas = canvas;
  return canvas;
}

const VS = `#version 300 es
layout(location=0) in vec2 q;
layout(location=1) in vec4 a0;
layout(location=2) in vec4 a1;
uniform vec2 res; uniform vec2 tex;
out vec2 uv; out vec4 col;
void main(){
  vec2 size = vec2(a0.z * 0.5, a0.z);
  vec2 xy = a0.xy + (q - 0.5) * size;
  gl_Position = vec4(xy / res * 2.0 - 1.0, 0.0, 1.0); gl_Position.y = -gl_Position.y;
  float id = a1.w; vec2 slot = vec2(mod(id, ${COLS}.0), floor(id / ${COLS}.0));
  uv = (slot * vec2(${SW}.0, ${SH}.0) + ${PAD}.0 + q * vec2(${CW}.0, ${CH}.0)) / tex;
  col = vec4(a1.rgb, a0.w);
}`;
const FS = `#version 300 es
precision mediump float;
in vec2 uv; in vec4 col; out vec4 o;
uniform sampler2D atlas;
void main(){ float a = texture(atlas, uv).a * col.a; o = vec4(col.rgb * a, a); }`;

/** Floats a mark: x, y, height, alpha, r, g, b, glyph. */
const STRIDE = 8;

export class Glyphs {
  readonly canvas: HTMLCanvasElement;
  /** CSS pixels. */
  width = 0;
  height = 0;
  #d = 1;
  #gl: WebGL2RenderingContext | null = null;
  #context: CanvasRenderingContext2D | null = null;
  #data = new Float32Array(STRIDE * 4096);
  #count = 0;
  #buffer: WebGLBuffer | null = null;
  #res: WebGLUniformLocation | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.setAttribute("aria-hidden", "true");
    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: true,
    });
    if (gl !== null && this.#start(gl)) this.#gl = gl;
    else this.#context = canvas.getContext("2d");
    canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
    canvas.addEventListener("webglcontextrestored", () => {
      if (this.#gl !== null) this.#start(this.#gl);
    });
  }

  #start(gl: WebGL2RenderingContext): boolean {
    const program = gl.createProgram();
    for (const [type, source] of [
      [gl.VERTEX_SHADER, VS],
      [gl.FRAGMENT_SHADER, FS],
    ] as const) {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return false;
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return false;
    gl.useProgram(program);
    const quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.#buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffer);
    for (const [at, offset] of [
      [1, 0],
      [2, 16],
    ] as const) {
      gl.enableVertexAttribArray(at);
      gl.vertexAttribPointer(at, 4, gl.FLOAT, false, STRIDE * 4, offset);
      gl.vertexAttribDivisor(at, 1);
    }
    const sheet = atlasOf();
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sheet);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform2f(gl.getUniformLocation(program, "tex"), sheet.width, sheet.height);
    this.#res = gl.getUniformLocation(program, "res");
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    return true;
  }

  /** Sizes the layer to `width` by `height` CSS pixels. */
  size(width: number, height: number): void {
    const d = density();
    if (width === this.width && height === this.height && d === this.#d) return;
    this.width = width;
    this.height = height;
    this.#d = d;
    this.canvas.width = Math.round(width * d);
    this.canvas.height = Math.round(height * d);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  clear(): void {
    this.#count = 0;
  }

  /** `ch` centred at (x, y) CSS pixels, its cell `h` tall and half as wide. */
  put(ch: string, x: number, y: number, h: number, rgb: Rgb, alpha = 1): void {
    const glyph = INDEX.get(ch);
    if (glyph === undefined || alpha <= 0.004) return;
    if ((this.#count + 1) * STRIDE > this.#data.length) {
      const grown = new Float32Array(this.#data.length * 2);
      grown.set(this.#data);
      this.#data = grown;
    }
    const d = this.#d,
      o = this.#count++ * STRIDE,
      data = this.#data;
    // Whole device pixels at the cell's corner, so a glyph at rest keeps its edges.
    const dh = h * d,
      dw = dh / 2;
    data[o] = Math.round(x * d - dw / 2) + dw / 2;
    data[o + 1] = Math.round(y * d - dh / 2) + dh / 2;
    data[o + 2] = dh;
    data[o + 3] = alpha;
    data[o + 4] = rgb[0] / 255;
    data[o + 5] = rgb[1] / 255;
    data[o + 6] = rgb[2] / 255;
    data[o + 7] = glyph;
  }

  /** A run of characters from `x` (its left edge), centred on `y`. */
  text(text: string, x: number, y: number, h: number, rgb: Rgb, alpha = 1): void {
    let at = x + h / 4;
    for (const ch of text) {
      if (ch !== " ") this.put(ch, at, y, h, rgb, alpha);
      at += h / 2;
    }
  }

  flush(): void {
    const gl = this.#gl;
    if (gl === null) return this.#flush2d();
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.#count === 0) return;
    gl.uniform2f(this.#res, this.canvas.width, this.canvas.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.#buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.#data.subarray(0, this.#count * STRIDE), gl.DYNAMIC_DRAW);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.#count);
  }

  #flush2d(): void {
    const context = this.#context;
    if (context === null) return;
    const data = this.#data;
    context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (let n = 0; n < this.#count; n++) {
      const o = n * STRIDE,
        h = data[o + 2]!,
        glyph = data[o + 7]!;
      context.globalAlpha = data[o + 3]!;
      context.drawImage(
        tinted(data[o + 4]!, data[o + 5]!, data[o + 6]!),
        (glyph % COLS) * SW + PAD,
        Math.floor(glyph / COLS) * SH + PAD,
        CW,
        CH,
        data[o]! - h / 4,
        data[o + 1]! - h / 2,
        h / 2,
        h,
      );
    }
    context.globalAlpha = 1;
  }
}

const tints = new Map<string, HTMLCanvasElement>();
/** The atlas in one colour, for the 2D layer: the page draws in a handful. */
function tinted(r: number, g: number, b: number): HTMLCanvasElement {
  const colour = `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)})`;
  let sheet = tints.get(colour);
  if (sheet === undefined) {
    const white = atlasOf();
    sheet = document.createElement("canvas");
    sheet.width = white.width;
    sheet.height = white.height;
    const context = sheet.getContext("2d")!;
    context.drawImage(white, 0, 0);
    context.globalCompositeOperation = "source-in";
    context.fillStyle = colour;
    context.fillRect(0, 0, sheet.width, sheet.height);
    if (tints.size > 48) tints.clear();
    tints.set(colour, sheet);
  }
  return sheet;
}
