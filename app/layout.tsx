import type { Metadata, Viewport } from "next";
import { DM_Sans, Fredoka } from "next/font/google";
import "./globals.css";

const interfaceFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-interface",
});

const display = Fredoka({
  subsets: ["latin"],
  variable: "--font-display",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fff9f0",
};

export const metadata: Metadata = {
  title: "Hummly - Hum a melody, get a demo",
  description: "Record your humming and get a complete demo song with chords and drums",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${interfaceFont.variable} ${display.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-interface)]">
        {children}
      </body>
    </html>
  );
}
