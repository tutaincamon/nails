import { appflu } from "./appflu";

/* ============================================================================
 *  ISIS NAILS  —  Las Palmas de Gran Canaria
 * ============================================================================
 *
 *  Parte de la configuración de Appflu y solo cambia lo suyo: marca, colores,
 *  fotos y contacto. Así, cuando se mejora algo del producto (un texto de las
 *  dudas, una política), lo hereda sola sin tener que tocarlo dos veces.
 *
 *  ⚠️ LOS PRECIOS Y HORARIOS SON LOS DE LA PLANTILLA, no los suyos. Están aquí
 *  para que la web se vea completa al enseñársela. Hay que confirmarlos con
 *  ella antes de que la use de verdad: si una clienta reserva a un precio que
 *  no es el suyo, el problema lo tiene ella delante.
 * ========================================================================== */

export const isis = {
  ...appflu,

  business: {
    ...appflu.business,
    name: "Isis Nails",
    shortName: "Isis",
    tagline: "Uñas que se miran dos veces",
    intro:
      "Centro de estética en Las Palmas. Cita individual, diseños hechos a mano y el tiempo que cada mano necesita.",
    instagram: "_nailsbyisiis",
    tiktok: "_nailsbyisiis",
    logo: "/isis/logo.jpg",
    logoAlt: "Isis Nails · Centro de estética",
    address: {
      area: "Las Palmas de Gran Canaria",
      note: "Te envío la dirección exacta por email al confirmar la cita.",
    },
  },

  /*
   * Rosa del logotipo sobre un fondo cálido, y el tinte coral que aparece en
   * sus propias fotos como acento. La tipografía y la estructura no cambian:
   * lo que distingue una web de otra debe ser su trabajo, no otra rejilla.
   */
  theme: {
    ...appflu.theme,
    primary: "#2a1f24",
    primaryDark: "#000000",
    bg: "#faf6f5",
    ink: "#2a1f24",
    muted: "#7b6a70",
    border: "#e8dcdf",
    accent: "#e8a5bd",
  },

  /*
   * Encendido hasta que ella pase su lista real de servicios, precios y
   * horarios. Sin este aviso, una clienta suya podría reservar a una tarifa
   * que no es la suya, y el problema lo tendría ella delante.
   */
  preview: {
    enabled: true,
    note: "Tarifa y horario de ejemplo: se sustituyen por los tuyos antes de publicar la web.",
  },

  gallery: [
    {
      src: "/isis/frances-flor.jpg",
      alt: "Uñas largas estilo bailarina con francesa blanca y una flor en relieve con perlas doradas",
    },
    {
      src: "/isis/flores-rosa.jpg",
      alt: "Manicura almendrada en rosa y coral con flores tropicales pintadas a mano",
    },
    {
      src: "/isis/rojo-lunares.jpg",
      alt: "Uñas almendradas en rojo con flores blancas en relieve y lunares",
    },
  ] as { src: string; alt: string }[],

  content: {
    ...appflu.content,
    about: {
      title: "El centro",
      body: [
        "Cita individual y sin prisa, en Las Palmas. Cada mano lleva el tiempo que necesita, y hay margen para hablar del diseño sin reloj de por medio.",
        "Material de marcas profesionales, instrumental esterilizado entre clientas y nada de MMA. Si vienes de otro sitio con acrílico rígido, se puede retirar sin dañarte la uña.",
      ],
      badges: appflu.content.about.badges,
    },
  },
};
