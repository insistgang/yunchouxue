interface Props { label: string; min: number; max: number; step?: number; value: number; onInput: (v: number) => void; }
export default function Slider({ label, min, max, step = 1, value, onInput }: Props) {
  return (
    <label class="sld">
      <span class="sld__label">{label}<b>{value}</b></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))} />
      <style>{`
        .sld{display:flex;flex-direction:column;gap:var(--space-1);min-width:160px;}
        .sld__label{display:flex;justify-content:space-between;color:var(--color-muted);font-size:var(--fs-caption);}
        .sld input{width:100%;height:44px;accent-color:var(--color-primary);touch-action:none;}
      `}</style>
    </label>
  );
}
