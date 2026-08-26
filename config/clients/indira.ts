import { appflu } from "./appflu";

/* ============================================================================
 *  LUAMIZ  —  Indira · manicura y pedicura a domicilio en Las Palmas
 * ============================================================================
 *
 *  Parte de la configuración de Appflu y solo cambia lo suyo, igual que isis.ts,
 *  para heredar las mejoras del producto sin tener que tocarlas dos veces.
 *
 *  Antes tenía centro y estaba en Booksy como "Beauty Studio By Indira Diaz".
 *  Ahora trabaja a domicilio con marca propia, Luamiz. Las reseñas son de esa
 *  etapa anterior: son suyas y valen, pero por eso alguna habla de "su centro".
 *
 *  Que vaya a casa de la clienta cambia tres cosas que conviene no "arreglar"
 *  por error más adelante:
 *
 *    1. La dirección va al revés. En un estudio, la profesional manda su
 *       dirección al confirmar. Aquí es la clienta quien tiene que darla, y por
 *       eso venue.needsClientAddress la vuelve obligatoria.
 *    2. bufferMinutes no son minutos de limpieza, son minutos de DESPLAZAMIENTO.
 *       Es el número más importante de este archivo.
 *    3. El horario que hay aquí es solo el de partida: ella lo lleva desde
 *       /admin → Mi horario, y lo que guarde ahí manda sobre esto.
 *
 *  ÚNICO CABO SUELTO — DURACIONES. Su cartelera trae los precios pero no los
 *  tiempos, así que los durationMin de abajo son una estimación del oficio, no
 *  los suyos. Es lo que hace que la agenda cuadre: si una pedicura spa le lleva
 *  2 h y aquí pone 105 min, el sistema le mete una clienta encima, en otra casa
 *  y sin margen para llegar. Hay que repasarlos con ella uno a uno.
 * ========================================================================== */

export const indira = {
  ...appflu,

  business: {
    ...appflu.business,
    name: "Luamiz",
    shortName: "Luamiz",
    /* Suyas, de su cartelera de servicios. */
    tagline: "Tu cita de belleza, donde tú quieras",
    intro:
      "Manicura, pedicura y acrílico a domicilio en Las Palmas. Voy yo a tu casa con todo el material: no pierdes el viaje ni la sala de espera, solo eliges la hora.",
    ownerName: "Indira",
    instagram: "beautynailsindiradiazz",
    tiktok: "",
    /* Recortado de su cartelera. Conviene pedirle el archivo original. */
    logo: "/indira/logo.png",
    logoAlt: "Luamiz · manicura y pedicura a domicilio",
    address: {
      area: "Las Palmas de Gran Canaria",
      /*
       * Coherente con venue.needsClientAddress = true. Si resulta que atiende
       * en su propio centro (ver AVISOS), esta frase y el bloque venue cambian
       * juntos: son la misma decisión.
       */
      note: "Voy yo a tu casa, en Las Palmas y alrededores. Dime la dirección al reservar.",
    },
  },

  /*
   * Ella no tiene estudio: el estudio es la casa de la clienta. Sin esto, la
   * web y los cinco emails le dirían a su clienta que se pase «por el estudio».
   */
  venue: {
    where: "en tu casa",
    payWhere: "en la cita",
    sectionTitle: "A domicilio",
    /*
     * Lo que de verdad la diferencia. Sin dirección obligatoria, ella recibiría
     * una reserva confirmada sin saber a qué casa tiene que ir.
     */
    needsClientAddress: true,
    addressLabel: "¿Dónde voy?",
    addressHint:
      "Calle, número, piso y población. Si hay algo que deba saber para llegar (portal sin timbre, zona de aparcamiento), dímelo también.",
  },

  /*
   * Los colores de su cartelera: el rosa empolvado del fondo, el rosa vino de
   * los titulares y el dorado del logotipo como único acento. La estructura y
   * la tipografía no cambian: lo que debe distinguir una web de otra es el
   * trabajo que enseña, no otra rejilla.
   */
  theme: {
    ...appflu.theme,
    primary: "#8f5560",
    primaryDark: "#6d3f48",
    bg: "#fdf3f1",
    surface: "#ffffff",
    ink: "#4a3338",
    muted: "#96787c",
    border: "#f0ded9",
    accent: "#c8a05c",
  },

  /*
   * Apagado: los precios son los de su cartelera, así que la web ya se puede
   * usar de verdad. Lo único sin confirmar son las duraciones, y eso no es algo
   * que la clienta tenga que leer en un cartel: se arregla repasándolas con
   * ella. Volver a encenderlo si vuelve a haber algo provisional a la vista.
   */
  preview: {
    enabled: false,
    note: "",
  },

  /*
   * Trabajos suyos, recortados de las capturas de Instagram que pasó: fuera la
   * barra del móvil, la tira de historias, los iconos de la app y las pegatinas
   * de las historias. Queda fuera una en la que el texto sobreimpreso tapaba
   * las uñas y la mesa vacía se comía media foto; para esa hace falta el
   * original del carrete.
   */
  gallery: [
    {
      src: "/indira/frances-burdeos.jpg",
      alt: "Uñas almendradas con francesa en burdeos y borde difuminado sobre pelo rosa",
    },
    {
      src: "/indira/frances-rosa.jpg",
      alt: "Uñas largas cuadradas con francesa en rosa fucsia con purpurina",
    },
    {
      src: "/indira/frances-blanca.jpg",
      alt: "Manicura cuadrada con francesa blanca clásica sobre base rosada",
    },
    {
      src: "/indira/naranja-nude.jpg",
      alt: "Manicura almendrada combinando naranja neón y nude con una línea de cristales dorados",
    },
    {
      src: "/indira/amarillo-pastel.jpg",
      alt: "Uñas largas cuadradas en amarillo pastel con dos uñas nude decoradas con flores en relieve",
    },
    {
      src: "/indira/naranja-glitter.jpg",
      alt: "Uñas XL cuadradas alternando naranja con purpurina y nude translúcido",
    },
    {
      src: "/indira/azul-noche.jpg",
      alt: "Uñas ovaladas cortas en azul noche con la cutícula perfilada en purpurina",
    },
  ] as { src: string; alt: string }[],

  booking: {
    ...appflu.booking,
    /*
     * Aquí esto NO son minutos de limpieza: es el tiempo de ir de una casa a
     * otra. 45 min es lo que se tarda en recoger, moverse por una ciudad media
     * y montar otra vez. Si se queda corto, la agenda le dará citas a las que
     * no puede llegar. Ajustar en cuanto se sepa su zona real.
     */
    bufferMinutes: 45,
    /* Necesita el día antes para organizar la ruta, no bastan 12 h. */
    minNoticeHours: 24,
    /* 48 h, igual que noShow.hoursBefore. Si se cambia uno hay que cambiar el
     * otro, o la web promete cancelación gratis en horas en las que ya cobra. */
    cancellationHours: 48,
  },

  /*
   * Lo que hacía en Booksy: guardar la tarjeta y cobrar el servicio entero a
   * quien no aparece o avisa con menos de 48 h. A domicilio duele el doble,
   * porque además del hueco se pierde el viaje.
   */
  noShow: {
    enabled: true,
    hoursBefore: 48,
    chargePercent: 100,
    terms:
      "Guardo tu tarjeta para asegurar la cita: ahora solo se te cobra la señal. Si cancelas con menos de 48 h de antelación o no acudes, se cobra el 100 % del servicio.",
  },

  /*
   * Con desplazamiento, un plantón no es una hora perdida: es el viaje también.
   * Por eso la señal aquí importa más que en un estudio.
   */
  deposit: {
    ...appflu.deposit,
    enabled: true,
    mode: "fixed" as "fixed" | "percent",
    amount: 10,
    /*
     * Sin opción de pagar todo en la cita: la tarjeta se guarda en la pantalla
     * de pago de la señal, así que quien no pasa por ahí se queda sin tarjeta
     * guardada y la política de plantones no le aplica. Un solo camino.
     */
    allowPayOnSite: false,
    note: "La señal se descuenta del precio final. Si cancelas con más de 48 h de antelación, se devuelve entera.",
  },

  /*
   * HORARIO PROVISIONAL. No tiene horario fijo, y hoy el horario vive en este
   * archivo, no en la base de datos: cambiarlo es tocar código y volver a
   * desplegar. Mientras tanto, la ventana va ancha (L–S de 9:00 a 21:00) y ella
   * cierra lo que no quiera desde /admin → bloquear horas.
   *
   * No es la solución buena: si un sábado no piensa trabajar, tiene que acordarse
   * de bloquearlo o alguien le reservará. La solución buena es un editor de
   * horario en /admin, que es desarrollo aparte.
   */
  hours: {
    0: [] as { start: string; end: string }[],
    1: [{ start: "09:00", end: "21:00" }],
    2: [{ start: "09:00", end: "21:00" }],
    3: [{ start: "09:00", end: "21:00" }],
    4: [{ start: "09:00", end: "21:00" }],
    5: [{ start: "09:00", end: "21:00" }],
    6: [{ start: "09:00", end: "21:00" }],
  } as Record<number, { start: string; end: string }[]>,

  closedDates: [] as string[],

  /* ---------------------------------------------------------------------- */
  /*  SERVICIOS                                                             */
  /*  ⚠️ SIN VERIFICAR: precios de una cartelera ajena, tiempos estimados.   */
  /*     Es un punto de partida para que ella corrija, no una tarifa.        */
  /* ---------------------------------------------------------------------- */
  categories: [
    {
      id: "manos",
      name: "Manos",
      subtitle: "Manicura, semipermanente y acrílico, en tu casa.",
      addOns: [
        { id: "extra-tamano", name: "Extra de tamaño", price: 5, durationMin: 20 },
        { id: "francesa", name: "Francesa", price: 5, durationMin: 15 },
        { id: "efectos", name: "Efectos y diseños", price: 3, durationMin: 10 },
        /*
         * En la cartelera esto era "desde 1 € por uña". El sistema no sabe
         * cobrar por unidad, así que va el mínimo y se ajusta en la cita.
         */
        { id: "piedras", name: "Piedras o cristales", price: 1, durationMin: 10 },
        { id: "cambio-forma", name: "Cambio de forma", price: 5, durationMin: 15 },
      ],
      services: [
        {
          id: "manicura",
          name: "Manicura",
          price: 20,
          durationMin: 45,
          description: "Limado, cutícula e hidratación, sin esmaltado permanente.",
        },
        {
          id: "semipermanente",
          name: "Semipermanente",
          price: 27,
          durationMin: 75,
          description: "Manicura completa y color a elegir. Dura 2–3 semanas.",
          featured: true,
        },
        {
          /*
           * La cartelera ponía "30 € / 35 €" sin decir cuál era cuál. Va como
           * uno solo "desde 30" hasta que lo aclare; entonces se parte en dos.
           */
          id: "semi-refuerzo",
          name: "Semipermanente con refuerzo o nivelación",
          price: 30,
          from: true,
          durationMin: 95,
          description:
            "Para uñas finas o que se quiebran. El precio final depende de si lleva refuerzo o nivelación completa.",
          featured: true,
        },
        {
          id: "acrilico-primera",
          name: "Acrílico · primera puesta",
          price: 35,
          from: true,
          durationMin: 150,
          description: "Esculpido completo desde cero. El precio sube según largo y diseño.",
        },
        {
          id: "acrilico-relleno",
          name: "Relleno de acrílico",
          price: 30,
          from: true,
          durationMin: 120,
          description: "Mantenimiento cada 3–4 semanas sobre acrílico ya puesto.",
        },
        {
          id: "retirada-propia",
          name: "Retirada de trabajo mío",
          price: 10,
          durationMin: 30,
          description: "Retirada cuidadosa de un trabajo hecho por mí.",
        },
        {
          id: "retirada-otro",
          name: "Retirada de otro centro",
          price: 15,
          durationMin: 45,
          description: "Lleva más tiempo porque no sé con qué producto se puso.",
        },
      ],
    },
    {
      id: "pies",
      name: "Pies",
      subtitle: "Pedicura y pedicura spa.",
      addOns: [
        { id: "pies-francesa", name: "Francesa", price: 5, durationMin: 15 },
        { id: "pies-efectos", name: "Efectos y diseños", price: 3, durationMin: 10 },
        { id: "pies-piedras", name: "Piedras o cristales", price: 1, durationMin: 10 },
      ],
      services: [
        {
          id: "solo-pedicura",
          name: "Solo pedicura",
          price: 20,
          durationMin: 50,
          description: "Limado, cutícula y durezas, sin esmaltado permanente.",
        },
        {
          id: "pedicura-semi-seco",
          name: "Pedicura + semipermanente en seco",
          price: 30,
          durationMin: 75,
          description: "Pedicura sin remojo y color permanente.",
          featured: true,
        },
        {
          id: "pedicura-spa",
          name: "Pedicura spa + semipermanente",
          price: 40,
          durationMin: 105,
          description:
            "Remojo, exfoliación, limpieza profunda, masaje hidratante y color permanente.",
          featured: true,
        },
      ],
    },
  ] as typeof appflu.categories,

  /* ---------------------------------------------------------------------- */
  /*  TEXTOS  —  escritos para un servicio a domicilio                      */
  /* ---------------------------------------------------------------------- */
  content: {
    ...appflu.content,

    steps: [
      {
        title: "Elige tu servicio",
        text: "Mira los precios y el tiempo de cada uno. Puedes añadir extras como francesa, diseños o cambio de forma.",
      },
      {
        title: "Reserva tu hueco",
        text: "Solo verás las horas a las que puedo llegar. La agenda ya cuenta el tiempo del servicio y el del desplazamiento.",
      },
      {
        title: "Voy a tu casa",
        text: "Te llega un email con la cita y un enlace para cancelar o cambiarla. El día antes, un recordatorio. Yo llevo todo el material.",
      },
    ],

    about: {
      title: "Cómo trabajo",
      body: [
        "Voy yo a tu casa con todo el material montado. No tienes que desplazarte, ni buscar aparcamiento, ni esperar: la cita es tuya y del tiempo que necesiten tus uñas.",
        "Producto profesional, instrumental esterilizado entre clientas y nada de MMA. Solo necesito una mesa despejada, una silla y un enchufe cerca.",
      ],
      /* Los cuatro reclamos de su propia cartelera. */
      badges: ["Vamos hasta ti", "Ahorras tiempo", "Experiencia personalizada", "Calidad y resultados"],
    },

    /*
     * Reseñas reales de sus clientas en Booksy. Van como TEXTO y no como las
     * capturas de pantalla que pasó, por tres motivos: las capturas llevaban la
     * barra del móvil y la marca de otra plataforma encima, pesaban 800 KB cada
     * una, y una reseña dentro de una imagen no la lee ni Google ni un lector
     * de pantalla. Escritas así valen para posicionar y se leen en el móvil.
     *
     * Están literales: solo se han corregido tildes y erratas evidentes. No se
     * reescribe lo que dijo una clienta.
     */
    testimonials: [
      {
        name: "Aisha",
        text: "Llevo haciéndome las uñas con Indira 4 veces, me he hecho dos rellenos de acrílico y una semipermanente, y estoy encantadísima, no tengo ni una queja. Es súper perfeccionista y hace su trabajo muy bien, además de lo bien que te trata. Un 10 sin duda.",
        service: "Retirada y semipermanente con refuerzo",
      },
      {
        name: "Elena",
        text: "El mejor sitio con diferencia de todos los que he probado, en todos los sentidos. De hecho, las únicas que me duran.",
        service: "Relleno de acrílico",
      },
      /*
       * Falta a propósito la de Patty. Es real y es de cinco estrellas, pero
       * dice "tiene su centro súper higienizado y bien ambientado", y en una
       * web que promete ir a casa de la clienta eso confunde. Vuelve a entrar
       * el día que haya local.
       */
      {
        name: "María",
        text: "La mejor sin duda, un trato increíble y una profesional. Es la primera vez que me las hago y no voy a dudar en seguir viniendo.",
        service: "Uñas acrílicas",
      },
      {
        name: "Estefanía",
        text: "Trato maravilloso. Eres un encanto Indira, como persona y como profesional. 100 % recomendado.",
        service: "Retirada y uñas acrílicas",
      },
      {
        name: "Elizabeth",
        text: "Brutal, es maravillosa, trabaja genial. He ido varias veces con ella y no la cambio. Gracias siempre.",
        service: "Uñas acrílicas",
      },
      {
        name: "Guacimara",
        text: "He salido encantada con mis uñas. Excelente el trato y el trabajo realizado. ¡Mil gracias! Lo recomiendo.",
        service: "Uñas acrílicas",
      },
      {
        name: "Esther",
        text: "Muy profesional, se nota que sabe lo que hace y lleva el arte en las manos. Recomiendo 200 %.",
        service: "Semipermanente con refuerzo",
      },
      {
        name: "Leticia",
        text: "Mi primera vez y me encantó. Trato muy familiar y la chica muy perfeccionista, súper contenta. Volveré seguro.",
        service: "Esmaltado semipermanente",
      },
      {
        name: "Cynthia",
        text: "Trato cálido y cercano, la chica se portó increíble y las uñas quedaron preciosas.",
        service: "Uñas acrílicas",
      },
      {
        name: "Celine",
        text: "Indira is so nice and careful. I enjoyed getting my nails done from her.",
        service: "Uñas acrílicas",
      },
    ] as { name: string; text: string; service: string }[],

    faq: [
      {
        q: "¿Vas de verdad a mi casa?",
        a: "Sí. Llevo la lámpara y todo el material. Tú solo necesitas una mesa despejada, una silla cómoda y un enchufe cerca.",
      },
      {
        q: "¿Cuánto dura la cita?",
        a: "Depende del servicio: un semipermanente son unos 75 minutos y un acrílico de primera puesta puede irse a dos horas y media. El tiempo aparece indicado en cada servicio al reservar.",
      },
      {
        q: "¿Hasta dónde te desplazas?",
        a: "Escríbeme antes de reservar si vives algo apartada y lo miramos. Entre cita y cita reservo tiempo de desplazamiento, así que cuanto antes sepa la dirección, mejor cuadro la ruta.",
      },
      {
        q: "¿Tengo que pagar algo al reservar?",
        a: "Se pide una señal para asegurar el hueco, que se descuenta del precio final. El resto se paga en el momento, en efectivo o Bizum.",
      },
      {
        q: "¿Puedo cancelar?",
        a: "Sí, desde el enlace del email de confirmación, hasta 24 horas antes. Cancelando con esa antelación la señal se devuelve entera. Con menos, ten en cuenta que el viaje ya está organizado.",
      },
      {
        q: "¿Los precios que ponen «desde» por qué varían?",
        a: "Porque un acrílico puede ser un largo corto y liso o diez uñas con diseño y piedras. Si me mandas la referencia antes de la cita, te confirmo el precio exacto.",
      },
      {
        q: "¿Retiras trabajos de otro sitio?",
        a: "Sí. Reserva la retirada junto con lo que quieras hacerte después; el sistema suma el tiempo de las dos cosas.",
      },
    ],

    policies: [
      "Necesito una mesa despejada, una silla y un enchufe cerca. Con eso me apaño.",
      "Ven con las uñas limpias, sin esmalte normal por encima si puedes.",
      "Avísame si hay mascotas sueltas o poco sitio, para saber con qué me encuentro.",
      "No trabajo sobre uñas con hongos u onicomicosis sin informe médico.",
      "Las reparaciones de una uña rota en los primeros 7 días son gratuitas.",
    ],
  },
};
