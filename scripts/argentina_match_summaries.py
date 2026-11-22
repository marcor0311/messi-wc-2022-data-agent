"""Materialize the 7 Argentina match summaries (score, goals, cards, substitutions, shootout) from Silver events.

Cards only exist in the provider payload, so this reads Silver once, offline, never during a conversation.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/api/src'))
from app.db.gold import digest

ARGENTINA = 779
OUTPUT = ROOT / 'data/agent/argentina_matches.json'


def latest(pattern):
    files = sorted(ROOT.glob(pattern), key=lambda f: f.stat().st_mtime_ns)
    if not files: raise SystemExit(f'Falta {pattern}')
    return files[-1]


def build(silver: Path, roster: Path, output: Path):
    """Build the serving companion without touching Gold or existing chat history."""
    nick = {r['player_id']: r['nicknames'][0] for r in map(json.loads, roster.open()) if r.get('nicknames')}
    jersey = {(r['match_id'], r['player_id']): r['jersey_number'] for r in map(json.loads, (roster.parent / 'match_rosters.jsonl').open())}
    # Position spells from the provider lineups: their start clock is reliable, their end clock is not, so only starts are kept.
    spells = {}
    for r in map(json.loads, (roster.parent / 'position_spells.jsonl').open()):
        spells.setdefault(r['match_id'], {}).setdefault(r['player_id'], []).append([r['from_clock_seconds'], r['position_id']])
    teams = {r['team_id']: r['name'] for r in map(json.loads, (silver / 'teams.jsonl').open())}
    matches = {m['match_id']: m for m in map(json.loads, (silver / 'matches.jsonl').open())
               if ARGENTINA in (m['home_team_id'], m['away_team_id'])}
    events = {mid: [] for mid in matches}
    for line in (silver / 'events.jsonl').open():
        if not line.startswith('{"match_id":'): continue
        mid = int(line[12:line.index(',')])
        if mid in events: events[mid].append(json.loads(line))

    def name(p): return nick.get(p['id'], p['name']) if p else None

    out = []
    for mid, m in sorted(matches.items(), key=lambda kv: kv[1]['match_date']):
        timeline, shootout, last_period = [], [], 1
        by_id = {e['event_id']: e for e in events[mid]}
        for e in sorted(events[mid], key=lambda e: e['event_index']):
            raw, kind, period = e['raw_payload'], e['type_name'], e['period']
            if period <= 4: last_period = max(last_period, period)
            base = {'period': period, 'minute': e['minute'], 'second': e['second'], 'team_id': e['team_id'],
                    'player': name(raw.get('player')), 'event_id': e['event_id']}
            if kind == 'Shot' and period == 5:
                shootout.append({'team_id': e['team_id'], 'player': base['player'], 'number': jersey.get((mid, e['player_id'])), 'scored': raw['shot']['outcome']['name'] == 'Goal'})
            elif kind == 'Shot' and raw['shot']['outcome']['name'] == 'Goal':
                st = raw['shot'].get('type', {}).get('name')
                key_pass = by_id.get(raw['shot'].get('key_pass_id'))
                assist = name(key_pass['raw_payload'].get('player')) if key_pass and key_pass['raw_payload'].get('pass', {}).get('goal_assist') else None
                timeline.append({**base, 'kind': 'penalty_goal' if st == 'Penalty' else 'goal', 'assist': assist})
            elif kind == 'Own Goal For':
                against = next((x for x in events[mid] if x['type_name'] == 'Own Goal Against' and x['minute'] == e['minute']), None)
                timeline.append({**base, 'kind': 'own_goal', 'player': name(against['raw_payload'].get('player')) if against else None})
            elif kind in ('Bad Behaviour', 'Foul Committed'):
                card = (raw.get('bad_behaviour') or raw.get('foul_committed') or {}).get('card', {}).get('name')
                if card: timeline.append({**base, 'kind': {'Yellow Card': 'yellow', 'Second Yellow': 'second_yellow', 'Red Card': 'red'}[card]})
            elif kind == 'Substitution':
                timeline.append({**base, 'kind': 'substitution', 'player_in': name(raw['substitution']['replacement'])})
        home, away = m['home_team_id'], m['away_team_id']
        out.append({'match_id': mid, 'match_date': m['match_date'], 'stage_name': m['stage_name'],
                    'home': {'team_id': home, 'name': teams[home], 'score': m['home_score']},
                    'away': {'team_id': away, 'name': teams[away], 'score': m['away_score']},
                    'extra_time': last_period >= 3,
                    'shootout': {'home': sum(s['scored'] for s in shootout if s['team_id'] == home),
                                 'away': sum(s['scored'] for s in shootout if s['team_id'] == away),
                                 'kicks': shootout} if shootout else None,
                    'events': timeline,
                    'jerseys': {str(pid): n for (m_id, pid), n in jersey.items() if m_id == mid},
                    'position_spells': {str(pid): sorted(v) for pid, v in spells.get(mid, {}).items()}})
    payload = {'source': {'silver_manifest_sha256': digest(silver / 'manifest.json'), 'roster': roster.parent.name}, 'matches': out}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=1))
    for x in out:
        print(x['match_date'], x['home']['name'], x['home']['score'], '-', x['away']['score'], x['away']['name'],
              x['shootout'] and f"({x['shootout']['home']}-{x['shootout']['away']} pen)", len(x['events']))
    return payload


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--silver', type=Path, help='Silver events snapshot folder; defaults to newest local snapshot.')
    parser.add_argument('--roster', type=Path, help='Silver lineups snapshot folder; defaults to newest local snapshot.')
    parser.add_argument('--output', type=Path, default=OUTPUT)
    args = parser.parse_args()
    silver = args.silver or latest('data/silver/statsbomb/wc2022/v1-*/manifest.json').parent
    roster = args.roster / 'players.jsonl' if args.roster else latest('data/silver/statsbomb/wc2022-lineups/*/players.jsonl')
    build(silver, roster, args.output)
