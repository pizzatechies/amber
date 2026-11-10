import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/toast";
import { site } from "@/lib/site";
import "./globals.css";

const figtree = localFont({
  src: "../fonts/figtree-latin-wght-normal.woff2",
  variable: "--font-figtree",
  weight: "300 900",
  display: "swap",
});
const figtreeExt = localFont({
  src: "../fonts/figtree-latin-ext-wght-normal.woff2",
  variable: "--font-figtree-ext",
  weight: "300 900",
  display: "swap",
  preload: false,
});
const fraunces = localFont({
  src: "../fonts/fraunces-latin-opsz-normal.woff2",
  variable: "--font-fraunces",
  weight: "100 900",
  display: "swap",
});
const frauncesExt = localFont({
  src: "../fonts/fraunces-latin-ext-opsz-normal.woff2",
  variable: "--font-fraunces-ext",
  weight: "100 900",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: `${site.name} — ${site.tagline}`, template: `%s · ${site.name}` },
  description: site.description,
  applicationName: site.name,
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#15120f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${figtree.variable} ${figtreeExt.variable} ${fraunces.variable} ${frauncesExt.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
