'use client';
import MatchResult,{type MatchSummary} from './match-result';
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

export type Cell = string | number | boolean | null | Record<string, unknown> | unknown[];
export type DataRow = Record<string, Cell>;
export type GoldQuery = {dataset:string; visualization:string; title?:string|null; filters:{column:string;op:string;value:unknown}[];metrics?:string[];group_by?:string[];columns?:string[];limit?:number;order_by?:string;descending?:boolean};
export type GoldResult = {visualization:string;rows:DataRow[];truncated:boolean;matched_source_rows:number;query:GoldQuery;provenance:{gold_load_id:string;dataset:string;source_sha256:string;query_sha256:string};limitations:string[]};
export type Entities = {
  players:{player_id:number;player_name:string;display_name?:string;team_id:number}[];
  teams:{team_id:number;team_name:string}[];
  matches:{match_id:number;team_id:number;team_name:string;opponent_id:number;opponent_name:string;match_date:string;stage_name:string}[];
};
type MetricInfo = {label?:string;definition?:string;unit?:string;numerator?:string;denominator?:string};
export type VisualCatalog = {
  entities:Entities;
  metrics:{additive?:Record<string,MetricInfo>;ratios?:Record<string,MetricInfo>};
  views:Record<string,{label:string;description:string;datasets:string[]|string}>;
};
type Props = {result:GoldResult;catalog:VisualCatalog};

/* ---------- Presentation vocabulary: Gold keeps provider (English) values; the interface speaks Spanish. ---------- */
const TEAM_ES:Record<string,string>={Belgium:'Bélgica',Brazil:'Brasil',Cameroon:'Camerún',Canada:'Canadá',Croatia:'Croacia',Denmark:'Dinamarca',England:'Inglaterra',France:'Francia',Germany:'Alemania',Iran:'Irán',Japan:'Japón',Mexico:'México',Morocco:'Marruecos',Netherlands:'Países Bajos',Poland:'Polonia',Qatar:'Catar','Saudi Arabia':'Arabia Saudita','South Korea':'Corea del Sur',Spain:'España',Switzerland:'Suiza',Tunisia:'Túnez','United States':'Estados Unidos',Wales:'Gales'};
const VALUE_ES:Record<string,string>={'Right Foot':'Pie derecho','Left Foot':'Pie izquierdo',Head:'Cabeza',Normal:'Normal',Volley:'Volea','Half Volley':'Media volea',Lob:'Vaselina',Backheel:'Taco','Diving Header':'Cabezazo en palomita','Overhead Kick':'Chilena',Shot:'Tiro',Pass:'Pase',Carry:'Conducción',Dribble:'Regate',Pressure:'Presión','Ball Receipt*':'Recepción','Ball Recovery':'Recuperación',Duel:'Duelo',Clearance:'Despeje',Block:'Bloqueo','Foul Committed':'Falta cometida','Foul Won':'Falta recibida',Miscontrol:'Mal control',Dispossessed:'Pérdida',Interception:'Intercepción','Goal Keeper':'Acción de arquero',Substitution:'Cambio',Offside:'Fuera de juego',
  Goal:'Gol',Saved:'Atajado','Off T':'Fuera',Blocked:'Bloqueado',Post:'Al poste',Wayward:'Desviado','Saved to Post':'Atajado al poste','Saved Off Target':'Atajado, iba fuera',Complete:'Completo',Incomplete:'Incompleto',Out:'Fuera del campo',Unknown:'Desconocido','Pass Offside':'Pase en fuera de juego',
  'Open Play':'Juego abierto','Free Kick':'Tiro libre',Penalty:'Penal',Corner:'Córner','Regular Play':'Juego corrido','From Throw In':'Tras saque de banda','From Free Kick':'Tras tiro libre','From Goal Kick':'Tras saque de arco','From Corner':'Tras córner','From Keeper':'Desde el arquero','From Kick Off':'Tras saque inicial','From Counter':'Contraataque',Other:'Otra',
  'Group Stage':'Fase de grupos','Round of 16':'Octavos de final','Quarter-finals':'Cuartos de final','Semi-finals':'Semifinal','3rd Place Final':'Tercer puesto',Final:'Final'};
const COLUMN_ES:Record<string,string>={match_id:'Partido',team_id:'Selección',opponent_id:'Rival',player_id:'Jugador',recipient_id:'Receptor',passer_id:'Pasador',creator_id:'Creador',shooter_id:'Rematador',team_name:'Selección',opponent_name:'Rival',player_name:'Jugador',stage_name:'Fase',match_date:'Fecha',minute:'Minuto',second:'Segundo',period:'Período',type_name:'Acción',outcome_name:'Resultado',shot_type:'Tipo de tiro',play_pattern_name:'Jugada',statsbomb_xg:'xG',end_z:'Altura destino',body_part_name:'Parte del cuerpo',technique_name:'Técnica',pass_count:'Pases',count:'Cantidad',location_x:'Origen x',location_y:'Origen y',end_x:'Destino x',end_y:'Destino y',formation_code:'Formación',event_index:'Orden',event_id:'Evento',is_goal:'Gol',is_penalty:'Penal',is_complete:'Completo',under_pressure:'Bajo presión',bin_x:'Zona x',bin_y:'Zona y',goals_for:'Goles a favor',goals_against:'Goles en contra',is_starter:'Titular',
  goals:'Goles',xg:'Goles esperados (xG)',npxg:'xG sin penales',assists:'Asistencias'};
const DATASET_ES:Record<string,string>={argentina_matches:'Partidos de Argentina',actions:'Acciones de partido',receipts:'Recepciones',connections:'Conexiones de pase',initial_lineups:'Alineaciones iniciales',player_match:'Jugador por partido',team_match:'Selección por partido',shot_creations:'Creación de tiros',lineup_changes:'Cambios de alineación',lineup_segments:'Tramos tácticos',segment_player_metrics:'Jugador por tramo',shootout_actions:'Tandas de penales'};
const PLAYER_KEYS=['player_id','recipient_id','passer_id','creator_id','shooter_id'];
const PERIOD_ES:Record<number,string>={1:'1.er tiempo',2:'2.º tiempo',3:'Prórroga (1.ª parte)',4:'Prórroga (2.ª parte)',5:'Tanda de penales'};

/* ---------- Colour: validated with dataviz validate_palette (all pairs) on each surface. Messi is always gold. ---------- */
type Palette={focus:string;series:string[];other:string};
// Action types on the dark pitch: distinct hues, focus amber first.
const TYPE_COLORS=['#c98500','#3987e5','#d55181','#2ea38f','#9b7be0','#e0703a','#cfd8d6'];
// Messi in Argentina's sky blue; rivals in warm hues so they never read as Argentina.
const ON_PITCH:Palette={focus:'#75aadb',series:['#e9a23b','#d55181'],other:'#9fb3b6'};
const ON_CARD:Palette={focus:'#3f86c4',series:['#c27a00','#c2457a'],other:'#8a9a9c'};
const PITCH_INK='#edf8fb', PITCH_SURFACE='#102e36';

/* ---------- Formatting and naming ---------- */
const nf=(digits:number)=>new Intl.NumberFormat('es',{maximumFractionDigits:digits});
const num=(v:Cell|undefined):number|null=>typeof v==='number'&&Number.isFinite(v)?v:null;
const truthy=(v:Cell|undefined)=>v===true||v===1;
export const teamName=(name:string)=>TEAM_ES[name]??name;
export const focusPlayer=(entities:Entities)=>entities.players.find(p=>p.player_name.includes('Messi'));
export const playerName=(id:Cell|undefined,entities:Entities)=>{const p=entities.players.find(p=>p.player_id===id);return p?(p.display_name||p.player_name):format(id);};
const surname=(name:string)=>name.split(' ').slice(1).join(' ')||name;
export const format=(v:Cell|undefined):string=>v===null||v===undefined?'Sin dato':typeof v==='number'?nf(3).format(v):typeof v==='boolean'?(v?'Sí':'No'):typeof v==='object'?JSON.stringify(v):String(v);
function formatMetric(key:string,v:Cell|undefined){
  if(typeof v!=='number')return format(v);
  if(key.endsWith('_pct'))return nf(1).format(v)+' %';
  return Number.isInteger(v)?nf(0).format(v):nf(2).format(v);
}
const metricInfo=(key:string,c:VisualCatalog)=>c.metrics.additive?.[key]??c.metrics.ratios?.[key];
const metricLabel=(key:string,c:VisualCatalog)=>COLUMN_ES[key]??metricInfo(key,c)?.label??key;
function metricDefinition(key:string,c:VisualCatalog){
  const info=metricInfo(key,c);
  if(info?.definition)return info.definition;
  return info?.numerator?`${metricLabel(info.numerator,c)} dividido entre ${metricLabel(info.denominator||'',c).toLowerCase()}.`:undefined;
}
const shortDate=(iso:string)=>new Date(iso+'T00:00:00Z').toLocaleDateString('es',{day:'numeric',month:'short',timeZone:'UTC'});
function matchLabel(id:Cell|undefined,entities:Entities,perspective?:number,short=false){
  const m=entities.matches.find(m=>m.match_id===id);
  if(!m)return format(id);
  const rival=perspective===m.team_id?m.opponent_name:perspective===m.opponent_id?m.team_name:null;
  if(short&&rival)return teamName(rival);
  const teams=rival?`vs ${teamName(rival)}`:`${teamName(m.team_name)} – ${teamName(m.opponent_name)}`;
  return short?teams:`${teams}, ${VALUE_ES[m.stage_name]??m.stage_name}, ${shortDate(m.match_date)}`;
}
export function label(key:string,value:Cell|undefined,c:VisualCatalog,perspective?:number):string{
  if(value===null||value===undefined)return 'Sin dato';
  if(PLAYER_KEYS.includes(key))return playerName(value,c.entities);
  if(key==='team_id'||key==='opponent_id'||key==='possession_team_id'){const t=c.entities.teams.find(t=>t.team_id===value);return t?teamName(t.team_name):format(value);}
  if(key==='match_id')return matchLabel(value,c.entities,perspective);
  if(key==='period'&&typeof value==='number')return PERIOD_ES[value]??format(value);
  if(key==='match_date'&&typeof value==='string')return shortDate(value);
  if(typeof value==='string')return key.endsWith('_name')&&TEAM_ES[value]?TEAM_ES[value]:VALUE_ES[value]??value;
  if(typeof value==='number'&&(key.startsWith('is_')||key==='under_pressure'))return value?'Sí':'No';
  if(typeof value==='number'&&(metricInfo(key,c)||key==='statsbomb_xg'||key==='count'))return formatMetric(key,value);
  return format(value);
}
/** The team whose point of view a result takes, so a match can read "vs Francia". */
function perspectiveTeam(result:GoldResult,entities:Entities){
  const eq=(column:string)=>result.query.filters.find(f=>f.column===column&&f.op==='eq')?.value;
  const team=eq('team_id');
  if(typeof team==='number')return team;
  return entities.players.find(p=>p.player_id===eq('player_id'))?.team_id;
}
function seriesColors(ids:string[],focusId:string|undefined,palette:Palette){
  // Colour follows the entity: assignment depends on identity, never on row order or on what is currently shown.
  const colors=new Map<string,string>();let next=0;
  for(const id of [...new Set(ids)].sort())colors.set(id,id===focusId?palette.focus:palette.series[next++]??palette.other);
  return colors;
}
function niceMax(v:number){
  if(v<=0)return 1;
  const power=10**Math.floor(Math.log10(v)),n=v/power;
  return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*power;
}

/* ---------- Hover and focus tooltip shared by every plot ---------- */
function useTip(below=false){
  const wrap=useRef<HTMLDivElement>(null);
  const [tip,setTip]=useState<{x:number;y:number;content:ReactNode}|null>(null);
  const at=(clientX:number,clientY:number,content:ReactNode)=>{
    const box=wrap.current?.getBoundingClientRect();
    if(box)setTip({x:Math.min(Math.max(clientX-box.left,110),Math.max(110,box.width-110)),y:clientY-box.top,content});
  };
  const bind=(content:ReactNode)=>({
    onPointerMove:(e:ReactPointerEvent)=>at(e.clientX,e.clientY,content),
    onPointerLeave:()=>setTip(null),
    onFocus:(e:FocusEvent<Element>)=>{const r=e.currentTarget.getBoundingClientRect();at(r.left+r.width/2,r.top,content);},
    onBlur:()=>setTip(null),
  });
  // Decorative duplicate: the same facts are in each mark's accessible name and in the data table.
  const node=tip?<div className={below?"agent-tip agent-tip-below":"agent-tip"} aria-hidden="true" style={{left:tip.x,top:tip.y}}>{tip.content}</div>:null;
  return {wrap,bind,node};
}
function PitchLines(){return <g fill="none" stroke="#8faeaa" strokeWidth=".3"><rect x="0" y="0" width="120" height="80"/><path d="M60 0V80M0 18H18V62H0M120 18H102V62H120M0 30H6V50H0M120 30H114V50H120"/><circle cx="60" cy="40" r="9.15"/><circle cx="12" cy="40" r=".5"/><circle cx="108" cy="40" r=".5"/></g>}

/* ---------- Headline numbers ---------- */
function Tiles({row,metrics,catalog}:{row:DataRow;metrics:string[];catalog:VisualCatalog}){
  return <dl className="agent-tiles">{metrics.map(m=><div className="agent-tile" key={m} title={metricDefinition(m,catalog)}><dt>{metricLabel(m,catalog)}</dt><dd>{formatMetric(m,row[m])}</dd></div>)}</dl>;
}

/* ---------- Comparison: one panel per metric, never two scales on one axis ---------- */
function MetricPanels({result,catalog}:Props){
  const metrics=result.query.metrics?.length?result.query.metrics:['count'];
  const groups=result.query.group_by||[];
  const focus=focusPlayer(catalog.entities);
  const perspective=perspectiveTeam(result,catalog.entities);
  // An id already reads as a name: a name column grouped next to it would only repeat it (Lionel Messi, Lionel Andrés Messi Cuccittini).
  const shownGroups=groups.filter(g=>!(g.endsWith('_name')&&groups.some(o=>o.endsWith('_id')&&(o.replace(/_id$/,'')===g.replace(/_name$/,'')||(g==='player_name'&&['player_id','shooter_id','creator_id','passer_id','recipient_id'].includes(o))||(g==='team_name'&&o==='team_id')))));
  const name=(r:DataRow)=>shownGroups.map(g=>label(g,r[g],catalog,perspective)).join(', ')||'Total';
  if(result.rows.length===1)return <>{groups.length?<p className="agent-who">{name(result.rows[0])}</p>:null}<Tiles row={result.rows[0]} metrics={metrics} catalog={catalog}/></>;
  // Rows about what Messi did (his shots, his passes, the shots he created) are drawn in his colour.
  const filteredToFocus=result.query.filters.some(f=>f.op==='eq'&&['player_id','creator_id','passer_id','shooter_id'].includes(f.column)&&f.value===focus?.player_id);
  const isFocus=(r:DataRow)=>groups.includes('player_id')?r.player_id===focus?.player_id:groups.includes('team_id')?r.team_id===focus?.team_id:filteredToFocus;
  const date=(r:DataRow)=>catalog.entities.matches.find(m=>m.match_id===r.match_id)?.match_date||'';
  const ordered=(metric:string)=>{
    const rows=[...result.rows];
    if(groups.includes('match_id'))return rows.sort((a,b)=>date(a).localeCompare(date(b)));
    if(groups.some(g=>['period','minute','match_date'].includes(g)))return rows.sort((a,b)=>String(a[groups[0]]).localeCompare(String(b[groups[0]]),'es',{numeric:true}));
    // A short comparison keeps one row order in every panel (focus first); a long one is a ranking per metric.
    if(rows.length<=6)return rows.sort((a,b)=>Number(isFocus(b))-Number(isFocus(a))||name(a).localeCompare(name(b),'es'));
    return rows.sort((a,b)=>(num(b[metric])??-Infinity)-(num(a[metric])??-Infinity));
  };
  const mixed=result.rows.some(isFocus)&&!result.rows.every(isFocus);
  const limit=12;
  return <>{mixed&&focus?<p className="agent-keys"><span className="agent-key"><i style={{background:ON_CARD.focus}}/>{playerName(focus.player_id,catalog.entities)}{groups.includes('player_id')?'':' y su selección'}</span></p>:null}
    <div className={metrics.length===1?"agent-panels agent-panels-single":"agent-panels"}>{metrics.map(metric=>{
      // Zero bars say nothing in a comparison: they stay in the exact data only.
      const rows=ordered(metric).filter(r=>result.rows.length<=2||num(r[metric])!==0),maximum=Math.max(...rows.map(r=>Math.abs(num(r[metric])??0)),0)||1;
      return <section className="agent-panel" key={metric} aria-label={metricLabel(metric,catalog)}>
        <h4 title={metricDefinition(metric,catalog)}>{metricLabel(metric,catalog)}</h4>
        <div className="agent-bars">{rows.slice(0,limit).map((r,i)=><div className="agent-bar" key={i}>
          <span>{name(r)}</span>
          <div><i style={{width:`${Math.abs(num(r[metric])??0)/maximum*100}%`,background:isFocus(r)?ON_CARD.focus:ON_CARD.series[0]}}/></div>
          <strong>{formatMetric(metric,r[metric])}</strong>
        </div>)}</div>
        {rows.length>limit?<p className="agent-muted">Se muestran {limit} de {rows.length}. El resto está en los datos exactos.</p>:null}
      </section>;
    })}</div></>;
}

/* ---------- Evolution: one small chart per metric ---------- */
const trendTitle=(metric:string,c:VisualCatalog)=>metric==='complete_dribbles'?'Regates':metricLabel(metric,c);
function TrendPanel({metric,rows,catalog,perspective,color}:{metric:string;rows:DataRow[];catalog:VisualCatalog;perspective?:number;color:string}){
  const {wrap,bind,node}=useTip();
  const [active,setActive]=useState<number|null>(null);
  const W=560,H=260,L=44,R=20,T=26,B=62,n=rows.length;
  const values=rows.map(r=>num(r[metric]));
  const top=niceMax(Math.max(...values.map(v=>v??0)));
  const x=(i:number)=>L+(n===1?.5:i/(n-1))*(W-L-R), y=(v:number)=>T+(1-v/top)*(H-T-B);
  const runs:number[][]=[];values.forEach((v,i)=>{if(v===null)return;const last=runs[runs.length-1];if(last&&last[last.length-1]===i-1)last.push(i);else runs.push([i]);});
  const peak=values.reduce<number|null>((best,v,i)=>v!==null&&(best===null||v>(values[best]??-Infinity))?i:best,null);
  const labelled=new Set([peak,values[n-1]!==null?n-1:null].filter((i):i is number=>i!==null));
  const name=trendTitle(metric,catalog);
  return <section className="agent-panel"><h4 title={metricDefinition(metric,catalog)}>{name}</h4>
    <div className="agent-plot" ref={wrap}><svg viewBox={`0 0 ${W} ${H}`} className="agent-trend" aria-label={`Evolución de ${name}`}>
      {[0,top/2,top].map(t=><g key={t}><line x1={L} x2={W-R} y1={y(t)} y2={y(t)} stroke={t===0?'#c3ccc9':'#e3e8e6'}/><text x={L-8} y={y(t)+4} textAnchor="end" fontSize="11">{formatMetric(metric,t)}</text></g>)}
      {runs.map((run,k)=><g key={k}>{run.length>1?<path d={`M${x(run[0])},${y(0)} `+run.map(i=>`L${x(i)},${y(values[i]!)}`).join(' ')+` L${x(run[run.length-1])},${y(0)} Z`} fill={color} opacity=".1"/>:null}
        <polyline points={run.map(i=>`${x(i)},${y(values[i]!)}`).join(' ')} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/></g>)}
      {active!==null?<line x1={x(active)} x2={x(active)} y1={T} y2={y(0)} stroke="#8da7aa"/>:null}
      {rows.map((r,i)=>{
        const v=values[i],match=catalog.entities.matches.find(m=>m.match_id===r.match_id);
        const words=matchLabel(r.match_id,catalog.entities,perspective,true).split(' ');
        const lines=words.length>1&&words.join(' ').length>9?[words.slice(0,Math.ceil(words.length/2)).join(' '),words.slice(Math.ceil(words.length/2)).join(' ')]:[words.join(' ')];
        const rival=matchLabel(r.match_id,catalog.entities,perspective);
        const dribbles=metric==='complete_dribbles'&&'dribble_attempts' in r;
        const long=dribbles?`${rival}: ${formatMetric('dribble_attempts',r.dribble_attempts)} regates intentados, ${formatMetric(metric,r[metric])} exitosos, ${formatMetric('dribble_success_pct',r.dribble_success_pct)} de éxito`:`${rival}: ${name} ${formatMetric(metric,r[metric])}`;
        const step=(W-L-R)/Math.max(1,n-1);
        return <g key={i} role="img" tabIndex={0} aria-label={long} onPointerEnter={()=>setActive(i)} onPointerOut={()=>setActive(null)} {...bind(dribbles?<><strong>{formatMetric(metric,r[metric])}</strong><span>Regates exitosos</span><span>{rival}</span><span>Intentados: {formatMetric('dribble_attempts',r.dribble_attempts)}</span><span>Éxito: {formatMetric('dribble_success_pct',r.dribble_success_pct)}</span></>:<><strong>{formatMetric(metric,r[metric])}</strong><span>{name}</span><span>{rival}</span></>)}>
          <rect x={x(i)-step/2} y={T-10} width={step} height={H-T+10} fill="transparent"/>
          {v!==null?<circle cx={x(i)} cy={y(v)} r={active===i?6:4.5} fill={color} stroke="#fff" strokeWidth="2"/>:null}
          {v!==null&&labelled.has(i)?<text x={x(i)} y={y(v)-11} textAnchor={i===n-1&&n>1?'end':'middle'} fontSize="12" fontWeight="600" className="agent-trend-value">{formatMetric(metric,v)}</text>:null}
          {lines.map((line,k)=><text key={k} x={x(i)} y={H-B+18+k*13} textAnchor="middle" fontSize="11">{line}</text>)}
          {match?<text x={x(i)} y={H-B+20+lines.length*13} textAnchor="middle" fontSize="10" opacity=".75">{shortDate(match.match_date)}</text>:null}
        </g>;
      })}
    </svg>{node}</div></section>;
}
function Trend({result,catalog}:Props){
  // xG asistido is reported once, as a tournament total in the balance cards, not as its own match-by-match chart.
  const asked=result.query.metrics?.length?result.query.metrics:['count'];
  const metrics=asked.length>1?asked.filter(m=>m!=='xg_assisted'):asked;
  const date=(r:DataRow)=>catalog.entities.matches.find(m=>m.match_id===r.match_id)?.match_date||String(r.match_id);
  const rows=[...result.rows].sort((a,b)=>date(a).localeCompare(date(b)));
  const focus=focusPlayer(catalog.entities),perspective=perspectiveTeam(result,catalog.entities);
  const aboutFocus=result.query.filters.some(f=>f.op==='eq'&&((f.column==='player_id'&&f.value===focus?.player_id)||(f.column==='team_id'&&f.value===focus?.team_id)));
  if(rows.length<2)return <MetricPanels result={result} catalog={catalog}/>;
  return <><div className="agent-panels">{metrics.map(m=><TrendPanel key={m} metric={m} rows={rows} catalog={catalog} perspective={perspective} color={aboutFocus?ON_CARD.focus:ON_CARD.series[0]}/>)}</div>
    <p className="agent-muted">Partidos en orden cronológico. Cada métrica tiene su propia escala; se rotulan el valor más alto y el último.</p>
    <TrendBalance rows={rows}/></>;
}
/** Tournament balance under the charts: four totals summed from the same per-match rows; ratio from summed counts, never averaged. */
function TrendBalance({rows}:{rows:DataRow[]}){
  const keys=['npxg','xg_assisted','completed_passes','complete_dribbles','known_dribbles'];
  if(!rows.length||!keys.every(k=>rows.every(r=>num(r[k])!==null)))return null;
  const sum=(k:string)=>rows.reduce((t,r)=>t+(num(r[k])??0),0);
  const done=sum('complete_dribbles'),known=sum('known_dribbles');
  const cards=[
    {label:'xG sin penales',value:nf(2).format(sum('npxg')),note:'Calidad de sus oportunidades sin penales'},
    {label:'xG asistido',value:nf(2).format(sum('xg_assisted')),note:'Calidad de los tiros que creó para otros'},
    {label:'Pases completos',value:nf(0).format(sum('completed_passes')),note:'Participación en la distribución del balón'},
    {label:'Efectividad en regates',value:known?nf(1).format(100*done/known)+' %':'Sin dato',note:`${nf(0).format(done)} completos de ${nf(0).format(known)} intentados`},
  ];
  return <dl className="agent-balance" aria-label="Balance del Mundial">{cards.map(c=><div key={c.label} className="agent-balance-card"><dt>{c.label}</dt><dd>{c.value}</dd><dd className="agent-balance-note">{c.note}</dd></div>)}</dl>;
}

/* ---------- Events on the pitch ---------- */
function describeEvent(r:DataRow,catalog:VisualCatalog){
  const who=r.player_id!=null?playerName(r.player_id,catalog.entities):label('team_id',r.team_id,catalog);
  const type=typeof r.type_name==='string'?VALUE_ES[r.type_name]??r.type_name:'Recepción';
  const kind=typeof r.shot_type==='string'&&r.shot_type!=='Open Play'?` de ${(VALUE_ES[r.shot_type]??r.shot_type).toLowerCase()}`:'';
  const outcome=typeof r.outcome_name==='string'?`, ${(VALUE_ES[r.outcome_name]??r.outcome_name).toLowerCase()}`:'';
  const target=r.recipient_id!=null?` → ${playerName(r.recipient_id,catalog.entities)}`:'';
  const when=[num(r.minute)!==null?`Minuto ${r.minute}`:null,num(r.period)!==null?PERIOD_ES[r.period as number]:null].filter(Boolean).join(', ');
  const xg=num(r.statsbomb_xg);
  return {who,what:`${type}${kind}${target}${outcome}`,when,xg:xg!==null?`xG ${nf(2).format(xg)}`:null,match:matchLabel(r.match_id,catalog.entities)};
}
/* ---------- Shots: vertical half pitch with the goal on top, and the goal mouth seen from the shooter ---------- */
type ShotKind='goal'|'saved'|'shot';
const shotKind=(r:DataRow):ShotKind=>truthy(r.is_goal)||r.outcome_name==='Goal'?'goal':typeof r.outcome_name==='string'&&r.outcome_name.startsWith('Saved')?'saved':'shot';
const SHOT_KIND_ES:Record<ShotKind,string>={goal:'Gol',saved:'Atajado',shot:'Disparo'};
/** One marker, identical size for every shot: the shape says the outcome, the ring colour says who. */
const MARK_FILL='#dfe7e5';
function ShotMark({kind,x,y,r,color}:{kind:ShotKind;x:number;y:number;r:number;color:string}){
  if(kind==='goal'){
    const p=Array.from({length:5},(_,i)=>{const a=-Math.PI/2+i*2*Math.PI/5;return [x+Math.cos(a)*r*.4,y+Math.sin(a)*r*.4];});
    return <g><circle cx={x} cy={y} r={r} fill="#fff" stroke={color} strokeWidth={r*.22}/>
      <path d={'M'+p.map(q=>q.join(' ')).join('L')+'Z'} fill="#142e35"/>
      {p.map(([px,py],i)=><line key={i} x1={px} y1={py} x2={x+(px-x)*2.3} y2={y+(py-y)*2.3} stroke="#142e35" strokeWidth={r*.14}/>)}</g>;
  }
  return <g><circle cx={x} cy={y} r={r} fill={MARK_FILL} stroke={color} strokeWidth={r*.22}/>{kind==='saved'?<circle cx={x} cy={y} r={r*.32} fill="#142e35"/>:null}</g>;
}
function HalfPitchLines(){return <g fill="none" stroke="#8faeaa" strokeWidth=".35">
  <rect x="0" y="0" width="80" height="60"/><path d="M18 0V18H62V0M30 0V6H50V0M32 18A10 10 0 0 0 48 18M30.85 60A9.15 9.15 0 0 1 49.15 60M0 1A1 1 0 0 0 1 0M79 0A1 1 0 0 0 80 1"/>
  <circle cx="40" cy="12" r=".4" fill="#8faeaa"/><path d="M36 0V-1.2H44V0" stroke="#edf8fb" strokeWidth=".55"/></g>;}
const GOAL={left:36,right:44,height:2.67};
// The goal view keeps the frame large, as broadcast shot maps do; shots wide or high sit on the border, faded, and say so.
const FRAME={left:30.5,right:49.5,top:4};
type Assist={pass:DataRow;creator:number};
/** The shot map; with `assists` (created shots) each shot also carries the key pass that led to it, drawn when the shot is selected. */
function ShotMap({result,catalog,assists}:Props&{assists?:Map<string,Assist>}){
  const {wrap,bind,node}=useTip(true); // below the ball, so the tip never covers the shot under the cursor
  const [selected,setSelected]=useState<string|null>(null);
  const focus=focusPlayer(catalog.entities);
  const byPlayer=result.rows.some(r=>r.player_id!=null);
  // Created shots are coloured by who created them (Messi in his colour), not by the many different shooters.
  const key=(r:DataRow)=>assists?String(assists.get(String(r.event_id))?.creator??'all'):String((byPlayer?r.player_id:r.team_id)??'all');
  const ids=[...new Set(result.rows.map(key))];
  const colors=seriesColors(ids,String(byPlayer?focus?.player_id:focus?.team_id),ON_PITCH);
  const seriesName=(s:string)=>s==='all'?'Todos':label(byPlayer?'player_id':'team_id',Number(s),catalog);
  const all=result.rows.map((r,i)=>({r,id:String(r.event_id??i)}));
  const shown=all.filter(({r})=>num(r.location_x)!==null&&num(r.location_y)!==null)
    .sort((a,b)=>String(a.r.match_id).localeCompare(String(b.r.match_id))||(num(a.r.period)??0)-(num(b.r.period)??0)||(num(a.r.minute)??0)-(num(b.r.minute)??0)||(num(a.r.second)??0)-(num(b.r.second)??0));
  const current=shown.find(s=>s.id===selected)??null;
  const oneMatch=new Set(shown.map(({r})=>r.match_id)).size===1;
  // StatsBomb always attacks towards x=120 with y growing to the attacker's right, so the goal goes on top without flipping.
  const P=(x:number,y:number)=>({x:y,y:120-x});
  const passStart=(a:Assist)=>num(a.pass.location_x)!==null?120-(a.pass.location_x as number)+2:0;
  const bottom=Math.min(78,Math.max(61,...shown.map(({r})=>120-(r.location_x as number)+2),...[...(assists?.values()??[])].map(passStart)));
  const assist=(r:DataRow)=>assists?.get(String(r.event_id));
  const heights=shown.filter(({r})=>num(r.end_z)!==null&&num(r.end_y)!==null);
  const noHeight=shown.length-heights.length;
  const fw=FRAME.right-FRAME.left, R=1.5, gr=R*fw/86;
  const gx=(v:number)=>Math.min(FRAME.right-gr*1.2,Math.max(FRAME.left+gr*1.2,v)), gz=(v:number)=>-Math.min(FRAME.top-gr*1.2,Math.max(gr,v));
  const outside=(r:DataRow)=>(r.end_y as number)<FRAME.left||(r.end_y as number)>FRAME.right||(r.end_z as number)>FRAME.top;
  const choose=(s:string|null)=>setSelected(c=>c===s?null:s);
  const tip=(r:DataRow)=>{const d=describeEvent(r,catalog);return <><strong>{d.who}</strong><span>{d.what}</span>{d.xg?<span>{d.xg}</span>:null}<span>{d.when}</span></>;};
  const name=(r:DataRow)=>{const d=describeEvent(r,catalog);return [d.who,d.what,d.xg,d.when,d.match].filter(Boolean).join('. ');};
  const dim=(s:string)=>current&&current.id!==s?.18:1;
  const shotLabel=(r:DataRow)=>`${format(r.minute)}′${oneMatch?'':' '+matchLabel(r.match_id,catalog.entities,perspectiveTeam(result,catalog.entities),true)}`;
  const xgSum=shown.reduce((t,{r})=>t+(num(r.statsbomb_xg)??0),0);
  const outcome=(r:DataRow)=>typeof r.outcome_name==='string'?VALUE_ES[r.outcome_name]??r.outcome_name:'Sin dato';
  const how=(r:DataRow)=>[typeof r.body_part_name==='string'?VALUE_ES[r.body_part_name]??r.body_part_name:null,typeof r.technique_name==='string'&&r.technique_name!=='Normal'?(VALUE_ES[r.technique_name]??r.technique_name).toLowerCase():null].filter(Boolean).join(', ')||'Sin dato';
  const situation=(r:DataRow)=>{const kind=typeof r.shot_type==='string'&&r.shot_type!=='Open Play'?VALUE_ES[r.shot_type]??r.shot_type:null;const pattern=typeof r.play_pattern_name==='string'?VALUE_ES[r.play_pattern_name]??r.play_pattern_name:null;return kind??pattern??'Sin dato';};
  const stats:[string,string][]=current?[
      ['xG',num(current.r.statsbomb_xg)!==null?nf(2).format(current.r.statsbomb_xg as number):'Sin dato'],
      ['Resultado',outcome(current.r)],['Situación',situation(current.r)],['Tipo de tiro',how(current.r)],
      ['Minuto',`${format(current.r.minute)}′, ${num(current.r.period)!==null?PERIOD_ES[current.r.period as number]:''}`],
      ...(oneMatch?[]:[['Partido',matchLabel(current.r.match_id,catalog.entities)] as [string,string]]),
      ...(assist(current.r)?[['Pase de',playerName(assist(current.r)!.creator,catalog.entities)],['Remató',playerName(current.r.player_id,catalog.entities)]] as [string,string][]:ids.length>1?[['Jugador',seriesName(key(current.r))] as [string,string]]:[])]
    :[['Tiros',String(shown.length)],['Goles',String(shown.filter(({r})=>shotKind(r)==='goal').length)],['Atajados',String(shown.filter(({r})=>shotKind(r)==='saved').length)],['xG total',nf(2).format(xgSum)]];
  const end=current&&num(current.r.end_x)!==null&&num(current.r.end_y)!==null?P(current.r.end_x as number,current.r.end_y as number):null;
  return <div className="agent-shots" onKeyDown={e=>{if(e.key==='Escape')setSelected(null);}}>
    <div className="agent-shot-chips" role="group" aria-label="Elegir tiro">
      <button type="button" className="agent-shot-chip" aria-pressed={!current} onClick={()=>setSelected(null)}>Todos</button>
      {shown.map(({r,id})=><button type="button" key={id} className="agent-shot-chip" aria-pressed={current?.id===id} aria-label={name(r)} onClick={()=>choose(id)}>
        {shotKind(r)==='goal'?<svg viewBox="-2 -2 4 4" width="15" height="15" aria-hidden="true"><ShotMark kind="goal" x={0} y={0} r={1.8} color="#fff"/></svg>:ids.length>1?<i style={{background:colors.get(key(r))}}/>:null}{shotLabel(r)}</button>)}
    </div>
    <div className="agent-shot-body">
      <div className="agent-plot agent-shotmap" ref={wrap}>
        <svg viewBox={`${FRAME.left} ${-FRAME.top} ${fw} ${FRAME.top+.2}`} className="agent-goal" aria-label="Arco visto desde el rematador: dónde terminó cada tiro con altura registrada">
          <path d={`M${FRAME.left} 0H${FRAME.right}`} stroke="#8faeaa" strokeWidth={fw/350}/>
          <rect x={GOAL.left} y={-GOAL.height} width={GOAL.right-GOAL.left} height={GOAL.height} fill="#ffffff12"/>
          <path d={`M${GOAL.left} 0V${-GOAL.height}H${GOAL.right}V0`} fill="none" stroke="#c4d2d0" strokeWidth={fw/110}/>
          {heights.map(({r,id:s})=><g key={s} aria-hidden="true" opacity={dim(s)*(outside(r)?.5:1)} onClick={()=>choose(s)} {...bind(<>{tip(r)}{outside(r)?<span>Fuera del cuadro: se dibuja en el borde</span>:null}</>)} style={{cursor:'pointer'}}>
            <circle cx={gx(r.end_y as number)} cy={gz(r.end_z as number)} r={gr*1.5} fill="transparent"/>
            <ShotMark kind={shotKind(r)} x={gx(r.end_y as number)} y={gz(r.end_z as number)} r={gr} color={colors.get(key(r))!}/></g>)}
        </svg>
        <svg viewBox={`-2 -2 84 ${bottom+3}`} className="agent-pitch agent-half-pitch" aria-label={`Cancha: ${result.visualization}`}><HalfPitchLines/>
          {current&&assist(current.r)?(()=>{const a=assist(current.r)!,o=P(current.r.location_x as number,current.r.location_y as number);
            if(num(a.pass.location_x)===null)return null;
            const from=P(Math.max(120-78,a.pass.location_x as number),a.pass.location_y as number),to=num(a.pass.end_x)!==null?P(a.pass.end_x as number,a.pass.end_y as number):o;
            const c=a.creator===focus?.player_id?ON_PITCH.focus:'#f4f7f6';
            // One play: the key pass (solid), the shooter's touch until the shot (white dotted), then the shot.
            return <g aria-hidden="true" pointerEvents="none"><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={c} strokeWidth=".6" strokeLinecap="round"/>
              <line x1={to.x} y1={to.y} x2={o.x} y2={o.y} stroke="#fff" strokeWidth=".45" strokeDasharray=".1 1" strokeLinecap="round"/>
              <circle cx={from.x} cy={from.y} r=".9" fill={c} stroke={PITCH_SURFACE} strokeWidth=".25"/></g>;})():null}
          {current&&end?(()=>{const o=P(current.r.location_x as number,current.r.location_y as number);
            return <g aria-hidden="true"><line x1={o.x} y1={o.y} x2={end.x} y2={end.y} stroke="#edf8fb" strokeWidth=".55" strokeDasharray=".1 1.1" strokeLinecap="round"/><path d={`M${end.x-.7} ${end.y-.7}l1.4 1.4m0 -1.4l-1.4 1.4`} stroke="#edf8fb" strokeWidth=".4"/></g>;})():null}
          {shown.map(({r,id:s})=>{const {x,y}=P(r.location_x as number,r.location_y as number);
            return <g key={s} role="button" tabIndex={0} aria-pressed={current?.id===s} aria-label={name(r)} opacity={dim(s)} onClick={()=>choose(s)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(s);}}} {...bind(tip(r))}>
              <circle cx={x} cy={y} r={R*1.5} fill="transparent"/>
              <ShotMark kind={shotKind(r)} x={x} y={y} r={R} color={colors.get(key(r))!}/></g>;})}
          {current?(()=>{const o=P(current.r.location_x as number,current.r.location_y as number);return <g aria-hidden="true" pointerEvents="none"><ShotMark kind={shotKind(current.r)} x={o.x} y={o.y} r={R} color={colors.get(key(current.r))!}/></g>;})():null}
        </svg>{node}</div>
      <dl className="agent-shot-stats" aria-live="polite">{stats.map(([k,v])=><div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
    </div>
    {ids.length>1&&ids.length<=8?<div className="agent-legend"><p className="agent-keys">{ids.map(s=><span className="agent-key" key={s}><i style={{background:colors.get(s)}}/>{seriesName(s)}</span>)}</p></div>:null}
    {noHeight?<p className="agent-muted">{noHeight} {noHeight===1?'tiro bloqueado o muy desviado no tiene':'tiros bloqueados o muy desviados no tienen'} altura en StatsBomb y no aparece{noHeight===1?'':'n'} en el arco.</p>:null}
  </div>;
}
function EventPitch({result,catalog}:Props){
  if(result.rows.some(r=>num(r.location_x)!==null)&&result.rows.every(r=>r.type_name==='Shot'))return <ShotMap result={result} catalog={catalog}/>;
  return <EventMap result={result} catalog={catalog}/>;
}
function EventMap({result,catalog}:Props){
  const {wrap,bind,node}=useTip();
  const [hidden,setHidden]=useState<string[]>([]);
  const focus=focusPlayer(catalog.entities);
  const byPlayer=result.rows.some(r=>r.player_id!=null);
  const key=(r:DataRow)=>String((byPlayer?r.player_id:r.team_id)??'all');
  const ids=[...new Set(result.rows.map(key))];
  const colors=seriesColors(ids,String(byPlayer?focus?.player_id:focus?.team_id),ON_PITCH);
  const seriesName=(id:string)=>id==='all'?'Todos':label(byPlayer?'player_id':'team_id',Number(id),catalog);
  const located=result.rows.filter(r=>num(r.location_x)!==null&&num(r.location_y)!==null);
  // Several action types: each gets its own colour, a chip to show it alone and a key below the pitch.
  const typeOf=(r:DataRow)=>typeof r.type_name==='string'?r.type_name:'Ball Receipt*';
  const types=[...new Set(located.map(typeOf))].sort((x,y)=>located.filter(r=>typeOf(r)===y).length-located.filter(r=>typeOf(r)===x).length);
  const byType=types.length>1;
  const typeColors=new Map(types.map((t,i)=>[t,TYPE_COLORS[i%TYPE_COLORS.length]]));
  const typeName=(t:string)=>VALUE_ES[t]??t;
  const [only,setOnly]=useState<string|null>(null);
  const rows=located.filter(r=>!hidden.includes(key(r))&&(!byType||only===null||typeOf(r)===only));
  // One chip per event, in match order, like the shot map: pick one to isolate it, or see them all.
  const order=(x:DataRow,y:DataRow)=>String(x.match_id).localeCompare(String(y.match_id))||(num(x.period)??0)-(num(y.period)??0)||(num(x.minute)??0)-(num(y.minute)??0)||(num(x.second)??0)-(num(y.second)??0);
  const events=[...rows].sort(order);
  const [picked,setPicked]=useState<DataRow|null>(null);
  const current=picked&&rows.includes(picked)?picked:null;
  const pick=(r:DataRow)=>setPicked(c=>c===r?null:r);
  const oneMatch=new Set(located.map(r=>r.match_id)).size===1;
  const dim=(r:DataRow)=>current&&current!==r?.15:1;
  const colorOf=(r:DataRow)=>byType?typeColors.get(typeOf(r)):colors.get(key(r));
  const shots=located.length>0&&located.every(r=>r.type_name==='Shot');
  const radius=(r:DataRow)=>shots?1+2.2*Math.sqrt(Math.max(0,num(r.statsbomb_xg)??0)):.95;
  const solid=(r:DataRow)=>shots?truthy(r.is_goal)||r.outcome_name==='Goal':r.is_complete!==0&&r.outcome_name!=='Incomplete';
  const interactive=rows.length<=80;
  const drawn=[...rows].sort((a,b)=>radius(b)-radius(a)).sort((a,b)=>Number(a===current)-Number(b===current));
  const tip=(r:DataRow)=>{const d=describeEvent(r,catalog);return <><strong>{d.who}</strong><span>{d.what}</span>{d.xg?<span>{d.xg}</span>:null}<span>{d.when}</span><span>{d.match}</span></>;};
  const name=(r:DataRow)=>{const d=describeEvent(r,catalog);return [d.who,d.what,d.xg,d.when,d.match].filter(Boolean).join('. ');};
  return <>{byType?<div className="agent-shot-chips" role="group" aria-label="Elegir acciones">
      <button type="button" className="agent-shot-chip" aria-pressed={only===null} onClick={()=>{setOnly(null);setPicked(null);}}>Todas <b>{located.length}</b></button>
      {types.map(t=><button type="button" key={t} className="agent-shot-chip" aria-pressed={only===t} onClick={()=>{setOnly(o=>o===t?null:t);setPicked(null);}}><i style={{background:typeColors.get(t)}}/>{typeName(t)} <b>{located.filter(r=>typeOf(r)===t).length}</b></button>)}
    </div>:null}
    {events.length>1?<div className="agent-shot-chips" role="group" aria-label="Elegir acción" onKeyDown={e=>{if(e.key==='Escape')setPicked(null);}}>
      <button type="button" className="agent-shot-chip" aria-pressed={!current} onClick={()=>setPicked(null)}>Todos</button>
      {events.map((r,i)=><button type="button" key={String(r.event_id??i)} className="agent-shot-chip" aria-pressed={current===r} aria-label={name(r)} onClick={()=>pick(r)}>
        <i style={{background:colorOf(r)}}/>{format(r.minute)}′{oneMatch?'':' '+matchLabel(r.match_id,catalog.entities,perspectiveTeam(result,catalog.entities),true)}</button>)}
    </div>:null}
    <div className="agent-legend"><span>Dirección de ataque →</span>
      {!byType&&ids.length>1&&ids.length<=24?<div className="agent-chips" role="group" aria-label="Mostrar u ocultar">{ids.map(id=><button type="button" key={id} className="agent-chip" aria-pressed={!hidden.includes(id)} onClick={()=>setHidden(h=>h.includes(id)?h.filter(x=>x!==id):[...h,id])}><i style={{background:colors.get(id)}}/>{seriesName(id)} <b>{located.filter(r=>key(r)===id).length}</b></button>)}</div>
        :!byType&&ids.length===1?<span className="agent-key"><i style={{background:colors.get(ids[0])}}/>{seriesName(ids[0])}</span>:null}</div>
    <div className="agent-plot" ref={wrap}><svg viewBox="-4 -5 128 90" className="agent-pitch" aria-label={`Cancha: ${result.visualization}`}><PitchLines/>
      {rows.map((r,i)=>num(r.end_x)!==null&&num(r.end_y)!==null?<line key={i} x1={r.location_x as number} y1={r.location_y as number} x2={r.end_x as number} y2={r.end_y as number} stroke={colorOf(r)} strokeWidth={current===r?.6:.35} opacity={(solid(r)?.75:.4)*dim(r)}/>:null)}
      {drawn.map((r,i)=>{
        const color=colorOf(r),x=r.location_x as number,y=r.location_y as number,size=radius(r)*(current===r?1.4:1);
        const action=interactive?{role:'button',tabIndex:0,'aria-pressed':current===r,'aria-label':name(r),onKeyDown:(e:{key:string;preventDefault():void})=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(r);}}}:{};
        return <g key={i} {...bind(tip(r))} {...action} opacity={dim(r)} onClick={()=>pick(r)} style={{cursor:'pointer'}}>
          <circle cx={x} cy={y} r={Math.max(2.2,size+.8)} fill="transparent"/>
          <circle cx={x} cy={y} r={size} fill={color} fillOpacity={solid(r)?1:.16} stroke={solid(r)?PITCH_SURFACE:color} strokeWidth={solid(r)?.3:.45}/>
        </g>;
      })}
    </svg>{node}</div>
    <div className="agent-legend agent-event-key" aria-label="Leyenda">
      {byType?<p className="agent-keys">{types.map(t=><span className="agent-key" key={t}><i style={{background:typeColors.get(t)}}/>{typeName(t)}</span>)}</p>:null}
      <p className="agent-keys">{shots?<>
        <span className="agent-key"><svg viewBox="-2 -2 4 4" width="14" height="14" aria-hidden="true"><circle r="1.6" fill="currentColor"/></svg>Gol</span>
        <span className="agent-key"><svg viewBox="-2 -2 4 4" width="14" height="14" aria-hidden="true"><circle r="1.4" fill="none" stroke="currentColor" strokeWidth=".5"/></svg>No fue gol</span>
        <span className="agent-key">Tamaño: xG</span></>:<>
        <span className="agent-key"><svg viewBox="-2 -2 4 4" width="14" height="14" aria-hidden="true"><circle r="1.6" fill="currentColor"/></svg>Completada</span>
        <span className="agent-key"><svg viewBox="-2 -2 4 4" width="14" height="14" aria-hidden="true"><circle r="1.4" fill="none" stroke="currentColor" strokeWidth=".5"/></svg>No completada</span></>}
        <span className="agent-key"><svg viewBox="0 0 16 4" width="18" height="6" aria-hidden="true"><line x1="1" y1="2" x2="15" y2="2" stroke="currentColor" strokeWidth="1.5"/></svg>Hacia dónde fue</span></p>
      {located.length<result.rows.length?<p className="agent-muted">{result.rows.length-located.length} registros sin ubicación no aparecen en la cancha.</p>:null}
    </div>
  </>;
}

/* ---------- Created shots: one play per shot (key pass, the shooter's touch, the shot) ---------- */
type Chain={match_id:number;creator_id:number;shooter_id:number;pass:DataRow;shot:DataRow};
function ChainMap({result,catalog}:Props){
  const chains=result.rows as unknown as Chain[];
  const assists=new Map(chains.map(c=>[String(c.shot.event_id),{pass:c.pass,creator:c.creator_id}]));
  return <><ShotMap result={{...result,rows:chains.map(c=>c.shot)}} catalog={catalog} assists={assists}/>
    <p className="agent-muted">Elige un tiro para ver la jugada completa: el pase clave, la recepción hasta el tiro (punteada) y el remate.</p></>;
}

/* ---------- Activity zones ---------- */
function Heat({result,catalog}:Props){
  const {wrap,bind,node}=useTip();
  const maximum=Math.max(1,...result.rows.map(r=>num(r.count)??0));
  const peak=result.rows.reduce((best,r)=>(num(r.count)??0)>(num(best.count)??0)?r:best,result.rows[0]);
  const focus=focusPlayer(catalog.entities);
  const hue=result.query.filters.some(f=>f.op==='eq'&&f.column==='player_id'&&f.value===focus?.player_id)?ON_PITCH.focus:ON_PITCH.series[0];
  const zone=(r:DataRow)=>`${nf(0).format(num(r.count)??0)} acciones en la zona x ${Number(r.bin_x)*10}–${Number(r.bin_x)*10+10}, y ${Number(r.bin_y)*10}–${Number(r.bin_y)*10+10}`;
  return <><div className="agent-legend"><span>Dirección de ataque →</span><span className="agent-scale">Menos<i style={{background:`linear-gradient(90deg,${hue}22,${hue})`}}/>Más (máximo {nf(0).format(maximum)} por zona)</span></div>
    <div className="agent-plot" ref={wrap}><svg viewBox="-4 -5 128 90" className="agent-pitch" aria-label={`Cancha: ${result.visualization}`}>
      {result.rows.map((r,i)=><rect key={i} x={Number(r.bin_x)*10+.2} y={Number(r.bin_y)*10+.2} width="9.6" height="9.6" rx=".6" fill={hue} opacity={.12+.84*(num(r.count)??0)/maximum} {...bind(<><strong>{nf(0).format(num(r.count)??0)}</strong><span>acciones en esta zona</span></>)}><title>{zone(r)}</title></rect>)}
      <PitchLines/>
      {peak?<text x={Number(peak.bin_x)*10+5} y={Number(peak.bin_y)*10+6} textAnchor="middle" fontSize="3.2" fontWeight="700" fill="#10252c" pointerEvents="none">{nf(0).format(num(peak.count)??0)}</text>:null}
    </svg>{node}</div>
    <p className="agent-muted">Cada zona cuenta las acciones registradas allí: cuanto más intenso el color, más acciones. Cuenta eventos, no el tiempo que el jugador pasó en la zona. La zona con más acciones lleva su número.</p></>;
}

/* ---------- Pass network ---------- */
function Network({result,catalog}:Props){
  const {wrap,bind,node}=useTip();
  const focus=focusPlayer(catalog.entities);
  type Node={sx:number;sy:number;sw:number;ex:number;ey:number;ew:number;given:number;received:number};
  const nodes=new Map<number,Node>();
  const get=(id:number)=>{if(!nodes.has(id))nodes.set(id,{sx:0,sy:0,sw:0,ex:0,ey:0,ew:0,given:0,received:0});return nodes.get(id)!;};
  const edges=result.rows.filter(r=>num(r.player_id)!==null&&num(r.recipient_id)!==null&&num(r.mean_start_x)!==null&&num(r.mean_end_x)!==null);
  for(const r of edges){
    const c=num(r.pass_count)??0,a=get(r.player_id as number),b=get(r.recipient_id as number);
    a.sx+=(r.mean_start_x as number)*c;a.sy+=(r.mean_start_y as number)*c;a.sw+=c;a.given+=c;
    b.ex+=(r.mean_end_x as number)*c;b.ey+=(r.mean_end_y as number)*c;b.ew+=c;b.received+=c;
  }
  // A passer sits where their passes start; a player who only receives sits where those passes arrive.
  const at=(id:number):[number,number]=>{const n=nodes.get(id)!;return n.sw>0?[n.sx/n.sw,n.sy/n.sw]:[n.ex/Math.max(1,n.ew),n.ey/Math.max(1,n.ew)];};
  const strongest=Math.max(1,...edges.map(r=>num(r.pass_count)??0));
  const busiest=Math.max(1,...[...nodes.values()].map(n=>n.given+n.received));
  const shown=[...edges].sort((a,b)=>(num(a.pass_count)??0)-(num(b.pass_count)??0)).slice(-70);
  return <><div className="agent-legend"><span>Dirección de ataque →</span>{focus&&nodes.has(focus.player_id)?<span className="agent-key"><i style={{background:ON_PITCH.focus}}/>{playerName(focus.player_id,catalog.entities)}</span>:null}</div>
    <div className="agent-plot" ref={wrap}><svg viewBox="-4 -5 128 90" className="agent-pitch" aria-label={`Cancha: ${result.visualization}`}><PitchLines/>
      {shown.map((r,i)=>{const [x1,y1]=at(r.player_id as number),[x2,y2]=at(r.recipient_id as number),c=num(r.pass_count)??0;
        const text=`${playerName(r.player_id,catalog.entities)} → ${playerName(r.recipient_id,catalog.entities)}`;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cfe6ea" strokeLinecap="round" strokeWidth={.3+1.5*c/strongest} opacity={.25+.6*c/strongest} {...bind(<><strong>{nf(0).format(c)} pases</strong><span>{text}</span></>)}><title>{text}: {c} pases</title></line>;})}
      {[...nodes.entries()].map(([id,n])=>{const [x,y]=at(id),isFocus=id===focus?.player_id,full=playerName(id,catalog.entities);
        const detail=`${full}: ${nf(0).format(n.given)} pases dados y ${nf(0).format(n.received)} recibidos en esta selección`;
        return <g key={id} role="img" tabIndex={0} aria-label={detail} {...bind(<><strong>{full}</strong><span>{nf(0).format(n.given)} pases dados</span><span>{nf(0).format(n.received)} pases recibidos</span></>)}>
          <circle cx={x} cy={y} r={1.5+1.9*Math.sqrt((n.given+n.received)/busiest)} fill={isFocus?ON_PITCH.focus:'#f4f7f6'} stroke={PITCH_SURFACE} strokeWidth=".35"/>
          <text x={x} y={y+5.2} textAnchor="middle" fontSize="2.1" fontWeight={isFocus?700:400} fill={PITCH_INK} stroke={PITCH_SURFACE} strokeWidth=".7" paintOrder="stroke">{surname(full)}</text>
        </g>;})}
    </svg>{node}</div>
    <p className="agent-muted">Cada círculo es un jugador, en el lugar promedio de sus pases. Cuanto más gruesa la línea, más pases completados entre esos dos jugadores. No son posiciones de seguimiento.{edges.length>shown.length?` Se dibujan las ${shown.length} conexiones más frecuentes de ${edges.length}.`:''}</p></>;
}

/* ---------- Starting XI ---------- */
// Messi's token on line-up pitches: a vivid blue with white number, so he stands out from the white tokens.
const MESSI_TOKEN='#1f8ff0';
type LineupPlayer={player:{id:number;name:string};position:{id:number;name:string};jersey_number:number};
const positionMap:Record<number,[number,number]>={1:[8,40],2:[27,70],3:[26,55],4:[25,40],5:[26,25],6:[27,10],7:[45,70],8:[45,10],9:[44,55],10:[44,40],11:[44,25],12:[62,70],13:[62,55],14:[62,40],15:[62,25],16:[62,10],17:[82,70],18:[82,55],19:[82,40],20:[82,25],21:[82,10],22:[101,55],23:[101,40],24:[101,25],25:[108,40]};
// StatsBomb stores 4231; football writes 4-2-3-1.
const formation=(v:Cell|undefined)=>v===null||v===undefined?'Sin dato':String(v).replace(/\D/g,'').split('').join('-');
/* Own half, vertical: goal at the bottom, halfway line on top, attack upwards (StatsBomb y grows to the attacker's right). */
function HalfPitchVertical(){return <g fill="none" stroke="#8faeaa" strokeWidth=".3">
  <rect x="0" y="0" width="80" height="60"/><path d="M0 0H80"/><path d="M30.85 0A9.15 9.15 0 0 0 49.15 0"/>
  <path d="M18 60V42H62V60M30 60V54H50V60"/><path d="M32.7 42A9.15 9.15 0 0 1 47.3 42"/><circle cx="40" cy="48" r=".45" fill="#8faeaa"/></g>;}
function LineupPitch({row,catalog}:{row:DataRow;catalog:VisualCatalog}){
  const focus=focusPlayer(catalog.entities);
  const players=row.players as unknown as LineupPlayer[];
  // Tactical lines (keeper, defence, midfield…) spread evenly from the goal to the halfway line.
  const line=(p:LineupPlayer)=>Math.round(((positionMap[p.position.id]||[60,40])[0]-8)/18);
  const lines=[...new Set(players.map(line))].sort((a,b)=>a-b);
  const rowY=(p:LineupPlayer)=>55-lines.indexOf(line(p))*(47/Math.max(1,lines.length-1));
  return <><svg viewBox="-3 -3 86 66" className="agent-pitch agent-lineup-pitch" aria-label={`Once de ${label('team_id',row.team_id,catalog)}`}><HalfPitchVertical/>
      {players.map(p=>{
        const [,py]=positionMap[p.position.id]||[60,40];
        const x=Math.min(74,Math.max(6,40+(py-40)*1.12)),y=rowY(p);
        const highlighted=p.player.id===focus?.player_id,full=playerName(p.player.id,catalog.entities),tag=surname(full),w=tag.length*1.42+3;
        return <g key={p.player.id} role="img" aria-label={`${p.jersey_number}, ${full}, ${p.position.name}`}><title>{`${full}, ${p.position.name}`}</title>
          <circle cx={x} cy={y} r="2.9" fill={highlighted?MESSI_TOKEN:'#f4f7f6'} stroke="#0b2027" strokeWidth=".3"/>
          <text x={x} y={y+1} textAnchor="middle" fill={highlighted?'#fff':'#10252c'} fontSize="2.8" fontWeight="700">{p.jersey_number}</text>
          <rect x={x-w/2} y={y+3.6} width={w} height="3.9" rx="1" fill="#0b2027" opacity=".92"/>
          <text x={x} y={y+6.45} textAnchor="middle" fill="#fff" fontSize="2.3" fontWeight="700">{tag}</text></g>;
      })}
    </svg>
    <p className="agent-formation" aria-label={`Formación ${formation(row.formation_code)}`}>{formation(row.formation_code)}</p></>;
}
function Lineups({result,catalog}:Props){
  const [tab,setTab]=useState(0);
  const refs=useRef<(HTMLButtonElement|null)[]>([]);
  const focus=focusPlayer(catalog.entities);
  const rows=[...result.rows].sort((a,b)=>Number(b.team_id===focus?.team_id)-Number(a.team_id===focus?.team_id)),n=rows.length,i=Math.min(tab,n-1),id=useId();
  const oneMatch=new Set(rows.map(r=>r.match_id)).size===1;
  const name=(r:DataRow)=>label('team_id',r.team_id,catalog)+(oneMatch?'':` · ${matchLabel(r.match_id,catalog.entities,num(r.team_id)??undefined,true)}`);
  const key=(e:{key:string;preventDefault():void})=>{const next=e.key==='ArrowRight'?(i+1)%n:e.key==='ArrowLeft'?(i-1+n)%n:e.key==='Home'?0:e.key==='End'?n-1:null;if(next===null)return;e.preventDefault();setTab(next);refs.current[next]?.focus();};
  return <div className="agent-lineups">
    {n>1?<div className="agent-lineup-tabs" role="tablist" aria-label="Elegir equipo" onKeyDown={key}>{rows.map((r,k)=><button key={k} ref={el=>{refs.current[k]=el;}} type="button" role="tab" id={`${id}-t${k}`} aria-controls={`${id}-p`} aria-selected={k===i} tabIndex={k===i?0:-1} onClick={()=>setTab(k)}>{name(r)}</button>)}</div>:<h4>{name(rows[0])}</h4>}
    <div id={`${id}-p`} role={n>1?'tabpanel':undefined} aria-labelledby={n>1?`${id}-t${i}`:undefined}>
      {oneMatch?<p className="agent-muted">{matchLabel(rows[i].match_id,catalog.entities)}</p>:null}
      <LineupPitch key={i} row={rows[i]} catalog={catalog}/></div>
  </div>;
}

/* ---------- Line-up story: one step per substitution or tactical shift, players glide to their new positions ---------- */
const POSITION_ES:Record<number,string>={1:'Arquero',2:'Lateral derecho',3:'Central derecho',4:'Central',5:'Central izquierdo',6:'Lateral izquierdo',7:'Carrilero derecho',8:'Carrilero izquierdo',9:'Pivote derecho',10:'Pivote',11:'Pivote izquierdo',12:'Volante derecho',13:'Mediocentro derecho',14:'Mediocentro',15:'Mediocentro izquierdo',16:'Volante izquierdo',17:'Extremo derecho',18:'Mediapunta derecho',19:'Mediapunta',20:'Mediapunta izquierdo',21:'Extremo izquierdo',22:'Delantero derecho',23:'Delantero centro',24:'Delantero izquierdo',25:'Segundo delantero'};
type StoryPlayer={player_id:number;number:number|null;position_id:number;position_source:'declared'|'lineup'|'inferred'|null};
type StoryStep={seconds:number;period:number;formation:number|null;players:StoryPlayer[];entered:number[];left:number[];moved:number[];substitutions?:{in:number;out:number|null}[]};
type StoryTeam={match_id:number;team_id:number;steps:StoryStep[]};
const storyMinute=(s:StoryStep)=>s.seconds?`${Math.floor(s.seconds/60)+1}′`:'0′';
/** Same placement as the starting XI: tactical lines spread from the goal (bottom) to the halfway line (top). */
function placeOnHalf(ids:{id:number;pos:number}[]){
  const line=(pos:number)=>Math.round(((positionMap[pos]||[60,40])[0]-8)/18);
  const lines=[...new Set(ids.map(p=>line(p.pos)))].sort((a,b)=>a-b);
  return new Map(ids.map(p=>{const py=(positionMap[p.pos]||[60,40])[1];return [p.id,[Math.min(74,Math.max(6,40+(py-40)*1.12)),55-lines.indexOf(line(p.pos))*(47/Math.max(1,lines.length-1))] as [number,number]];}));
}
function StoryPitch({team,catalog}:{team:StoryTeam;catalog:VisualCatalog}){
  const focus=focusPlayer(catalog.entities);
  const [step,setStep]=useState(0);
  const [playing,setPlaying]=useState(false);
  const steps=team.steps,current=steps[step],last=steps.length-1;
  const reduced=typeof window!=='undefined'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  useEffect(()=>{
    if(!playing)return;
    if(step>=last){setPlaying(false);return;}
    const t=setTimeout(()=>setStep(s=>s+1),reduced?1200:2800);
    return ()=>clearTimeout(t);
  },[playing,step,last,reduced]);
  const where=placeOnHalf(current.players.map(p=>({id:p.player_id,pos:p.position_id})));
  // Substitutions are organic: who leaves walks off to the bench at the halfway line, who enters walks on from there.
  // Measured before paint so an entering player never flashes at his final spot.
  const shown=useRef(step);
  const [moves,setMoves]=useState<{ghosts:{p:StoryPlayer;x:number;y:number}[];entering:number[]}>({ghosts:[],entering:[]});
  useLayoutEffect(()=>{
    const from=steps[shown.current];shown.current=step;
    if(!from||from===current)return;
    const at=placeOnHalf(from.players.map(p=>({id:p.player_id,pos:p.position_id})));
    const was=new Set(from.players.map(p=>p.player_id)),now=new Set(current.players.map(p=>p.player_id));
    setMoves({ghosts:from.players.filter(p=>!now.has(p.player_id)).map(p=>({p,x:at.get(p.player_id)![0],y:at.get(p.player_id)![1]})),entering:current.players.filter(p=>!was.has(p.player_id)).map(p=>p.player_id)});
    const t=setTimeout(()=>setMoves({ghosts:[],entering:[]}),2050);
    return ()=>clearTimeout(t);
  },[step]);// eslint-disable-line react-hooks/exhaustive-deps
  const previous=step?new Map(steps[step-1].players.map(p=>[p.player_id,p.position_id])):new Map<number,number>();
  const name=(id:number)=>surname(playerName(id,catalog.entities));
  const numberOf=(id:number)=>steps.flatMap(s=>s.players).find(p=>p.player_id===id)?.number;
  const tagged=(id:number)=>`${name(id)}${numberOf(id)!=null?` (${numberOf(id)})`:''}`;
  const subs=current.substitutions??current.entered.map(id=>({in:id,out:null as number|null}));
  const formationChanged=step>0&&steps[step-1].formation!==current.formation;
  return <div className="agent-story">
    <div className="agent-story-controls">
      <div className="agent-shot-chips" role="group" aria-label="Elegir momento del partido">
        <button type="button" className="agent-story-play" aria-pressed={playing} onClick={()=>{if(step>=last)setStep(0);setPlaying(p=>!p);}}>{playing?'Pausa':step>=last?'Repetir':'Reproducir'}</button>
        {steps.map((s,k)=><button key={k} type="button" className="agent-shot-chip" aria-pressed={k===step} onClick={()=>{setPlaying(false);setStep(k);}}>{storyMinute(s)}{k===0?' Inicio':''}</button>)}
      </div>
    </div>
    <svg viewBox="-3 -3 86 66" className="agent-pitch agent-lineup-pitch" aria-label={`Alineación de ${label('team_id',team.team_id,catalog)} en el minuto ${storyMinute(current)}`}><HalfPitchVertical/>
      {current.players.map(p=>{
        const [x,y]=where.get(p.player_id)!;
        const highlighted=p.player_id===focus?.player_id,full=playerName(p.player_id,catalog.entities),tag=surname(full),w=tag.length*1.42+3;
        const moved=current.moved.includes(p.player_id),entered=current.entered.includes(p.player_id);
        const role=POSITION_ES[p.position_id]??'Posición sin dato';
        const note=p.position_source==='inferred'?' (posición inferida: la del jugador al que reemplazó)':'';
        return <g key={p.player_id} className={'agent-story-player'+(moves.entering.includes(p.player_id)?' agent-story-in':'')} style={{transform:`translate(${x}px,${y}px)`,'--x':`${x}px`,'--y':`${y}px`} as CSSProperties} role="img"
          aria-label={`${p.number??''} ${full}, ${role}${moved&&previous.has(p.player_id)?`, antes ${POSITION_ES[previous.get(p.player_id)!]??''}`:''}${entered?', entró en este momento':''}${note}`}>
          <title>{`${full}: ${role}${note}`}</title>
          {moved||entered?<circle r="4.1" fill="none" stroke={entered?'#7fd6a5':'#f2c14e'} strokeWidth=".45"/>:null}
          <circle r="2.9" fill={highlighted?MESSI_TOKEN:'#f4f7f6'} stroke="#0b2027" strokeWidth=".3" strokeDasharray={p.position_source==='inferred'?'.8 .6':undefined}/>
          <text y="1" textAnchor="middle" fill={highlighted?'#fff':'#10252c'} fontSize="2.8" fontWeight="700">{p.number??''}</text>
          <rect x={-w/2} y="3.6" width={w} height="3.9" rx="1" fill="#0b2027" opacity=".92"/>
          <text y="6.45" textAnchor="middle" fill="#fff" fontSize="2.3" fontWeight="700">{tag}</text></g>;
      })}
      {moves.ghosts.map(({p,x,y})=>{const tag=surname(playerName(p.player_id,catalog.entities)),w=tag.length*1.42+3;
        return <g key={'out'+p.player_id} className="agent-story-out" style={{'--x':`${x}px`,'--y':`${y}px`} as CSSProperties} aria-hidden="true">
          <circle r="2.9" fill="#f4f7f6" stroke="#0b2027" strokeWidth=".3"/><text y="1" textAnchor="middle" fill="#10252c" fontSize="2.8" fontWeight="700">{p.number??''}</text>
          <rect x={-w/2} y="3.6" width={w} height="3.9" rx="1" fill="#0b2027" opacity=".92"/><text y="6.45" textAnchor="middle" fill="#fff" fontSize="2.3" fontWeight="700">{tag}</text></g>;})}
    </svg>
    <div className="agent-story-caption" aria-live="polite">
      <p className="agent-formation" aria-label={`Formación ${formation(current.formation)}`}>{formation(current.formation)}</p>
      <p className="agent-story-when">{step===0?'Once inicial':`Minuto ${storyMinute(current)}`}{formationChanged?` · cambia de ${formation(steps[step-1].formation)} a ${formation(current.formation)}`:''}</p>
      {subs.length||current.moved.length?<ul className="agent-story-changes">
        {subs.map(s=><li key={s.in}><i className="agent-story-dot agent-story-dot-in"/>Entra {tagged(s.in)}{s.out!=null?` por ${tagged(s.out)}`:''} para jugar de {POSITION_ES[current.players.find(p=>p.player_id===s.in)!.position_id]?.toLowerCase()}</li>)}
        {current.moved.map(id=><li key={id}><i className="agent-story-dot agent-story-dot-move"/>{name(id)} pasa de {POSITION_ES[previous.get(id)!]?.toLowerCase()} a {POSITION_ES[current.players.find(p=>p.player_id===id)!.position_id]?.toLowerCase()}</li>)}
      </ul>:null}
      {current.players.some(p=>p.position_source==='inferred')?<p className="agent-muted">Borde punteado: StatsBomb no registró su posición; se usa la del jugador al que reemplazó.</p>:null}
    </div>
  </div>;
}
function LineupStory({result,catalog}:Props){
  const [tab,setTab]=useState(0);
  const refs=useRef<(HTMLButtonElement|null)[]>([]);
  const teams=result.rows as unknown as StoryTeam[],n=teams.length,i=Math.min(tab,n-1),id=useId();
  const key=(e:{key:string;preventDefault():void})=>{const next=e.key==='ArrowRight'?(i+1)%n:e.key==='ArrowLeft'?(i-1+n)%n:e.key==='Home'?0:e.key==='End'?n-1:null;if(next===null)return;e.preventDefault();setTab(next);refs.current[next]?.focus();};
  return <div className="agent-lineups">
    {n>1?<div className="agent-lineup-tabs" role="tablist" aria-label="Elegir equipo" onKeyDown={key}>{teams.map((t,k)=><button key={k} ref={el=>{refs.current[k]=el;}} type="button" role="tab" id={`${id}-t${k}`} aria-controls={`${id}-p`} aria-selected={k===i} tabIndex={k===i?0:-1} onClick={()=>setTab(k)}>{label('team_id',t.team_id,catalog)}</button>)}</div>:null}
    <div id={`${id}-p`} role={n>1?'tabpanel':undefined} aria-labelledby={n>1?`${id}-t${i}`:undefined}>
      <p className="agent-muted">{matchLabel(teams[i].match_id,catalog.entities)}</p>
      <StoryPitch key={i} team={teams[i]} catalog={catalog}/></div>
  </div>;
}

/* ---------- Chronology ---------- */
function Table({result,catalog}:Props){
  const keys=[...new Set(result.rows.flatMap(Object.keys))];
  const perspective=perspectiveTeam(result,catalog.entities);
  const numeric=(k:string)=>!k.endsWith('_id')&&result.rows.some(r=>typeof r[k]==='number');
  return <div className="agent-table-wrap" tabIndex={0} role="region" aria-label="Datos exactos"><table><thead><tr>{keys.map(k=><th key={k} title={k} className={numeric(k)?'agent-num':undefined}>{metricLabel(k,catalog)}</th>)}</tr></thead>
    <tbody>{result.rows.map((r,i)=><tr key={i}>{keys.map(k=><td key={k} className={numeric(k)?'agent-num':undefined}>{label(k,r[k],catalog,perspective)}</td>)}</tr>)}</tbody></table></div>;
}

/* ---------- Shared entry points: renderer and evidence without the result container (used by /agent-propuesta) ---------- */
export function resultBody({result,catalog}:Props):ReactNode|null{
  const view=result.visualization,query=result.query;
  const aggregated=(query.metrics?.length??0)>0;
  return !result.rows.length?null
    :view==='pitch'?<EventPitch result={result} catalog={catalog}/>
    :view==='heatmap'?<Heat result={result} catalog={catalog}/>
    :view==='network'?<Network result={result} catalog={catalog}/>
    :view==='lineup'?<Lineups result={result} catalog={catalog}/>
    :view==='lineup_story'?<LineupStory result={result} catalog={catalog}/>
    :view==='creation_chains'?<ChainMap result={result} catalog={catalog}/>
    :view==='match_result'?<MatchResult match={result.rows[0] as unknown as MatchSummary}/>
    :view==='trend'?<Trend result={result} catalog={catalog}/>
    :view==='bars'||(aggregated&&result.rows.length<=40)?<MetricPanels result={result} catalog={catalog}/>
    :null;
}
export {Table as ResultTable,metricLabel,matchLabel};
export const datasetLabel=(dataset:string)=>DATASET_ES[dataset]??dataset;

export default function AgentVisual({result,catalog}:Props){
  const view=result.visualization,query=result.query;
  const viewLabel=catalog.views[view]?.label??view;
  const body=resultBody({result,catalog});
  return <section className="agent-result">
    <header><div><span className="agent-kicker">{query.title?viewLabel:DATASET_ES[query.dataset]??query.dataset}</span><h3>{query.title||viewLabel}</h3></div><span>{result.matched_source_rows.toLocaleString('es')} registros</span></header>
    {result.rows.length===0?<p>No hay registros para esta selección.</p>:body}
    {result.truncated?<p role="status" className="agent-warning">Se muestran solo {result.rows.length} filas. Afina los filtros: esto no representa el conjunto completo.</p>:null}
    {result.rows.length?<details open={body===null}><summary>Datos exactos y alternativa accesible</summary><Table result={result} catalog={catalog}/></details>:null}
    <details><summary>Procedencia y consulta reproducible</summary><pre>{JSON.stringify({query:result.query,provenance:result.provenance},null,2)}</pre></details>
  </section>;
}
