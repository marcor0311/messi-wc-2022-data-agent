"""LangGraph tool loop over the Responses API with terminal-stream verification and Gold-only evidence."""
import json
import operator
import unicodedata
from typing import Annotated, TypedDict
import httpx
from fastapi import HTTPException
from langgraph.graph import END, START, StateGraph
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

SCOPE. Only Argentina's seven matches at the 2022 World Cup exist here; every tool is limited to them. If the user asks about a match Argentina did not play (for example France vs Morocco), or a team or player only in such matches, do not query: say briefly that it is outside the scope and offer something about Argentina or Messi instead. A tool error starting with 'Fuera de alcance' means the same.\n\nDATA RULES. Every factual football claim and number MUST come from query_gold results in this conversation, never from memory. Resolve entity IDs with find_entities, never assume them. Discover metric definitions with describe_data. If the user omits a player on a fresh question, use Messi unless the question clearly asks for another scope. Preserve filters and entities across follow-ups unless the user changes them; ask when ambiguous. Do not hardcode questions or entities. Coordinates: StatsBomb x 0..120, y 0..80 downward, attack toward x=120. Shootouts are separate; match metrics exclude them. Never sum percentages. For filtered actions only sparse additive metrics exist; use count to count events. player_match and team_match contain precomputed metrics. No per-90 or tracking analysis. A tool validation error is recoverable: repair the arguments. If there are no records, say so. Mention truncation, nulls and limitations when they affect the answer. Each query_gold result includes a names lookup for the IDs in its rows: read names from it, and rank or compare by the actual values in the rows before you state who leads.

CHOOSING THE VISUALIZATION. The visualization is the main answer. Every question that asks for data gets at least one fresh tool call in this turn, even when earlier results in the conversation already contain the number: previous results are not shown again, so answering from memory leaves the user without a chart. Pick it by what the user wants to see:
- where on the pitch something happened (shots, passes, carries, dribbles, receptions, pressures): pitch. Shots are drawn sized by xG with goals filled. Never answer a question about events with only a table.
- in which zones a player was most active: heatmap.
- a total or a few headline numbers for one player or team: table with metrics (shown as stat cards).
- comparing players, teams, matches or periods: bars, with group_by on what is compared. Several metrics are fine; each gets its own panel.
- how something changed match by match: trend, group_by match_id, ascending. Several metrics are fine. MESSI DASHBOARD: whenever the user asks how Messi did match by match or across the tournament in general (his stats, his evolution, his performance or the danger he created, without naming specific metrics), use exactly these six metrics in this order: goals, assists, shots, xg, shots_created, complete_dribbles. Never fewer, never others, never xg_assisted (dribble attempts and success rate come back automatically). If the user names specific metrics, use those instead. Four tournament totals (non-penalty xG, xG assisted, completed passes, dribble success) are shown under those charts automatically, so do not add a separate headline-numbers query for that answer.
- who combined with whom: network. For one player's partners, filter connections by that player (player_id is the passer, recipient_id the receiver) instead of loading the whole team.
- starting XI: lineup. One query can return both teams of a match; each is drawn on its own pitch.
- how a line-up or formation changed during a match (substitutions, tactical shifts, who moved to which position, where Messi played in each phase): call lineup_story, never query_gold with a table. Resolve the match_id with find_entities kind=matches search=Argentina plus the rival.
- the order of events within a match (what happened and when): match_result, whose timeline shows goals, cards and substitutions.
- the result or score of a match (who won, how it ended, goals, cards and substitutions of a match): call match_result, never query_gold. Only Argentina's seven 2022 World Cup matches are available; for any other match, say that only Argentina's matches can be shown. Resolve the match_id with find_entities kind=matches search=Argentina plus the rival.
- a table without metrics only when the user asks for a list, or nothing else fits.
For pitch, network and lineup use no metrics and no group_by. For heatmap use no metrics, no group_by, no columns. columns is only valid with table.
Every visualization of an answer is shown stacked in one dashboard, charts first and headline stat cards below them. When it helps, build a small dashboard with two or three complementary query_gold calls, for example headline numbers plus the map, or a comparison plus the match-by-match trend. Never more than four visualizations.
Give every query_gold call a short human title in the user's language, such as "Tiros de Messi en la final". No IDs or column names in titles.

WRITING THE ANSWER. Reply in the user's language. Lead with the headline finding, then one or two insights read from the returned rows. Two to five short sentences. Plain text only: no Markdown, no headings, no tables, no lists of rows. Never repeat the rows in the text: the visualization and its data table already show them. Name players and teams, never IDs. Use natural names for metrics, for example "goles esperados (xG)" instead of column names.'''

AUDIENCES = {
    'simple': 'The reader is a child or someone new to football statistics. Very short sentences and everyday words, at most three sentences. Explain any statistic in passing with a simple idea, for example: xG says how easy a shot was to score, from 0 (almost impossible) to 1 (a sure goal). No acronyms left unexplained. Warm and encouraging, never childish about the facts.',
    'fan': 'The reader is a football fan. Conversational and clear. Explain an advanced metric briefly the first time it appears.',
    'analyst': 'The reader is a performance analyst, coaching staff or the player himself. Be precise and compact: exact values, denominators and sample sizes, what is included or excluded (penalties, extra time, shootouts), and the caveats of the data. Use standard terminology without explaining the basics. Add a tactical reading only when the returned data supports it.',
}


# Model calls per turn: the base covers entity lookups, one chart and the answer; each chart the
# model actually produces earns more room, so multi-chart dashboards fit and stalled loops still stop.
BASE_STEPS=10
STEPS_PER_CHART=2
MAX_STEPS=20
CHART_TOOLS=('query_gold','lineup_story','match_result')


class Turn(TypedDict):
    """LangGraph state of one chat turn. Lists with operator.add accumulate across steps."""
    account: dict
    model: str
    instructions: str
    inputs: Annotated[list, operator.add]
    visuals: Annotated[list, operator.add]
    trace: Annotated[list, operator.add]
    calls: list
    answer: str | None
    steps: Annotated[int, operator.add]
    charts: Annotated[int, operator.add]


class DataAgent:
    def __init__(self, analytics: Analytics):
        self.analytics=analytics
        self.graph=self.build_graph()

    def tools(self):
        return [
            {'type':'function','strict':False,'name':'describe_data','description':'Discover schemas, metric definitions and limitations. Use before querying an unfamiliar dataset.',
             'parameters':{'type':'object','properties':{'dataset':{'type':['string','null']}},'required':['dataset'],'additionalProperties':False}},
            {'type':'function','strict':False,'name':'find_entities','description':'Resolve actual Gold player, team and match IDs by a name fragment. Empty search lists all for teams/matches.',
             'parameters':{'type':'object','properties':{'kind':{'type':'string','enum':['players','teams','matches']},'search':{'type':'string'}},'required':['kind','search'],'additionalProperties':False}},
            {'type':'function','strict':False,'name':'query_gold','description':'Execute a validated Gold query and return a ready-to-render visualization with deterministic statistics. No SQL. Metrics are summed, ratios recomputed. count counts rows. Filters combine with AND; in supports OR values. Set explicit limits and do not present truncated results as totals.',
             'parameters':Query.model_json_schema()},
            {'type':'function','strict':False,'name':'lineup_story','description':"Show how both teams' line-ups changed during one of Argentina's 2022 World Cup matches: an animated pitch with one step per substitution or tactical shift, each player's position and the formation. Only Argentina matches.",
             'parameters':{'type':'object','properties':{'match_id':{'type':'integer'}},'required':['match_id'],'additionalProperties':False}},
            {'type':'function','strict':False,'name':'match_result','description':"Show the final score of one of Argentina's 2022 World Cup matches with both crests and a horizontal timeline of goals, cards and substitutions (plus the penalty shootout). Only Argentina matches.",
             'parameters':{'type':'object','properties':{'match_id':{'type':'integer'}},'required':['match_id'],'additionalProperties':False}},
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
        if query['dataset']=='shot_creations' and result['rows']:
            return self.creation_map(query)
        if result['visualization']!='table' or query['dataset'] not in VIEWS['pitch']['datasets'] or query['metrics'] or query['group_by'] or not result['rows']:
            return None
        mapped=self.analytics.query(Query(dataset=query['dataset'],filters=query['filters'],visualization='pitch',limit=query['limit'],title=query.get('title')))
        return mapped if any(row.get('location_x') is not None for row in mapped['rows']) else None

    def creation_map(self, query):
        # Each created shot is one play on the pitch: the key pass, the shooter's touch until he shoots, and the shot.
        chains=self.analytics.query(Query(dataset='shot_creations',filters=query['filters'],columns=['pass_event_id','shot_event_id','creator_id','shooter_id','match_id','statsbomb_xg'],limit=61))
        if not chains['rows'] or chains['truncated'] or len(chains['rows'])>60: return None
        ids=[e for row in chains['rows'] for e in (row['pass_event_id'],row['shot_event_id']) if e]
        events=self.analytics.query(Query(dataset='actions',visualization='pitch',filters=[{'column':'event_id','op':'in','value':ids}],limit=150))
        by_id={e['event_id']:e for e in events['rows']}
        rows=[{'match_id':c['match_id'],'creator_id':c['creator_id'],'shooter_id':c['shooter_id'],'pass':by_id[c['pass_event_id']],'shot':by_id[c['shot_event_id']]}
              for c in chains['rows'] if c['pass_event_id'] in by_id and c['shot_event_id'] in by_id and by_id[c['pass_event_id']].get('location_x') is not None and by_id[c['shot_event_id']].get('location_x') is not None]
        if not rows: return None
        rows.sort(key=lambda r:(r['match_id'],r['pass'].get('period') or 0,r['pass'].get('minute') or 0,r['pass'].get('second') or 0))
        title=((query.get('title') or 'Tiros creados')+' en la cancha')[:120]
        return {**events,'visualization':'creation_chains','rows':rows,'matched_source_rows':len(rows),
                'query':{**events['query'],'visualization':'creation_chains','title':title},
                'limitations':['Cada jugada une el pase clave con el tiro que generó; el tramo intermedio (recepción y conducción del rematador) se dibuja recto, no es su recorrido real.']}

    def execute(self, name, arguments):
        if name=='query_gold': return self.analytics.query(Query.model_validate(arguments))
        if name=='lineup_story':
            match_id=arguments.get('match_id')
            if not isinstance(match_id,int): raise ValueError('match_id debe ser un entero')
            return self.analytics.lineup_story(match_id)
        if name=='match_result':
            match_id=arguments.get('match_id')
            if not isinstance(match_id,int): raise ValueError('match_id debe ser un entero')
            return self.analytics.match_result(match_id)
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

    def call_model(self, turn: Turn):
        # response_stream is looked up at call time so tests can replace the inference transport.
        response=response_stream(turn['account'],{'model':turn['model'],'instructions':turn['instructions'],'input':turn['inputs'],
                                                  'tools':self.tools(),'parallel_tool_calls':False})
        outputs=response.get('output',[])
        calls=[o for o in outputs if o.get('type')=='function_call']
        answer=None if calls else '\n'.join(c['text'] for o in outputs if o.get('type')=='message' for c in o.get('content',[]) if c.get('type')=='output_text')
        if answer=='': raise HTTPException(502,'El modelo no devolvió una respuesta legible.')
        return {'inputs':outputs,'calls':calls,'answer':answer,'steps':1}

    def run_tools(self, turn: Turn):
        inputs=[]; visuals=[]; trace=[]; charts=0
        for call in turn['calls']:
            try:
                args=json.loads(call['arguments']); result=self.execute(call['name'],args)
                if call['name'] in ('match_result','lineup_story'):
                    visuals.append(result)
                elif call['name']=='query_gold':
                    companion=self.companion_map(result)
                    if companion:
                        visuals.append(companion)
                        result={**result,'also_shown_to_user':'A pitch map of these same events (for shot creations: each key pass and the shot it led to) is displayed above this result.'}
                    visuals.append(result)
                    result=self.named(result)
                trace.append({'tool':call['name'],'arguments':args,'ok':True})
                charts+=call['name'] in CHART_TOOLS
            except (ValueError,KeyError,TypeError) as exc:
                # A tool error goes back to the model, which repairs its arguments on the next step.
                result={'error':str(exc)[:1500]}; trace.append({'tool':call['name'],'ok':False,'error':str(exc)[:1500]})
            inputs.append({'type':'function_call_output','call_id':call['call_id'],'output':json.dumps(result,ensure_ascii=False)})
        return {'inputs':inputs,'visuals':visuals,'trace':trace,'calls':[],'charts':charts}

    @staticmethod
    def budget(charts):
        return min(MAX_STEPS,BASE_STEPS+STEPS_PER_CHART*charts)

    @staticmethod
    def after_model(turn: Turn):
        if turn['answer'] is not None or turn['steps']>=DataAgent.budget(turn['charts']): return END
        return 'tools'

    def build_graph(self):
        # model ⇄ tools until the model answers in text or the step budget runs out.
        graph=StateGraph(Turn)
        graph.add_node('model',self.call_model)
        graph.add_node('tools',self.run_tools)
        graph.add_edge(START,'model')
        graph.add_conditional_edges('model',self.after_model,{'tools':'tools',END:END})
        graph.add_edge('tools','model')
        return graph.compile()

    def answer(self, account, message, history, model, audience='fan'):
        catalog=self.analytics.describe()
        instructions=RULES+'\n\nAUDIENCE. '+AUDIENCES[audience]+'\n\nSchema and views follow:\n'+json.dumps({'datasets':catalog,'views':VIEWS},ensure_ascii=False)
        inputs=[]
        for turn in history[-12:]:
            inputs += [{'role':'user','content':turn['question']},{'role':'assistant','content':turn['answer']}]
            # Include exact previous query/result evidence for follow-up resolution.
            inputs.append({'role':'user','content':'Previous verified tool results: '+json.dumps(turn.get('visualizations',[]),ensure_ascii=False)[:45000]})
        inputs.append({'role':'user','content':message})
        final=self.graph.invoke({'account':account,'model':model,'instructions':instructions,'inputs':inputs,
                                 'visuals':[],'trace':[],'calls':[],'answer':None,'steps':0,'charts':0},
                                {'recursion_limit':2*MAX_STEPS+2})
        if final['answer'] is None: raise HTTPException(422,'La consulta superó el límite de pasos; concreta la pregunta.')
        return {'question':message,'answer':final['answer'],'visualizations':final['visuals'],'trace':final['trace'],'model':model}
