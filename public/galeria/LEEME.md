# Fotos de la galería

Deja aquí las fotos de trabajos reales y añádelas después a la lista `gallery`
de [`config/site.config.ts`](../../config/site.config.ts):

```ts
gallery: [
  { src: "/galeria/margaritas.jpg", alt: "Semipermanente nude con margaritas y abejas" },
  { src: "/galeria/verano.jpg",     alt: "Diseño de verano con estrellas y rayas de colores" },
],
```

Mientras la lista esté vacía, la web dibuja unas uñas de ejemplo en SVG, así que
la sección nunca se ve rota.

## Recomendaciones

- **Formato**: `.jpg` o `.webp`. El `.heic` del iPhone no lo entienden los
  navegadores; conviértelo antes.
- **Proporción**: vertical, tipo 4:5. La web recorta a esa forma.
- **Tamaño**: 1200 px de ancho es más que suficiente. Fotos de 5 MB solo hacen
  que la web tarde en cargar en el móvil.
- **Texto alternativo**: describe el diseño en `alt`. Lo leen los buscadores y
  quien navegue con lector de pantalla.

## Antes de publicarlas

Comprueba que las fotos son tuyas o que tienes permiso para usarlas, y fíjate en
si llevan la marca de agua de otra cuenta.
