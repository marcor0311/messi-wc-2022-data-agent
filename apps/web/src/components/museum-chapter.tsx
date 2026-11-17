import MuseumPhoto from "./museum-photo";
import { locations, type Match, type MuseumChapterData } from "./museum-data";

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

function Award({ award, location }: { award: { total: number; label: string; organizer: string }; location: string }) {
  return <div className="chapter-award" role="group" aria-label={`${award.total} ${award.label} de Lionel Messi`}>
    <p className="score-location">{location}</p>
    <div className="award-board"><strong className="award-count">{award.total}</strong><span className="award-label">{award.label}</span></div>
    <div className="score-context"><span className="score-competition">{award.organizer}</span></div>
  </div>;
}

export default function MuseumChapter({ chapter }: { chapter: MuseumChapterData }) {
  return <section id={chapter.id} data-chapter data-gallery-panel className="memory-scene" data-year={chapter.year.split(" / ")[0]} data-place={chapter.date.split(" — ")[1]} aria-labelledby={`title-${chapter.id}`}>
              <div className="scene-stage">
                <figure className="scene-visual"><div className="scene-image"><MuseumPhoto src={chapter.image} alt={chapter.alt} sizes="(max-width: 760px) 92vw, (max-height: 739px) 90vw, (prefers-reduced-motion: reduce) 90vw, 62vw" /></div></figure>
              </div>
                <div className="scene-copy">
                  <p className="scene-year"><span className="scene-year-label">{chapter.year.split(" / ")[0]}</span></p>
                  <div className="scene-heading"><h2 id={`title-${chapter.id}`} tabIndex={-1}>{chapter.title.split("\n").map(line => <span key={line}>{line}</span>)}</h2><p className="scene-summary">{chapter.body}</p></div>
                  {chapter.match ? <Score match={chapter.match} location={locations[chapter.id]} /> : <Award award={chapter.award} location={locations[chapter.id]} />}
                </div>
            </section>;
}
