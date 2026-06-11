import { useCallback, useEffect, useRef } from 'react';
import { useStore, selectActiveProfile } from '../store';
import type { TextElement, SymbolElement, ShapeElement } from '../elements/types';
import { useCanvasLoop } from './useCanvasLoop';
import { render, RULER_SIZE_PX, type RenderState } from './renderer';
import { elementAtPoint, elementBBox, elementsInRect, resizeBBox, rotationFromPointer } from './interaction';
import { handlePositions, hitTestHandles, cursorForHandle, type HandleId } from './handles';
import { snapToGrid, computeAlignmentSnap, type AlignmentGuide } from './snapping';
import { mmToPx, pxToMm } from '../utils/units';
import { bboxCentre, bboxContains, clamp, rotateAround, type BBox, type Vec2 } from '../utils/geometry';
import { MIN_ZOOM, MAX_ZOOM } from '../store/uiSlice';
import styles from './CanvasView.module.css';

type DragState =
  | { mode: 'none' }
  | { mode: 'pan'; startScreen: Vec2; pan0: Vec2 }
  | { mode: 'move'; ids: string[]; starts: Map<string, Vec2>; startMm: Vec2; primaryId: string }
  | {
      mode: 'resize';
      id: string;
      handle: HandleId;
      startBBox: BBox;
      startMm: Vec2;
      rotation: number;
      startFontSize: number | null;
    }
  | { mode: 'rotate'; id: string; centre: Vec2 }
  | { mode: 'marquee'; startMm: Vec2 };

const DEFAULT_TEXT: Omit<TextElement, 'id' | 'x' | 'y'> = {
  type: 'text',
  text: 'TEXT',
  fontName: 'hershey_simplex',
  fontSize: 6,
  passCount: 1,
  passSpacing: 0.2,
  lineSpacing: 2,
  align: 'left',
  engraveDepth: null,
  width: 1,
  height: 1,
  rotation: 0,
  locked: false,
};

export function CanvasView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<DragState>({ mode: 'none' });
  const guides = useRef<AlignmentGuide[]>([]);
  const marquee = useRef<BBox | null>(null);
  const spaceDown = useRef(false);

  // Reactive subscriptions only for things the React overlay needs.
  const zoom = useStore((s) => s.zoom);
  const panX = useStore((s) => s.panX);
  const panY = useStore((s) => s.panY);
  const activeTool = useStore((s) => s.activeTool);

  const screenToWorld = useCallback((sx: number, sy: number): Vec2 => {
    const s = useStore.getState();
    return { x: pxToMm(sx - s.panX, s.zoom), y: pxToMm(sy - s.panY, s.zoom) };
  }, []);

  const pointerPos = useCallback((e: { clientX: number; clientY: number }): Vec2 => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const fitToWindow = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = useStore.getState();
    const rect = canvas.getBoundingClientRect();
    const margin = 60;
    const zw = (rect.width - margin * 2) / mmToPx(s.project.label.width, 1);
    const zh = (rect.height - margin * 2) / mmToPx(s.project.label.height, 1);
    const z = clamp(Math.min(zw, zh), MIN_ZOOM, MAX_ZOOM);
    s.setZoom(z);
    s.setPan(
      (rect.width - mmToPx(s.project.label.width, z)) / 2,
      (rect.height - mmToPx(s.project.label.height, z)) / 2,
    );
  }, []);

  // Initial fit + external "fit" requests (toolbar / menu / shortcut).
  useEffect(() => {
    fitToWindow();
    window.addEventListener('engravelab:fit', fitToWindow);
    return () => window.removeEventListener('engravelab:fit', fitToWindow);
  }, [fitToWindow]);

  // ---- Pointer handlers -------------------------------------------------

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const canvas = canvasRef.current!;
      canvas.setPointerCapture(e.pointerId);
      const s = useStore.getState();
      const screen = pointerPos(e);
      const world = screenToWorld(screen.x, screen.y);

      if (e.button === 1 || (e.button === 0 && spaceDown.current)) {
        drag.current = { mode: 'pan', startScreen: screen, pan0: { x: s.panX, y: s.panY } };
        return;
      }
      if (e.button !== 0) return;

      if (s.editingTextId) s.setEditingTextId(null);

      // Placement tools
      if (s.activeTool === 'text') {
        const el: TextElement = { ...DEFAULT_TEXT, id: crypto.randomUUID(), x: world.x, y: world.y };
        s.addElement(el);
        s.setSelection([el.id]);
        s.setActiveTool('select');
        s.setEditingTextId(el.id);
        return;
      }
      if (s.activeTool === 'symbol') {
        const size = 10;
        const el: SymbolElement = {
          type: 'symbol',
          id: crypto.randomUUID(),
          symbolName: s.pendingSymbolName,
          x: world.x - size / 2,
          y: world.y - size / 2,
          width: size,
          height: size,
          rotation: 0,
          locked: false,
          passCount: 1,
          engraveDepth: null,
        };
        s.addElement(el);
        s.setSelection([el.id]);
        s.setActiveTool('select');
        return;
      }
      if (s.activeTool === 'shape') {
        const size = 20;
        const el: ShapeElement = {
          type: 'shape',
          id: crypto.randomUUID(),
          shapeKind: s.pendingShapeKind,
          mode: 'engrave',
          x: world.x - size / 2,
          y: world.y - size / 2,
          width: size,
          height: size,
          rotation: 0,
          locked: false,
          cornerRadius: 0,
          passCount: 1,
          engraveDepth: null,
        };
        s.addElement(el);
        s.setSelection([el.id]);
        s.setActiveTool('select');
        return;
      }

      // Select tool: handles first (single selection only)
      if (s.selectedIds.length === 1) {
        const el = s.project.label.elements.find((x) => x.id === s.selectedIds[0]);
        if (el && !el.locked) {
          const toScreen = (p: Vec2): Vec2 => ({ x: s.panX + mmToPx(p.x, s.zoom), y: s.panY + mmToPx(p.y, s.zoom) });
          const handle = hitTestHandles(screen, handlePositions(elementBBox(el), el.rotation, toScreen));
          if (handle === 'rot') {
            s.pushHistory();
            drag.current = { mode: 'rotate', id: el.id, centre: bboxCentre(elementBBox(el)) };
            return;
          }
          if (handle) {
            s.pushHistory();
            drag.current = {
              mode: 'resize',
              id: el.id,
              handle,
              startBBox: elementBBox(el),
              startMm: world,
              rotation: el.rotation,
              startFontSize: el.type === 'text' ? el.fontSize : null,
            };
            return;
          }
        }
      }

      const hit = elementAtPoint(world, s.project.label.elements);
      if (hit) {
        let ids: string[];
        if (e.shiftKey) {
          ids = s.selectedIds.includes(hit.id)
            ? s.selectedIds.filter((id) => id !== hit.id)
            : [...s.selectedIds, hit.id];
        } else {
          ids = s.selectedIds.includes(hit.id) ? s.selectedIds : [hit.id];
        }
        s.setSelection(ids);
        const movable = s.project.label.elements.filter((el) => ids.includes(el.id) && !el.locked);
        if (movable.length > 0 && !e.shiftKey) {
          s.pushHistory();
          drag.current = {
            mode: 'move',
            ids: movable.map((m) => m.id),
            starts: new Map(movable.map((m) => [m.id, { x: m.x, y: m.y }])),
            startMm: world,
            primaryId: hit.id,
          };
        }
        return;
      }

      // Empty canvas: marquee
      if (!e.shiftKey) s.setSelection([]);
      drag.current = { mode: 'marquee', startMm: world };
    },
    [pointerPos, screenToWorld],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const s = useStore.getState();
      const screen = pointerPos(e);
      const world = screenToWorld(screen.x, screen.y);
      const d = drag.current;
      const canvas = canvasRef.current!;

      // Cursor feedback when idle
      if (d.mode === 'none') {
        let cursor = spaceDown.current ? 'grab' : 'default';
        if (s.activeTool === 'text' || s.activeTool === 'symbol' || s.activeTool === 'shape') cursor = 'crosshair';
        else if (s.selectedIds.length === 1) {
          const el = s.project.label.elements.find((x) => x.id === s.selectedIds[0]);
          if (el && !el.locked) {
            const toScreen = (p: Vec2): Vec2 => ({ x: s.panX + mmToPx(p.x, s.zoom), y: s.panY + mmToPx(p.y, s.zoom) });
            const handle = hitTestHandles(screen, handlePositions(elementBBox(el), el.rotation, toScreen));
            if (handle) cursor = cursorForHandle(handle);
          }
        }
        if (cursor === 'default' && elementAtPoint(world, s.project.label.elements)) cursor = 'move';
        canvas.style.cursor = cursor;
        return;
      }

      if (d.mode === 'pan') {
        s.setPan(d.pan0.x + (screen.x - d.startScreen.x), d.pan0.y + (screen.y - d.startScreen.y));
        return;
      }

      if (d.mode === 'move') {
        let dx = world.x - d.startMm.x;
        let dy = world.y - d.startMm.y;
        const primaryStart = d.starts.get(d.primaryId) ?? d.starts.values().next().value!;
        const primary = s.project.label.elements.find((el) => el.id === d.primaryId);

        // Grid snap on the primary element's top-left (Ctrl disables momentarily)
        if (s.gridEnabled && !e.ctrlKey) {
          dx = snapToGrid(primaryStart.x + dx, s.gridSpacing) - primaryStart.x;
          dy = snapToGrid(primaryStart.y + dy, s.gridSpacing) - primaryStart.y;
        }

        // Alignment guides against unselected elements + label boundary
        guides.current = [];
        if (primary && !e.ctrlKey) {
          const draggedBBox: BBox = {
            x: primaryStart.x + dx,
            y: primaryStart.y + dy,
            width: primary.width,
            height: primary.height,
          };
          const others = s.project.label.elements
            .filter((el) => !d.ids.includes(el.id))
            .map(elementBBox);
          others.push({ x: 0, y: 0, width: s.project.label.width, height: s.project.label.height });
          const snap = computeAlignmentSnap(draggedBBox, others, pxToMm(3, s.zoom));
          dx += snap.dx;
          dy += snap.dy;
          guides.current = snap.guides;
        }

        for (const id of d.ids) {
          const start = d.starts.get(id)!;
          s.updateElement(id, { x: start.x + dx, y: start.y + dy });
        }
        return;
      }

      if (d.mode === 'resize') {
        const el = s.project.label.elements.find((x) => x.id === d.id);
        if (!el) return;
        const centre = bboxCentre(d.startBBox);
        // Un-rotate pointer delta so resizing works in the element's local frame
        const p0 = d.rotation ? rotateAround(d.startMm, centre, -d.rotation) : d.startMm;
        const p1 = d.rotation ? rotateAround(world, centre, -d.rotation) : world;
        const proportional = el.type === 'symbol' ? !e.shiftKey : e.shiftKey;
        let next = resizeBBox({
          start: d.startBBox,
          handle: d.handle,
          dx: p1.x - p0.x,
          dy: p1.y - p0.y,
          proportional: el.type === 'text' ? true : proportional,
          minSize: 1,
        });
        if (s.gridEnabled && !e.ctrlKey) {
          next = { ...next, x: snapToGrid(next.x, s.gridSpacing), y: snapToGrid(next.y, s.gridSpacing) };
        }
        if (el.type === 'text' && d.startFontSize) {
          // Text scales via font size; the store re-measures the bbox.
          const scale = next.height / d.startBBox.height;
          s.updateElement(d.id, {
            x: next.x,
            y: next.y,
            fontSize: Math.max(0.5, d.startFontSize * scale),
          });
        } else {
          s.updateElement(d.id, { x: next.x, y: next.y, width: next.width, height: next.height });
        }
        return;
      }

      if (d.mode === 'rotate') {
        let angle = rotationFromPointer(d.centre, world);
        if (!e.ctrlKey) angle = Math.round(angle / 15) * 15; // 15° detents; Ctrl for free rotation
        s.updateElement(d.id, { rotation: angle % 360 });
        return;
      }

      if (d.mode === 'marquee') {
        marquee.current = {
          x: Math.min(d.startMm.x, world.x),
          y: Math.min(d.startMm.y, world.y),
          width: Math.abs(world.x - d.startMm.x),
          height: Math.abs(world.y - d.startMm.y),
        };
        const inside = elementsInRect(marquee.current, s.project.label.elements);
        s.setSelection(inside.map((el) => el.id));
      }
    },
    [pointerPos, screenToWorld],
  );

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    canvasRef.current?.releasePointerCapture(e.pointerId);
    drag.current = { mode: 'none' };
    guides.current = [];
    marquee.current = null;
  }, []);

  const onDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      const s = useStore.getState();
      const screen = pointerPos(e);
      const world = screenToWorld(screen.x, screen.y);
      const hit = elementAtPoint(world, s.project.label.elements);
      if (hit?.type === 'text' && !hit.locked) {
        s.pushHistory();
        s.setSelection([hit.id]);
        s.setEditingTextId(hit.id);
      }
    },
    [pointerPos, screenToWorld],
  );

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const s = useStore.getState();
      const screen = pointerPos(e);
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newZoom = clamp(s.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const ratio = newZoom / s.zoom;
      s.setZoom(newZoom);
      s.setPan(screen.x - (screen.x - s.panX) * ratio, screen.y - (screen.y - s.panY) * ratio);
    },
    [pointerPos],
  );

  // ---- Keyboard ---------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const target = e.target as HTMLElement;
      const typing = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable;

      if (e.code === 'Space' && !typing) {
        spaceDown.current = true;
        return;
      }
      if (typing) return;

      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        s.duplicateElements(s.selectedIds);
        return;
      }
      if (mod && e.key === '0') {
        e.preventDefault();
        s.setZoom(1);
        return;
      }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        window.dispatchEvent(new Event('engravelab:fit'));
        return;
      }
      if (mod) return;

      switch (e.key) {
        case 'Delete':
        case 'Backspace':
          s.deleteElements(s.selectedIds.filter((id) => {
            const el = s.project.label.elements.find((x) => x.id === id);
            return el && !el.locked;
          }));
          break;
        case 'Escape':
          s.setEditingTextId(null);
          s.setSelection([]);
          s.setActiveTool('select');
          break;
        case 'v':
        case 'V':
          s.setActiveTool('select');
          break;
        case 't':
        case 'T':
          s.setActiveTool('text');
          break;
        case 's':
        case 'S':
          s.setActiveTool('symbol');
          break;
        case 'b':
        case 'B':
        case 'r':
        case 'R':
          s.setActiveTool('shape');
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceDown.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // ---- Render loop ------------------------------------------------------

  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, width: number, height: number, dpr: number) => {
      const s = useStore.getState();
      const profile = selectActiveProfile(s);
      const label = s.project.label;
      const outOfBoundsIds = new Set<string>();
      const labelBox: BBox = { x: 0, y: 0, width: label.width, height: label.height };
      for (const el of label.elements) {
        if (!bboxContains(labelBox, elementBBox(el))) outOfBoundsIds.add(el.id);
      }
      const state: RenderState = {
        width,
        height,
        dpr,
        zoom: s.zoom,
        panX: s.panX,
        panY: s.panY,
        label,
        profile,
        originX: s.project.canvasOriginX,
        originY: s.project.canvasOriginY,
        selectedIds: s.selectedIds,
        gridEnabled: s.gridEnabled,
        gridSpacing: s.gridSpacing,
        guides: guides.current,
        marquee: marquee.current,
        outOfBoundsIds,
        editingTextId: s.editingTextId,
        dark: s.theme === 'dark',
      };
      render(ctx, state);
    },
    [],
  );

  useCanvasLoop(canvasRef, draw);

  // ---- Inline text editor overlay ----------------------------------------

  const editingEl = useStore((s) =>
    s.editingTextId
      ? (s.project.label.elements.find((el) => el.id === s.editingTextId) as TextElement | undefined)
      : undefined,
  );

  const commitTextEdit = useCallback(() => {
    const s = useStore.getState();
    const el = s.project.label.elements.find((x) => x.id === s.editingTextId);
    if (el?.type === 'text' && el.text.trim() === '') s.deleteElements([el.id]);
    s.setEditingTextId(null);
  }, []);

  return (
    <div ref={containerRef} className={styles.container}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        onContextMenu={(e) => e.preventDefault()}
        data-tool={activeTool}
      />
      {editingEl && (
        <textarea
          autoFocus
          className={styles.textEditor}
          style={{
            left: panX + mmToPx(editingEl.x, zoom),
            top: panY + mmToPx(editingEl.y, zoom),
            minWidth: Math.max(60, mmToPx(editingEl.width, zoom) + 20),
            height: mmToPx(editingEl.height, zoom) + 16,
            fontSize: Math.max(10, mmToPx(editingEl.fontSize, zoom)),
            transform: editingEl.rotation ? `rotate(${editingEl.rotation}deg)` : undefined,
          }}
          value={editingEl.text}
          onChange={(e) => useStore.getState().updateElement(editingEl.id, { text: e.target.value })}
          onBlur={commitTextEdit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault();
              commitTextEdit();
            }
          }}
        />
      )}
    </div>
  );
}

export { RULER_SIZE_PX };
