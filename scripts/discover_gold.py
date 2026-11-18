"""Verify and materialize Gold once, outside conversation requests."""
import argparse
import collections
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'apps/api/src'))
from app.db.gold import digest


def flatten(row):
    return {**{k: v for k, v in row.items() if k != 'metrics'}, **row.get('metrics', {})}


SHOT_DETAIL = ('end_z', 'body_part_name', 'technique_name')


def shot_details(manifest):
    """Shot height and technique from the exact Silver load this Gold was built from."""
    base = manifest['source_load_ids']['base']
    for folder in (ROOT / 'data/silver/statsbomb/wc2022').glob('v1-*'):
        silver = json.loads((folder / 'manifest.json').read_text())
        if silver['load_id'] != base:
            continue
        if digest(folder / 'shots.jsonl') != silver['files']['shots.jsonl']:
            raise ValueError('Invalid checksum: silver shots.jsonl')
        return {(r['match_id'], r['event_id']): {k: r.get(k) for k in SHOT_DETAIL} for r in map(json.loads, (folder / 'shots.jsonl').open())}
    raise ValueError(f'Silver load {base} not found; shot height is unavailable.')


def build(folder, destination):
    manifest = json.loads((folder / 'manifest.json').read_text())
    for name, checksum in manifest['files'].items():
        if Path(name).name != name or digest(folder / name) != checksum:
            raise ValueError(f'Invalid checksum: {name}')
    shots = shot_details(manifest)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix('.building')
    temporary.unlink(missing_ok=True)
    con = sqlite3.connect(temporary)
    catalog = {'cache_version': 3, 'load_id': manifest['load_id'], 'manifest': manifest, 'datasets': {},
               'metrics': json.loads((folder / 'metric_catalog.json').read_text()),
               'coordinates': {'x': [0, 120], 'y': [0, 80], 'orientation': 'StatsBomb attacking direction; y grows downward. Event locations, not tracking.'},
               'limitations': ['No continuous tracking, speed, distance covered or physical workload.',
                              'Declared tactical positions are not measured player coordinates.',
                              'Shootouts are separate from match actions and match metrics.',
                              'Do not sum percentages; recompute from their numerators and denominators.',
                              'Missing coordinates and unknown outcomes remain missing.',
                              'No reliable minutes denominator; per-90 metrics are unsupported.',
                              'Shot goals exclude own goals; team goals_for is the match score.']}
    for path in sorted(folder.glob('*.jsonl')):
        rows = [flatten(json.loads(line)) for line in path.open()]
        if path.stem == 'actions':
            empty = dict.fromkeys(SHOT_DETAIL)
            rows = [{**r, **(shots.get((r['match_id'], r['event_id']), empty) if r.get('type_name') == 'Shot' else empty)} for r in rows]
        keys = sorted(set().union(*(r.keys() for r in rows)))
        profiles = {}
        for key in keys:
            values = [r.get(key) for r in rows]
            present = [v for v in values if v is not None]
            kinds = sorted({type(v).__name__ for v in present})
            p = {'types': kinds, 'nulls': len(values) - len(present)}
            if present and all(isinstance(v, (int, float)) for v in present):
                p.update(min=min(present), max=max(present))
            if all(not isinstance(v, (dict, list)) for v in present):
                counts = collections.Counter(present)
                p['distinct_count'] = len(counts)
                if len(counts) <= 100:
                    p['values'] = [v for v, _ in counts.most_common()]
            profiles[key] = p
        table = path.stem
        catalog['datasets'][table] = {'rows': len(rows), 'columns': profiles, 'sha256': manifest['files'][path.name]}
        def sqltype(k):
            kinds = profiles[k]['types']
            return 'REAL' if 'float' in kinds else 'INTEGER' if set(kinds) <= {'int','bool'} else 'TEXT'
        columns = ','.join(f'"{k}" {sqltype(k)}' for k in keys)
        con.execute(f'CREATE TABLE "{table}" ({columns})')
        def cell(v):
            return json.dumps(v, ensure_ascii=False) if isinstance(v, (dict,list)) else v
        con.executemany(f'INSERT INTO "{table}" VALUES ({",".join("?" for _ in keys)})',
                        [[cell(r.get(k)) for k in keys] for r in rows])
        for key in ('match_id','team_id','player_id','type_name','period','segment_id','creator_id','shooter_id'):
            if key in keys:
                con.execute(f'CREATE INDEX "idx_{table}_{key}" ON "{table}" ("{key}")')
        print(table, len(rows), flush=True)
    # Precompute spatial density at reusable dimensions; arbitrary extra filters
    # retain the bounded raw-query path rather than losing analytical flexibility.
    for source in ('actions','receipts'):
        dims=[k for k in ('match_id','team_id','player_id','type_name','period') if k in catalog['datasets'][source]['columns']]
        fields=','.join('"'+k+'"' for k in dims)
        con.execute(f'CREATE TABLE "_heatmap_{source}" AS SELECT {fields}, MIN(11,CAST(location_x/10 AS INTEGER)) AS bin_x, MIN(7,CAST(location_y/10 AS INTEGER)) AS bin_y,COUNT(*) AS event_count FROM "{source}" WHERE location_x BETWEEN 0 AND 120 AND location_y BETWEEN 0 AND 80 GROUP BY {fields},bin_x,bin_y')
        con.execute(f'CREATE INDEX "idx_heatmap_{source}" ON "_heatmap_{source}" (player_id,match_id,team_id)')
    catalog['relationships'] = ['match_id joins match datasets; team_id joins team_match.',
        'player_id / recipient_id / creator_id / shooter_id join player_match by player_id and match_id.',
        'lineup_segment_id / segment_id join lineup_segments.',
        'event_id / shot_event_id / pass_event_id join actions by event_id and match_id.']
    con.execute('CREATE TABLE metadata (catalog TEXT)')
    con.execute('INSERT INTO metadata VALUES (?)', (json.dumps(catalog, ensure_ascii=False),))
    con.commit()
    con.close()
    temporary.replace(destination)
    destination.with_suffix('.manifest.json').write_text(json.dumps({'sha256':digest(destination),'load_id':manifest['load_id'],'cache_version':3})+'\n')
    out = ROOT / 'docs/GOLD_CATALOG.json'
    out.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n')
    (ROOT / 'docs/GOLD_CATALOG.md').write_text('# Discovered Gold catalog\n\nLoad: `' + manifest['load_id'] + '`\n\n' +
        '\n'.join(f'- **{k}**: {v["rows"]:,} rows; {len(v["columns"])} columns.' for k,v in catalog['datasets'].items()) +
        '\n\nComplete columns, types, null counts, ranges, categorical values, hashes and metric definitions: [GOLD_CATALOG.json](GOLD_CATALOG.json).\n\n' +
        '\n'.join('- ' + s for s in catalog['relationships'] + catalog['limitations']) + '\n')
    return catalog

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--gold', type=Path)
    parser.add_argument('--output', type=Path, default=ROOT / 'data/agent/gold.sqlite3')
    args = parser.parse_args()
    folder = args.gold or max((ROOT / 'data/gold/statsbomb/wc2022').glob('*/manifest.json'),key=lambda p:p.stat().st_mtime_ns).parent
    build(folder, args.output)
