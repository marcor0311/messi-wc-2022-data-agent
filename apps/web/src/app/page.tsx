import type { Metadata, Viewport } from "next";
import MuseumHome from "@/components/museum-home";
import "./museo-propuesta/photography.css";

export const metadata: Metadata = {
  title: "La memoria albiceleste — Un museo de Leo Messi",
  description: "Las caídas. Los regresos. La tercera estrella. Un museo virtual de la historia de Leo Messi con Argentina, contado en fotografías y partidos inolvidables.",
};
export const viewport: Viewport = { themeColor: "#0b203b", viewportFit: "cover" };

export default function Home() {
  return <div className="museum-photo-proposal"><MuseumHome /></div>;
}
