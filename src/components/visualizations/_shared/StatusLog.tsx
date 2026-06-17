export default function StatusLog({ text }: { text: string }) {
  return (
    <p class="status" role="status" aria-live="polite">{text}
      <style>{`.status{margin:var(--space-4) 0 0;padding:var(--space-3) var(--space-4);background:var(--color-surface);border-left:4px solid var(--color-accent);border-radius:var(--radius-sm);color:var(--color-body);font-size:var(--fs-caption);min-height:2.5em;}`}</style>
    </p>
  );
}
