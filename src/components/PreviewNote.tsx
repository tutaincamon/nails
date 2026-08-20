import siteConfig from "@config";

/*
 * Aviso de que la tarifa mostrada es de ejemplo.
 *
 * Aparece mientras se le enseña la web a una profesional y todavía no ha
 * pasado sus precios reales. Va discreto a propósito: si pareciera un error
 * del sistema restaría en la demostración, y lo que hace falta es justo lo
 * contrario, que se entienda que la web se adapta a ella.
 *
 * No se muestra nada si la profesional no tiene el modo muestra encendido.
 */
export function PreviewNote({ className = "" }: { className?: string }) {
  const { preview } = siteConfig;
  if (!preview.enabled || !preview.note) return null;

  return (
    <p
      className={`border border-dashed border-accent bg-surface px-4 py-2.5 text-[12.5px] leading-relaxed text-muted ${className}`}
    >
      <span className="mr-2 font-semibold uppercase tracking-[0.12em] text-ink">Muestra</span>
      {preview.note}
    </p>
  );
}
