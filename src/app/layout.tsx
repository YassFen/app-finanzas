import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import { APP_NAME, THEME_COOKIE } from "@/lib/types";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Registro mes a mes de las finanzas del hogar",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Finanzas", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2a78d6",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Tema elegido en este dispositivo (sin cookie = sigue al sistema)
  const tema = (await cookies()).get(THEME_COOKIE)?.value;
  const dataTheme = tema === "oscuro" ? "dark" : tema === "claro" ? "light" : undefined;
  return (
    <html lang="es-CL" data-theme={dataTheme} className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
