# Dar de alta a una profesional

Lo que hay que pedirle y en qué orden. Sin la lista de servicios con duraciones
no se puede montar nada: es lo que hace que la agenda cuadre.

## 1. Lo imprescindible

Sin esto la web no funciona.

**Servicios.** De cada uno: nombre, precio y **cuánto tarda**. La duración es lo
que impide que la agenda dé citas imposibles. Si un servicio tarda 3 h, el
sistema deja de ofrecer huecos donde no quepan esas 3 h.

Si el precio depende del diseño, se marca como «desde» y la web lo indica.

**Extras.** Cosas que suman precio y tiempo a un servicio: tamaño XL, refuerzo,
uñas mordidas. De cada uno: cuánto cobra de más y cuántos minutos añade.

**Horario semanal.** Día por día, con los descansos. Por ejemplo: lunes a jueves
de 10 a 14 y de 16 a 20:30, viernes de 10 a 15, sábado de 10 a 14, domingo
cerrado.

**Email para los avisos.** Donde quiere recibir el correo de cada reserva nueva.

## 2. Su marca

- Nombre del negocio, tal y como quiere que se lea.
- Logotipo. **En PNG con fondo transparente** si lo tiene; en JPG con fondo
  blanco también sirve, pero se ve peor.
- Zona o ciudad. Y si quiere publicar la dirección exacta o mandarla solo al
  confirmar la cita, que es lo normal cuando trabaja en casa.
- Instagram y TikTok, si quiere que aparezcan.
- Teléfono o WhatsApp, si quiere que aparezcan. Puede no poner ninguno.
- **Fotos de sus trabajos.** Entre 3 y 8, verticales, sin marca de agua de otra
  cuenta. Son lo que más vende de toda la web.

## 3. Sus reglas

Si no las tiene claras, se dejan las de la plantilla y se ajustan luego.

- ¿Cobra señal al reservar? ¿Cuánto? ¿Se devuelve si cancelan a tiempo?
- ¿Con cuánta antelación mínima acepta una reserva?
- ¿Hasta cuándo puede cancelar una clienta sin coste?
- ¿Cuántos minutos necesita entre clienta y clienta?
- Vacaciones y días cerrados que ya sepa.
- Avisos para antes de la cita: venir sin acompañantes, sin esmalte, etc.

## 4. Dominio

- ¿Tiene dominio propio o usa un subdominio del nuestro?
- Si tiene uno, hace falta entrar a su panel de DNS. Es más fácil que nos pase
  el acceso a que se lo expliquemos.

## 5. Lo que NO hay que pedirle

- Contraseñas de sus redes sociales.
- Su contraseña de Gmail. Si quiere que los correos salgan desde su cuenta,
  necesita generar una **contraseña de aplicación**, que es distinta y solo
  sirve para eso.
- Datos de sus clientas. Esos entran solos cuando reserven.

## Después: qué se monta

1. Archivo suyo en `config/clients/`, partiendo de otro.
2. Proyecto propio en Vercel, con `NEXT_PUBLIC_CLIENT_ID` apuntando a ella.
3. Base de datos propia en Turso. **Nunca compartida**: es lo que impide que las
   clientas de una acaben viéndose en la agenda de otra.
4. Su dominio o subdominio.
5. Variables: `ADMIN_PASSWORD`, `OWNER_EMAIL`, `SMTP_*`, `CRON_SECRET`.
6. Quitar `preview.enabled` cuando los precios ya sean los suyos de verdad.
