// One field of points that takes any shape: each shape gives every point a place and an ink, and
// a point travels from its place in one shape to its place in the next. Lines, textured sheets
// and labels belong to a shape and come and go with it. Plain WebGL; it draws nothing without it.

export type Vec = readonly [number, number, number];
export type Rgb = readonly [number, number, number];
/** Where a shape is looked at from: turned and raised in radians, how far off, and at what. */
export interface Eye {
  readonly yaw: number;
  readonly pitch: number;
  readonly far: number;
  readonly at: Vec;
  /** How far it sways on its own, radians. */
  readonly sway: number;
}
export interface Frame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
/** Lines with a place in the shape and, where the next shape is the same thing changed, one in that too. */
export interface Lines {
  readonly pos: Float32Array;
  readonly ink: Float32Array;
}
export interface Sheet {
  readonly image: HTMLCanvasElement;
  /** Its corners: top left, top right, bottom left, bottom right. */
  readonly corners: readonly [Vec, Vec, Vec, Vec];
}
/** What a label is drawn with: a place on the canvas for a place in the shape, and how much of it is there. */
export interface Pen {
  readonly ctx: CanvasRenderingContext2D;
  readonly frame: Frame;
  readonly narrow: boolean;
  readonly alpha: number;
  /** 0 at this shape, towards 1 on the way to the next of its family and from -1 on the way in from the last. */
  readonly along: number;
  place(point: Vec): readonly [number, number];
}
export interface Shape {
  /** Three numbers a point: its place. In canvas pixels when there is no eye. */
  readonly pos: Float32Array;
  /** Four a point: red, green, blue, and its size in pixels. */
  readonly ink: Float32Array;
  readonly eye: Eye | null;
  /** When each point sets off for the next shape, 0..1. */
  readonly waits?: Float32Array;
  readonly lines?: Lines;
  readonly sheets?: readonly Sheet[];
  /** Two shapes of one family are one thing changed: their lines and sheets morph, not fade. */
  readonly family?: string;
  /** How bright the points stay once the sheets have come in over them. */
  readonly dim?: number;
  readonly tick?: (time: number) => void;
  readonly label?: (pen: Pen) => void;
}

const POINTS = `
attribute vec3 a, b; attribute vec4 ia, ib; attribute float wait, seed;
uniform mat4 A, B; uniform vec4 frame; uniform vec2 near, dims; uniform float m, px, swirl;
varying vec4 ink;
void main() {
  float u = clamp(m * 1.7 - wait * 0.7, 0.0, 1.0); u = u * u * (3.0 - 2.0 * u);
  vec4 ca = A * vec4(a, 1.0), cb = B * vec4(b, 1.0);
  vec2 at = mix(ca.xy / ca.w, cb.xy / cb.w, u);
  float away = u * (1.0 - u) * 4.0, turn = seed * 6.2832 + u * 2.4;
  at += away * swirl * (0.25 + fract(seed * 7.31)) * vec2(cos(turn), sin(turn) * 0.8 + 0.35);
  gl_Position = vec4(at * frame.xy + frame.zw, 0.0, 1.0);
  vec4 i = mix(ia, ib, u);
  float size = mix(ia.w * near.x / ca.w, ib.w * near.y / cb.w, u) * px;
  // A point smaller than a pixel is drawn at one, and fainter.
  gl_PointSize = max(size, 1.5);
  float thin = min(1.0, size * size / 2.25);
  ink = vec4(i.rgb * mix(dims.x, dims.y, u) * thin * (1.0 + away * 0.35), 1.0);
}`;
const DOT = `
precision mediump float; varying vec4 ink;
void main() {
  float r = length(gl_PointCoord - 0.5) * 2.0;
  float there = smoothstep(1.0, 0.35, r);
  gl_FragColor = vec4(ink.rgb * there, there * 0.35 * max(ink.r, max(ink.g, ink.b)));
}`;
const STROKES = `
attribute vec3 a, b; attribute vec4 ia, ib;
uniform mat4 A, B; uniform vec4 frame; uniform float m, alpha;
varying vec4 ink;
void main() {
  vec4 ca = A * vec4(a, 1.0), cb = B * vec4(b, 1.0);
  gl_Position = vec4(mix(ca.xy / ca.w, cb.xy / cb.w, m) * frame.xy + frame.zw, 0.0, 1.0);
  ink = mix(ia, ib, m); ink.a *= alpha;
}`;
const STROKE = `
precision mediump float; varying vec4 ink;
void main() { gl_FragColor = vec4(ink.rgb * ink.a, ink.a * 0.4); }`;
const SHEETS = `
attribute vec3 a, b; attribute vec2 uv;
uniform mat4 A, B; uniform vec4 frame; uniform float m; varying vec2 at; 
void main() {
  vec4 ca = A * vec4(a, 1.0), cb = B * vec4(b, 1.0), c = mix(ca, cb, m);
  gl_Position = vec4(c.xy * frame.xy + frame.zw * c.w, 0.0, c.w); at = uv;
}`;
const SHEET = `
precision mediump float; varying vec2 at; uniform sampler2D image; uniform float alpha;
void main() { gl_FragColor = texture2D(image, at) * alpha; }`;

type Mat = Float32Array;
const multiply = (a: Mat, b: Mat): Mat => {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r]! += a[k * 4 + r]! * b[c * 4 + k]!;
  return out;
};
const FOV = 0.62;

/** The eye's view of a frame `aspect` wide. A narrow frame is looked at from further off, so its width still fits. */
function seen(eye: Eye, aspect: number, sway: number, tilt: readonly [number, number]): Mat {
  const far = eye.far * Math.max(1, 1.25 / aspect);
  const yaw = eye.yaw + sway * eye.sway + tilt[0],
    pitch = eye.pitch + tilt[1];
  const [cy, sy, cp, sp] = [Math.cos(yaw), Math.sin(yaw), Math.cos(pitch), Math.sin(pitch)];
  const f = 1 / Math.tan(FOV / 2);
  const project = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, -1, -1, 0, 0, 0, 0]);
  // prettier-ignore
  const turn = new Float32Array([cy, sp * sy, -cp * sy, 0, 0, cp, sp, 0, sy, -sp * cy, cp * cy, 0, 0, 0, -far, 1]);
  const [x, y, z] = eye.at;
  const move = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -x, -y, -z, 1]);
  return multiply(project, multiply(turn, move));
}

export class Stage {
  readonly canvas = document.createElement("canvas");
  readonly words = document.createElement("canvas");
  readonly count: number;
  readonly #gl: WebGLRenderingContext | null;
  readonly #ctx: CanvasRenderingContext2D;
  #shapes: readonly Shape[] = [];
  #programs: WebGLProgram[] = [];
  readonly #buffers = new Map<Float32Array, WebGLBuffer>();
  readonly #textures = new Map<HTMLCanvasElement, WebGLTexture>();
  readonly #seeds: Float32Array;
  #w = 1;
  #h = 1;
  #k = 1;
  #frame: Frame = { x: 0, y: 0, w: 1, h: 1 };

  constructor(count: number) {
    this.count = count;
    this.#seeds = new Float32Array(count);
    for (let n = 0; n < count; n++) this.#seeds[n] = (n * 0.61803398875) % 1;
    this.#gl = this.canvas.getContext("webgl", { alpha: true, antialias: true });
    this.#ctx = this.words.getContext("2d")!;
    this.#start();
    this.canvas.addEventListener("webglcontextlost", (event) => event.preventDefault());
    this.canvas.addEventListener("webglcontextrestored", () => {
      this.#buffers.clear();
      this.#textures.clear();
      this.#start();
    });
  }

  /** Whether this browser can draw it. */
  get able(): boolean {
    return this.#gl !== null && !this.#gl.isContextLost() && this.#programs.length > 0;
  }

  #start(): void {
    const gl = this.#gl;
    if (gl === null) return;
    const program = (vertex: string, fragment: string): WebGLProgram | null => {
      const made = gl.createProgram();
      for (const [kind, source] of [
        [gl.VERTEX_SHADER, vertex],
        [gl.FRAGMENT_SHADER, fragment],
      ] as const) {
        const shader = gl.createShader(kind)!;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        gl.attachShader(made, shader);
      }
      gl.linkProgram(made);
      return gl.getProgramParameter(made, gl.LINK_STATUS) ? made : null;
    };
    const made = [program(POINTS, DOT), program(STROKES, STROKE), program(SHEETS, SHEET)];
    this.#programs = made.every((each) => each !== null) ? (made as WebGLProgram[]) : [];
  }

  shapes(shapes: readonly Shape[]): void {
    this.#shapes = shapes;
  }

  /** The canvas's size in CSS pixels, the device pixels to one, and where on it the shapes stand. */
  lay(w: number, h: number, k: number, frame: Frame): void {
    this.#frame = frame;
    if (w === this.#w && h === this.#h && k === this.#k) return;
    [this.#w, this.#h, this.#k] = [w, h, k];
    for (const canvas of [this.canvas, this.words]) {
      canvas.width = Math.round(w * k);
      canvas.height = Math.round(h * k);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
  }

  #buffer(data: Float32Array, live: boolean): WebGLBuffer {
    const gl = this.#gl!;
    let buffer = this.#buffers.get(data);
    const fresh = buffer === undefined;
    if (buffer === undefined) this.#buffers.set(data, (buffer = gl.createBuffer()));
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    if (fresh || live)
      gl.bufferData(gl.ARRAY_BUFFER, data, live ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    return buffer;
  }
  #feed(program: WebGLProgram, name: string, data: Float32Array, size: number, live = false): void {
    const gl = this.#gl!;
    const at = gl.getAttribLocation(program, name);
    this.#buffer(data, live);
    if (at < 0) return;
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, size, gl.FLOAT, false, 0, 0);
  }
  #texture(image: HTMLCanvasElement): WebGLTexture {
    const gl = this.#gl!;
    let texture = this.#textures.get(image);
    if (texture === undefined) {
      this.#textures.set(image, (texture = gl.createTexture()));
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
    gl.bindTexture(gl.TEXTURE_2D, texture);
    return texture;
  }

  /** The shapes `at` along their order: 1.5 is halfway from the second to the third. */
  draw(at: number, time: number, tilt: readonly [number, number], shown = 1): void {
    const gl = this.#gl;
    if (gl === null || !this.able || this.#shapes.length === 0) return;
    const from = Math.max(0, Math.min(this.#shapes.length - 1, Math.floor(at)));
    const a = this.#shapes[from]!,
      b = this.#shapes[Math.min(from + 1, this.#shapes.length - 1)]!;
    const m = a === b ? 0 : at - from;
    a.tick?.(time);
    if (b !== a && m > 0) b.tick?.(time);

    const { x, y, w, h } = this.#frame;
    const aspect = w / h;
    const sway = Math.sin(time * 0.35);
    /** Canvas pixels straight onto the frame's own square, for a shape with no eye. */
    const flat = new Float32Array([
      2 / w,
      0,
      0,
      0,
      0,
      -2 / h,
      0,
      0,
      0,
      0,
      0,
      0,
      -1 - (2 * x) / w,
      1 + (2 * y) / h,
      0,
      1,
    ]);
    const view = (shape: Shape) =>
      shape.eye === null ? flat : seen(shape.eye, aspect, sway, tilt);
    const A = view(a),
      B = view(b);
    const frame = new Float32Array([
      w / this.#w,
      h / this.#h,
      ((x + w / 2) / this.#w) * 2 - 1,
      1 - ((y + h / 2) / this.#h) * 2,
    ]);

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    this.canvas.style.opacity = this.words.style.opacity = `${shown}`;

    const same = a.family !== undefined && a.family === b.family;
    const eased = m * m * (3 - 2 * m);
    /** How much of what belongs to a shape alone is there: gone early on the way out, in late on the way in. */
    const going = same ? 1 : Math.max(0, 1 - m * 4),
      coming = same ? 0 : Math.max(0, (m - 0.72) / 0.28);

    const strokes = (shape: Shape, other: Shape, V: Mat, W: Mat, mix: number, alpha: number) => {
      if (shape.lines === undefined || alpha <= 0) return;
      const program = this.#programs[1]!;
      const next = other.lines ?? shape.lines;
      gl.useProgram(program);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      this.#feed(program, "a", shape.lines.pos, 3);
      this.#feed(program, "b", next.pos, 3);
      this.#feed(program, "ia", shape.lines.ink, 4);
      this.#feed(program, "ib", next.ink, 4);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "A"), false, V);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "B"), false, W);
      gl.uniform4fv(gl.getUniformLocation(program, "frame"), frame);
      gl.uniform1f(gl.getUniformLocation(program, "m"), mix);
      gl.uniform1f(gl.getUniformLocation(program, "alpha"), alpha);
      gl.drawArrays(gl.LINES, 0, shape.lines.pos.length / 3);
    };
    const sheets = (shape: Shape, other: Shape, V: Mat, W: Mat, mix: number, alpha: number) => {
      if (shape.sheets === undefined || alpha <= 0) return;
      const program = this.#programs[2]!;
      gl.useProgram(program);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "A"), false, V);
      gl.uniformMatrix4fv(gl.getUniformLocation(program, "B"), false, W);
      gl.uniform4fv(gl.getUniformLocation(program, "frame"), frame);
      gl.uniform1f(gl.getUniformLocation(program, "m"), mix);
      gl.uniform1f(gl.getUniformLocation(program, "alpha"), alpha);
      shape.sheets.forEach((sheet, n) => {
        const next = other.sheets?.[n] ?? sheet;
        this.#texture(sheet.image);
        this.#feed(program, "a", cornersOf(sheet), 3);
        this.#feed(program, "b", cornersOf(next), 3);
        this.#feed(program, "uv", UV, 2);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      });
    };
    if (same) {
      sheets(a, b, A, B, eased, 1);
      strokes(a, b, A, B, eased, 1);
    } else {
      sheets(a, a, A, A, 0, going);
      strokes(a, a, A, A, 0, going);
      sheets(b, b, B, B, 0, coming);
      strokes(b, b, B, B, 0, coming);
    }

    const program = this.#programs[0]!;
    gl.useProgram(program);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.#feed(program, "a", a.pos, 3, a.tick !== undefined);
    this.#feed(program, "b", b.pos, 3, b.tick !== undefined);
    this.#feed(program, "ia", a.ink, 4);
    this.#feed(program, "ib", b.ink, 4);
    this.#feed(program, "wait", a.waits ?? this.#seeds, 1);
    this.#feed(program, "seed", this.#seeds, 1);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "A"), false, A);
    gl.uniformMatrix4fv(gl.getUniformLocation(program, "B"), false, B);
    gl.uniform4fv(gl.getUniformLocation(program, "frame"), frame);
    const reach = (shape: Shape) =>
      shape.eye === null ? 1 : shape.eye.far * Math.max(1, 1.25 / aspect);
    gl.uniform2f(gl.getUniformLocation(program, "near"), reach(a), reach(b));
    gl.uniform2f(
      gl.getUniformLocation(program, "dims"),
      1 - (1 - (a.dim ?? 1)) * (same ? 1 : going),
      1 - (1 - (b.dim ?? 1)) * (same ? 1 : coming),
    );
    gl.uniform1f(gl.getUniformLocation(program, "m"), m);
    gl.uniform1f(
      gl.getUniformLocation(program, "px"),
      this.#k * Math.max(0.72, Math.min(1.15, w / 700)),
    );
    gl.uniform1f(gl.getUniformLocation(program, "swirl"), same ? 0.015 : 0.16);
    gl.drawArrays(gl.POINTS, 0, this.count);

    const ctx = this.#ctx;
    ctx.setTransform(this.#k, 0, 0, this.#k, 0, 0);
    ctx.clearRect(0, 0, this.#w, this.#h);
    const write = (shape: Shape, V: Mat, alpha: number, along: number) => {
      if (shape.label === undefined || alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = alpha;
      shape.label({
        ctx,
        frame: this.#frame,
        narrow: w < 500,
        alpha,
        along,
        place: (point) => {
          const [px, py, pz] = point;
          const at = (r: number) => V[r]! * px + V[4 + r]! * py + V[8 + r]! * pz + V[12 + r]!;
          const d = at(3);
          return [x + (at(0) / d / 2 + 0.5) * w, y + (0.5 - at(1) / d / 2) * h];
        },
      });
      ctx.restore();
    };
    if (same) write(...((m < 0.5 ? [a, A, 1, m] : [b, B, 1, m - 1]) as Parameters<typeof write>));
    else {
      write(a, A, going, 0);
      write(b, B, coming, 0);
    }
  }
}

const UV = new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]);
const CORNERS = new WeakMap<Sheet, Float32Array>();
function cornersOf(sheet: Sheet): Float32Array {
  let flat = CORNERS.get(sheet);
  if (flat === undefined) CORNERS.set(sheet, (flat = new Float32Array(sheet.corners.flat())));
  return flat;
}
