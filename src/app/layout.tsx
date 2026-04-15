import type { Metadata } from "next";
import { ConvexClientProvider } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "IMO — Listing Tracker",
  description: "Track and manage real estate listings",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
