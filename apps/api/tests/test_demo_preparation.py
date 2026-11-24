"""Published preparation commands must recreate the data used by the demo."""
import json
import os
from pathlib import Path
import subprocess
import sys

import pytest

from app.agent.analytics import Analytics, Query
from app.db.gold import ROOT, digest


@pytest.fixture(scope='module')
def serving():
    path = ROOT / 'data/agent/gold.sqlite3'
    if not path.exists():
        pytest.skip('Requires local Gold/Silver artifacts; run scripts/discover_gold.py first')
    return Analytics()


def run_script(name, *arguments):
    return subprocess.run([sys.executable, str(ROOT / 'scripts' / name), *map(str, arguments)],
                          cwd=ROOT, env={**os.environ, 'PYTHONDONTWRITEBYTECODE': '1'},
                          capture_output=True, text=True, check=True)


def test_regenerated_summaries_supply_results_and_tactical_changes(serving, tmp_path):
    manifest = serving.catalog['manifest']
    hashes = manifest['source_manifest_hashes']
    silver = next(p.parent for p in (ROOT / 'data/silver/statsbomb/wc2022').glob('*/manifest.json')
                  if digest(p) == hashes['base'])
    roster = next(p.parent for p in (ROOT / 'data/silver/statsbomb/wc2022-lineups').glob('*/manifest.json')
                  if digest(p) == hashes['lineups'])
    output = tmp_path / 'argentina_matches.json'
    run_script('argentina_match_summaries.py', '--silver', silver, '--roster', roster, '--output', output)
    summary = json.loads(output.read_text())
    assert summary['source']['silver_manifest_sha256'] == hashes['base']
    assert {m['match_id'] for m in summary['matches']} == set(serving.scope_matches)
    # Exercise the actual serving tools against only the freshly generated companion.
    for name in ('gold.sqlite3', 'gold.manifest.json'):
        (tmp_path / name).symlink_to(serving.path.parent / name)
    rebuilt = Analytics(tmp_path / 'gold.sqlite3')
    final = next(m['match_id'] for m in rebuilt.entities()['matches'] if m['stage_name'] == 'Final')
    match = rebuilt.match_result(final)['rows'][0]
    assert match['home']['score'] == match['away']['score'] == 3
    assert (match['shootout']['home'], match['shootout']['away']) == (4, 2)
    assert sum(e['kind'] in ('goal', 'penalty_goal', 'own_goal') for e in match['events']) == 6
    for team in rebuilt.lineup_story(final)['rows']:
        assert team['steps'][0]['seconds'] == 0
        assert len(team['steps']) > 1
        assert all(len(step['players']) == 11 for step in team['steps'])
        assert all(p['position_id'] is not None for step in team['steps'] for p in step['players'])


def test_demo_generation_replays_current_query_contract(serving, tmp_path):
    run_script('generate_demo.py', '--output-dir', tmp_path)
    cases = json.loads((tmp_path / 'DEMO_SCENARIOS.json').read_text())
    assert len(cases) == 27
    entities = json.loads((tmp_path / 'GOLD_ENTITIES.json').read_text())
    assert {m['match_id'] for m in entities['matches']} == set(serving.scope_matches)
    for case in cases:
        query = Query.model_validate(case['query'])
        assert len(serving.query(query)['rows']) == case['verified_rows']
    chronological_shots = cases[12]['query']
    assert chronological_shots['visualization'] == 'pitch'
    assert chronological_shots['order_by'] == 'event_index'
    assert chronological_shots['descending'] is False
    assert 'timeline' not in {case['query']['visualization'] for case in cases}
