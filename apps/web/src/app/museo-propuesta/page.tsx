import type { Metadata } from "next";
import Home from "../page";
import "./photography.css";

export const metadata: Metadata = {
  title: "Estudio fotográfico — La memoria albiceleste",
  robots: { index: false, follow: false },
};

/** A reviewable photo treatment, isolated from the approved main page. */
export default function PhotographyProposal() {
  return <div className="museum-photo-proposal"><Home /></div>;
}
