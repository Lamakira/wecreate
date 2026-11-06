"use client";

import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { useEffect, useRef } from "react";

import { FRAGMENT_SHADER, PRESET, VERTEX_SHADER } from "./hero-background-shader";

type Uniform = { value: unknown };

/**
 * The silk drifts slowly and its grain already steps at 24 Hz in the shader, so
 * 30 frames per second shows nothing that 60 would, at half the cost.
 */
const FRAME_INTERVAL_MS = 1000 / 30;
/**
 * A display refreshing at 60 Hz hands out timestamps about 16.7 ms apart, so
 * two of them can land a hair under the interval. Without this slack a frame
 * would be skipped for being 0.1 ms early and the cap would become 20 fps.
 */
const FRAME_TOLERANCE_MS = 2;
/** Fractions of the device pixel ratio to render at, sharpest first. */
const RESOLUTION_SCALES = [1, 0.5, 0.25];
/** Rendered frames to ignore after mount or a scale change: shader compile. */
const WARMUP_FRAMES = 2;
/** Rendered frames averaged, after the warm-up, to judge the device. */
const SAMPLE_FRAMES = 6;
/** An average gap between rendered frames above this means the GPU is slow. */
const SLOW_FRAME_MS = 45;
/**
 * A gap this long is a hidden tab or a scrolled-away hero, not a slow GPU, so
 * it is left out of the measurement.
 */
const PAUSE_FRAME_MS = 1000;

/**
 * What this visit has learned about the device, kept outside the component so
 * the hero on the next page (`/` to `/branding` to `/site-web`) starts where
 * the last one ended instead of re-learning from full resolution. It only ever
 * moves down: a device that was too slow once is not given another chance.
 */
let learnedScaleIndex = 0;
let learnedStill = false;

/**
 * The silk's colour ramp, as the current Discipline theme paints it.
 *
 * Read from the `--wc-hero-silk-*` custom properties in `globals.css` rather
 * than fixed here, so the same silk folds in black and warm grey on
 * Vidéographie, in cream on Branding and in night blue on Site web. A missing
 * or malformed value falls back to the approved preset's own stop.
 */
function themeRamp(element: Element): string[] {
  const style = getComputedStyle(element);
  return PRESET.colors.map((fallback, index) => {
    const value = style
      .getPropertyValue(`--wc-hero-silk-${"abc"[index]}`)
      .trim();
    return /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
  });
}

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return new Float32Array([
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ]);
}

/**
 * The hero's generated background.
 *
 * Purely decorative, and treated as such throughout: it is hidden from
 * assistive technology, it is never the only thing carrying meaning, and it is
 * layered over a plain CSS gradient that stands in whenever it is absent.
 *
 * It is absent more often than not, by design:
 *
 * - It is never rendered for a visitor who prefers reduced motion or has
 *   Save-Data on — the caller decides that, so the module is not even fetched.
 * - It stops rendering as soon as the hero scrolls out of view. A full-screen
 *   fragment shader running while someone reads the footer is battery spent for
 *   nothing, which matters on the low-memory Android hardware this site targets.
 * - It keeps to a frame budget: 30 frames per second at most, with the
 *   resolution stepped down when the first frames show a slow device and, as a
 *   last resort, a single still frame left on the canvas. What it learns is
 *   kept for the rest of the visit, so each hero does not repeat the lesson.
 * - If WebGL2 is unavailable or the context is lost, it removes itself and the
 *   gradient underneath simply shows through.
 *
 * The container is transparent rather than opaque black so that fallback is
 * visible in the moment before the first frame, and after a context loss.
 *
 * NOTE ON COLOUR: Vidéographie's ramp is warm (`#837b70`, `#f3eadb`), which is
 * a deliberate departure from the strict black-and-white palette the rest of
 * the identity keeps. Each Discipline theme sets its own ramp in `globals.css`;
 * changing Vidéographie's back to the brand greys is a change there.
 */
export function HeroBackground({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const baseDpr = Math.min(window.devicePixelRatio || 1, 2);
    let scaleIndex = learnedScaleIndex;
    let still = learnedStill;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: false,
        antialias: false,
        dpr: baseDpr * RESOLUTION_SCALES[scaleIndex],
      });
    } catch {
      // No WebGL2 on this device. The gradient underneath is the design.
      return;
    }

    const ramp = themeRamp(container);
    const gl = renderer.gl;
    const canvas = gl.canvas as HTMLCanvasElement;
    Object.assign(canvas.style, {
      width: "100%",
      height: "100%",
      display: "block",
    });
    container.appendChild(canvas);

    const texture = new Texture(gl, {
      image: new Uint8Array([8, 8, 8, 255]),
      width: 1,
      height: 1,
      generateMipmaps: false,
    });
    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      uniforms: {
        uResolution: { value: new Float32Array([1, 1]) },
        uTime: { value: 0 },
        uTexture: { value: texture },
        uHasSource: { value: 0 },
        uSourceAspect: { value: 1 },
        uGenerator: { value: PRESET.generator },
        uColorA: { value: hexToRgb(ramp[0]) },
        uColorB: { value: hexToRgb(ramp[1]) },
        uColorC: { value: hexToRgb(ramp[2]) },
        uGlow: { value: PRESET.settings.glow / 100 },
        uGrain: { value: PRESET.grain },
        uVignette: { value: PRESET.settings.vignette / 100 },
        uBrightness: { value: PRESET.settings.brightness / 100 },
        uContrast: { value: PRESET.settings.contrast / 100 },
        uSaturation: { value: PRESET.settings.saturation / 100 },
        uHue: { value: (PRESET.settings.hue / 180) * Math.PI },
        uGrayscale: { value: 0 },
        uSepia: { value: 0 },
        uInvert: { value: 0 },
        uPixelate: { value: PRESET.effectUniforms.uPixelate },
        uDither: { value: PRESET.effectUniforms.uDither },
        uPosterize: { value: PRESET.effectUniforms.uPosterize },
        uEdgeGlow: { value: PRESET.effectUniforms.uEdgeGlow },
        uPixelSort: { value: PRESET.effectUniforms.uPixelSort },
        uLed: { value: PRESET.effectUniforms.uLed },
        uRgbSplit: { value: PRESET.effectUniforms.uRgbSplit },
        uGlitch: { value: PRESET.effectUniforms.uGlitch },
        uScanlines: { value: PRESET.effectUniforms.uScanlines },
        uDuotone: { value: PRESET.effectUniforms.uDuotone },
        uPixelSize: { value: PRESET.pixelSettings.size / 100 },
        uDensity: { value: PRESET.pixelSettings.density / 100 },
        uExposure: { value: (PRESET.pixelSettings.exposure - 50) / 100 },
        uScatter: { value: PRESET.pixelSettings.scatter / 100 },
        uPixelOpacity: { value: PRESET.pixelSettings.opacity / 100 },
        uDitherAlgorithm: { value: PRESET.ditherAlgorithm },
        uAnimationPreset: { value: PRESET.animation.preset },
        uAnimationPace: { value: PRESET.animation.pace },
        uAnimationIntensity: { value: PRESET.animation.intensity },
        uEffectsVisible: { value: 1 },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    let needsRender = true;
    let lost = false;
    let elapsed = 0;
    const draw = () => {
      (program.uniforms.uTime as Uniform).value = elapsed / 1000;
      renderer.render({ scene: mesh });
      needsRender = false;
    };
    const resize = () => {
      const bounds = container.getBoundingClientRect();
      renderer.setSize(
        Math.max(1, Math.round(bounds.width)),
        Math.max(1, Math.round(bounds.height)),
      );
      const resolution = (program.uniforms.uResolution as Uniform)
        .value as Float32Array;
      resolution[0] = gl.drawingBufferWidth;
      resolution[1] = gl.drawingBufferHeight;
      needsRender = true;
      // Resizing clears the canvas, and a still hero has no loop to repaint it.
      if (still && !lost) {
        draw();
      }
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    resize();

    // Only animate while the hero is actually on screen.
    let isOnScreen = true;
    const visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          isOnScreen = entry.isIntersecting;
        }
      },
      { threshold: 0 },
    );
    visibilityObserver.observe(container);

    let frame = 0;
    let previous = 0;

    // Judging the device: skip the warm-up frames, then average the gap between
    // the next few rendered frames.
    let measuring = !still;
    let warmupLeft = WARMUP_FRAMES;
    let samples = 0;
    let totalGap = 0;
    const restartMeasuring = () => {
      measuring = true;
      warmupLeft = WARMUP_FRAMES;
      samples = 0;
      totalGap = 0;
    };
    const judgeDevice = () => {
      measuring = false;
      if (totalGap / samples <= SLOW_FRAME_MS) {
        return;
      }
      if (scaleIndex < RESOLUTION_SCALES.length - 1) {
        scaleIndex += 1;
        learnedScaleIndex = scaleIndex;
        renderer.dpr = baseDpr * RESOLUTION_SCALES[scaleIndex];
        resize();
        restartMeasuring();
        return;
      }
      // Even the smallest buffer is too slow: keep the last frame and stop.
      still = true;
      learnedStill = true;
      cancelAnimationFrame(frame);
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      lost = true;
      canvas.remove();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    const render = (now: number) => {
      frame = requestAnimationFrame(render);
      if (lost) {
        return;
      }

      if (!isOnScreen && !needsRender) {
        // Paused: the gap until the next frame says nothing about the GPU.
        previous = 0;
        return;
      }
      if (previous && now - previous < FRAME_INTERVAL_MS - FRAME_TOLERANCE_MS) {
        return;
      }

      // Time since the previous rendered frame, clamped so a long pause does
      // not make the animation jump.
      const gap = previous ? now - previous : 0;
      previous = now;
      elapsed += Math.min(40, gap);
      draw();

      if (measuring && gap > 0 && gap < PAUSE_FRAME_MS) {
        if (warmupLeft > 0) {
          warmupLeft -= 1;
        } else {
          totalGap += gap;
          samples += 1;
          if (samples === SAMPLE_FRAMES) {
            judgeDevice();
          }
        }
      }
    };
    if (!still) {
      frame = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      visibilityObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      data-testid="hero-background"
      className={`absolute inset-0 overflow-hidden ${className}`}
      aria-hidden="true"
    />
  );
}
