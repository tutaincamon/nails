import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node:sqlite y stripe/resend se cargan solo en el servidor.
  serverExternalPackages: ["stripe", "resend"],
  experimental: {
    // El wizard de reserva escribe en la BBDD desde route handlers (runtime node).
  },
};

export default nextConfig;
