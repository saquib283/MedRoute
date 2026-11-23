import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { GlobalProviders } from "@/components/GlobalProviders";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Afzal Healthcare — Medical Tourism Platform",
  description:
    "Centralised medical tourism operations platform connecting international patients with India's best healthcare providers.",
  keywords: [
    "medical tourism",
    "India",
    "healthcare",
    "hospital",
    "doctor",
    "patient management",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className="font-sans antialiased">
        <GlobalProviders>{children}</GlobalProviders>
      </body>
    </html>
  );
}
