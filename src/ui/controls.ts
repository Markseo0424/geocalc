import type { GridSettings } from '@/types';

export interface ControlsOptions {
  onSettingsChange: (partial: Partial<GridSettings>) => void;
  onToggle: (enabled: boolean) => void;
  onResetAnchor: () => void;
}

export function initControls(container: HTMLElement, initial: GridSettings, opts: ControlsOptions) {
  container.innerHTML = '';

  const row = (html: string) => {
    const div = document.createElement('div');
    div.className = 'row';
    div.innerHTML = html;
    container.appendChild(div);
    return div;
  };

  // Toggle
  const toggleRow = row(`<label><input type="checkbox" id="grid-enabled" ${initial.enabled ? 'checked' : ''}/> Grid (G)</label>`);
  const enabledInput = toggleRow.querySelector('#grid-enabled') as HTMLInputElement;
  enabledInput.addEventListener('change', () => {
    opts.onToggle(enabledInput.checked);
  });

  // Spacing (m)
  const spacingRow = row(`<label>Spacing (m) <input type="number" step="0.1" min="0.1" id="grid-spacing" value="${initial.spacingM}" style="width:80px"/></label>`);
  const spacingInput = spacingRow.querySelector('#grid-spacing') as HTMLInputElement;
  spacingInput.addEventListener('input', () => {
    const v = Math.max(0.1, parseFloat(spacingInput.value) || 1);
    opts.onSettingsChange({ spacingM: v });
  });

  // Offset X/Y (cm)
  const offsetRow = row(`<label>Offset X (cm) <input type="number" id="grid-offx" step="1" min="-5000" max="5000" value="${initial.offsetXmCm}" style="width:80px"/></label>
  <label>Y (cm) <input type="number" id="grid-offy" step="1" min="-5000" max="5000" value="${initial.offsetYmCm}" style="width:80px"/></label>`);
  const offx = offsetRow.querySelector('#grid-offx') as HTMLInputElement;
  const offy = offsetRow.querySelector('#grid-offy') as HTMLInputElement;
  const onOffset = () => {
    const ox = parseFloat(offx.value);
    const oy = parseFloat(offy.value);
    opts.onSettingsChange({ offsetXmCm: isFinite(ox) ? ox : 0, offsetYmCm: isFinite(oy) ? oy : 0 });
  };
  offx.addEventListener('input', onOffset);
  offy.addEventListener('input', onOffset);

  // Opacity
  const opacityRow = row(`<label>Opacity <input type="range" id="grid-opacity" min="0.1" max="0.9" step="0.01" value="${initial.opacity}"/></label>`);
  const opacityInput = opacityRow.querySelector('#grid-opacity') as HTMLInputElement;
  opacityInput.addEventListener('input', () => {
    const v = Math.max(0.1, Math.min(0.9, parseFloat(opacityInput.value) || initial.opacity));
    opts.onSettingsChange({ opacity: v });
  });

  // Reset anchor
  const anchorRow = row(`<button id="reset-anchor">Set anchor = current center</button>`);
  const resetBtn = anchorRow.querySelector('#reset-anchor') as HTMLButtonElement;
  resetBtn.addEventListener('click', () => opts.onResetAnchor());

  // Help / shortcuts
  row(`<div style="opacity:.8">Left drag: move map • Right drag: select grid-aligned area • ESC: cancel • G: toggle grid</div>`);

  // Keyboard G toggle
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'g') {
      e.preventDefault();
      enabledInput.checked = !enabledInput.checked;
      opts.onToggle(enabledInput.checked);
    }
  });
}