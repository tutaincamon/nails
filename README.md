# Web de reservas para estudios de uñas

Web completa + sistema de reservas para profesionales de uñas que trabajan solas
(estudio en casa, alquiler de sillón, autónoma a domicilio).

Está pensada para **revenderse**: todo el negocio —nombre, colores, textos,
servicios, precios, duraciones, horarios y políticas— sale de un único archivo,
[`config/site.config.ts`](config/site.config.ts). Para una clienta nueva se copia
el proyecto, se edita ese archivo y ya está.

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
- Ingresos previstos y señales ya cobradas de un vistazo.

## Arrancar

```bash
npm install && npm run dev
```

Abre http://localhost:3000. No hace falta configurar nada: arranca en **modo
prototipo** y se puede enseñar y probar el flujo completo tal cual.

Contraseña del panel `/admin`: **demo1234** (hasta que configures `ADMIN_PASSWORD`).

### Modo prototipo

Sin claves de terceros, dos cosas funcionan «en seco» para poder probar todo:

| | Modo prototipo | Con la clave puesta |
|---|---|---|
| **Emails** | No salen a internet. Se guardan en la base de datos y en `data/outbox/*.html`, y se leen enteros en `/admin` → pestaña **Emails** | Se envían de verdad con Resend |
| **Cobro** | Pantalla de pago simulado. **No pide ni procesa ningún dato de tarjeta**: solo dos botones para simular cobro correcto o rechazado | Stripe Checkout real |

Los dos modos se activan solos según las variables de entorno. Cuando pongas
`STRIPE_SECRET_KEY`, la pantalla de pago simulado se desactiva por completo.

## Personalizar para otra profesional

Todo está en [`config/site.config.ts`](config/site.config.ts), comentado en
castellano:

| Sección | Qué controla |
|---|---|
| `business` | Nombre, lema, teléfono, WhatsApp, Instagram, zona, email de avisos, zona horaria |
| `theme` | 8 colores. Cambiándolos cambia el estilo de la web y de los emails |
| `booking` | Intervalo de huecos, minutos de limpieza, antelación mínima, días vista, plazo de cancelación |
| `deposit` | Señal: activada o no, importe fijo o porcentaje, si se permite pagar en el estudio |
| `hours` | Horario de cada día de la semana, con descansos |
| `closedDates` | Vacaciones y festivos |
| `categories` | Servicios: nombre, precio, duración, descripción, «desde», y extras por categoría |
| `content` | Textos: pasos, sobre mí, opiniones, dudas frecuentes, avisos previos a la cita |

Las **fotos** son ilustraciones SVG generadas por código
([`src/components/NailArt.tsx`](src/components/NailArt.tsx)), así que la web se ve
terminada sin subir ninguna imagen. Cuando la profesional tenga sus fotos, se
sustituye `<NailSwatch>` por `<Image>` en la galería de
[`src/app/page.tsx`](src/app/page.tsx).

La duración de cada servicio es lo que hace que la agenda cuadre: si un
babyboomer se tarda 3 h, hay que poner `durationMin: 180` y el sistema dejará de
ofrecer huecos donde no quepa.

## Poner la web en producción

1. Copia `.env.example` a `.env.local` y rellena lo que quieras activar.
2. **Contraseña del panel**: pon `ADMIN_PASSWORD`. Es lo primero.
3. **Emails de verdad**: crea una cuenta en [Resend](https://resend.com), verifica
   el dominio y pon `RESEND_API_KEY` y `MAIL_FROM`.
4. **Cobro de la señal**: pon `STRIPE_SECRET_KEY`. Con `sk_test_...` se cobra con
   tarjetas de prueba; con `sk_live_...` se cobra de verdad. Para que la reserva se
   confirme aunque la clienta cierre el navegador tras pagar, añade también
   `STRIPE_WEBHOOK_SECRET` apuntando a `/api/webhooks/stripe`.
5. **URL pública**: `NEXT_PUBLIC_SITE_URL`, para que los enlaces de los emails
   funcionen.

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

SQLite en `data/studio.db`, con el módulo `node:sqlite` que ya viene en Node
(sin dependencias que compilar). Suficiente para un negocio de una persona en un
servidor propio o un VPS.

> **Aviso para Vercel y similares**: el disco es efímero, así que las reservas se
> perderían en cada despliegue. Para desplegar ahí hay que cambiar
> [`src/lib/db.ts`](src/lib/db.ts) por Postgres, Turso o similar. Es el único
> archivo que toca la base de datos: el resto de la app solo usa sus funciones.

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
