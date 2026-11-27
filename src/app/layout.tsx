import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { GlobalProviders } from "@/components/GlobalProviders";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "MediRoute India — Medical Travel Operations",
  description:
    "Clinical coordination and care portal for international patients receiving treatment at accredited Indian hospitals.",
  keywords: [
    "medical travel",
    "India",
    "healthcare",
    "hospital",
    "doctor",
    "patient coordination",
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
