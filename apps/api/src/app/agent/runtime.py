"""Responses tool loop with terminal-stream verification and Gold-only evidence."""
import json
import unicodedata
import httpx
from fastapi import HTTPException
from app.agent.analytics import Analytics, Query, VIEWS


def model_catalog(account):
    try:
        with httpx.Client(timeout=30) as client:
            response=client.get('https://api.openai.com/v1/models',headers={'Authorization':'Bearer '+account['access_token']})
            response.raise_for_status()
        models=[m for m in response.json()['models'] if m.get('visibility')=='list']
        if not models: raise ValueError('Catálogo vacío')
        return [{'slug':m['slug'],'display_name':m['display_name']} for m in models]
    except (httpx.HTTPError,KeyError,ValueError) as exc:
        raise HTTPException(502,'No se pudo descubrir el catálogo de modelos de esta cuenta.') from exc


def response_stream(account, payload):
    completed=None
    try:
        with httpx.Client(timeout=httpx.Timeout(120,connect=20)) as client:
            with client.stream('POST','https://api.openai.com/v1/responses',
                headers={'Authorization':'Bearer '+account['access_token']},json={**payload,'store':False,'stream':True}) as response:
                if response.status_code>=400:
                    response.read()
                    raise HTTPException(502,f'La inferencia oficial devolvió HTTP {response.status_code}. Revisa permisos y límites en ChatGPT Settings.')
                for line in response.iter_lines():
                    if not line.startswith('data: '): continue
                    raw=line[6:]
                    if raw=='[DONE]': continue
                    event=json.loads(raw)
                    kind=event.get('type')
                    if kind in ('response.failed','response.incomplete','error'):
                        raise HTTPException(502,'La inferencia no se completó. Revisa los límites de tu plan o vuelve a intentarlo.')
                    if kind=='response.completed': completed=event['response']
        if completed is None: raise HTTPException(502,'El stream terminó sin response.completed.')
        return completed
    except httpx.HTTPError as exc:
        raise HTTPException(502,'Conexión con la inferencia oficial interrumpida; puedes reintentar.') from exc


RULES = '''You are a football data agent focused on Lionel Messi at the 2022 World Cup. Messi is the protagonist; other players and teams provide context or comparisons. People ask in natural language; you turn each question into validated Gold queries, pick the visualization that answers it best and explain what it shows.

DATA RULES. Every factual football claim and number MUST come from query_gold results in this conversation, never from memory. Resolve entity IDs with find_entities, never assume them. Discover metric definitions with describe_data. If the user omits a player on a fresh question, use Messi unless the question clearly asks for another scope. Preserve filters and entities across follow-ups unless the user changes them; ask when ambiguous. Do not hardcode questions or entities. Coordinates: StatsBomb x 0..120, y 0..80 downward, attack toward x=120. Shootouts are separate; match metrics exclude them. Never sum percentages. For filtered actions only sparse additive metrics exist; use count to count events. player_match and team_match contain precomputed metrics. No per-90 or tracking analysis. A tool validation error is recoverable: repair the arguments. If there are no records, say so. Mention truncation, nulls and limitations when they affect the answer. Each query_gold result includes a names lookup for the IDs in its rows: read names from it, and rank or compare by the actual values in the rows before you state who leads.

CHOOSING THE VISUALIZATION. The visualization is the main answer. Pick it by what the user wants to see:
- where on the pitch something happened (shots, passes, carries, dribbles, receptions, pressures): pitch. Shots are drawn sized by xG with goals filled. Never answer a question about events with only a table.
- in which zones a player was most active: heatmap.
- a total or a few headline numbers for one player or team: table with metrics (shown as stat cards).
- comparing players, teams, matches or periods: bars, with group_by on what is compared. Several metrics are fine; each gets its own panel.
- how something changed match by match: trend, group_by match_id, ascending. Several metrics are fine.
- who combined with whom: network. For one player's partners, filter connections by that player (player_id is the passer, recipient_id the receiver) instead of loading the whole team.
- starting XI or formation: lineup. One query can return both teams of a match; each is drawn on its own pitch.
- the order of events within a match: timeline.
- a table without metrics only when the user asks for a list, or nothing else fits.
For pitch, network, lineup and timeline use no metrics and no group_by. For heatmap use no metrics, no group_by, no columns. columns is only valid with table.
When it helps, build a small dashboard with two or three complementary query_gold calls, for example headline numbers plus the map, or a comparison plus the match-by-match trend. Never more than four visualizations.
Give every query_gold call a short human title in the user's language, such as "Tiros de Messi en la final". No IDs or column names in titles.

WRITING THE ANSWER. Reply in the user's language. Lead with the headline finding, then one or two insights read from the returned rows. Two to five short sentences. Plain text only: no Markdown, no headings, no tables, no lists of rows. Never repeat the rows in the text: the visualization and its data table already show them. Name players and teams, never IDs. Use natural names for metrics, for example "goles esperados (xG)" instead of column names.'''

AUDIENCES = {
    'simple': 'The reader is a child or someone new to football statistics. Very short sentences and everyday words, at most three sentences. Explain any statistic in passing with a simple idea, for example: xG says how easy a shot was to score, from 0 (almost impossible) to 1 (a sure goal). No acronyms left unexplained. Warm and encouraging, never childish about the facts.',
    'fan': 'The reader is a football fan. Conversational and clear. Explain an advanced metric briefly the first time it appears.',
    'analyst': 'The reader is a performance analyst, coaching staff or the player himself. Be precise and compact: exact values, denominators and sample sizes, what is included or excluded (penalties, extra time, shootouts), and the caveats of the data. Use standard terminology without explaining the basics. Add a tactical reading only when the returned data supports it.',
}


class DataAgent:
    def __init__(self, analytics: Analytics): self.analytics=analytics

    def tools(self):
        return [
            {'type':'function','strict':False,'name':'describe_data','description':'Discover schemas, metric definitions and limitations. Use before querying an unfamiliar dataset.',
             'parameters':{'type':'object','properties':{'dataset':{'type':['string','null']}},'required':['dataset'],'additionalProperties':False}},
            {'type':'function','strict':False,'name':'find_entities','description':'Resolve actual Gold player, team and match IDs by a name fragment. Empty search lists all for teams/matches.',
             'parameters':{'type':'object','properties':{'kind':{'type':'string','enum':['players','teams','matches']},'search':{'type':'string'}},'required':['kind','search'],'additionalProperties':False}},
            {'type':'function','strict':False,'name':'query_gold','description':'Execute a validated Gold query and return a ready-to-render visualization with deterministic statistics. No SQL. Metrics are summed, ratios recomputed. count counts rows. Filters combine with AND; in supports OR values. Set explicit limits and do not present truncated results as totals.',
             'parameters':Query.model_json_schema()},
        ]

    def named(self, result):
        # Rows carry IDs. Reading them back as names is where a model slips, so the lookup travels with the result.
        entities=self.analytics.entities()
        used={key:{row.get(column) for row in result['rows'] for column in columns}
              for key,columns in (('players',('player_id','recipient_id','passer_id','creator_id','shooter_id')),('teams',('team_id','opponent_id')),('matches',('match_id',)))}
        return {**result,'names':{
            'players':{p['player_id']:p['display_name'] for p in entities['players'] if p['player_id'] in used['players']},
            'teams':{t['team_id']:t['team_name'] for t in entities['teams'] if t['team_id'] in used['teams']},
            'matches':{m['match_id']:f"{m['team_name']} vs {m['opponent_name']}, {m['stage_name']}, {m['match_date']}" for m in entities['matches'] if m['match_id'] in used['matches']}}}

    def companion_map(self, result):
        query=result['query']
        if result['visualization']!='table' or query['dataset'] not in VIEWS['pitch']['datasets'] or query['metrics'] or query['group_by'] or not result['rows']:
            return None
        mapped=self.analytics.query(Query(dataset=query['dataset'],filters=query['filters'],visualization='pitch',limit=query['limit'],title=query.get('title')))
        return mapped if any(row.get('location_x') is not None for row in mapped['rows']) else None

    def execute(self, name, arguments):
        if name=='query_gold': return self.analytics.query(Query.model_validate(arguments))
        if name=='describe_data':
            return {'datasets':self.analytics.describe(arguments.get('dataset')), 'metrics':self.analytics.metrics,
                    'limitations':self.analytics.catalog['limitations']}
        if name=='find_entities':
            kind=arguments['kind']
            if kind not in ('players','teams','matches'): raise ValueError('Entidad desconocida')
            def norm(v): return ''.join(c for c in unicodedata.normalize('NFKD',v.casefold()) if not unicodedata.combining(c))
            search=norm(arguments['search'])
            rows=[r for r in self.analytics.entities()[kind] if all(word in norm(' '.join(str(v) for v in r.values())) for word in search.split())]
            return {'rows':rows[:100],'truncated':len(rows)>100}
        raise ValueError('Herramienta desconocida')

    def answer(self, account, message, history, model, audience='fan'):
        catalog=self.analytics.describe()
        instructions=RULES+'\n\nAUDIENCE. '+AUDIENCES[audience]+'\n\nSchema and views follow:\n'+json.dumps({'datasets':catalog,'views':VIEWS},ensure_ascii=False)
        inputs=[]
        for turn in history[-12:]:
            inputs += [{'role':'user','content':turn['question']},{'role':'assistant','content':turn['answer']}]
            # Include exact previous query/result evidence for follow-up resolution.
            inputs.append({'role':'user','content':'Previous verified tool results: '+json.dumps(turn.get('visualizations',[]),ensure_ascii=False)[:45000]})
        inputs.append({'role':'user','content':message})
        visuals=[]; trace=[]
        for step in range(10):
            response=response_stream(account,{'model':model,'instructions':instructions,'input':inputs,'tools':self.tools(),'parallel_tool_calls':False})
            outputs=response.get('output',[])
            inputs.extend(outputs)
            calls=[o for o in outputs if o.get('type')=='function_call']
            if not calls:
                answer='\n'.join(c['text'] for o in outputs if o.get('type')=='message' for c in o.get('content',[]) if c.get('type')=='output_text')
                if not answer: raise HTTPException(502,'El modelo no devolvió una respuesta legible.')
                return {'question':message,'answer':answer,'visualizations':visuals,'trace':trace,'model':model}
            for call in calls:
                try:
                    args=json.loads(call['arguments']); result=self.execute(call['name'],args)
                    if call['name']=='query_gold':
                        companion=self.companion_map(result)
                        if companion:
                            visuals.append(companion)
                            result={**result,'also_shown_to_user':'A pitch map of these same events is displayed above this table.'}
                        visuals.append(result)
                        result=self.named(result)
                    trace.append({'tool':call['name'],'arguments':args,'ok':True})
                except (ValueError,KeyError,TypeError) as exc:
                    result={'error':str(exc)[:1500]}; trace.append({'tool':call['name'],'ok':False,'error':str(exc)[:1500]})
                inputs.append({'type':'function_call_output','call_id':call['call_id'],'output':json.dumps(result,ensure_ascii=False)})
        raise HTTPException(422,'La consulta superó el límite de pasos; concreta la pregunta.')
