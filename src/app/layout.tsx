import type { Metadata, Viewport } from "next";
import { Hind_Vadodara, Noto_Serif_Gujarati } from "next/font/google";
import "./globals.css";

const serif = Noto_Serif_Gujarati({
  subsets: ["gujarati", "latin"],
  weight: ["500", "600"],
  variable: "--font-serif",
});

const sans = Hind_Vadodara({
  subsets: ["gujarati", "latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "સૉરી 🤍",
  description: "એક મિનિટ આપીશ?",
  openGraph: { title: "સૉરી 🤍", description: "એક મિનિટ આપીશ?" },
};

export const viewport: Viewport = {
  themeColor: "#05040a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="gu" className={`${serif.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
