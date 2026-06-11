import type { Project } from '../store/types';
import { PROJECT_SCHEMA_VERSION } from '../store/projectSlice';

export function downloadBlob(content: string, filename: string, mime = 'application/octet-stream'): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function safeFilename(name: string): string {
  return (name.trim() || 'label').replace(/[^a-z0-9 _.-]/gi, '_');
}

export function saveProjectFile(project: Project): void {
  downloadBlob(JSON.stringify(project, null, 2), `${safeFilename(project.label.name)}.elb`, 'application/json');
}

export function downloadGcode(gcode: string, labelName: string, extension: string): void {
  downloadBlob(gcode, `${safeFilename(labelName)}.${extension}`, 'text/plain');
}

/** Parse and validate an .elb file. Throws with a readable message on failure. */
export function parseProjectFile(text: string, filename: string): Project {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`"${filename}" is not valid JSON.`);
  }
  const p = data as Partial<Project>;
  if (!p || typeof p !== 'object' || !p.label || !Array.isArray(p.label.elements)) {
    throw new Error(`"${filename}" is not a valid EngraveLab project file.`);
  }
  if (p.version !== PROJECT_SCHEMA_VERSION) {
    throw new Error(`"${filename}" uses unsupported schema version "${p.version}".`);
  }
  return {
    version: p.version,
    units: p.units === 'inches' ? 'inches' : 'mm',
    machineProfileId: p.machineProfileId ?? '',
    label: p.label,
    canvasOriginX: p.canvasOriginX ?? 0,
    canvasOriginY: p.canvasOriginY ?? 0,
  };
}

/** Open a file picker and read the chosen file as text. */
export function pickFile(accept: string): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      resolve({ name: file.name, text: await file.text() });
    };
    // Cancel: resolve null when focus returns without a change event
    input.oncancel = () => resolve(null);
    input.click();
  });
}
