import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import MuseumExperience from "@/components/museum-experience";
import MuseumPhoto from "@/components/museum-photo";
import firstYears from "../../public/memoria/seleccion/debut-2005.jpg";
import worldCup2006 from "../../public/memoria/seleccion/mundial-2006.webp";
import copa2007 from "../../public/memoria/seleccion/copa-2007.jpg";
import olympics2008 from "../../public/memoria/seleccion/olimpicos-2008.webp";
import numberTen2009 from "../../public/memoria/seleccion/camiseta-10-2009.jpg";
import worldCup2010 from "../../public/memoria/seleccion/mundial-2010.webp";
import brazil2012 from "../../public/memoria/seleccion/brasil-2012.jpeg";
import copa2011 from "../../public/memoria/seleccion/copa-2011.webp";
import copa2015 from "../../public/memoria/seleccion/copa-2015.webp";
import rio from "../../public/memoria/seleccion/mundial-2014.jpg";
import centenario from "../../public/memoria/seleccion/copa-2016.jpg";
import russia from "../../public/memoria/seleccion/mundial-2018.jpg";
import america from "../../public/memoria/seleccion/copa-2021.jpg";
import wembley from "../../public/memoria/seleccion/finalissima-2022.jpeg";
import qatar from "../../public/memoria/seleccion/mundial-2022.jpg";
import worldChampions from "../../public/memoria/seleccion/mundial-2022.jpg";
import miami from "../../public/memoria/seleccion/copa-2024.jpg";
import legacy from "../../public/memoria/seleccion/mundial-2026.jpg";
import "./museum.css";

const display = localFont({ src: "./fonts/BarlowCondensed-Bold.ttf", variable: "--museum-display", weight: "700", style: "normal", display: "swap" });
const sans = localFont({ src: "./fonts/Manrope.woff2", variable: "--museum-sans", weight: "300 700", style: "normal", display: "swap" });

export const metadata: Metadata = {
  title: "La memoria albiceleste — Un museo de Leo Messi",
  description: "Las caídas. Los regresos. La tercera estrella. Un museo virtual de la historia de Leo Messi con Argentina, contado en fotografías y partidos inolvidables.",
};
export const viewport: Viewport = { themeColor: "#0b203b", viewportFit: "cover" };

type Match = { opponent: string; goals: readonly [number, number]; competition: string; penalties?: readonly [number, number]; redCard?: { player: string; minute: number }; detail: string };
const chapters = [
  { id: "comienzos", year: "2005", date: "17 de agosto — Budapest", title: "Una camiseta\nToda una vida",
    body: "Debuta ante Hungría y ve la roja casi de inmediato. El sueño apenas empezaba.",
    image: firstYears, alt: "El joven Messi durante su debut con Argentina ante Hungría en 2005", layout: "opening", note: "Todavía no pesaba la gloria. Solo el sueño.",
    match: { opponent: "Hungría", goals: [2, 1], competition: "Amistoso internacional", redCard: { player: "Messi", minute: 64 }, detail: "Debut de Messi — Expulsado a los 64′" } },
  { id: "alemania-2006", year: "2006", date: "16 de junio — Gelsenkirchen", title: "El mundo\nlo descubre",
    body: "Con 18 años, debuta en un Mundial y marca en la goleada 6–0.",
    image: worldCup2006, alt: "Messi celebra su primer gol en un Mundial ante Serbia y Montenegro en 2006", layout: "debut", note: "El primero de muchos escenarios.",
    match: { opponent: "Serbia y Montenegro", goals: [6, 0], competition: "Mundial — fase de grupos", detail: "Messi 88′ — Su primer gol mundialista" } },
  { id: "copa-2007", year: "2007", date: "15 de julio — Maracaibo", title: "La primera\ngran caída",
    body: "Brasil gana 3–0 en la final de la Copa América. La primera final con la mayor termina en tristeza.",
    image: copa2007, alt: "Messi sentado en el césped tras perder la final de la Copa América 2007 ante Brasil", layout: "copa-seven", note: "El sueño también conoce la derrota.",
    match: { opponent: "Brasil", goals: [0, 3], competition: "Final de la Copa América", detail: "La primera final de Messi con la selección mayor" } },
  { id: "beijing-2008", year: "2008", date: "23 de agosto — Pekín", title: "Oro\ncon Argentina",
    body: "Messi y una generación dorada ganan los Juegos Olímpicos.",
    image: olympics2008, alt: "Messi celebra la medalla de oro olímpica con Argentina en Pekín 2008", layout: "olympic", note: "Una medalla para empezar a creer.",
    match: { opponent: "Nigeria", goals: [1, 0], competition: "Final olímpica", detail: "Di María 58′" } },
  { id: "camiseta-10-2009", year: "2009", date: "28 de marzo — Buenos Aires", title: "La 10\nya tiene dueño",
    body: "Maradona le confía la 10. Messi marca en el 4–0 ante Venezuela, rumbo a Sudáfrica.",
    image: numberTen2009, alt: "Messi con la camiseta número 10 de Argentina en 2009", layout: "number-ten", note: "Un número. Toda una historia por escribir.",
    match: { opponent: "Venezuela", goals: [4, 0], competition: "Eliminatorias al Mundial", detail: "Debut de Messi con la 10 — Abre la goleada rumbo a Sudáfrica 2010" } },
  { id: "sudafrica-2010", year: "2010", date: "3 de julio — Ciudad del Cabo", title: "Un sueño\ninterrumpido",
    body: "Alemania gana 4–0. Argentina vuelve a quedarse en cuartos.",
    image: worldCup2010, alt: "Messi durante el Mundial de Sudáfrica 2010", layout: "setback", note: "La espera continúa.",
    match: { opponent: "Alemania", goals: [0, 4], competition: "Cuartos del Mundial", detail: "El final de Sudáfrica" } },
  { id: "copa-2011", year: "2011", date: "16 de julio — Santa Fe", title: "La Copa\nen casa",
    body: "Argentina cae en cuartos ante Uruguay, en los penales. La espera sigue.",
    image: copa2011, alt: "Messi con Argentina durante la Copa América 2011", layout: "copa-eleven", note: "Otra ilusión que se escapa.",
    match: { opponent: "Uruguay", goals: [1, 1], competition: "Cuartos de Copa América", penalties: [4, 5], detail: "120 minutos sin ganador" } },
  { id: "brasil-2012", year: "2012", date: "9 de junio — Nueva Jersey", title: "Una noche\npara recordar",
    body: "Hat-trick de Messi. Argentina vence a Brasil 4–3 en un amistoso inolvidable.",
    image: brazil2012, alt: "Messi celebra su hat-trick ante Brasil en Nueva Jersey en 2012", layout: "brasil", note: "Tres goles. Una noche épica.",
    match: { opponent: "Brasil", goals: [4, 3], competition: "Amistoso internacional", detail: "Messi 31′, 34′, 85′" } },
  { id: "maracana", year: "2014", date: "13 de julio — Maracaná", title: "Tan cerca\nTan lejos",
    body: "A un partido de la copa. Götze marca en el 113. Otra vez, el sueño queda del otro lado.",
    image: rio, alt: "Messi mira la Copa del Mundo durante la entrega de premios de la final de 2014", layout: "heartbreak", note: "A veces, un solo gol pesa una vida.",
    match: { opponent: "Alemania", goals: [0, 1], competition: "Final del Mundial", detail: "Götze 113′ — Tiempo extra" } },
  { id: "copa-2015", year: "2015", date: "4 de julio — Santiago", title: "Otra final\nque se escapa",
    body: "Chile gana por penales. Messi vuelve a quedarse a un paso.",
    image: copa2015, alt: "Messi con Argentina durante la Copa América 2015", layout: "copa-fifteen", note: "La segunda final perdida en un año.",
    match: { opponent: "Chile", goals: [0, 0], competition: "Final de Copa América", penalties: [1, 4], detail: "120 minutos sin goles" } },
  { id: "volver", year: "2016", date: "26 de junio — East Rutherford", title: "Hasta para volver\nhay que ser gigante",
    body: "Falla el penal y anuncia su retiro. Parece el final.",
    image: centenario, alt: "Messi sentado en el césped después de la final de la Copa América 2016", layout: "farewell", note: "Se fue. Le dolió. Y volvió.",
    match: { opponent: "Chile", goals: [0, 0], competition: "Final de la Copa América", penalties: [2, 4], detail: "120 minutos sin goles" } },
  { id: "rusia", year: "2018", date: "30 de junio — Kazán", title: "Todavía\nno era el final",
    body: "Un hat-trick en Quito salva la clasificación. En Rusia, Francia gana 4–3.",
    image: russia, alt: "Messi se lleva la mano al rostro durante el Mundial de Rusia 2018", layout: "editorial", note: "Había que volver a empezar. Juntos.",
    match: { opponent: "Francia", goals: [3, 4], competition: "Octavos del Mundial", detail: "La última caída antes de un nuevo equipo" } },
  { id: "america", year: "2021", date: "10 de julio — Maracaná", title: "El abrazo que\ntardó una vida",
    body: "Di María marca. En el mismo estadio de la derrota, Messi por fin levanta una copa.",
    image: america, alt: "Messi besa la Copa América 2021, rodeado de sus compañeros", layout: "celebration", note: "Esta vez, las lágrimas eran de alegría.",
    match: { opponent: "Brasil", goals: [1, 0], competition: "Final de la Copa América", detail: "Di María 22′ — Se termina la espera" } },
  { id: "wembley", year: "2022 / JUN", date: "1 de junio — Wembley", title: "Ya no era\nsolo un sueño",
    body: "Argentina gana 3–0. A Qatar ya no viaja un hombre solo: viaja un equipo.",
    image: wembley, alt: "Messi levanta el trofeo de la Finalissima 2022 con sus compañeros en Wembley", layout: "wembley", note: "La confianza también se aprende.",
    match: { opponent: "Italia", goals: [3, 0], competition: "Finalissima", detail: "Lautaro 28′ — Di María 45+1′ — Dybala 90+4′" } },
  { id: "qatar", year: "2022 / DIC", date: "18 de diciembre — Lusail", title: "El mundo cabe\nen sus manos",
    body: "3–3. Penales. Montiel convierte y Argentina vuelve a ser campeona del mundo.",
    image: worldChampions, alt: "Messi celebra sobre los hombros de un compañero con la Copa del Mundo en Lusail", layout: "world", note: "Campeones del mundo. Para siempre.",
    match: { opponent: "Francia", goals: [3, 3], competition: "Final del Mundial", penalties: [4, 2], detail: "Messi 23′, 108′ — Di María 36′" } },
  { id: "bicampeones", year: "2024", date: "14 de julio — Miami", title: "La alegría\naprendió a quedarse",
    body: "Messi mira desde afuera. Lautaro marca en el alargue y Argentina retiene la Copa América.",
    image: miami, alt: "Messi, Di María y sus compañeros celebran con la Copa América 2024", layout: "encore", note: "El legado también es lo que sigue sin vos.",
    match: { opponent: "Colombia", goals: [1, 0], competition: "Final de la Copa América", detail: "Lautaro Martínez 112′ — Tiempo extra" } },
  { id: "legado", year: "2026", date: "19 de julio — Nueva Jersey", title: "El pasado\nfrente al futuro",
    body: "Messi y Yamal, el pasado frente al futuro. España gana 1–0; el legado sigue en quienes vienen.",
    image: legacy, alt: "Messi conduce el balón ante un jugador de España en la final del Mundial 2026", layout: "legacy", note: "El final duele. El camino queda.", match: { opponent: "España", goals: [0, 1], competition: "Final del Mundial", detail: "Ferran Torres 104′ — Tiempo extra" } },
] as const;

// Cities are distinct from the stadium or regional names in the chapter dates.
const locations: Record<(typeof chapters)[number]["id"], string> = {
  comienzos: "Budapest, Hungría",
  "alemania-2006": "Gelsenkirchen, Alemania",
  "copa-2007": "Maracaibo, Venezuela",
  "beijing-2008": "Pekín, China",
  "camiseta-10-2009": "Buenos Aires, Argentina",
  "sudafrica-2010": "Ciudad del Cabo, Sudáfrica",
  "copa-2011": "Santa Fe, Argentina",
  "brasil-2012": "East Rutherford, Estados Unidos",
  maracana: "Río de Janeiro, Brasil",
  "copa-2015": "Santiago, Chile",
  volver: "East Rutherford, Estados Unidos",
  rusia: "Kazán, Rusia",
  america: "Río de Janeiro, Brasil",
  wembley: "Londres, Inglaterra",
  qatar: "Lusail, Qatar",
  bicampeones: "Miami Gardens, Estados Unidos",
  legado: "East Rutherford, Estados Unidos",
};

function Arrow({ down = false }: { down?: boolean }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    {down ? <path d="M12 4v16m-6-6 6 6 6-6" /> : <path d="M4 12h16m-6-6 6 6-6 6" />}
  </svg>;
}

function Stars() {
  return <span className="museum-stars" aria-hidden="true">{[0, 1, 2].map(i => <svg key={i} viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.3 6.9.8-5.1 4.8 1.4 6.8L12 17.2l-6.1 3.5 1.4-6.8L2.2 9.1l6.9-.8Z" /></svg>)}</span>;
}

function Score({ match, location }: { match: Match; location: string }) {
  return <div className="match-score" role="group" aria-label={`${match.competition}: Argentina ${match.goals[0]}, ${match.opponent} ${match.goals[1]}${match.penalties ? `. Penales: Argentina ${match.penalties[0]}, ${match.opponent} ${match.penalties[1]}` : ""}`}>
    <p className="score-location">{location}</p>
    <div className="score-board"><span className="score-team">Argentina</span><p className="score-result"><strong>{match.goals[0]}</strong><span className="score-separator" aria-hidden="true">—</span><strong>{match.goals[1]}</strong></p><span className="score-team">{match.opponent}</span></div>
    <div className="score-context">
      <span className="score-competition">{match.competition}</span>
      {match.penalties ? <span className="score-penalties">Penales <strong>{match.penalties[0]} — {match.penalties[1]}</strong></span> : null}
      {match.redCard ? <span className="score-dismissal"><svg viewBox="0 0 12 18" role="img" aria-label="Tarjeta roja"><rect x="1" y="1" width="10" height="16" rx="1" fill="currentColor" /></svg><span>{match.redCard.player} {match.redCard.minute}′</span></span> : null}
    </div>
  </div>;
}

export default function Home() {
  return <div className={`${display.variable} ${sans.variable}`}>
    <MuseumExperience>
      <a className="museum-skip" href="#comienzos">Saltar al recorrido</a>
      <header className="museum-header">
        <a className="museum-brand" href="#portada" aria-label="La memoria albiceleste, inicio"><Stars /><span>LA MEMORIA<br /><strong>ALBICELESTE</strong></span></a>
      </header>
      <main id="memoria">
        <section className="museum-hero" id="portada" data-chapter aria-labelledby="museum-title">
          <div className="hero-photo"><MuseumPhoto src={qatar} preload alt="Leo Messi levanta la Copa del Mundo sobre los hombros de un compañero en Lusail" /></div>
          <div className="hero-shade" aria-hidden="true" />
          <div className="hero-copy">
            <h1 id="museum-title"><span>El peso de</span><span>la <span className="museum-accent">gloria</span></span></h1>
            <p>No empezó con una copa.<br />Empezó con las ganas de volver.</p>
            <a className="museum-start" href="#comienzos"><span className="arrow-circle"><Arrow down /></span>Recorrer la historia</a>
          </div>
        </section>

        <div className="horizontal-story" aria-label="Galería de la memoria albiceleste">
          <div className="museum-coverflow" tabIndex={0} aria-label="Recorrido fotográfico de Messi" aria-keyshortcuts="ArrowLeft ArrowRight Home End PageUp PageDown" />
          <div className="museum-gallery-clip"><div className="museum-perspective"><div className="museum-world">
            {chapters.map(chapter => <section id={chapter.id} data-chapter data-gallery-panel className="memory-scene" data-year={chapter.year.split(" / ")[0]} data-place={chapter.date.split(" — ")[1]} aria-labelledby={`title-${chapter.id}`} key={chapter.id}>
              <div className="scene-stage">
                <figure className="scene-visual"><div className="scene-image"><MuseumPhoto src={chapter.image} alt={chapter.alt} sizes="(max-width: 760px) 92vw, (max-height: 739px) 90vw, (prefers-reduced-motion: reduce) 90vw, 62vw" /></div></figure>
              </div>
                <div className="scene-copy">
                  <p className="scene-year"><span className="scene-year-label">{chapter.year.split(" / ")[0]}</span></p>
                  <div className="scene-heading"><h2 id={`title-${chapter.id}`} tabIndex={-1}>{chapter.title.split("\n").map(line => <span key={line}>{line}</span>)}</h2><p className="scene-summary">{chapter.body}</p></div>
                  {chapter.match ? <Score match={chapter.match} location={locations[chapter.id]} /> : <p className="score-location">{locations[chapter.id]}</p>}
                </div>
            </section>)}
          </div></div></div>
        </div>
      </main>
    </MuseumExperience>
  </div>;
}
