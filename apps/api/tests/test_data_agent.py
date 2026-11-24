"""Independent Gold accuracy checks and agent/auth protocol regression tests."""
import json
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs,urlparse
import time
import pytest
from fastapi import HTTPException
from app.agent.analytics import Analytics, Query
from app.agent.auth import Auth, fingerprint
from app.agent.runtime import DataAgent, BASE_STEPS, MAX_STEPS, STEPS_PER_CHART, response_stream
from app.db.gold import ROOT

@pytest.fixture(scope='module')
def analytics():
    if not (ROOT/'data/agent/gold.sqlite3').exists(): pytest.skip('Run scripts/discover_gold.py for real-Gold integration tests')
    return Analytics()

def test_all_entities_and_columns_discovered(analytics):
    entities=analytics.entities()
    # Product scope: only Argentina's seven matches, their eight teams and their players.
    assert len(entities['matches'])==7 and len(entities['teams'])==8
    assert 150<len(entities['players'])<300
    assert len(analytics.datasets)==11
    assert analytics.datasets['actions']['rows']==234531

def test_totals_independently_from_raw_gold(analytics):
    load=analytics.catalog['load_id']
    folder=ROOT/'data/gold/statsbomb/wc2022'/('v1-'+load)
    players=[json.loads(s) for s in (folder/'player_match.jsonl').open()]
    player=5503
    selected=[p for p in players if p['player_id']==player and p['match_id'] in analytics.scope_matches]
    result=analytics.query(Query(dataset='player_match',filters=[{'column':'player_id','value':player}],metrics=['shots','npxg','pass_completion_pct']))['rows'][0]
    assert result['shots']==sum(p['metrics']['shots'] for p in selected)
    assert result['npxg']==pytest.approx(sum(p['metrics']['npxg'] for p in selected))
    n=sum(p['metrics']['completed_passes'] for p in selected);d=sum(p['metrics']['known_passes'] for p in selected)
    assert result['pass_completion_pct']==pytest.approx(n/d*100)

def test_novel_pressure_recovery_comparison(analytics):
    teams=analytics.entities()['teams'][:4]
    r=analytics.query(Query(dataset='team_match',filters=[{'column':'team_id','op':'in','value':[t['team_id'] for t in teams]}],group_by=['team_id'],metrics=['successful_recoveries','pressure_pass_completion_pct'],visualization='bars'))
    assert len(r['rows'])==4 and not r['truncated']
    assert all(0<=row['pressure_pass_completion_pct']<=100 for row in r['rows'])

@pytest.mark.parametrize('dataset,view,extra',[
    ('actions','pitch',{}),('receipts','heatmap',{}),('connections','network',{}),
    ('initial_lineups','lineup',{}),
    ('player_match','bars',{'metrics':['npxg'],'group_by':['player_id']}),
    ('team_match','trend',{'metrics':['passes'],'group_by':['match_id']}),('shot_creations','table',{}),
])
def test_all_visualization_contracts(analytics,dataset,view,extra):
    match=analytics.entities()['matches'][0]['match_id']
    r=analytics.query(Query(dataset=dataset,visualization=view,filters=[{'column':'match_id','value':match}],**extra))
    assert r['rows'] and r['provenance']['source_sha256']
    if view=='heatmap':
        assert all(0<=r['bin_x']<=11 and 0<=r['bin_y']<=7 for r in r['rows'])
    if view=='lineup': assert len(r['rows'][0]['players'])==11

@pytest.mark.parametrize('body',[
    {'dataset':'actions; DROP TABLE actions'},
    {'dataset':'actions','columns':['not_a_column']},
    {'dataset':'actions','filters':[{'column':'match_id','op':'in','value':[]}]},
    {'dataset':'player_match','metrics':['player_name']},
    {'dataset':'team_match','visualization':'pitch'},
    {'dataset':'actions','visualization':'bars'},
])
def test_query_rejects_invalid_or_unsafe_requests(analytics,body):
    with pytest.raises(ValueError): analytics.query(Query(**body))

def test_empty_results_missing_and_truncation(analytics):
    r=analytics.query(Query(dataset='actions',filters=[{'column':'type_name','value':'Not a type'}]))
    assert r['rows']==[] and r['matched_source_rows']==0
    r=analytics.query(Query(dataset='actions',columns=['location_x'],limit=1))
    assert r['truncated'] and len(r['rows'])==1
    assert r['rows'][0]['location_x'] is None

def test_scope_is_argentina_matches_only(analytics):
    import sqlite3
    con=sqlite3.connect(analytics.path)
    semi=con.execute("SELECT match_id FROM team_match WHERE stage_name='Semi-finals' AND team_id!=779 AND opponent_id!=779").fetchone()[0]
    morocco=con.execute("SELECT team_id FROM team_match WHERE team_name='Morocco'").fetchone()[0]
    for f in ([{'column':'match_id','value':semi}],[{'column':'team_id','value':morocco}],[{'column':'match_id','op':'in','value':[semi,analytics.scope_matches[0]]}]):
        with pytest.raises(ValueError,match='Fuera de alcance'): analytics.query(Query(dataset='actions',visualization='pitch',filters=f))
    # A team that also played Argentina only returns that match.
    r=analytics.query(Query(dataset='actions',visualization='pitch',filters=[{'column':'team_id','value':771},{'column':'type_name','value':'Shot'}]))
    assert r['rows'] and {x['match_id'] for x in r['rows']}<=set(analytics.scope_matches)
    r=analytics.query(Query(dataset='segment_player_metrics',limit=500))
    assert r['rows']

def test_oauth_pkce_state_and_host_persistence(tmp_path):
    path=tmp_path/'credentials.json';a=Auth(path)
    url,state=a.start();p=parse_qs(urlparse(url).query)
    assert p['client_id']==['dynamic_agent_client']
    assert p['code_challenge_method']==['S256']
    assert p['ext_agent_host_id'][0].startswith('urn:uuid:')
    assert 'chatgpt.tokens.use.direct' in p['scope'][0]
    assert path.stat().st_mode&0o777==0o600
    with pytest.raises(HTTPException):a.callback(state,'forged',code='not-used')
    assert Auth(path).state['host_id']==a.state['host_id']
    with pytest.raises(HTTPException):a.callback(state,state,error='access_denied')
    with pytest.raises(HTTPException):a.callback(state,state,code='replayed')

def test_expiry_and_logout(tmp_path):
    a=Auth(tmp_path/'credentials.json')
    a.state['accounts']['a']={'client_id':'issued','subject':'u','email':'e','access_token':'x','expires_at':time.time()+600}
    a.state['sessions'][fingerprint('s')]={'account_id':'a','expires':time.time()+600}
    assert a.account('s')[0]=='a'
    a.logout('s')
    with pytest.raises(HTTPException):a.account('s')
    assert not a.state['accounts']['a'].get('access_token')

def test_tool_loop_selects_novel_query_and_preserves_context(analytics):
    calls=[]
    def fake_stream(account,payload):
        calls.append(payload)
        if len(calls)==1:return {'output':[{'type':'function_call','name':'query_gold','call_id':'q1','arguments':json.dumps({'dataset':'team_match','metrics':['carry_box_entries'],'group_by':['team_id'],'visualization':'bars','limit':32})}]}
        return {'output':[{'type':'message','content':[{'type':'output_text','text':'Verified tool result.'}]}]}
    previous=[{'question':'Compare team entries','answer':'Prior result','visualizations':[]}]
    with patch('app.agent.runtime.response_stream',fake_stream):
        result=DataAgent(analytics).answer({},'Now use carries',previous,'test-model')
    assert result['visualizations'][0]['query']['metrics']==['carry_box_entries']
    assert len(result['visualizations'][0]['rows'])==8
    assert calls[0]['input'][0]['content']=='Compare team entries'
    assert any(x.get('type')=='function_call_output' for x in calls[1]['input'])

def test_signed_identity_validation(tmp_path,monkeypatch):
    import jwt,httpx
    from cryptography.hazmat.primitives.asymmetric import rsa
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    jwk=json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(key.public_key()));jwk['kid']='one'
    actual=httpx.Client
    def transport(req):
        if 'openid-configuration' in str(req.url):return httpx.Response(200,json={'jwks_uri':'https://auth.openai.com/keys'})
        return httpx.Response(200,json={'keys':[jwk]})
    monkeypatch.setattr('app.agent.auth.httpx.Client',lambda **kwargs:actual(transport=httpx.MockTransport(transport),**kwargs))
    claims={'iss':'https://auth.openai.com','aud':'issued','sub':'subject','exp':time.time()+300,'iat':time.time(),'nonce':'nonce'}
    token=jwt.encode(claims,key,algorithm='RS256',headers={'kid':'one'})
    a=Auth(tmp_path/'auth.json')
    assert a.validate_id(token,'issued','nonce')['sub']=='subject'
    with pytest.raises(ValueError):a.validate_id(token,'issued','wrong')
    with pytest.raises(jwt.PyJWTError):a.validate_id(token,'other','nonce')

@pytest.mark.parametrize('events,success',[
    ([{'type':'response.output_text.delta','delta':'partial'}],False),
    ([{'type':'response.completed','response':{'output':[]}}],True),
    ([{'type':'response.failed','response':{'error':{'code':'subscription_sharing_usage_limit_exceeded'}}}],False),
])
def test_terminal_inference_required(monkeypatch,events,success):
    import httpx
    actual=httpx.Client
    def transport(req):
        payload=json.loads(req.content);assert payload['store'] is False and payload['stream'] is True
        return httpx.Response(200,text='\n\n'.join('data: '+json.dumps(e) for e in events)+'\n\n')
    monkeypatch.setattr('app.agent.runtime.httpx.Client',lambda **kw:actual(transport=httpx.MockTransport(transport),**kw))
    if success: assert response_stream({'access_token':'oauth'},{'model':'test'})=={'output':[]}
    else:
        with pytest.raises(HTTPException):response_stream({'access_token':'oauth'},{'model':'test'})

def test_messi_tournament_against_independent_actions(analytics):
    import math
    entities=analytics.entities()
    messi=next(p for p in entities['players'] if 'Messi' in p['player_name'])
    folder=ROOT/'data/gold/statsbomb/wc2022'/('v1-'+analytics.catalog['load_id'])
    shots=[r for s in (folder/'actions.jsonl').open() if (r:=json.loads(s))['player_id']==messi['player_id'] and r['type_name']=='Shot']
    result=analytics.query(Query(dataset='player_match',filters=[{'column':'player_id','value':messi['player_id']}],metrics=['shots','goals','xg','npxg']))['rows'][0]
    assert result['shots']==len(shots)
    assert result['goals']==sum(bool(s['is_goal']) for s in shots)
    assert result['xg']==pytest.approx(math.fsum(s['statsbomb_xg'] for s in shots))
    assert result['npxg']==pytest.approx(math.fsum(s['statsbomb_xg'] for s in shots if not s['is_penalty']))
    assert len({s['match_id'] for s in shots})==7
    filtered=analytics.query(Query(dataset='actions',filters=[{'column':'player_id','value':messi['player_id']},{'column':'type_name','value':'Shot'},{'column':'is_penalty','value':False}],metrics=['shots','xg']))['rows'][0]
    assert filtered['xg']==pytest.approx(result['npxg'])
    assert filtered['shots']==sum(not s['is_penalty'] for s in shots)

def test_messi_comparison_and_lineups_by_match(analytics):
    e=analytics.entities();messi=next(p for p in e['players'] if 'Messi' in p['player_name'])
    other=next(p for p in e['players'] if 'Mbappé' in p['player_name'])
    final=next(m for m in e['matches'] if m['stage_name']=='Final')
    scope=[{'column':'match_id','value':final['match_id']},{'column':'player_id','op':'in','value':[messi['player_id'],other['player_id']]}]
    result=analytics.query(Query(dataset='actions',filters=scope+[{'column':'type_name','value':'Shot'},{'column':'is_penalty','value':False}],group_by=['player_id'],metrics=['shots','goals','xg'],visualization='bars'))
    assert len(result['rows'])==2
    assert all(r['shots']>0 and r['xg']>0 for r in result['rows'])
    own=analytics.query(Query(dataset='initial_lineups',filters=[{'column':'match_id','value':final['match_id']},{'column':'team_id','value':messi['team_id']}],visualization='lineup'))
    opponent=analytics.query(Query(dataset='initial_lineups',filters=[{'column':'match_id','value':final['match_id']},{'column':'team_id','value':other['team_id']}],visualization='lineup'))
    assert len(own['rows'])==len(opponent['rows'])==1
    assert messi['player_id'] in [p['player']['id'] for p in own['rows'][0]['players']]
    assert other['player_id'] in [p['player']['id'] for p in opponent['rows'][0]['players']]
    assert len(own['rows'][0]['players'])==len(opponent['rows'][0]['players'])==11
    folder=ROOT/'data/gold/statsbomb/wc2022'/('v1-'+analytics.catalog['load_id'])
    raw_shots=[r for line in (folder/'actions.jsonl').open() if (r:=json.loads(line))['match_id']==final['match_id'] and r['type_name']=='Shot' and not r['is_penalty']]
    for row in result['rows']:
        selected=[r for r in raw_shots if r['player_id']==row['player_id']]
        assert row['shots']==len(selected)
        assert row['goals']==sum(bool(r['is_goal']) for r in selected)
        assert row['xg']==pytest.approx(sum(r['statsbomb_xg'] for r in selected))
    raw_lineups=[json.loads(line) for line in (folder/'initial_lineups.jsonl').open()]
    for visual in (own,opponent):
        row=visual['rows'][0]
        source=next(r for r in raw_lineups if r['match_id']==row['match_id'] and r['team_id']==row['team_id'])
        assert row['players']==source['players']
        assert row['formation_code']==source['formation_code']

def test_oauth_exchange_refresh_and_returning_registration(tmp_path,monkeypatch):
    import httpx
    actual=httpx.Client; grants=[]
    def transport(request):
        data=parse_qs(request.content.decode());grants.append(data)
        assert data['client_id']==['oaiapp_test']
        assert data['resource']==['https://api.openai.com/v1']
        if data['grant_type']==['authorization_code']:
            assert data['code_verifier'] and data['redirect_uri']
        return httpx.Response(200,json={'access_token':'new','refresh_token':'rotated','id_token':'signed-in-separate-test','expires_in':3600,'scope':'openid offline_access resource.invoke chatgpt.tokens.use.direct'})
    monkeypatch.setattr('app.agent.auth.httpx.Client',lambda **kw:actual(transport=httpx.MockTransport(transport),**kw))
    a=Auth(tmp_path/'auth.json')
    monkeypatch.setattr(a,'validate_id',lambda token,client,nonce:{'sub':'subject','email':'test@example.test'})
    url,state=a.start();session=a.callback(state,state,'code','oaiapp_test')
    key,account=a.account(session);assert account['client_id']=='oaiapp_test'
    a.state['accounts'][key]['expires_at']=time.time()-10
    assert a.account(session)[1]['refresh_token']=='rotated'
    assert grants[-1]['grant_type']==['refresh_token']
    assert 'scope' not in grants[-1]
    url,state=a.start(key);params=parse_qs(urlparse(url).query)
    assert params['client_id']==['oaiapp_test'] and 'agent_name_hint' not in params
    assert params['id_token_hint']==['signed-in-separate-test']
    with pytest.raises(HTTPException):a.callback(state,state,'code','other-client')

def test_api_authentication_and_origin_errors(tmp_path,monkeypatch):
    from fastapi.testclient import TestClient
    from app.main import app
    from app.agent import routes
    local=Auth(tmp_path/'credentials.json')
    monkeypatch.setattr(routes,'auth',lambda:local)
    with TestClient(app) as client:
        assert client.get('/api/auth/status').json()['authenticated'] is False
        assert client.post('/api/agent/chat',json={'question':'Compare Messi shots'}).status_code==401
        assert client.post('/api/auth/logout',json={},headers={'Origin':'https://untrusted.example'}).status_code==403
        assert client.get('/auth/callback?state=forged&code=not-used').status_code==400

def test_precomputed_heatmap_equals_raw_locations(analytics):
    e=analytics.entities();messi=next(p for p in e['players'] if 'Messi' in p['player_name'])
    q=Query(dataset='receipts',visualization='heatmap',filters=[{'column':'player_id','value':messi['player_id']}])
    r=analytics.query(q)
    assert r['precomputed_spatial']
    with analytics.connect() as con:
        raw=con.execute('SELECT location_x,location_y FROM receipts WHERE player_id=?',(messi['player_id'],)).fetchall()
    from collections import Counter
    expected=Counter((min(11,int(x/10)),min(7,int(y/10))) for x,y in raw if x is not None and y is not None and 0<=x<=120 and 0<=y<=80)
    assert {(r['bin_x'],r['bin_y']):r['count'] for r in r['rows']}==dict(expected)

def test_match_entity_search_accepts_multiple_names(analytics):
    rows=DataAgent(analytics).execute('find_entities',{'kind':'matches','search':'Argentina Netherlands'})['rows']
    assert len(rows)==1
    assert {'Argentina','Netherlands'}=={rows[0]['team_name'],rows[0]['opponent_name']}

def test_heatmap_orders_derived_counts(analytics):
    r=analytics.query(Query(dataset='receipts',visualization='heatmap',order_by='count',descending=True))
    counts=[row['count'] for row in r['rows']]
    assert counts==sorted(counts,reverse=True)

def test_nonfinite_filters_rejected():
    with pytest.raises(ValueError): Query(dataset='actions',filters=[{'column':'location_x','value':float('nan')}])
    with pytest.raises(ValueError): Query(dataset='actions',filters=[{'column':'location_x','op':'in','value':[float('inf')]}])

def test_function_contract_keeps_optional_query_defaults(analytics):
    tool=next(t for t in DataAgent(analytics).tools() if t['name']=='query_gold')
    assert tool['strict'] is False
    assert 'limit' not in tool['parameters']['required']
    # Arguments omitted by the model retain deterministic server defaults.
    result=DataAgent(analytics).execute('query_gold',{'dataset':'initial_lineups','visualization':'lineup','limit':2})
    assert len(result['rows'])==2
    assert {r['team_id'] for r in result['rows']}.__len__()==2

def test_event_listing_gets_its_map_and_audience_reaches_the_model(analytics):
    messi=next(p for p in analytics.entities()['players'] if 'Messi' in p['player_name'])
    assert messi['display_name']=='Lionel Messi'
    shots=[{'column':'player_id','value':messi['player_id']},{'column':'type_name','value':'Shot'}]
    calls=[]
    def fake_stream(account,payload):
        calls.append(payload)
        if len(calls)==1:return {'output':[{'type':'function_call','name':'query_gold','call_id':'q1','arguments':json.dumps({'dataset':'actions','filters':shots,'columns':['minute','outcome_name','xg'],'title':'Tiros de Messi','limit':100})}]}
        return {'output':[{'type':'message','content':[{'type':'output_text','text':'ok'}]}]}
    with patch('app.agent.runtime.response_stream',fake_stream):
        turn=DataAgent(analytics).answer({},'tiros de Messi',[],'test-model','simple')
    pitch,table=turn['visualizations']
    assert (pitch['visualization'],table['visualization'])==('pitch','table')
    assert pitch['query']['title']=='Tiros de Messi' and len(pitch['rows'])==len(table['rows'])==32
    assert all(r['location_x'] is not None and 'is_goal' in r and 'shot_type' in r for r in pitch['rows'])
    assert 'reader is a child' in calls[0]['instructions']
    assert any('also_shown_to_user' in x.get('output','') for x in calls[1]['input'] if x.get('type')=='function_call_output')
    agent=DataAgent(analytics)
    # Totals and datasets without locations keep their own form.
    assert agent.companion_map(analytics.query(Query(dataset='actions',filters=shots,metrics=['count'])))is None
    assert agent.companion_map(analytics.query(Query(dataset='player_match',filters=shots[:1])))is None
    with pytest.raises(Exception):Query(dataset='actions',title='x'*121)

def test_results_reach_the_model_with_names_and_networks_lead_with_the_strongest_link(analytics):
    e=analytics.entities();messi=next(p for p in e['players'] if 'Messi' in p['player_name'])
    final=next(m for m in e['matches'] if m['stage_name']=='Final')
    result=analytics.query(Query(dataset='connections',visualization='network',filters=[{'column':'match_id','value':final['match_id']},{'column':'player_id','value':messi['player_id']}]))
    counts=[r['pass_count'] for r in result['rows']]
    assert counts==sorted(counts,reverse=True) and len(counts)>3
    named=DataAgent(analytics).named(result)
    assert named['names']['players'][messi['player_id']]=='Lionel Messi'
    assert set(named['names']['players'])=={messi['player_id'],*(r['recipient_id'] for r in result['rows'])}
    assert named['names']['matches'][final['match_id']].endswith('Final, 2022-12-18')
    assert 'names' not in result



def test_lineup_story_every_player_has_a_position(analytics):
    for match_id in analytics.scope_matches:
        story = analytics.lineup_story(match_id)
        assert story['visualization'] == 'lineup_story' and len(story['rows']) == 2
        for team in story['rows']:
            assert team['steps'][0]['seconds'] == 0
            for step in team['steps']:
                assert len(step['players']) == 11
                assert all(p['position_id'] is not None for p in step['players'])
    final = analytics.lineup_story(max(analytics.scope_matches))
    argentina = next(t for t in final['rows'] if t['team_id'] == 779)
    acuna = next(s for s in argentina['steps'] if 19597 in s['entered'])
    assert acuna['seconds'] // 60 == 63 and next(p for p in acuna['players'] if p['player_id'] == 19597)['position_id'] == 21
    with pytest.raises(ValueError): analytics.lineup_story(1)

def test_langgraph_loop_repairs_tool_errors_and_bounds_steps(analytics):
    calls=[]
    def repairing(account,payload):
        calls.append(payload)
        if len(calls)==1:return {'output':[{'type':'function_call','name':'query_gold','call_id':'bad','arguments':json.dumps({'dataset':'not_a_dataset'})}]}
        if len(calls)==2:return {'output':[{'type':'function_call','name':'find_entities','call_id':'ok','arguments':json.dumps({'kind':'teams','search':'Argentina'})}]}
        return {'output':[{'type':'message','content':[{'type':'output_text','text':'Reparado.'}]}]}
    with patch('app.agent.runtime.response_stream',repairing):
        turn=DataAgent(analytics).answer({},'equipos',[],'test-model')
    assert turn['answer']=='Reparado.' and len(calls)==3
    assert [t['ok'] for t in turn['trace']]==[False,True]
    assert 'error' in json.loads(next(x for x in calls[1]['input'] if x.get('call_id')=='bad' and x.get('type')=='function_call_output')['output'])
    # The graph keeps every earlier item of the turn in the model input.
    assert sum(x.get('type')=='function_call_output' for x in calls[2]['input'])==2

    looping=[]
    def endless(account,payload):
        looping.append(payload)
        return {'output':[{'type':'function_call','name':'find_entities','call_id':f'c{len(looping)}','arguments':json.dumps({'kind':'teams','search':''})}]}
    with patch('app.agent.runtime.response_stream',endless), pytest.raises(HTTPException) as exc:
        DataAgent(analytics).answer({},'sin fin',[],'test-model')
    # Lookups alone never earn more room: the base budget stops the loop.
    assert exc.value.status_code==422 and len(looping)==BASE_STEPS

    # Each chart produced extends the budget, up to the hard cap.
    charting=[]
    def charts(account,payload):
        charting.append(payload)
        return {'output':[{'type':'function_call','name':'query_gold','call_id':f'q{len(charting)}','arguments':json.dumps({'dataset':'team_match','metrics':['shots'],'group_by':['team_id'],'visualization':'bars','limit':8})}]}
    with patch('app.agent.runtime.response_stream',charts), pytest.raises(HTTPException) as exc:
        DataAgent(analytics).answer({},'muchos gráficos',[],'test-model')
    assert exc.value.status_code==422 and len(charting)==MAX_STEPS
    assert [DataAgent.budget(n) for n in (0,1,4,99)]==[BASE_STEPS,BASE_STEPS+STEPS_PER_CHART,BASE_STEPS+4*STEPS_PER_CHART,MAX_STEPS]

    with patch('app.agent.runtime.response_stream',lambda a,p:{'output':[{'type':'message','content':[]}]}), pytest.raises(HTTPException) as exc:
        DataAgent(analytics).answer({},'vacío',[],'test-model')
    assert exc.value.status_code==502
