import { chapters } from "./museum-data";
import MuseumChapter from "./museum-chapter";

export default function MuseumGallery() {
  return <div className="horizontal-story" aria-label="Galería de la memoria albiceleste">
    <div className="museum-coverflow" role="group" aria-roledescription="galería" tabIndex={0} aria-label="Recorrido fotográfico de Messi" aria-keyshortcuts="ArrowLeft ArrowRight Home End" />
    <div className="museum-world">
      {chapters.map(chapter => <MuseumChapter key={chapter.id} chapter={chapter} />)}
    </div>
  </div>;
}
