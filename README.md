# Web de reservas para estudios de uñas

Web completa + sistema de reservas para profesionales de uñas que trabajan solas
(estudio en casa, alquiler de sillón, autónoma a domicilio).

Está pensada para **revenderse**: todo el negocio —nombre, colores, logotipo,
textos, servicios, precios, duraciones, horarios y políticas— sale de un archivo
por profesional en [`config/clients/`](config/clients). Un mismo código sirve a
todas; cada una se despliega por separado y con su propia base de datos.

## Qué incluye

**Para la clienta**

- Web con carta de servicios, precios, duraciones, galería, opiniones y dudas.
- Reserva en 4 pasos: servicio → día y hora → datos → confirmar.
- Solo se ofrecen las horas en las que **cabe entero** el servicio elegido:
  la agenda cuenta la duración real, los extras y los minutos de limpieza.
- Email de confirmación al instante, con la dirección y un enlace privado para
  ver o cancelar la cita.
- Recordatorio automático el día antes.
- Pago opcional de una señal al reservar.

**Para la profesional**

- Aviso por email de cada reserva nueva, con teléfono y notas de la clienta.
- Panel en `/admin`: próximas citas, histórico, cambio de estado, bloqueo de
  horas (médico, recados, descanso) y bandeja con todos los emails enviados.
- **Su horario, editable desde el panel** (pestaña «Mi horario»), sin tocar
  código ni volver a desplegar. Mientras no lo toque, rige el del archivo.
- Ingresos previstos y señales ya cobradas de un vistazo.

### Para quien trabaja a domicilio

Con `venue.needsClientAddress` en true, la dirección deja de ser un dato
opcional y pasa a ser obligatoria: sin ella la cita no se puede atender. Sale
en el email de aviso, en el recordatorio y destacada en el panel. Y el
vocabulario de toda la web cambia con `venue`, que es lo que hace que no le
diga a su clienta que se pase «por el estudio».

Ojo con `booking.bufferMinutes`: ahí ya no son minutos de limpieza, son minutos
de **desplazamiento**. Es el número que decide si la agenda le da citas a las
que puede llegar.

### Cobrar plantones (opcional)

Con `noShow.enabled`, la pantalla que cobra la señal guarda además la tarjeta,
y desde `/admin` se puede cobrar a quien no aparece. Requiere Stripe.

**El número de tarjeta no pasa nunca por este servidor**: lo pide y lo guarda
Stripe, y aquí solo queda un identificador que sirve para cobrar en esa cuenta
de Stripe y en ninguna otra.

No se cobra sin que conste que la clienta aceptó la política al reservar: la
fecha se guarda en `policy_accepted_at` y sin ella el sistema se niega.

Conviene saber que **no es un cobro garantizado**: en Europa el banco puede
exigir que la clienta autentique el pago, y sin ella delante eso no se puede
hacer. El panel lo dice con todas las letras en vez de fallar en silencio.
`noShow.hoursBefore` tiene que coincidir con `booking.cancellationHours`, o la
web promete cancelación gratis en horas en las que ya cobra.

## Arrancar

```bash
npm install && npm run dev
```

Abre http://localhost:3000. No hace falta configurar nada: arranca en **modo
prototipo** y se puede enseñar y probar el flujo completo tal cual.

Contraseña del panel `/admin`: **demo1234** (hasta que configures `ADMIN_PASSWORD`).

### Modo prototipo

Sin claves de terceros, dos cosas funcionan «en seco» para poder probar todo:

| | Modo prototipo | Con la configuración puesta |
|---|---|---|
| **Base de datos** | Archivo `data/studio.db` | Turso (SQLite en la nube) |
| **Emails** | No salen a internet. Se guardan en la base de datos y en `data/outbox/*.html`, y se leen enteros en `/admin` → pestaña **Emails** | Se envían de verdad por SMTP o Resend |
| **Cobro** | Pantalla de pago simulado. **No pide ni procesa ningún dato de tarjeta**: solo dos botones para simular cobro correcto o rechazado | Stripe Checkout real |

Cada modo se activa solo según las variables de entorno. Cuando pongas
`STRIPE_SECRET_KEY`, la pantalla de pago simulado se desactiva por completo.

## Varias profesionales, un mismo código

Cada profesional tiene su archivo en `config/clients/`. La web muestra una u
otra según la variable `NEXT_PUBLIC_CLIENT_ID`:

```
config/
  site.config.ts        elige cuál se muestra
  clients/
    appflu.ts           la web general del producto (por defecto)
    isis.ts             Isis Nails · Las Palmas
    luamiz.ts           Luamiz · Indira, a domicilio en Las Palmas
```

Cada una se despliega como **su propio proyecto de Vercel, con su propia base
de datos y su propio dominio**. Nunca comparten datos: eso es lo que hace
imposible que las clientas de una acaben viéndose en la agenda de otra.

```bash
npm run dev        # Appflu, en el puerto 3000
npm run dev:isis   # Isis, en el puerto 3001
npm run dev:luamiz # Luamiz, en el puerto 3002
```

### Dar de alta a una nueva

1. Copia `config/clients/appflu.ts` y cámbiale lo suyo.
2. Regístrala en la lista `clients` de `config/site.config.ts`.
3. Crea su proyecto en Vercel desde este mismo repositorio, con
   `NEXT_PUBLIC_CLIENT_ID=<su id>` y su propia base de datos de Turso.

Si el identificador está mal escrito, **el despliegue falla a propósito**: es
preferible a que la web de una profesional acabe mostrando la marca de otra sin
que nadie se dé cuenta.

### Qué lleva el archivo de cada una

| Sección | Qué controla |
|---|---|
| `business` | Nombre, lema, logotipo, zona, teléfono, WhatsApp, Instagram, TikTok. Los de contacto vacíos se ocultan solos |
| `theme` | 8 colores. Cambiándolos cambia la web y los emails |
| `gallery` | Fotos de trabajos. Con tres, la galería les da una fila entera |
| `booking` · `deposit` · `hours` | Reglas de la agenda, señal y horario |
| `categories` | Servicios: nombre, precio, duración, extras |
| `content` | Textos: sobre el estudio, dudas frecuentes, avisos previos |

Un archivo de cliente puede partir de otro y cambiar solo lo suyo, como hace
`isis.ts`: así hereda las mejoras del producto sin tener que tocarlas dos veces.

La duración de cada servicio es lo que hace que la agenda cuadre: si un
babyboomer se tarda 3 h, hay que poner `durationMin: 180` y el sistema dejará de
ofrecer huecos donde no quepa.

## Publicarla en internet (Vercel + Turso, gratis)

Los dos servicios tienen plan gratuito suficiente para un negocio de una persona.

**1. Base de datos en Turso** — porque en Vercel el disco es efímero y un archivo
SQLite se perdería en cada despliegue.

```bash
# instalar la CLI de Turso y entrar
curl -sSfL https://tur.so/install.sh | bash
turso auth login

turso db create estudio-unas
turso db show estudio-unas --url          # -> TURSO_DATABASE_URL
turso db tokens create estudio-unas       # -> TURSO_AUTH_TOKEN
```

Las tablas se crean solas la primera vez que arranca la web.

**2. Desplegar en Vercel**

```bash
npx vercel        # la primera vez, para vincular el proyecto
npx vercel --prod
```

**3. Variables de entorno en Vercel** (panel del proyecto → Settings →
Environment Variables):

| Variable | Para qué |
|---|---|
| `TURSO_DATABASE_URL` · `TURSO_AUTH_TOKEN` | Base de datos |
| `ADMIN_PASSWORD` | Contraseña del panel `/admin` |
| `NEXT_PUBLIC_SITE_URL` | La URL final, para los enlaces de los emails |
| `CRON_SECRET` | Protege el endpoint de recordatorios |
| `SMTP_*` o `RESEND_API_KEY` | Enviar emails de verdad (ver abajo) |
| `STRIPE_SECRET_KEY` | Cobrar la señal (opcional) |

### Que los emails lleguen de verdad

**Opción rápida: SMTP con Gmail.** No necesita dominio propio.

1. Activa la verificación en dos pasos en tu cuenta de Google.
2. Crea una **contraseña de aplicación** en
   [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords).
3. Pon estas variables (la contraseña, solo en el entorno; nunca en el repo):

   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=tucuenta@gmail.com
   SMTP_PASSWORD=la-contraseña-de-aplicación
   MAIL_FROM=Estudio Aura <tucuenta@gmail.com>
   ```

   Con Gmail el remitente tiene que ser tu propia dirección: si pones otra, Google
   la reescribe. Gmail limita a unos 500 envíos al día, de sobra para empezar.

**Opción a largo plazo: Resend con dominio propio.** Mejor entregabilidad y un
remitente tipo `citas@tudominio.com`. Requiere comprar un dominio y verificar
unos registros DNS. Pon `RESEND_API_KEY` y `MAIL_FROM`.

Si hay las dos configuradas, gana SMTP. El modo activo se ve en `/admin`.

### Cobro de la señal

Pon `STRIPE_SECRET_KEY`. Con `sk_test_...` se cobra con tarjetas de prueba; con
`sk_live_...` se cobra de verdad. Para que la reserva se confirme aunque la clienta
cierre el navegador tras pagar, añade también `STRIPE_WEBHOOK_SECRET` con un
webhook apuntando a `/api/webhooks/stripe`.

### Recordatorios automáticos

El endpoint `/api/cron/reminders` envía los recordatorios de las citas del día
siguiente. Es idempotente: llamarlo varias veces no manda emails repetidos.

- **En Vercel**: ya está configurado en [`vercel.json`](vercel.json) (08:00 UTC =
  10:00 en Madrid). Vercel lo autentica con `CRON_SECRET`.
- **En un servidor propio**: `npm run reminders` desde el crontab.
  ```bash
  0 10 * * * cd /ruta/al/proyecto && npm run reminders
  ```
- **A mano**: botón «Enviar recordatorios de mañana» en `/admin`.

### Base de datos

[`src/lib/db.ts`](src/lib/db.ts) es el único archivo que habla con la base de datos,
y funciona con dos motores usando el mismo SQL (Turso *es* SQLite):

- **Sin configurar**: archivo `data/studio.db` con el módulo `node:sqlite` que ya
  viene en Node. Cero dependencias que compilar. Vale para desarrollo y para un
  VPS con disco propio.
- **Con `TURSO_DATABASE_URL`**: Turso por HTTP, sin dependencias nativas. Es lo que
  permite desplegar en Vercel y similares.

## Cómo está organizado

```
config/site.config.ts        Todo el negocio: la única cosa que hay que editar
src/lib/
  catalog.ts                 Servicios, extras y cálculo de precio y duración
  availability.ts            Motor de huecos libres
  bookings.ts                Crear, pagar, cancelar, recordar
  db.ts                      SQLite (el único archivo que habla con la BBDD)
  time.ts                    Fechas y horas en la zona del estudio
  payments.ts                Stripe o pago simulado
  mail/templates.ts          Los 5 emails en HTML
  mail/send.ts               Resend o bandeja simulada
src/app/
  page.tsx                   Portada
  reservar/                  Wizard de reserva
  reserva/[code]/            Ficha privada de la cita (ver y cancelar)
  pago/[code]/               Pago de la señal
  admin/                     Panel de la profesional
  api/                       Disponibilidad, reservas, pagos, cron, admin
```

## Decisiones que conviene conocer

- **Precios y duraciones se recalculan siempre en el servidor.** Lo que llega del
  navegador solo dice *qué* se ha elegido, nunca cuánto vale.
- **El hueco se vuelve a validar al guardar.** Si dos personas eligen la misma
  hora a la vez, la segunda recibe un aviso claro y vuelve al selector de horas.
- **Las horas se guardan como texto en la hora local del estudio.** Lo que la
  profesional ve en su agenda es exactamente lo guardado, sin sorpresas con UTC
  ni con el cambio de hora.
- **La cita bloquea su duración más los minutos de limpieza**, así que nunca se
  solapan dos clientas.
- **El enlace de la clienta lleva un token secreto.** Sin él no se puede ver ni
  cancelar una cita.
- **Los pagos de Stripe se verifican contra Stripe**, nunca por lo que diga la URL
  de vuelta.

## Comandos

```bash
npm run dev          # desarrollo
npm run build        # compilar para producción
npm start            # servir lo compilado
npm run typecheck    # comprobar tipos
npm run reminders    # lanzar los recordatorios del día siguiente
```
