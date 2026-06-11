import { useEffect, type RefObject } from 'react';

/**
 * requestAnimationFrame render loop. Calls `draw` every frame with the 2D
 * context, CSS-pixel size, and device pixel ratio. Handles canvas resize
 * and DPR scaling.
 */
export function useCanvasLoop(
  canvasRef: RefObject<HTMLCanvasElement>,
  draw: (ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) => void,
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    const loop = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      draw(ctx, w, h, dpr);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, draw]);
}
