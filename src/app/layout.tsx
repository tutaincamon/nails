import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import siteConfig from "@config";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import "./globals.css";

/*
 * Archivo es una grotesca con eje de anchura variable. En su versión ancha y
 * pesada da el carácter de titular rotundo que buscábamos, y al descargarla
 * next/font la sirve desde nuestro propio dominio: ni una petición a Google
 * desde el navegador de la clienta.
 */
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  display: "swap",
  variable: "--font-archivo",
});

const { business, theme } = siteConfig;

export const metadata: Metadata = {
  title: {
    default: `${business.name} · ${business.tagline}`,
    template: `%s · ${business.name}`,
  },
  description: business.intro,
  openGraph: {
    title: `${business.name} · ${business.tagline}`,
    description: business.intro,
    locale: business.locale,
    type: "website",
  },
  robots: { index: true, follow: true },
};

/** Variables CSS del tema, generadas desde la configuración del negocio. */
const themeVars = `:root{
  --c-primary:${theme.primary};
  --c-primary-dark:${theme.primaryDark};
  --c-bg:${theme.bg};
  --c-surface:${theme.surface};
  --c-ink:${theme.ink};
  --c-muted:${theme.muted};
  --c-border:${theme.border};
  --c-accent:${theme.accent};
}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang={business.locale.split("-")[0]} className={archivo.variable}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: themeVars }} />
        <meta name="theme-color" content={theme.bg} />
      </head>
      <body>
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:text-white"
        >
          Saltar al contenido
        </a>
        <Nav />
        <main id="contenido">{children}</main>
        <Footer />
        {/*
          Analítica de Vercel: cuenta visitas sin cookies y sin identificar a
          nadie, así que no hace falta banner de consentimiento. Dice cuánta
          gente entra y a qué páginas, nunca quién.
        */}
        <Analytics />
      </body>
    </html>
  );
}
