import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scuola — orario, compiti e materiali",
  description:
    "Agenda scolastica personale: orario settimanale, calendario, compiti per la prossima lezione, materiali per materia e progetti.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
