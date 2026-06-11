import type { ShapeElement, ShapeKind } from './types';
import type { Stroke } from '../fonts/types';
import { expandMultiPass, scaleStrokes, type Polyline } from '../fonts/strokeRenderer';
import { rotateAround, type Vec2 } from '../utils/geometry';

const ARC_SEGMENTS = 48;
const SHAPE_PASS_SPACING = 0.2;

function circleStroke(): Stroke {
  const pts: Stroke = [];
  for (let i = 0; i <= ARC_SEGMENTS; i++) {
    const a = (i / ARC_SEGMENTS) * Math.PI * 2;
    pts.push([0.5 + 0.5 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)]);
  }
  return pts;
}

const NORMALISED_SHAPES: Record<Exclude<ShapeKind, 'rectangle'>, Stroke[]> = {
  circle: [circleStroke()],
  triangle: [
    [
      [0.5, 0],
      [1, 1],
      [0, 1],
      [0.5, 0],
    ],
  ],
  line: [
    [
      [0, 0],
      [1, 1],
    ],
  ],
  flash: [
    [
      [0.62, 0],
      [0.24, 0.55],
      [0.46, 0.55],
      [0.38, 1],
      [0.76, 0.42],
      [0.54, 0.42],
      [0.62, 0],
    ],
  ],
};

/** Closed rounded-rectangle polyline inside a width × height box (mm). */
export function roundedRectStrokes(width: number, height: number, cornerRadius: number): Polyline[] {
  const r = Math.max(0, Math.min(cornerRadius, width / 2, height / 2));
  if (r <= 0) {
    return [
      [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
        { x: 0, y: 0 },
      ],
    ];
  }
  const seg = 8;
  const pts: Polyline = [];
  const corner = (cx: number, cy: number, startAngle: number) => {
    for (let i = 0; i <= seg; i++) {
      const a = startAngle + (i / seg) * (Math.PI / 2);
      pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  };
  // Clockwise in y-down space, starting after the top-left corner.
  corner(r, r, Math.PI);
  corner(width - r, r, -Math.PI / 2);
  corner(width - r, height - r, 0);
  corner(r, height - r, Math.PI / 2);
  pts.push({ ...pts[0] });
  return [pts];
}

function baseStrokes(el: ShapeElement): Polyline[] {
  if (el.shapeKind === 'rectangle') return roundedRectStrokes(el.width, el.height, el.cornerRadius);
  return scaleStrokes(NORMALISED_SHAPES[el.shapeKind], el.width, el.height);
}

/** Strokes for a shape element in label space (mm, y-down from label top-left). */
export function shapeElementStrokes(el: ShapeElement): Polyline[] {
  const centre: Vec2 = { x: el.x + el.width / 2, y: el.y + el.height / 2 };
  const passCount = el.mode === 'engrave' ? el.passCount : 1;

  const out: Polyline[] = [];
  for (const stroke of baseStrokes(el)) {
    const placed = stroke.map((p) => ({ x: el.x + p.x, y: el.y + p.y }));
    for (const pass of expandMultiPass(placed, passCount, SHAPE_PASS_SPACING)) {
      out.push(el.rotation ? pass.map((p) => rotateAround(p, centre, el.rotation)) : pass);
    }
  }
  return out;
}
