import MuseumPhoto from "./museum-photo";
import qatar from "../../public/memoria/seleccion/mundial-2022.jpg";

export function MuseumArrow({ down = false }: { down?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    {down ? <path d="M12 4v16m-6-6 6 6 6-6" /> : <path d="M4 12h16m-6-6 6 6-6 6" />}
  </svg>;
}

function Stars() {
  return <span className="museum-stars" aria-hidden="true">{[0, 1, 2].map(i => <svg key={i} viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.3 6.9.8-5.1 4.8 1.4 6.8L12 17.2l-6.1 3.5 1.4-6.8L2.2 9.1l6.9-.8Z" /></svg>)}</span>;
}

export function MuseumHeader() { return <>
<a className="museum-skip" href="#comienzos">Saltar al recorrido</a>
      <header className="museum-header">
        <a className="museum-brand" href="#portada" aria-label="La memoria albiceleste, inicio"><Stars /><span>LA MEMORIA<br /><strong>ALBICELESTE</strong></span></a>
      </header>
</>; }

export function MuseumHero() { return <section className="museum-hero" id="portada" data-chapter aria-labelledby="museum-title">
          <div className="hero-photo"><MuseumPhoto src={qatar} preload alt="Leo Messi levanta la Copa del Mundo sobre los hombros de un compañero en Lusail" /></div>
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-copy">
            <h1 id="museum-title"><span>El peso de</span><span>la <span className="museum-accent">gloria</span></span></h1>
            <p>No empezó con una copa.<br />Empezó con las ganas de volver.</p>
            <a className="museum-start" href="#comienzos"><span className="arrow-circle"><MuseumArrow down /></span>Recorrer la historia</a>
          </div>
        </section>; }

export function MuseumReturn() { return <footer className="museum-return" id="museum-return">
          <div className="museum-return-content">
            <p>La historia queda. El juego sigue.</p>
            <a className="museum-return-link" href="/analisis">
              <span>Regresar al Mundial 2022</span>
              <MuseumArrow down />
            </a>
          </div>
        </footer>; }
