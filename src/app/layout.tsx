import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Caissette — vos tickets de caisse, enfin rangés",
  description:
    "Envoyez un ticket de caisse en photo ou en PDF : Caissette le lit, le classe et tient votre budget à jour dans un Google Sheet.",
  applicationName: "Caissette",
  robots: { index: false, follow: false },
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: {
    capable: true,
    title: "Caissette",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-stone-50 font-sans text-stone-900 antialiased">
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-emerald-700 focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-white focus:shadow-lg"
        >
          Aller au contenu principal
        </a>
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{ style: { borderRadius: "14px" } }}
        />
      </body>
    </html>
  );
}
