import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = new URL(protocol + "://" + host);
  const socialImage = new URL("/og-engine-lab.png", origin).toString();
  const title = "NEXUS — Play. Think. Evolve.";
  const description =
    "A premium online chess platform for live play, seven ranked bots, configurable Stockfish analysis, and AI coaching.";

  return {
    metadataBase: origin,
    title: {
      default: title,
      template: "%s · NEXUS Chess",
    },
    description,
    applicationName: "NEXUS Chess",
    openGraph: {
      title,
      description,
      type: "website",
      url: origin,
      siteName: "NEXUS Chess",
      images: [
        {
          url: socialImage,
          width: 1659,
          height: 948,
          alt: "NEXUS — Play. Think. Evolve.",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [socialImage],
    },
  };
}

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#090b09",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
