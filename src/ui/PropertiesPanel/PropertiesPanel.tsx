import { useStore, selectActiveProfile } from '../../store';
import type { Element, TextElement, SymbolElement, ShapeElement, ShapeKind } from '../../elements/types';
import { listFonts } from '../../fonts/fontRegistry';
import { listSymbols } from '../../symbols/symbolRegistry';
import { profileBits, resolveBit, bitLabel } from '../../machineProfiles/bits';
import { boldStrokeWidth } from '../../gcode/fill';
import { isLine, lineEndpoints, lineBoxFromEndpoints } from '../../elements/line';
import { NumberField } from '../common/NumberField';
import { alignSelection, distributeSelection, type AlignAction } from './alignment';
import styles from './PropertiesPanel.module.css';

export function PropertiesPanel() {
  const selectedIds = useStore((s) => s.selectedIds);
  const elements = useStore((s) => s.project.label.elements);
  const selected = elements.filter((el) => selectedIds.includes(el.id));

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Properties</div>
      {selected.length === 0 && <div className={styles.empty}>Select an element to edit its properties.</div>}
      {selected.length === 1 && <SingleElementProps el={selected[0]} />}
      {selected.length > 1 && <MultiElementProps els={selected} />}
    </div>
  );
}

function useUpdate() {
  return useStore((s) => s.updateElement);
}

function SingleElementProps({ el }: { el: Element }) {
  switch (el.type) {
    case 'text':
      return <TextProps el={el} />;
    case 'symbol':
      return <SymbolProps el={el} />;
    case 'shape':
      return <ShapeProps el={el} />;
  }
}

function CommonPosition({ el }: { el: Element }) {
  const update = useUpdate();
  return (
    <>
      <div className={styles.row}>
        <NumberField label="X" value={el.x} onChange={(v) => update(el.id, { x: v })} />
        <NumberField label="Y" value={el.y} onChange={(v) => update(el.id, { y: v })} />
      </div>
      <label className={styles.check}>
        <input type="checkbox" checked={el.locked} onChange={(e) => update(el.id, { locked: e.target.checked })} />
        Lock element
      </label>
    </>
  );
}

function BitField({ el }: { el: Element }) {
  const update = useUpdate();
  const profile = useStore(selectActiveProfile);
  const bits = profileBits(profile);
  const defaultBit = resolveBit(profile, null);
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>Bit</span>
      <select value={el.bitId ?? ''} onChange={(e) => update(el.id, { bitId: e.target.value || null })}>
        <option value="">Default — {bitLabel(defaultBit)}</option>
        {bits.map((b) => (
          <option key={b.id} value={b.id}>
            {bitLabel(b)}
          </option>
        ))}
      </select>
    </label>
  );
}

function BitFieldMulti({ els }: { els: Element[] }) {
  const update = useUpdate();
  const profile = useStore(selectActiveProfile);
  const bits = profileBits(profile);
  const shared = els.every((e) => (e.bitId ?? '') === (els[0].bitId ?? ''));
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>Bit</span>
      <select
        value={shared ? els[0].bitId ?? '' : ''}
        onChange={(e) => els.forEach((el) => update(el.id, { bitId: e.target.value || null }))}
      >
        <option value="">Default bit</option>
        {bits.map((b) => (
          <option key={b.id} value={b.id}>
            {bitLabel(b)}
          </option>
        ))}
      </select>
    </label>
  );
}

function BoldWidthField({ el }: { el: TextElement }) {
  const update = useUpdate();
  const profile = useStore(selectActiveProfile);
  const bit = resolveBit(profile, el.bitId);
  const effective = boldStrokeWidth(bit.diameter, el.boldWidth);
  const useDefault = el.boldWidth == null;
  return (
    <>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={useDefault}
          onChange={(e) =>
            update(el.id, { boldWidth: e.target.checked ? null : Math.round(effective * 100) / 100 })
          }
        />
        Default bold width
      </label>
      {!useDefault && (
        <NumberField
          label="Bold width"
          value={el.boldWidth ?? effective}
          min={bit.diameter}
          step={0.05}
          onChange={(v) => update(el.id, { boldWidth: v })}
        />
      )}
    </>
  );
}

function DepthField({ el }: { el: Element }) {
  const update = useUpdate();
  const useDefault = el.engraveDepth === null;
  return (
    <>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={useDefault}
          onChange={(e) => update(el.id, { engraveDepth: e.target.checked ? null : 0.3 })}
        />
        Use machine default depth
      </label>
      {!useDefault && (
        <NumberField
          label="Engrave depth"
          value={el.engraveDepth ?? 0.3}
          min={0.01}
          onChange={(v) => update(el.id, { engraveDepth: v })}
        />
      )}
    </>
  );
}

function TextProps({ el }: { el: TextElement }) {
  const update = useUpdate();
  return (
    <div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Text</span>
        <textarea rows={3} value={el.text} onChange={(e) => update(el.id, { text: e.target.value })} />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Font</span>
        <select value={el.fontName} onChange={(e) => update(el.id, { fontName: e.target.value })}>
          {listFonts().map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.row}>
        <NumberField label="Font size" value={el.fontSize} min={0.5} onChange={(v) => update(el.id, { fontSize: v })} />
        <NumberField
          label="Line spacing"
          value={el.lineSpacing}
          min={0}
          onChange={(v) => update(el.id, { lineSpacing: v })}
        />
      </div>
      <BitField el={el} />
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Weight</span>
        <div className={styles.btnRow}>
          {([['normal', false], ['bold', true]] as const).map(([label, value]) => (
            <button
              key={label}
              className={`${styles.segBtn} ${!!el.bold === value ? styles.active : ''}`}
              onClick={() => update(el.id, { bold: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {el.bold && <BoldWidthField el={el} />}
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Alignment</span>
        <div className={styles.btnRow}>
          {(['left', 'centre', 'right'] as const).map((a) => (
            <button
              key={a}
              className={`${styles.segBtn} ${el.align === a ? styles.active : ''}`}
              onClick={() => update(el.id, { align: a })}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
      <DepthField el={el} />
      <CommonPosition el={el} />
    </div>
  );
}

function SymbolProps({ el }: { el: SymbolElement }) {
  const update = useUpdate();
  return (
    <div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Symbol</span>
        <select value={el.symbolName} onChange={(e) => update(el.id, { symbolName: e.target.value })}>
          {listSymbols().map((sym) => (
            <option key={sym.name} value={sym.name}>
              {sym.displayName}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.row}>
        <NumberField label="Width" value={el.width} min={1} onChange={(v) => update(el.id, { width: v })} />
        <NumberField label="Height" value={el.height} min={1} onChange={(v) => update(el.id, { height: v })} />
      </div>
      <BitField el={el} />
      <DepthField el={el} />
      <CommonPosition el={el} />
    </div>
  );
}

const SHAPE_KINDS: { kind: ShapeKind; label: string }[] = [
  { kind: 'rectangle', label: 'Rectangle' },
  { kind: 'circle', label: 'Circle' },
  { kind: 'triangle', label: 'Triangle' },
  { kind: 'line', label: 'Line' },
];

function ShapeProps({ el }: { el: ShapeElement }) {
  const update = useUpdate();
  return (
    <div>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Shape</span>
        <select
          value={el.shapeKind}
          onChange={(e) => update(el.id, { shapeKind: e.target.value as ShapeKind })}
        >
          {SHAPE_KINDS.map(({ kind, label }) => (
            <option key={kind} value={kind}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Mode</span>
        <div className={styles.btnRow}>
          <button
            className={`${styles.segBtn} ${el.mode === 'engrave' ? styles.active : ''}`}
            onClick={() => update(el.id, { mode: 'engrave' })}
          >
            Engrave
          </button>
          <button
            className={`${styles.segBtn} ${el.mode === 'cut' ? styles.active : ''}`}
            onClick={() => update(el.id, { mode: 'cut' })}
          >
            Cut through
          </button>
        </div>
      </div>
      {el.mode === 'cut' && (
        <div className={styles.note}>Cut shapes always run last (innermost first) at material thickness.</div>
      )}
      {isLine(el) ? (
        <LineEndpoints el={el} />
      ) : (
        <>
          <div className={styles.row}>
            <NumberField label="Width" value={el.width} min={0.5} onChange={(v) => update(el.id, { width: v })} />
            <NumberField label="Height" value={el.height} min={0.5} onChange={(v) => update(el.id, { height: v })} />
          </div>
          {el.shapeKind === 'rectangle' && (
            <NumberField
              label="Corner radius"
              value={el.cornerRadius}
              min={0}
              onChange={(v) => update(el.id, { cornerRadius: v })}
            />
          )}
        </>
      )}
      <BitField el={el} />
      <DepthField el={el} />
      <CommonPosition el={el} />
    </div>
  );
}

function LineEndpoints({ el }: { el: ShapeElement }) {
  const update = useUpdate();
  const [a, b] = lineEndpoints(el as ShapeElement & { shapeKind: 'line' });
  return (
    <>
      <div className={styles.row}>
        <NumberField label="X1" value={a.x} onChange={(v) => update(el.id, lineBoxFromEndpoints({ x: v, y: a.y }, b))} />
        <NumberField label="Y1" value={a.y} onChange={(v) => update(el.id, lineBoxFromEndpoints({ x: a.x, y: v }, b))} />
      </div>
      <div className={styles.row}>
        <NumberField label="X2" value={b.x} onChange={(v) => update(el.id, lineBoxFromEndpoints(a, { x: v, y: b.y }))} />
        <NumberField label="Y2" value={b.y} onChange={(v) => update(el.id, lineBoxFromEndpoints(a, { x: b.x, y: v }))} />
      </div>
    </>
  );
}

const ALIGN_ACTIONS: { action: AlignAction; label: string }[] = [
  { action: 'left', label: '⫷ Left' },
  { action: 'centreH', label: '⊟ Centre H' },
  { action: 'right', label: '⫸ Right' },
  { action: 'top', label: '⫯ Top' },
  { action: 'centreV', label: '⊞ Centre V' },
  { action: 'bottom', label: '⫰ Bottom' },
];

function MultiElementProps({ els }: { els: Element[] }) {
  const update = useUpdate();
  const sharedDepth = els.every((e) => e.engraveDepth === els[0].engraveDepth);

  return (
    <div>
      <div className={styles.note}>{els.length} elements selected</div>
      <div className={styles.field}>
        <span className={styles.fieldLabel}>Align</span>
        <div className={styles.alignGrid}>
          {ALIGN_ACTIONS.map(({ action, label }) => (
            <button key={action} className={styles.segBtn} onClick={() => alignSelection(action)}>
              {label}
            </button>
          ))}
        </div>
        <div className={styles.btnRow}>
          <button className={styles.segBtn} onClick={() => distributeSelection('h')}>
            Distribute H
          </button>
          <button className={styles.segBtn} onClick={() => distributeSelection('v')}>
            Distribute V
          </button>
        </div>
      </div>
      <BitFieldMulti els={els} />
      <NumberField
        label="Engrave depth"
        value={sharedDepth ? (els[0].engraveDepth ?? 0.3) : 0.3}
        min={0.01}
        onChange={(v) => els.forEach((e) => update(e.id, { engraveDepth: v }))}
      />
    </div>
  );
}
