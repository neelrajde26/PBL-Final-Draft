import shape from "@/lib/maharashtra-shape.json";

/** The Maharashtra outline, traced from the canonical 36-district boundary file (scripts/make_outline.py). */
export function StateMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg viewBox={shape.viewBox} className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <path d={shape.state} fill="currentColor" />
    </svg>
  );
}

export const stateShape = shape;
