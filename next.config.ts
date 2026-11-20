import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ces paquets utilisent des binaires / workers natifs : on les garde hors du bundle.
  serverExternalPackages: ["sharp", "tesseract.js", "unpdf"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
