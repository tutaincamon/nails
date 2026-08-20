/**
 * Lee una variable de entorno tratando la cadena vacía como si no existiera.
 *
 * Hace falta porque Vercel, al importar el repositorio, ofrece prerellenadas
 * todas las variables que aparecen en .env.example y las crea aunque se dejen
 * en blanco. Con el operador ?? una variable vacía no es lo mismo que ausente,
 * así que DATA_DIR="" acababa intentando crear una carpeta sin nombre y
 * tumbaba la base de datos con un error que no decía nada.
 */
export function env(name: string): string | undefined {
  const value = process.env[name];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}
