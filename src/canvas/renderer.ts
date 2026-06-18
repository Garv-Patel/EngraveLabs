import type { Label } from '../elements/types';
import type { MachineProfile } from '../machineProfiles/types';
import type { BBox, Vec2 } from '../utils/geometry';
import { bboxCentre, degToRad } from '../utils/geometry';
import { mmToPx } from '../utils/units';
import { elementStrokes, isCutShape, partBBox } from '../gcode/toolpath';
import { resolveBit, bitWidthMm } from '../machineProfiles/bits';
import { isLine } from '../elements/line';
import { handlePositions, lineHandlePositions, HANDLE_SIZE_PX } from './handles';
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
  cut: string;
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
  cut: '#c43c3c',
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
  cut: '#ff6b6b',
  selection: '#6f93ff',
  handleFill: '#2a2a32',
  guide: '#e0529c',
  warning: '#f0a93c',
  ruler: '#26262e',
  rulerText: '#999',
};

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

  // 2. Machine bed = the stock surface (the full work area is the background).
  // The part's bottom-left sits at (originX, originY), so machine (0,0) is the
  // bed's bottom-left corner.
  const part = partBBox(s.label);
  const bedX0 = part.x - s.originX; // label-space x of machine x=0
  const bedY1 = part.y + part.height + s.originY; // label-space y of machine y=0 (bottom)
  const bedTopLeft = toScreen({ x: bedX0, y: bedY1 - s.profile.workAreaY });
  const bedW = mmToPx(s.profile.workAreaX, s.zoom);
  const bedH = mmToPx(s.profile.workAreaY, s.zoom);
  ctx.fillStyle = s.label.backgroundColor || '#ffffff';
  ctx.fillRect(bedTopLeft.x, bedTopLeft.y, bedW, bedH);
  ctx.strokeStyle = t.bedBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(bedTopLeft.x, bedTopLeft.y, bedW, bedH);

  // 3. Grid over the work area (only when spacing is visible enough).
  if (s.gridEnabled && mmToPx(s.gridSpacing, s.zoom) >= 5) {
    const bedRight = bedX0 + s.profile.workAreaX;
    const bedTopMm = bedY1 - s.profile.workAreaY;
    ctx.save();
    ctx.beginPath();
    ctx.rect(bedTopLeft.x, bedTopLeft.y, bedW, bedH);
    ctx.clip();
    const isMajor = (g: number) =>
      Math.abs(g / (s.gridSpacing * 10) - Math.round(g / (s.gridSpacing * 10))) < 1e-6;
    for (let gx = Math.ceil(bedX0 / s.gridSpacing) * s.gridSpacing; gx <= bedRight + 1e-9; gx += s.gridSpacing) {
      ctx.strokeStyle = isMajor(gx) ? t.gridMajor : t.grid;
      ctx.beginPath();
      const sx = toScreen({ x: gx, y: 0 }).x;
      ctx.moveTo(sx, bedTopLeft.y);
      ctx.lineTo(sx, bedTopLeft.y + bedH);
      ctx.stroke();
    }
    for (let gy = Math.ceil(bedTopMm / s.gridSpacing) * s.gridSpacing; gy <= bedY1 + 1e-9; gy += s.gridSpacing) {
      ctx.strokeStyle = isMajor(gy) ? t.gridMajor : t.grid;
      ctx.beginPath();
      const sy = toScreen({ x: 0, y: gy }).y;
      ctx.moveTo(bedTopLeft.x, sy);
      ctx.lineTo(bedTopLeft.x + bedW, sy);
      ctx.stroke();
    }
    ctx.restore();
  }

  // 5. Elements (cut-mode shapes drawn in red to distinguish from engraving)
  for (const el of s.label.elements) {
    if (el.type === 'text' && el.id === s.editingTextId) continue; // textarea overlay replaces it
    ctx.strokeStyle = isCutShape(el) ? t.cut : t.stroke;
    // Line width reflects the actual bit, so heavier text/shapes look heavier.
    ctx.lineWidth = Math.max(1, mmToPx(bitWidthMm(resolveBit(s.profile, el.bitId)), s.zoom));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const stroke of elementStrokes(el)) {
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

    // Lines are shown as the segment itself — no rectangular bounding box.
    if (isLine(el)) {
      const handles = lineHandlePositions(el, toScreen);
      ctx.beginPath();
      ctx.strokeStyle = t.selection;
      ctx.lineWidth = 1.5;
      ctx.moveTo(handles[0].point.x, handles[0].point.y);
      ctx.lineTo(handles[1].point.x, handles[1].point.y);
      ctx.stroke();
      if (s.selectedIds.length === 1 && !el.locked) {
        for (const h of handles) {
          ctx.beginPath();
          ctx.fillStyle = t.handleFill;
          ctx.strokeStyle = t.selection;
          ctx.lineWidth = 1;
          ctx.arc(h.point.x, h.point.y, HANDLE_SIZE_PX / 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
      continue;
    }

    const bbox = elementBBox(el);
    drawRotatedBox(ctx, bbox, el.rotation, toScreen, t.selection, []);
    if (s.selectedIds.length === 1 && !el.locked) {
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
