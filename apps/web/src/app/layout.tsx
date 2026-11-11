import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Messi · Mundial 2022",
  description: "Explora los tiros de la final con datos de StatsBomb y una conversación que conserva el contexto.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
