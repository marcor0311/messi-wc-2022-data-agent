"""Real special-tool results for browser tests; no credentials or model inference."""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / 'apps/api/src'))
from app.agent.analytics import Analytics, Query
from app.agent.runtime import DataAgent

analytics = Analytics()
agent = DataAgent(analytics)
entities = analytics.entities()
messi = next(p for p in entities['players'] if 'Messi' in p['player_name'])
final = next(m for m in entities['matches'] if m['stage_name'] == 'Final')
creation = analytics.query(Query(dataset='shot_creations', visualization='bars',
    filters=[{'column': 'creator_id', 'value': messi['player_id']}],
    group_by=['shooter_id'], metrics=['count'], title='Rematadores de los pases de Messi'))
chains = agent.companion_map(creation)
if not chains:
    raise RuntimeError('No se pudieron reconstruir las jugadas de tiros creados.')
print(json.dumps({
    'creation': [chains, creation],
    'lineup_story': [agent.execute('lineup_story', {'match_id': final['match_id']})],
    'match_result': [agent.execute('match_result', {'match_id': final['match_id']})],
}))
