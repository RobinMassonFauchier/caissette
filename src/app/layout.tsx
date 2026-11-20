import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Caissette — vos tickets de caisse, enfin rangés",
  description:
    "Envoyez un ticket de caisse en photo ou en PDF : Caissette le lit, le classe et tient votre budget à jour dans un Google Sheet.",
  applicationName: "Caissette",
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-stone-50 font-sans text-stone-900 antialiased">
        {children}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{ style: { borderRadius: "14px" } }}
        />
      </body>
    </html>
  );
}
