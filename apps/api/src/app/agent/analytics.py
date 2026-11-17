"""Bounded, parameterized analytical tools. No model SQL or executable code."""
import hashlib
import json
import os
import sqlite3
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from app.db.gold import ROOT, GoldUnavailable, digest

VIEWS = {
    'table': {'label': 'Cifras y tabla', 'datasets': '*', 'description': 'Cifras exactas: un total se muestra como tarjetas, un listado como tabla.'},
    'bars': {'label': 'Comparación', 'datasets': ['player_match','team_match','segment_player_metrics','actions'], 'description': 'Compara jugadores, selecciones, partidos o períodos; cada métrica en su propio panel.'},
    'trend': {'label': 'Evolución por partido', 'datasets': ['player_match','team_match'], 'description': 'Cómo cambia una métrica partido a partido, en orden cronológico.'},
    'pitch': {'label': 'Mapa de eventos', 'datasets': ['actions','receipts'], 'description': 'Dónde ocurrió cada acción registrada y hacia dónde fue. No es seguimiento continuo.'},
    'heatmap': {'label': 'Zonas de actividad', 'datasets': ['actions','receipts'], 'description': 'Cuántas acciones ocurrieron en cada zona de la cancha (12 × 8). Cuenta eventos, no tiempo.'},
    'network': {'label': 'Red de pases', 'datasets': ['connections'], 'description': 'Quién le pasó a quién: pases completados entre jugadores, en su ubicación promedio.'},
    'lineup': {'label': 'Once inicial', 'datasets': ['initial_lineups'], 'description': 'Formación y posiciones declaradas, en un esquema. No son ubicaciones medidas.'},
    'timeline': {'label': 'Cronología', 'datasets': ['actions'], 'description': 'Acciones registradas en el orden en que ocurrieron.'},
}
RATIOS = {'pass_completion_pct': ('completed_passes','known_passes',100),
          'pressure_pass_completion_pct': ('completed_passes_under_pressure','known_passes_under_pressure',100),
          'dribble_success_pct': ('complete_dribbles','known_dribbles',100),
          'xg_per_shot': ('xg','shots',1), 'npxg_per_non_penalty_shot': ('npxg','non_penalty_shots',1)}

class Filter(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    column: str
    op: Literal['eq','ne','in','gte','lte','contains','is_null'] = 'eq'
    value: str | int | float | bool | list[str | int | float] | None = None

class Query(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    dataset: str
    filters: list[Filter] = Field(default_factory=list, max_length=16)
    columns: list[str] = Field(default_factory=list, max_length=20)
    group_by: list[str] = Field(default_factory=list, max_length=4)
    metrics: list[str] = Field(default_factory=list, max_length=10)
    visualization: Literal['table','bars','trend','pitch','heatmap','network','lineup','timeline'] = 'table'
    title: str | None = Field(default=None, max_length=120, description='Short human title for the visualization, in the user language. No IDs or column names.')
    order_by: str | None = None
    descending: bool = True
    limit: int = Field(default=100, ge=1, le=500)

class Analytics:
    def __init__(self, path=None):
        self.path = Path(path or os.environ.get('AGENT_GOLD_DB', ROOT / 'data/agent/gold.sqlite3'))
        try:
            cache=json.loads(self.path.with_suffix('.manifest.json').read_text())
            if cache['cache_version']!=2 or digest(self.path)!=cache['sha256']:
                raise ValueError('Cache checksum/version mismatch')
        except (OSError,ValueError,KeyError) as exc:
            raise GoldUnavailable('Cache ausente, corrupta o desactualizada. Ejecuta scripts/discover_gold.py.') from exc
        with self.connect() as con:
            self.catalog = json.loads(con.execute('SELECT catalog FROM metadata').fetchone()[0])
        self.datasets = self.catalog['datasets']
        self.metrics = self.catalog['metrics']
        self.nicknames = self._nicknames()

    def connect(self):
        if not self.path.is_file():
            raise GoldUnavailable('Ejecuta .venv/bin/python scripts/discover_gold.py antes de iniciar el agente.')
        con = sqlite3.connect(f'file:{self.path}?mode=ro', uri=True)
        con.row_factory = sqlite3.Row
        # Bound arbitrary combinations, even though SQL itself is controlled.
        budget = [0]
        def progress():
            budget[0] += 1
            return int(budget[0] > 10000)
        con.set_progress_handler(progress, 1000)
        return con

    def _nicknames(self):
        # Display names only: Gold keeps full legal names, the Silver roster keeps the provider's short names.
        files = sorted((ROOT / 'data/silver/statsbomb/wc2022-lineups').glob('*/players.jsonl'), key=lambda f: f.stat().st_mtime_ns)
        if not files: return {}
        rows = (json.loads(line) for line in files[-1].open())
        return {r['player_id']: r['nicknames'][0] for r in rows if r.get('nicknames')}

    def entities(self):
        with self.connect() as con:
            players = [dict(r) for r in con.execute('SELECT DISTINCT player_id, player_name, team_id FROM player_match ORDER BY player_name')]
            teams = [dict(r) for r in con.execute('SELECT DISTINCT team_id, team_name FROM team_match ORDER BY team_name')]
            matches = [dict(r) for r in con.execute('SELECT match_id,team_id,team_name,opponent_id,opponent_name,match_date,stage_name FROM team_match WHERE is_home=1 ORDER BY match_date,match_id')]
        for p in players: p['display_name'] = self.nicknames.get(p['player_id'], p['player_name'])
        return {'players': players, 'teams': teams, 'matches': matches}

    def describe(self, dataset=None):
        if dataset:
            if dataset not in self.datasets:
                raise ValueError('Dataset desconocido')
            return self.datasets[dataset]
        return {k:{'rows':v['rows'], 'columns':list(v['columns'])} for k,v in self.datasets.items()}

    def query(self, request: Query):
        q = request
        if q.dataset not in self.datasets:
            raise ValueError('Dataset desconocido')
        schema = self.datasets[q.dataset]['columns']
        def col(name):
            if name not in schema:
                raise ValueError(f'Columna desconocida: {name}')
            return '"' + name + '"'
        if q.columns and q.visualization!='table':
            raise ValueError('Las vistas visuales usan un contrato fijo; columns solo se admite en table')
        allowed = VIEWS[q.visualization]['datasets']
        if allowed != '*' and q.dataset not in allowed:
            raise ValueError('Visualización incompatible con el dataset')
        if q.visualization=='trend' and q.group_by!=['match_id']:
            raise ValueError('Las tendencias requieren agrupar solo por match_id; compara entidades con consultas separadas')
        if q.group_by and not q.metrics:
            raise ValueError('Agrupar requiere métricas')
        where, params = [], []
        for f in q.filters:
            c = col(f.column)
            if f.op == 'in':
                if not isinstance(f.value, list) or not 1 <= len(f.value) <= 100:
                    raise ValueError('Filtro in requiere entre 1 y 100 valores')
                where.append(c + ' IN (' + ','.join('?' for _ in f.value) + ')'); params.extend(f.value)
            elif f.op == 'is_null':
                where.append(c + (' IS NULL' if f.value is not False else ' IS NOT NULL'))
            else:
                if isinstance(f.value, list) or f.value is None:
                    raise ValueError('Filtro requiere un valor escalar')
                op = {'eq':'=', 'ne':'!=','gte':'>=','lte':'<=','contains':'LIKE'}[f.op]
                where.append(c + ' ' + op + ' ?')
                params.append('%' + str(f.value).replace('\\','\\\\').replace('%','\\%').replace('_','\\_') + '%' if f.op == 'contains' else f.value)
                if f.op == 'contains': where[-1] += " ESCAPE '\\'"
        cached_spatial=False
        base = ' FROM "' + q.dataset + '"' + (' WHERE ' + ' AND '.join(where) if where else '')
        if q.visualization == 'heatmap':
            if q.metrics or q.group_by: raise ValueError('Heatmap cuenta eventos; no admite métricas agregadas')
            x,y=col('location_x'),col('location_y')
            base += (' AND ' if where else ' WHERE ') + f'{x} BETWEEN 0 AND 120 AND {y} BETWEEN 0 AND 80'
            select = f'MIN(11,CAST({x}/10 AS INTEGER)) AS bin_x, MIN(7,CAST({y}/10 AS INTEGER)) AS bin_y, COUNT(*) AS count'
            group = ' GROUP BY bin_x,bin_y'
            dimensions={'match_id','team_id','player_id','type_name','period'} if q.dataset=='actions' else {'match_id','team_id','player_id'}
            if self.catalog.get('cache_version')==2 and all(f.column in dimensions for f in q.filters):
                base=' FROM "_heatmap_' + q.dataset + '"' + (' WHERE ' + ' AND '.join(where) if where else '')
                select='bin_x,bin_y,SUM(event_count) AS count'
                cached_spatial=True
        elif q.metrics:
            expressions = [col(k) for k in q.group_by]
            additive = self.metrics['additive']
            for m in q.metrics:
                if m == 'count': expr = 'COUNT(*)'
                elif m in RATIOS:
                    n,d,factor = RATIOS[m]
                    numerator = f'COALESCE({col(n)},0)' if q.dataset=='actions' else col(n)
                    denominator = f'COALESCE({col(d)},0)' if q.dataset=='actions' else col(d)
                    expr = f'{factor}*1.0*SUM({numerator})/NULLIF(SUM({denominator}),0)'
                elif m in additive or m in ('pass_count','statsbomb_xg'):
                    if m in ('shot_involvements','xg_involved') and q.dataset in ('player_match','segment_player_metrics') and 'player_id' not in q.group_by and not any(f.column=='player_id' and f.op=='eq' for f in q.filters):
                        raise ValueError('Participación directa no es aditiva entre jugadores. Agrupa o filtra un jugador.')
                    c = col(m)
                    expr = f'COALESCE(SUM({c}),0)' if q.dataset=='actions' and m in additive else f'CASE WHEN COUNT({c})=COUNT(*) THEN SUM({c}) ELSE NULL END'
                else: raise ValueError(f'Métrica no aditiva o desconocida: {m}')
                expressions.append(expr + ' AS "' + m + '"')
            select = ','.join(expressions)
            group = ' GROUP BY ' + ','.join(col(k) for k in q.group_by) if q.group_by else ''
        else:
            if q.visualization in ('bars','trend'): raise ValueError('Comparación y evolución requieren métricas')
            defaults = {
                'pitch': ['event_id','match_id','team_id','player_id','recipient_id','location_x','location_y','end_x','end_y','type_name','period','minute','second','statsbomb_xg','outcome_name','shot_type','is_goal','is_penalty','is_complete'],
                'network': ['match_id','team_id','player_id','recipient_id','pass_count','mean_start_x','mean_start_y','mean_end_x','mean_end_y'],
                'lineup': ['match_id','team_id','formation_code','players'],
                'timeline': ['match_id','event_id','period','event_index','minute','second','player_id','team_id','type_name','outcome_name','shot_type','is_goal','statsbomb_xg'],
            }
            selected = q.columns or [k for k in defaults.get(q.visualization,list(schema)[:14]) if k in schema]
            select = ','.join(col(k) for k in selected)
            group = ''
        if q.metrics and q.visualization in ('pitch','network','lineup','timeline'):
            raise ValueError('La vista necesita filas sin agregar')
        order = ''
        if q.order_by:
            valid = {'bin_x','bin_y','count'} if q.visualization=='heatmap' else set(q.group_by + q.metrics) if q.metrics else set(schema)
            if q.order_by not in valid: raise ValueError('Orden inválido')
            order = ' ORDER BY "' + q.order_by + '"' + (' DESC' if q.descending else ' ASC')
        elif q.visualization == 'timeline': order = ' ORDER BY match_id,period,event_index'
        elif q.visualization == 'network': order = ' ORDER BY pass_count DESC'
        sql = 'SELECT ' + select + base + group + order + ' LIMIT ?'
        with self.connect() as con:
            total = con.execute(('SELECT COALESCE(SUM(event_count),0)' if cached_spatial else 'SELECT COUNT(*)') + base, params).fetchone()[0]
            rows = [dict(r) for r in con.execute(sql, [*params,q.limit+1])]
        for row in rows:
            for k,v in row.items():
                if isinstance(v,str) and schema.get(k,{}).get('types') in (['list'],['dict']):
                    row[k] = json.loads(v)
        return {'visualization':q.visualization, 'rows':rows[:q.limit], 'truncated':len(rows)>q.limit,
                'matched_source_rows':total, 'precomputed_spatial':cached_spatial, 'query':q.model_dump(),
                'provenance': {'gold_load_id':self.catalog['load_id'], 'dataset':q.dataset,
                               'source_sha256':self.datasets[q.dataset]['sha256'],
                               'query_sha256':hashlib.sha256(json.dumps(q.model_dump(),sort_keys=True).encode()).hexdigest()},
                'limitations':self.catalog['limitations']}
