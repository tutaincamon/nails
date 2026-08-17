/*
 * Ilustraciones de uñas en SVG.
 *
 * Sirven de marcador de posición: la web se ve terminada sin necesidad de subir
 * ni una foto. Cuando la profesional tenga las suyas, se sustituye <NailSwatch>
 * por <Image> en la galería y ya está.
 */

export type Finish =
  | "nude"
  | "francesa"
  | "cromado"
  | "aura"
  | "animal"
  | "babyboomer"
  | "glitter"
  | "gatuna";

/** Contorno de uña almendrada, en un lienzo de 100 × 160. */
const NAIL_PATH =
  "M50 3C75 3 91 38 91 86v50c0 13-11 20-41 20s-41-7-41-20V86C9 38 25 3 50 3Z";

const FINISH_LABELS: Record<Finish, string> = {
  nude: "Nude natural",
  francesa: "Francesa fija",
  cromado: "Efecto cromado",
  aura: "Efecto aura",
  animal: "Animal print",
  babyboomer: "Babyboomer",
  glitter: "Purpurina",
  gatuna: "Cat eye",
};

export function finishLabel(finish: Finish): string {
  return FINISH_LABELS[finish];
}

function Defs({ id, finish }: { id: string; finish: Finish }) {
  switch (finish) {
    case "nude":
      return (
        <linearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#f3ded6" />
          <stop offset="100%" stopColor="#e2bfb3" />
        </linearGradient>
      );
    case "francesa":
      // Base más rosada de lo habitual para que la sonrisa blanca contraste.
      return (
        <linearGradient id={id} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#f0cfc2" />
          <stop offset="100%" stopColor="#dcae9c" />
        </linearGradient>
      );
    case "cromado":
      return (
        <linearGradient id={id} x1="0.1" y1="0" x2="0.9" y2="1">
          <stop offset="0%" stopColor="#e8d8f0" />
          <stop offset="28%" stopColor="#b9c9e8" />
          <stop offset="55%" stopColor="#eae4d5" />
          <stop offset="78%" stopColor="#d9b8c8" />
          <stop offset="100%" stopColor="#a9b6d6" />
        </linearGradient>
      );
    case "aura":
      // El aura es un halo difuso en el centro: un degradado radial lo imita
      // mucho mejor que dos elipses, que dejaban un anillo con borde duro.
      return (
        <radialGradient id={id} cx="0.5" cy="0.46" r="0.68">
          <stop offset="0%" stopColor="#f6dde6" />
          <stop offset="26%" stopColor="#dd9bb4" />
          <stop offset="52%" stopColor="#c87d99" />
          <stop offset="78%" stopColor="#ecd3d5" />
          <stop offset="100%" stopColor="#f4e3df" />
        </radialGradient>
      );
    case "animal":
      return (
        <linearGradient id={id} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#f0dcc6" />
          <stop offset="100%" stopColor="#dcbd9c" />
        </linearGradient>
      );
    case "babyboomer":
      return (
        <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#e6c6b8" />
          <stop offset="45%" stopColor="#f2ddd3" />
          <stop offset="100%" stopColor="#fdf8f5" />
        </linearGradient>
      );
    case "glitter":
      return (
        <linearGradient id={id} x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#c9a8b4" />
          <stop offset="100%" stopColor="#8f6b7c" />
        </linearGradient>
      );
    case "gatuna":
      return (
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="0.6">
          <stop offset="0%" stopColor="#3b3550" />
          <stop offset="45%" stopColor="#6f6790" />
          <stop offset="52%" stopColor="#c9c2e0" />
          <stop offset="60%" stopColor="#6a6289" />
          <stop offset="100%" stopColor="#332d47" />
        </linearGradient>
      );
  }
}

function Detail({ finish, clipId }: { finish: Finish; clipId: string }) {
  switch (finish) {
    case "francesa":
      return (
        <g clipPath={`url(#${clipId})`}>
          <path d="M-10 3C10 44 90 44 110 3V-14H-10Z" fill="#fffdfc" opacity="0.96" />
        </g>
      );
    case "animal":
      // Manchas de leopardo: anillos partidos (no círculos rellenos) con un
      // punto más oscuro dentro, que es lo que da el aspecto de animal print.
      return (
        <g clipPath={`url(#${clipId})`}>
          {[
            { cx: 30, cy: 40, rx: 11, ry: 8, rot: -22 },
            { cx: 65, cy: 60, rx: 12, ry: 9, rot: 18 },
            { cx: 33, cy: 82, rx: 10, ry: 8, rot: -12 },
            { cx: 66, cy: 107, rx: 11, ry: 8, rot: 24 },
            { cx: 34, cy: 124, rx: 9, ry: 7, rot: -30 },
          ].map((spot, i) => (
            <g key={i} transform={`rotate(${spot.rot} ${spot.cx} ${spot.cy})`}>
              <ellipse
                cx={spot.cx}
                cy={spot.cy}
                rx={spot.rx}
                ry={spot.ry}
                fill="none"
                stroke="#4a3428"
                strokeWidth="4"
                strokeDasharray="13 7"
                strokeLinecap="round"
                opacity="0.9"
              />
              <ellipse cx={spot.cx} cy={spot.cy} rx={spot.rx - 6} ry={spot.ry - 4} fill="#8a5f3c" opacity="0.45" />
            </g>
          ))}
        </g>
      );
    case "glitter":
      return (
        <g clipPath={`url(#${clipId})`} fill="#f6e6c8">
          {[
            [28, 38], [56, 30], [42, 56], [70, 62], [24, 74], [50, 88], [72, 96],
            [34, 104], [58, 118], [26, 128], [66, 138], [44, 144],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2.6 : 1.6} opacity={0.85} />
          ))}
        </g>
      );
    case "cromado":
      return (
        <g clipPath={`url(#${clipId})`}>
          <path d="M18 20C34 60 30 110 22 152h14C44 108 46 58 32 18Z" fill="#fff" opacity="0.35" />
        </g>
      );
    default:
      return null;
  }
}

export function NailSwatch({
  finish,
  className = "",
  label,
}: {
  finish: Finish;
  className?: string;
  label?: string;
}) {
  const gradId = `g-${finish}`;
  const clipId = `c-${finish}`;

  return (
    <svg
      viewBox="0 0 100 160"
      className={className}
      role="img"
      aria-label={label ?? FINISH_LABELS[finish]}
    >
      <defs>
        <Defs id={gradId} finish={finish} />
        <clipPath id={clipId}>
          <path d={NAIL_PATH} />
        </clipPath>
      </defs>

      <path d={NAIL_PATH} fill={`url(#${gradId})`} />
      <Detail finish={finish} clipId={clipId} />

      {/* Brillo del esmalte */}
      <g clipPath={`url(#${clipId})`}>
        <ellipse cx="34" cy="42" rx="11" ry="26" fill="#fff" opacity="0.22" />
      </g>
      <path d={NAIL_PATH} fill="none" stroke="#00000014" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * Grupo de uñas en abanico, como una mano. Decorativo: se oculta a lectores
 * de pantalla porque no aporta información.
 */
export function NailFan({ className = "" }: { className?: string }) {
  const nails: { finish: Finish; x: number; y: number; rotate: number; scale: number }[] = [
    { finish: "cromado", x: 8, y: 58, rotate: -16, scale: 0.72 },
    { finish: "aura", x: 88, y: 26, rotate: -8, scale: 0.86 },
    { finish: "francesa", x: 178, y: 12, rotate: 0, scale: 0.94 },
    { finish: "animal", x: 272, y: 26, rotate: 8, scale: 0.86 },
    { finish: "babyboomer", x: 356, y: 58, rotate: 16, scale: 0.72 },
  ];

  return (
    <svg viewBox="0 0 460 240" className={className} aria-hidden="true" focusable="false">
      {nails.map((nail) => (
        <g
          key={nail.finish}
          transform={`translate(${nail.x} ${nail.y}) rotate(${nail.rotate} 50 80) scale(${nail.scale})`}
        >
          <NailSwatchInline finish={nail.finish} />
        </g>
      ))}
    </svg>
  );
}

/** Versión sin <svg> propio, para incrustar dentro de otro lienzo. */
function NailSwatchInline({ finish }: { finish: Finish }) {
  const gradId = `fan-g-${finish}`;
  const clipId = `fan-c-${finish}`;
  return (
    <>
      <defs>
        <Defs id={gradId} finish={finish} />
        <clipPath id={clipId}>
          <path d={NAIL_PATH} />
        </clipPath>
      </defs>
      <path d={NAIL_PATH} fill={`url(#${gradId})`} />
      <Detail finish={finish} clipId={clipId} />
      <g clipPath={`url(#${clipId})`}>
        <ellipse cx="34" cy="42" rx="11" ry="26" fill="#fff" opacity="0.22" />
      </g>
      <path d={NAIL_PATH} fill="none" stroke="#00000014" strokeWidth="1.5" />
    </>
  );
}
