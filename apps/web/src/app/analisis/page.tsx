import type { Metadata, Viewport } from "next";
import AnalysisWorkspace from "@/components/analysis-workspace";

export const metadata: Metadata = {
  title: "El juego en contexto · Messi / Mundial 2022",
  description: "Explora los tiros de la final de Qatar 2022, ajusta filtros y compara a Messi con Mbappé.",
};

export const viewport: Viewport = { themeColor: "#f5f5f0" };

export default function AnalysisPage() { return <AnalysisWorkspace />; }
