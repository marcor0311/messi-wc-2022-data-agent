"""Generate Messi-centered demo questions by executing their actual Gold queries.
Query verification is deterministic; live model routing is reported separately.
"""
import argparse
import json
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'apps/api/src'))
from app.agent.analytics import Analytics,Query,VIEWS

def generate(output_dir=ROOT/'docs'):
    a=Analytics();e=a.entities();messi=next(p for p in e['players'] if 'Messi' in p['player_name'])
    ranked=a.query(Query(dataset='player_match',group_by=['player_id'],metrics=['shots'],order_by='shots',limit=20))['rows']
    compare_id=next(r['player_id'] for r in ranked if r['player_id']!=messi['player_id'])
    compare=next(p for p in e['players'] if p['player_id']==compare_id)
    with a.connect() as con:
        games=[dict(r) for r in con.execute('SELECT match_id,team_name,opponent_name,match_date FROM team_match WHERE team_id=? ORDER BY match_date',(messi['team_id'],))]
    final=games[-1];mid=final['match_id'];pid=messi['player_id'];tid=messi['team_id'];name=messi['player_name'];other=compare['player_name']
    player=[{'column':'player_id','value':pid}];match=[{'column':'match_id','value':mid}];team=[{'column':'team_id','value':tid}]
    cases=[]
    def add(question,dataset,view='table',filters=None,**kw):
        q=Query(dataset=dataset,visualization=view,filters=filters or [],**kw)
        result=a.query(q)
        if not result['rows']: raise ValueError('Demo query has no records: '+question)
        cases.append({'question':question,'query':q.model_dump(),'verified_rows':len(result['rows']),
                      'source_rows':result['matched_source_rows'],'truncated':result['truncated'],'provenance':result['provenance']})
    add(f'¿Cuántos tiros, goles, xG y npxG sumó {name} en el torneo?','player_match',filters=player,metrics=['shots','goals','xg','npxg'])
    add(f'Compara los tiros y npxG de {name} y {other} en el torneo.','player_match','bars',[{'column':'player_id','op':'in','value':[pid,compare_id]}],group_by=['player_id'],metrics=['shots','npxg'])
    add(f'¿Cómo evolucionó el xG de {name} partido a partido?','player_match','trend',player,group_by=['match_id'],metrics=['xg','npxg'],order_by='match_id',descending=False)
    add(f'Muestra los tiros de {name} en la final con sus destinos registrados.','actions','pitch',player+match+[{'column':'type_name','value':'Shot'}])
    add(f'Quita los penales de los tiros de {name} en la final.','actions','pitch',player+match+[{'column':'type_name','value':'Shot'},{'column':'is_penalty','value':False}])
    add(f'Compara los tiros sin penal de {name} y {other} en la final.','actions','bars',match+[{'column':'player_id','op':'in','value':[pid,compare_id]},{'column':'type_name','value':'Shot'},{'column':'is_penalty','value':False}],group_by=['player_id'],metrics=['shots','goals','xg'])
    add(f'Muestra la densidad de las recepciones de {name} durante el torneo.','receipts','heatmap',player)
    add(f'¿Dónde recibió {name} en la final?','receipts','pitch',player+match)
    add(f'¿Con qué compañeros conectó pases {name} en la final?','connections','network',player+match)
    add(f'Muestra el once declarado de Argentina en la final.','initial_lineups','lineup',team+match)
    opponent=next(m for m in e['matches'] if m['match_id']==mid)
    rival=next(t for t in e['teams'] if t['team_name'] in [opponent['team_name'],opponent['opponent_name']] and t['team_id']!=tid)
    add(f'Compara ese once con el de {rival["team_name"]} en la misma final.','initial_lineups','lineup',match+[{'column':'team_id','value':rival['team_id']}])
    add(f'Muestra los dos onces de la final de Argentina, para comparar el contexto táctico de {name}.','initial_lineups','lineup',match)
    add(f'Ordena cronológicamente los tiros de {name} en la final.','actions','pitch',player+match+[{'column':'type_name','value':'Shot'}],order_by='event_index',descending=False)
    add(f'Muestra los pases de {name} en la primera parte de la final.','actions','pitch',player+match+[{'column':'type_name','value':'Pass'},{'column':'period','value':1}])
    add(f'¿Cómo cambió la creación de tiros de {name} por partido?','player_match','trend',player,group_by=['match_id'],metrics=['shots_created','xg_assisted'],order_by='match_id',descending=False)
    add(f'¿Qué pases de {name} estuvieron vinculados a tiros durante el torneo?','shot_creations',filters=[{'column':'creator_id','value':pid}],columns=['match_id','pass_event_id','shot_event_id','shooter_id','statsbomb_xg'])
    add(f'Compara la precisión bajo presión de {name} y {other}.','player_match','bars',[{'column':'player_id','op':'in','value':[pid,compare_id]}],group_by=['player_id'],metrics=['pressure_pass_completion_pct','passes_under_pressure'])
    add(f'¿Cuántas entradas al área por pase y conducción hizo {name}?','player_match','bars',player,metrics=['pass_box_entries','carry_box_entries'])
    add(f'¿Dónde realizó conducciones {name} en la final?','actions','heatmap',player+match+[{'column':'type_name','value':'Carry'}])
    add(f'¿Qué conexiones de pase hacia {name} aparecen en el torneo?','connections','table',[{'column':'recipient_id','value':pid}],order_by='pass_count',limit=30)
    add(f'¿Qué cambios de alineación realizó Argentina en la final?','lineup_changes',filters=team+match)
    add(f'Muestra los segmentos tácticos declarados de Argentina en la final.','lineup_segments',filters=team+match)
    add(f'¿Cómo se distribuyó la actividad de {name} por segmento táctico?','segment_player_metrics',filters=player,group_by=['segment_id','player_id'],metrics=['shots','passes','npxg'])
    add(f'¿Qué acciones de tanda de {name} están registradas?','shootout_actions',filters=player)
    add(f'Compara recuperaciones, presiones y regates de {name} por partido.','player_match','bars',player,group_by=['match_id'],metrics=['successful_recoveries','pressures','complete_dribbles'])
    add(f'¿Cómo evolucionaron los tiros de Argentina a lo largo del Mundial de {name}?','team_match','trend',team,group_by=['match_id'],metrics=['shots','xg'],order_by='match_id',descending=False)
    add(f'¿Cómo fue la precisión de pase de {name} en cada período de la final?','actions','bars',player+match,group_by=['period'],metrics=['pass_completion_pct','passes'],order_by='period',descending=False)
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir/'GOLD_ENTITIES.json').write_text(json.dumps(e,ensure_ascii=False,indent=2)+'\n')
    # This JSON is a regenerable test manifest, not production question routing.
    (output_dir/'DEMO_SCENARIOS.json').write_text(json.dumps(cases,ensure_ascii=False,indent=2)+'\n')
    lines=['# Demo: el Mundial de Messi','',f'Gold `{a.catalog["load_id"]}`. {len(e["matches"])} partidos, {len(e["teams"])} selecciones y {len(e["players"])} jugadores.',
           '',f'Protagonista: **{name}** (player_id {pid}); comparador descubierto por volumen de tiros: **{other}** ({compare_id}).',
           '', '**Estado de verificación:** todas las consultas de esta guía se ejecutaron contra Gold. Esto verifica herramientas y datos; por sí solo no certifica que un modelo autenticado seleccione esas consultas. La inferencia y la conversación con cuenta real se verifican por separado; sus fechas, modelos y límites están en [VERIFICATION.md](VERIFICATION.md).',
           '', '## Visualizaciones implementadas','', '| Vista | Qué muestra | Gold |','|---|---|---|']
    for k,v in VIEWS.items():lines.append(f'| {k} | {v["description"]} | {v["datasets"]} |')
    lines+=['','## Preguntas y consultas verificadas','']
    for i,c in enumerate(cases,1):
        lines += [f'{i}. **{c["question"]}** — `{c["query"]["visualization"]}` / `{c["query"]["dataset"]}`. {c["verified_rows"]} filas devueltas de {c["source_rows"]} filas de origen'+(' (resultado limitado).' if c['truncated'] else '.'), '']
    lines+=['## Partidos de Messi','']+[f'- {g["match_date"]}: {g["team_name"]} vs {g["opponent_name"]} (`{g["match_id"]}`).' for g in games]
    lines+=['','## Entidades, métricas y filtros','',
            'El inventario completo de jugadores, selecciones y partidos está en [GOLD_ENTITIES.json](GOLD_ENTITIES.json), y se sirve en `/api/agent/catalog`.',
            'Todas las columnas, valores categóricos, rangos, coordenadas, métricas y definiciones están en [GOLD_CATALOG.json](GOLD_CATALOG.json).',
            'Filtros admitidos: eq, ne, in (1–100 valores), gte, lte, contains, is_null; se combinan con AND. Hasta 4 dimensiones, 10 métricas y 500 filas. Las columnas se validan por dataset. Las ratios se recalculan desde sumas; no se promedian porcentajes.',
            'Los contratos y consultas reproducibles de cada pregunta están en [DEMO_SCENARIOS.json](DEMO_SCENARIOS.json). Son evidencia de prueba, no respuestas o rutas predefinidas del agente.',
            '', '## Límites','']+['- '+s for s in a.catalog['limitations']]+[
            '- Las alineaciones se comparan de dos en dos en canchas identificadas; las posiciones son esquemáticas.',
            '- Una red usa medias de ubicaciones de pases, no posiciones de seguimiento.',
            '- El modelo explica estadísticas verificadas, pero sus textos requieren revisión; no hay garantía de ausencia de errores del LLM.',
            '- El servicio está diseñado para uso local en loopback y un proceso de API. No es una instalación pública multiusuario.',
            '- Sin autenticar, la pestaña Explorar datos muestra el catálogo; las consultas públicas están en /api/agent/query. No hay fallback de API keys ni de intenciones simuladas en /agent.']
    (output_dir/'DEMO_CHEAT_SHEET.md').write_text('\n'.join(lines)+'\n')
    print(f'Executed {len(cases)} Messi-centered scenarios; generated cheat sheet and full entity inventory.')

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir',type=Path,default=ROOT/'docs')
    generate(parser.parse_args().output_dir)
