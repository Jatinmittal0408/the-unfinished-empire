// A held frame that clears over the incoming clip: either evenly (dissolve) or darkest-first (threshold: the
// incoming clip shows first through shadows, doorways and openings, then everywhere).
//
// The outgoing picture (a paused video or a still) is copied once into a texture of a WebGL canvas that was
// created and compiled in advance, at idle. The video element is then hidden, so the compositor has a static
// canvas over the one playing video. Each animation frame only a uniform changes. (Fading a paused <video>
// layer instead measured 4–5 dropped compositor frames per join; creating the context at the cut, ≈90 ms.)
const VERT = `attribute vec2 p; varying vec2 uv; void main(){ uv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `precision mediump float; varying vec2 uv; uniform sampler2D tex; uniform float t; uniform float soft; uniform float mode;
void main(){ vec4 c = texture2D(tex, uv); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
  float a = mode < 0.5 ? 1.0 - t : smoothstep(t - soft, t + soft, l);
  gl_FragColor = vec4(c.rgb * a, a); }`;

export type ClearMode = 'dissolve' | 'threshold';

export class HeldFrame {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private uT: WebGLUniformLocation;
  private uMode: WebGLUniformLocation;
  private mode: ClearMode = 'dissolve';
  readonly soft = 0.12;

  static supported() { try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; } }

  /** Creates and compiles everything up front (call at idle); nothing is drawn until capture(). */
  constructor(width: number, height: number) {
    const c = (this.canvas = document.createElement('canvas'));
    c.width = width; c.height = height; c.className = 'plate-media plate-held';
    c.style.visibility = 'hidden';
    const gl = c.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: true })!;
    this.gl = gl;
    const sh = (type: number, src: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG)); gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array(3));
    this.uT = gl.getUniformLocation(prog, 't')!;
    this.uMode = gl.getUniformLocation(prog, 'mode')!;
    gl.uniform1f(gl.getUniformLocation(prog, 'soft'), this.soft);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.finish();
  }

  /** Copy the frame now on screen and show it, fully opaque. Call inside a frame callback. */
  capture(source: HTMLVideoElement | HTMLImageElement, mode: ClearMode) {
    const gl = this.gl;
    this.mode = mode;
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, source);
    gl.uniform1f(this.uMode, mode === 'dissolve' ? 0 : 1);
    this.draw(0);
    this.canvas.style.visibility = '';
  }

  /** progress 0 → fully opaque, 1 → fully cleared. */
  draw(progress: number) {
    const t = this.mode === 'dissolve' ? progress : -this.soft + progress * (1 + 2 * this.soft);
    this.gl.uniform1f(this.uT, t);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  /** Hide and detach (the context is kept for the next join). */
  release() { this.canvas.style.visibility = 'hidden'; this.canvas.remove(); }
}
