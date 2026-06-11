import type { Element, Label } from '../elements/types';
import type { MachineProfile } from '../machineProfiles/types';
import type { BBox, Vec2 } from '../utils/geometry';
import { bboxCentre, degToRad } from '../utils/geometry';
import { mmToPx } from '../utils/units';
import { textElementStrokes } from '../elements/TextElement';
import { symbolElementStrokes } from '../elements/SymbolElement';
import { borderElementStrokes } from '../elements/BorderElement';
import type { Polyline } from '../fonts/strokeRenderer';
import { handlePositions, HANDLE_SIZE_PX } from './handles';
import { elementBBox } from './interaction';
import type { AlignmentGuide } from './snapping';

export const RULER_SIZE_PX = 22;

export interface RenderState {
  width: number; // canvas CSS px
  height: number;
  dpr: number;
  zoom: number;
  panX: number;
  panY: number;
  label: Label;
  profile: MachineProfile;
  originX: number;
  originY: number;
  selectedIds: string[];
  gridEnabled: boolean;
  gridSpacing: number;
  guides: AlignmentGuide[];
  marquee: BBox | null; // label-space mm
  outOfBoundsIds: Set<string>;
  editingTextId: string | null;
  dark: boolean;
}

interface Theme {
  bg: string;
  bed: string;
  bedBorder: string;
  labelBorder: string;
  grid: string;
  gridMajor: string;
  stroke: string;
  selection: string;
  handleFill: string;
  guide: string;
  warning: string;
  ruler: string;
  rulerText: string;
}

const LIGHT: Theme = {
  bg: '#e8e8ec',
  bed: '#d4d4da',
  bedBorder: '#a0a0aa',
  labelBorder: '#555',
  grid: 'rgba(0,0,0,0.06)',
  gridMajor: 'rgba(0,0,0,0.14)',
  stroke: '#1a1a1a',
  selection: '#4f7cff',
  handleFill: '#ffffff',
  guide: '#e0529c',
  warning: '#e8930c',
  ruler: '#f4f4f6',
  rulerText: '#666',
};

const DARK: Theme = {
  bg: '#1e1e24',
  bed: '#2a2a32',
  bedBorder: '#4a4a55',
  labelBorder: '#999',
  grid: 'rgba(255,255,255,0.06)',
  gridMajor: 'rgba(255,255,255,0.14)',
  stroke: '#e8e8e8',
  selection: '#6f93ff',
  handleFill: '#2a2a32',
  guide: '#e0529c',
  warning: '#f0a93c',
  ruler: '#26262e',
  rulerText: '#999',
};

function elementPreviewStrokes(el: Element, label: Label, profile: MachineProfile): Polyline[] {
  switch (el.type) {
    case 'text':
      return textElementStrokes(el);
    case 'symbol':
      return symbolElementStrokes(el);
    case 'border':
      return borderElementStrokes(el, label, profile.toolDiameter);
  }
}

export function render(ctx: CanvasRenderingContext2D, s: RenderState): void {
  const t = s.dark ? DARK : LIGHT;
  const toScreen = (p: Vec2): Vec2 => ({
    x: s.panX + mmToPx(p.x, s.zoom),
    y: s.panY + mmToPx(p.y, s.zoom),
  });

  ctx.save();
  ctx.scale(s.dpr, s.dpr);
  ctx.clearRect(0, 0, s.width, s.height);
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, s.width, s.height);

  // 2. Machine bed (label space: bed bottom-left is machine origin)
  const bedTopLeft = toScreen({
    x: -s.originX,
    y: s.label.height + s.originY - s.profile.workAreaY,
  });
  ctx.fillStyle = t.bed;
  ctx.strokeStyle = t.bedBorder;
  ctx.lineWidth = 1;
  ctx.fillRect(bedTopLeft.x, bedTopLeft.y, mmToPx(s.profile.workAreaX, s.zoom), mmToPx(s.profile.workAreaY, s.zoom));
  ctx.strokeRect(bedTopLeft.x, bedTopLeft.y, mmToPx(s.profile.workAreaX, s.zoom), mmToPx(s.profile.workAreaY, s.zoom));

  // 3. Label boundary
  const labelTL = toScreen({ x: 0, y: 0 });
  const labelW = mmToPx(s.label.width, s.zoom);
  const labelH = mmToPx(s.label.height, s.zoom);
  ctx.fillStyle = s.label.backgroundColor || '#ffffff';
  ctx.fillRect(labelTL.x, labelTL.y, labelW, labelH);
  ctx.strokeStyle = t.labelBorder;
  ctx.strokeRect(labelTL.x, labelTL.y, labelW, labelH);

  // 4. Grid (only when spacing is visible enough)
  if (s.gridEnabled && mmToPx(s.gridSpacing, s.zoom) >= 5) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(labelTL.x, labelTL.y, labelW, labelH);
    ctx.clip();
    for (let gx = 0; gx <= s.label.width + 1e-9; gx += s.gridSpacing) {
      const major = Math.abs(gx / (s.gridSpacing * 10) - Math.round(gx / (s.gridSpacing * 10))) < 1e-6;
      ctx.strokeStyle = major ? t.gridMajor : t.grid;
      ctx.beginPath();
      const sx = toScreen({ x: gx, y: 0 }).x;
      ctx.moveTo(sx, labelTL.y);
      ctx.lineTo(sx, labelTL.y + labelH);
      ctx.stroke();
    }
    for (let gy = 0; gy <= s.label.height + 1e-9; gy += s.gridSpacing) {
      const major = Math.abs(gy / (s.gridSpacing * 10) - Math.round(gy / (s.gridSpacing * 10))) < 1e-6;
      ctx.strokeStyle = major ? t.gridMajor : t.grid;
      ctx.beginPath();
      const sy = toScreen({ x: 0, y: gy }).y;
      ctx.moveTo(labelTL.x, sy);
      ctx.lineTo(labelTL.x + labelW, sy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 5. Elements
  for (const el of s.label.elements) {
    if (el.type === 'text' && el.id === s.editingTextId) continue; // textarea overlay replaces it
    ctx.strokeStyle = t.stroke;
    ctx.lineWidth = Math.max(1, mmToPx(0.2, s.zoom));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of elementPreviewStrokes(el, s.label, s.profile)) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      const p0 = toScreen(stroke[0]);
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < stroke.length; i++) {
        const p = toScreen(stroke[i]);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    // Out-of-bounds warning outline
    if (s.outOfBoundsIds.has(el.id)) {
      drawRotatedBox(ctx, elementBBox(el), el.rotation, toScreen, t.warning, [5, 4]);
    }
  }

  // 6. Selection highlights + handles
  for (const el of s.label.elements) {
    if (!s.selectedIds.includes(el.id)) continue;
    const bbox = elementBBox(el);
    drawRotatedBox(ctx, bbox, el.rotation, toScreen, t.selection, []);
    if (s.selectedIds.length === 1 && el.type !== 'border' && !el.locked) {
      const handles = handlePositions(bbox, el.rotation, toScreen);
      for (const h of handles) {
        ctx.fillStyle = t.handleFill;
        ctx.strokeStyle = t.selection;
        ctx.lineWidth = 1;
        if (h.id === 'rot') {
          ctx.beginPath();
          ctx.arc(h.point.x, h.point.y, HANDLE_SIZE_PX / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(h.point.x - HANDLE_SIZE_PX / 2, h.point.y - HANDLE_SIZE_PX / 2, HANDLE_SIZE_PX, HANDLE_SIZE_PX);
          ctx.strokeRect(h.point.x - HANDLE_SIZE_PX / 2, h.point.y - HANDLE_SIZE_PX / 2, HANDLE_SIZE_PX, HANDLE_SIZE_PX);
        }
      }
    }
  }

  // 7. Alignment guides
  ctx.setLineDash([6, 4]);
  ctx.strokeStyle = t.guide;
  ctx.lineWidth = 1;
  for (const g of s.guides) {
    ctx.beginPath();
    if (g.axis === 'x') {
      const x = toScreen({ x: g.position, y: 0 }).x;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, s.height);
    } else {
      const y = toScreen({ x: 0, y: g.position }).y;
      ctx.moveTo(0, y);
      ctx.lineTo(s.width, y);
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Marquee selection rectangle
  if (s.marquee) {
    const tl = toScreen({ x: s.marquee.x, y: s.marquee.y });
    ctx.fillStyle = 'rgba(79,124,255,0.12)';
    ctx.strokeStyle = t.selection;
    ctx.fillRect(tl.x, tl.y, mmToPx(s.marquee.width, s.zoom), mmToPx(s.marquee.height, s.zoom));
    ctx.strokeRect(tl.x, tl.y, mmToPx(s.marquee.width, s.zoom), mmToPx(s.marquee.height, s.zoom));
  }

  // 8. Rulers
  drawRulers(ctx, s, t, toScreen);
  ctx.restore();
}

function drawRotatedBox(
  ctx: CanvasRenderingContext2D,
  bbox: BBox,
  rotation: number,
  toScreen: (p: Vec2) => Vec2,
  color: string,
  dash: number[],
): void {
  const c = toScreen(bboxCentre(bbox));
  const tl = toScreen({ x: bbox.x, y: bbox.y });
  const w = toScreen({ x: bbox.x + bbox.width, y: bbox.y }).x - tl.x;
  const h = toScreen({ x: bbox.x, y: bbox.y + bbox.height }).y - tl.y;
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(degToRad(rotation));
  ctx.setLineDash(dash);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-w / 2, -h / 2, w, h);
  ctx.restore();
}

function rulerStep(zoom: number): number {
  const candidates = [0.5, 1, 2, 5, 10, 20, 50, 100];
  for (const c of candidates) if (mmToPx(c, zoom) >= 40) return c;
  return 200;
}

function drawRulers(
  ctx: CanvasRenderingContext2D,
  s: RenderState,
  t: Theme,
  toScreen: (p: Vec2) => Vec2,
): void {
  const step = rulerStep(s.zoom);
  ctx.fillStyle = t.ruler;
  ctx.fillRect(0, 0, s.width, RULER_SIZE_PX);
  ctx.fillRect(0, 0, RULER_SIZE_PX, s.height);
  ctx.strokeStyle = t.bedBorder;
  ctx.beginPath();
  ctx.moveTo(0, RULER_SIZE_PX + 0.5);
  ctx.lineTo(s.width, RULER_SIZE_PX + 0.5);
  ctx.moveTo(RULER_SIZE_PX + 0.5, 0);
  ctx.lineTo(RULER_SIZE_PX + 0.5, s.height);
  ctx.stroke();

  ctx.fillStyle = t.rulerText;
  ctx.font = '9px sans-serif';
  ctx.textBaseline = 'top';

  const startMmX = Math.floor(((-s.panX) / (mmToPx(1, s.zoom))) / step) * step;
  for (let mm = startMmX; ; mm += step) {
    const x = toScreen({ x: mm, y: 0 }).x;
    if (x > s.width) break;
    if (x < RULER_SIZE_PX) continue;
    ctx.strokeStyle = t.rulerText;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, RULER_SIZE_PX - 6);
    ctx.lineTo(x + 0.5, RULER_SIZE_PX);
    ctx.stroke();
    ctx.fillText(String(Math.round(mm * 10) / 10), x + 2, 2);
  }
  const startMmY = Math.floor(((-s.panY) / (mmToPx(1, s.zoom))) / step) * step;
  for (let mm = startMmY; ; mm += step) {
    const y = toScreen({ x: 0, y: mm }).y;
    if (y > s.height) break;
    if (y < RULER_SIZE_PX) continue;
    ctx.strokeStyle = t.rulerText;
    ctx.beginPath();
    ctx.moveTo(RULER_SIZE_PX - 6, y + 0.5);
    ctx.lineTo(RULER_SIZE_PX, y + 0.5);
    ctx.stroke();
    ctx.save();
    ctx.translate(2, y + 2);
    ctx.fillText(String(Math.round(mm * 10) / 10), 0, 0);
    ctx.restore();
  }

  // Corner square over the intersection
  ctx.fillStyle = t.ruler;
  ctx.fillRect(0, 0, RULER_SIZE_PX, RULER_SIZE_PX);
}
