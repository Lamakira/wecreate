"use client";

import { Mesh, Program, Renderer, Texture, Triangle } from "ogl";
import { useEffect, useRef } from "react";

import { FRAGMENT_SHADER, PRESET, VERTEX_SHADER } from "./hero-background-shader";

type Uniform = { value: unknown };

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
 * - If WebGL2 is unavailable or the context is lost, it removes itself and the
 *   gradient underneath simply shows through.
 *
 * The container is transparent rather than opaque black so that fallback is
 * visible in the moment before the first frame, and after a context loss.
 *
 * NOTE ON COLOUR: the preset's ramp is warm (`#837b70`, `#f3eadb`), which is a
 * deliberate departure from the strict black-and-white palette the rest of the
 * identity keeps. Swapping `PRESET.colors` for the brand greys is a one-line
 * change if that is reconsidered.
 */
export function HeroBackground({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        webgl: 2,
        alpha: false,
        antialias: false,
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    } catch {
      // No WebGL2 on this device. The gradient underneath is the design.
      return;
    }

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
        uColorA: { value: hexToRgb(PRESET.colors[0]) },
        uColorB: { value: hexToRgb(PRESET.colors[1]) },
        uColorC: { value: hexToRgb(PRESET.colors[2]) },
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
    let elapsed = 0;
    let previous = 0;
    let lost = false;

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

      if (!previous) {
        previous = now;
      }
      const delta = Math.min(40, now - previous);
      previous = now;

      if (!isOnScreen && !needsRender) {
        return;
      }

      elapsed += delta;
      (program.uniforms.uTime as Uniform).value = elapsed / 1000;
      renderer.render({ scene: mesh });
      needsRender = false;
    };
    frame = requestAnimationFrame(render);

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
