import localFont from "next/font/local";
import MuseumExperience from "./museum-experience";
import MuseumGallery from "./museum-gallery";
import { MuseumHeader, MuseumHero, MuseumReturn } from "./museum-chrome";
import "../app/museum.css";

const display = localFont({ src: "../app/fonts/BarlowCondensed-Bold.ttf", variable: "--museum-display", weight: "700", style: "normal", display: "swap" });
const sans = localFont({ src: "../app/fonts/Manrope.woff2", variable: "--museum-sans", weight: "300 700", style: "normal", display: "swap" });


export default function MuseumHome() {
  return <div className={`${display.variable} ${sans.variable}`}>
    <MuseumExperience>
      <MuseumHeader />
      <main id="memoria">
        <MuseumHero />
        <MuseumGallery />
        <MuseumReturn />
      </main>
    </MuseumExperience>
  </div>;
}
