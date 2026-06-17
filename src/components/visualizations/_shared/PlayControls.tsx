interface Props {
  i: number; total: number; playing: boolean; speed: number;
  onPrev: () => void; onNext: () => void; onToggle: () => void; onReset: () => void; onSpeed: (s: number) => void;
}
export default function PlayControls(p: Props) {
  return (
    <div class="pc" role="group" aria-label="演示播放控制">
      <button onClick={p.onPrev} disabled={p.i === 0} aria-label="上一步">⏮ 上一步</button>
      <button onClick={p.onToggle} aria-label={p.playing ? '暂停' : '播放'}>{p.playing ? '⏸ 暂停' : '▶ 播放'}</button>
      <button onClick={p.onNext} disabled={p.i >= p.total - 1} aria-label="下一步">下一步 ⏭</button>
      <button onClick={p.onReset} aria-label="重置">↺ 重置</button>
      <label class="pc__speed">速度
        <select value={String(p.speed)} onChange={(e) => p.onSpeed(Number((e.target as HTMLSelectElement).value))}>
          <option value="0.25">0.25x</option><option value="0.5">0.5x</option>
          <option value="1">1x</option><option value="2">2x</option><option value="4">4x</option>
        </select>
      </label>
      <span class="pc__pos" aria-live="off">{p.i + 1} / {p.total}</span>
      <style>{`
        .pc{display:flex;gap:var(--space-2);flex-wrap:wrap;align-items:center;margin-top:var(--space-4);}
        .pc button{height:40px;padding:0 var(--space-4);border:1px solid var(--color-primary);background:transparent;color:var(--color-primary);border-radius:var(--radius-sm);cursor:pointer;font-size:var(--fs-caption);}
        .pc button:disabled{opacity:.4;cursor:not-allowed;}
        .pc__speed{display:flex;gap:var(--space-1);align-items:center;color:var(--color-muted);font-size:var(--fs-caption);}
        .pc__pos{margin-left:auto;color:var(--color-muted);font-size:var(--fs-caption);}
      `}</style>
    </div>
  );
}
