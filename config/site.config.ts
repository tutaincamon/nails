/* ============================================================================
 *  CONFIGURACIÓN DEL NEGOCIO  —  edita SOLO este archivo para personalizar la web
 * ============================================================================
 *
 *  Todo lo que aparece en la web (nombre, colores, textos, servicios, precios,
 *  horarios, políticas) sale de aquí. No hace falta tocar código.
 *
 *  Para vender la web a otra profesional: copia el proyecto, cambia este archivo
 *  y las variables del .env. Nada más.
 * ========================================================================== */

export type Service = {
  id: string;
  name: string;
  /** Precio en euros. Si `from` es true, se muestra como "desde 30 €". */
  price: number;
  /** Duración de la cita en minutos. Se usa para calcular los huecos libres. */
  durationMin: number;
  description?: string;
  /** true = el precio final puede subir según el diseño elegido */
  from?: boolean;
  /** Marca el servicio como destacado en la web */
  featured?: boolean;
};

export type ServiceCategory = {
  id: string;
  name: string;
  subtitle: string;
  /** Extras que se pueden añadir a los servicios de esta categoría */
  addOns: AddOn[];
  services: Service[];
};

export type AddOn = {
  id: string;
  name: string;
  price: number;
  /** Minutos extra que suma a la cita */
  durationMin: number;
};

/** Franja horaria de trabajo, formato "HH:MM" */
export type TimeRange = { start: string; end: string };

export const siteConfig = {
  /* ---------------------------------------------------------------------- */
  /*  1. DATOS DEL NEGOCIO                                                  */
  /* ---------------------------------------------------------------------- */
  business: {
    name: "Appflu",
    /** Aparece en el <title> y en la cabecera */
    shortName: "Appflu",
    tagline: "Uñas hechas a mano, sin prisa",
    intro:
      "Estudio pequeño y tranquilo donde cada cita es individual. Sin salas llenas, sin esperas: solo tus uñas y el tiempo que necesitan.",
    /*
     * Los campos de contacto son opcionales: si se dejan vacíos, la web oculta
     * sola el botón o el dato correspondiente. Así se puede publicar sin datos
     * personales y rellenarlos más adelante.
     */
    ownerName: "",
    /** Email que recibe el aviso de cada reserva. Se sobrescribe con OWNER_EMAIL. */
    ownerEmail: "",
    phone: "",
    /** Solo dígitos con prefijo internacional, para el enlace de WhatsApp */
    whatsapp: "",
    instagram: "",
    address: {
      area: "Cita previa",
      /** La dirección exacta se envía al confirmar (habitual en negocios en casa) */
      note: "Te envío la dirección exacta por email al confirmar la cita.",
    },
    timezone: "Europe/Madrid",
    locale: "es-ES",
    currency: "EUR",
  },

  /* ---------------------------------------------------------------------- */
  /*  GALERÍA                                                               */
  /*  Fotos de trabajos reales. Si está vacía, la web dibuja unas uñas de   */
  /*  ejemplo en SVG para que no se vea un hueco.                           */
  /*  Deja los archivos en public/galeria/ y añádelos aquí.                 */
  /* ---------------------------------------------------------------------- */
  gallery: [] as { src: string; alt: string }[],

  /* ---------------------------------------------------------------------- */
  /*  2. IDENTIDAD VISUAL                                                   */
  /*     Cambia estos colores y la web entera cambia de estilo.             */
  /* ---------------------------------------------------------------------- */
  theme: {
    /** Color principal (botones, acentos) */
    primary: "#8d5b4c",
    primaryDark: "#6f4438",
    /** Fondo general, cálido */
    bg: "#faf6f3",
    surface: "#ffffff",
    ink: "#2c2320",
    muted: "#7d6c64",
    border: "#e8ddd6",
    accent: "#d9a8a0",
  },

  /* ---------------------------------------------------------------------- */
  /*  3. REGLAS DE LA AGENDA                                                */
  /* ---------------------------------------------------------------------- */
  booking: {
    /** Cada cuántos minutos se ofrece un hueco (30 = 10:00, 10:30, 11:00...) */
    slotMinutes: 30,
    /** Minutos de limpieza/preparación entre clientas */
    bufferMinutes: 15,
    /** No se puede reservar con menos de estas horas de antelación */
    minNoticeHours: 12,
    /** Hasta cuántos días vista se puede reservar */
    maxDaysAhead: 60,
    /** Horas mínimas antes de la cita para poder cancelar online */
    cancellationHours: 24,
    /** Máximo de citas por día (0 = sin límite) */
    maxPerDay: 0,
  },

  /* ---------------------------------------------------------------------- */
  /*  4. SEÑAL / PAGO ANTICIPADO                                            */
  /* ---------------------------------------------------------------------- */
  deposit: {
    /** false = se paga todo en el estudio, sin pago online */
    enabled: true,
    /** "fixed" = importe fijo | "percent" = porcentaje del servicio */
    mode: "fixed" as "fixed" | "percent",
    /** Euros si mode="fixed", porcentaje (0-100) si mode="percent" */
    amount: 10,
    /** Si true, la clienta puede elegir pagar en el estudio */
    allowPayOnSite: true,
    note: "La señal se descuenta del precio final. Si cancelas con más de 24 h de antelación, se devuelve.",
  },

  /* ---------------------------------------------------------------------- */
  /*  5. HORARIO SEMANAL                                                    */
  /*     0 = domingo, 1 = lunes ... 6 = sábado. Array vacío = cerrado.      */
  /* ---------------------------------------------------------------------- */
  hours: {
    0: [] as TimeRange[],
    1: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "20:30" }],
    2: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "20:30" }],
    3: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "20:30" }],
    4: [{ start: "10:00", end: "14:00" }, { start: "16:00", end: "20:30" }],
    5: [{ start: "10:00", end: "15:00" }],
    6: [{ start: "10:00", end: "14:00" }],
  } as Record<number, TimeRange[]>,

  /** Días concretos cerrados (vacaciones, festivos). Formato "YYYY-MM-DD" */
  closedDates: ["2026-12-25", "2026-01-01"],

  /* ---------------------------------------------------------------------- */
  /*  6. SERVICIOS Y PRECIOS                                                */
  /* ---------------------------------------------------------------------- */
  categories: [
    {
      id: "acrilicas",
      name: "Acrílicas",
      subtitle: "Extensión y esculpido. Duración 3–4 semanas.",
      addOns: [
        { id: "acr-talla-l", name: "Tamaño L o uñas mordidas", price: 3, durationMin: 20 },
      ],
      services: [
        {
          id: "acr-color",
          name: "Acrílicas nude o color",
          price: 27,
          durationMin: 150,
          description: "Esculpido completo en un solo tono, acabado liso.",
          featured: true,
        },
        {
          id: "acr-deco-sencilla",
          name: "Acrílicas + decoración sencilla",
          price: 30,
          from: true,
          durationMin: 165,
          description: "Francesa, líneas, puntos, cat eye…",
          featured: true,
        },
        {
          id: "acr-deco-elaborada",
          name: "Acrílicas + decoración elaborada",
          price: 34,
          from: true,
          durationMin: 180,
          description: "Animal print, efecto aura, cromado…",
        },
        {
          id: "acr-deco-muy-elaborada",
          name: "Acrílicas + decoración muy elaborada",
          price: 48,
          from: true,
          durationMin: 210,
          description: "Relieves, mano alzada detallada, diseños a medida.",
        },
        {
          id: "acr-francesa-blanca",
          name: "Francesa fija blanca",
          price: 34,
          durationMin: 180,
          description: "Sonrisa esculpida en acrílico blanco.",
        },
        {
          id: "acr-francesa-color",
          name: "Francesa fija de color",
          price: 37,
          durationMin: 180,
          description: "Sonrisa esculpida en el color que elijas.",
        },
        {
          id: "acr-babyboomer-blanco",
          name: "Babyboomer blanco",
          price: 34,
          durationMin: 180,
          description: "Degradado suave de nude a blanco.",
        },
        {
          id: "acr-babyboomer-color",
          name: "Babyboomer de color",
          price: 37,
          durationMin: 180,
          description: "Degradado en el color que elijas.",
        },
        {
          id: "acr-xl",
          name: "Acrílicas XL (color o francesa)",
          price: 37,
          durationMin: 180,
          description: "Longitud extra larga.",
        },
        {
          id: "acr-xxl",
          name: "Acrílicas XXL (color o francesa)",
          price: 42,
          durationMin: 195,
          description: "La máxima longitud, esculpida a medida.",
        },
        {
          id: "acr-xl-deco-sencilla",
          name: "XL–XXL + decoración sencilla",
          price: 47,
          from: true,
          durationMin: 210,
        },
        {
          id: "acr-xl-deco-elaborada",
          name: "XL–XXL + decoración elaborada",
          price: 65,
          from: true,
          durationMin: 240,
        },
      ],
    },
    {
      id: "semipermanente",
      name: "Semipermanente",
      subtitle: "Sobre tu uña natural. Duración 2–3 semanas.",
      addOns: [
        { id: "semi-rubber", name: "Refuerzo y nivelación con rubber o builder gel", price: 4, durationMin: 20 },
        { id: "semi-largas", name: "Uñas largas (tamaño L o más)", price: 2, durationMin: 10 },
      ],
      services: [
        {
          id: "semi-color",
          name: "Semipermanente de color",
          price: 18,
          durationMin: 75,
          description: "Manicura, preparado y color a elegir.",
          featured: true,
        },
        {
          id: "semi-deco-sencilla",
          name: "Semipermanente + decoración sencilla",
          price: 20,
          from: true,
          durationMin: 90,
          description: "Francesa, líneas, puntos, cat eye…",
        },
        {
          id: "semi-deco-elaborada",
          name: "Semipermanente + decoración elaborada",
          price: 24,
          from: true,
          durationMin: 105,
          description: "Animal print, efecto aura, cromado…",
        },
        {
          id: "semi-deco-muy-elaborada",
          name: "Semipermanente + decoración muy elaborada",
          price: 33,
          from: true,
          durationMin: 135,
          description: "Relieves, mano alzada detallada.",
        },
      ],
    },
    {
      id: "retiradas",
      name: "Retiradas",
      subtitle: "Retirada segura, sin dañar la uña natural.",
      addOns: [],
      services: [
        {
          id: "ret-acrilicas",
          name: "Retirada de acrílicas",
          price: 10,
          durationMin: 45,
          description: "Limado y retirada cuidadosa.",
        },
        {
          id: "ret-acrilicas-mma",
          name: "Retirada de acrílicas con MMA",
          price: 15,
          durationMin: 60,
          description: "Producto rígido: requiere más tiempo y cuidado.",
        },
        {
          id: "ret-semi",
          name: "Retirada de semipermanente",
          price: 5,
          durationMin: 30,
        },
        {
          id: "ret-semi-rubber",
          name: "Retirada de semipermanente con rubber o builder gel",
          price: 8,
          durationMin: 30,
        },
      ],
    },
  ] as ServiceCategory[],

  /* ---------------------------------------------------------------------- */
  /*  7. TEXTOS DE LA WEB                                                   */
  /* ---------------------------------------------------------------------- */
  content: {
    steps: [
      {
        title: "Elige tu servicio",
        text: "Mira los precios y el tiempo de cada técnica. Puedes añadir extras como longitud o refuerzo.",
      },
      {
        title: "Reserva tu hueco",
        text: "Solo verás las horas realmente libres. La agenda ya cuenta el tiempo que necesita tu servicio.",
      },
      {
        title: "Recibes confirmación",
        text: "Te llega un email con la cita, la dirección y un enlace para cancelar o cambiar. El día antes, un recordatorio.",
      },
    ],
    about: {
      title: "Cómo trabajo",
      body: [
        "Cita individual y sin prisa. Cada mano lleva el tiempo que necesita, y hay margen para hablar del diseño sin reloj de por medio.",
        "Material de marcas profesionales, instrumental esterilizado entre clientas y nada de MMA. Si vienes de otro sitio con acrílico rígido, se puede retirar sin dañarte la uña.",
      ],
      badges: ["Producto profesional", "Instrumental esterilizado", "Libre de MMA", "Cita individual"],
    },
    /*
     * Opiniones reales de clientas. Vacío a propósito: publicar reseñas
     * inventadas es engañoso, así que la sección solo aparece cuando hay algo
     * de verdad que enseñar.
     */
    testimonials: [] as { name: string; text: string; service: string }[],
    faq: [
      {
        q: "¿Cuánto dura la cita?",
        a: "Depende del servicio: un semipermanente de color son unos 75 minutos y unas acrílicas con decoración pueden llegar a 3 horas. El tiempo aparece indicado en cada servicio al reservar.",
      },
      {
        q: "¿Qué pasa si llego tarde?",
        a: "Avisa cuanto antes. Se puede esperar unos 15 minutos, pero si es más tiempo quizá haya que simplificar el diseño o mover la cita, porque después hay otra clienta.",
      },
      {
        q: "¿Tengo que pagar algo al reservar?",
        a: "Se pide una señal para asegurar el hueco, que se descuenta del precio final. El resto se paga en el estudio, en efectivo o Bizum.",
      },
      {
        q: "¿Puedo cancelar?",
        a: "Sí, desde el enlace del email de confirmación, hasta 24 horas antes. Cancelando con esa antelación la señal se devuelve.",
      },
      {
        q: "¿Los precios que ponen «desde» por qué varían?",
        a: "Porque una decoración puede ser dos uñas con líneas o las diez con relieve y mano alzada. Si mandas la referencia antes de la cita, se confirma el precio exacto.",
      },
      {
        q: "¿Hacéis retirada de trabajos de otro sitio?",
        a: "Sí, y no hay problema. Reserva el servicio de retirada junto con lo que quieras hacerte después; el sistema suma el tiempo de las dos cosas.",
      },
    ],
    policies: [
      "Ven con las uñas limpias, sin esmalte normal por encima si puedes.",
      "El estudio es pequeño: por favor, ven sola (sin acompañantes ni niños).",
      "No se atiende con uñas con hongos u onicomicosis sin informe médico.",
      "Las reparaciones de una uña rota en los primeros 7 días son gratuitas.",
    ],
  },
};

export type SiteConfig = typeof siteConfig;
export default siteConfig;
