import type { Metadata } from "next";
import "./globals.css";
import { GlobalProviders } from "@/components/GlobalProviders";

export const metadata: Metadata = {
  title: "MediRoute India — Medical Tourism Platform",
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
    <html lang="en">
      <body className="font-sans antialiased">
        <GlobalProviders>{children}</GlobalProviders>
      </body>
    </html>
  );
}
