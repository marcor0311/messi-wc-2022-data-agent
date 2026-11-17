'use client';
import { useRef, useState, type FocusEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';

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
const VALUE_ES:Record<string,string>={Shot:'Tiro',Pass:'Pase',Carry:'Conducción',Dribble:'Regate',Pressure:'Presión','Ball Receipt*':'Recepción','Ball Recovery':'Recuperación',Duel:'Duelo',Clearance:'Despeje',Block:'Bloqueo','Foul Committed':'Falta cometida','Foul Won':'Falta recibida',Miscontrol:'Mal control',Dispossessed:'Pérdida',Interception:'Intercepción','Goal Keeper':'Acción de arquero',Substitution:'Cambio',Offside:'Fuera de juego',
  Goal:'Gol',Saved:'Atajado','Off T':'Fuera',Blocked:'Bloqueado',Post:'Al poste',Wayward:'Desviado','Saved to Post':'Atajado al poste','Saved Off Target':'Atajado, iba fuera',Complete:'Completo',Incomplete:'Incompleto',Out:'Fuera del campo',Unknown:'Desconocido','Pass Offside':'Pase en fuera de juego',
  'Open Play':'Juego abierto','Free Kick':'Tiro libre',Penalty:'Penal',Corner:'Córner','Regular Play':'Juego corrido','From Throw In':'Tras saque de banda','From Free Kick':'Tras tiro libre','From Goal Kick':'Tras saque de arco','From Corner':'Tras córner','From Keeper':'Desde el arquero','From Kick Off':'Tras saque inicial','From Counter':'Contraataque',Other:'Otra',
  'Group Stage':'Fase de grupos','Round of 16':'Octavos de final','Quarter-finals':'Cuartos de final','Semi-finals':'Semifinal','3rd Place Final':'Tercer puesto',Final:'Final'};
const COLUMN_ES:Record<string,string>={match_id:'Partido',team_id:'Selección',opponent_id:'Rival',player_id:'Jugador',recipient_id:'Receptor',passer_id:'Pasador',creator_id:'Creador',shooter_id:'Rematador',team_name:'Selección',opponent_name:'Rival',player_name:'Jugador',stage_name:'Fase',match_date:'Fecha',minute:'Minuto',second:'Segundo',period:'Período',type_name:'Acción',outcome_name:'Resultado',shot_type:'Tipo de tiro',play_pattern_name:'Jugada',statsbomb_xg:'xG',pass_count:'Pases',count:'Cantidad',location_x:'Origen x',location_y:'Origen y',end_x:'Destino x',end_y:'Destino y',formation_code:'Formación',event_index:'Orden',event_id:'Evento',is_goal:'Gol',is_penalty:'Penal',is_complete:'Completo',under_pressure:'Bajo presión',bin_x:'Zona x',bin_y:'Zona y',goals_for:'Goles a favor',goals_against:'Goles en contra',is_starter:'Titular',
  goals:'Goles',xg:'Goles esperados (xG)',npxg:'xG sin penales',assists:'Asistencias'};
const DATASET_ES:Record<string,string>={actions:'Acciones de partido',receipts:'Recepciones',connections:'Conexiones de pase',initial_lineups:'Alineaciones iniciales',player_match:'Jugador por partido',team_match:'Selección por partido',shot_creations:'Creación de tiros',lineup_changes:'Cambios de alineación',lineup_segments:'Tramos tácticos',segment_player_metrics:'Jugador por tramo',shootout_actions:'Tandas de penales'};
const PLAYER_KEYS=['player_id','recipient_id','passer_id','creator_id','shooter_id'];
const PERIOD_ES:Record<number,string>={1:'1.er tiempo',2:'2.º tiempo',3:'Prórroga (1.ª parte)',4:'Prórroga (2.ª parte)',5:'Tanda de penales'};

/* ---------- Colour: validated with dataviz validate_palette (all pairs) on each surface. Messi is always gold. ---------- */
type Palette={focus:string;series:string[];other:string};
const ON_PITCH:Palette={focus:'#c98500',series:['#3987e5','#d55181'],other:'#9fb3b6'};
const ON_CARD:Palette={focus:'#c27a00',series:['#2a78d6','#1b9a6c'],other:'#8a9a9c'};
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
  return short?teams:`${teams} · ${VALUE_ES[m.stage_name]??m.stage_name} · ${shortDate(m.match_date)}`;
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
function useTip(){
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
  const node=tip?<div className="agent-tip" aria-hidden="true" style={{left:tip.x,top:tip.y}}>{tip.content}</div>:null;
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
  const name=(r:DataRow)=>groups.map(g=>label(g,r[g],catalog,perspective)).join(' · ')||'Total';
  if(result.rows.length===1)return <>{groups.length?<p className="agent-who">{name(result.rows[0])}</p>:null}<Tiles row={result.rows[0]} metrics={metrics} catalog={catalog}/></>;
  const filteredToFocus=result.query.filters.some(f=>f.op==='eq'&&f.column==='player_id'&&f.value===focus?.player_id);
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
    <div className="agent-panels">{metrics.map(metric=>{
      const rows=ordered(metric),maximum=Math.max(...rows.map(r=>Math.abs(num(r[metric])??0)),0)||1;
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
  const name=metricLabel(metric,catalog);
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
        const long=`${matchLabel(r.match_id,catalog.entities,perspective)}: ${name} ${formatMetric(metric,r[metric])}`;
        const step=(W-L-R)/Math.max(1,n-1);
        return <g key={i} role="img" tabIndex={0} aria-label={long} onPointerEnter={()=>setActive(i)} onPointerOut={()=>setActive(null)} {...bind(<><strong>{formatMetric(metric,r[metric])}</strong><span>{name}</span><span>{matchLabel(r.match_id,catalog.entities,perspective)}</span></>)}>
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
  const metrics=result.query.metrics?.length?result.query.metrics:['count'];
  const date=(r:DataRow)=>catalog.entities.matches.find(m=>m.match_id===r.match_id)?.match_date||String(r.match_id);
  const rows=[...result.rows].sort((a,b)=>date(a).localeCompare(date(b)));
  const focus=focusPlayer(catalog.entities),perspective=perspectiveTeam(result,catalog.entities);
  const aboutFocus=result.query.filters.some(f=>f.op==='eq'&&((f.column==='player_id'&&f.value===focus?.player_id)||(f.column==='team_id'&&f.value===focus?.team_id)));
  if(rows.length<2)return <MetricPanels result={result} catalog={catalog}/>;
  return <><div className="agent-panels">{metrics.map(m=><TrendPanel key={m} metric={m} rows={rows} catalog={catalog} perspective={perspective} color={aboutFocus?ON_CARD.focus:ON_CARD.series[0]}/>)}</div>
    <p className="agent-muted">Partidos en orden cronológico. Cada métrica tiene su propia escala; se rotulan el valor más alto y el último.</p></>;
}

/* ---------- Events on the pitch ---------- */
function describeEvent(r:DataRow,catalog:VisualCatalog){
  const who=r.player_id!=null?playerName(r.player_id,catalog.entities):label('team_id',r.team_id,catalog);
  const type=typeof r.type_name==='string'?VALUE_ES[r.type_name]??r.type_name:'Recepción';
  const kind=typeof r.shot_type==='string'&&r.shot_type!=='Open Play'?` de ${(VALUE_ES[r.shot_type]??r.shot_type).toLowerCase()}`:'';
  const outcome=typeof r.outcome_name==='string'?` · ${VALUE_ES[r.outcome_name]??r.outcome_name}`:'';
  const target=r.recipient_id!=null?` → ${playerName(r.recipient_id,catalog.entities)}`:'';
  const when=[num(r.minute)!==null?`Minuto ${r.minute}`:null,num(r.period)!==null?PERIOD_ES[r.period as number]:null].filter(Boolean).join(' · ');
  const xg=num(r.statsbomb_xg);
  return {who,what:`${type}${kind}${target}${outcome}`,when,xg:xg!==null?`xG ${nf(2).format(xg)}`:null,match:matchLabel(r.match_id,catalog.entities)};
}
function EventPitch({result,catalog}:Props){
  const {wrap,bind,node}=useTip();
  const [hidden,setHidden]=useState<string[]>([]);
  const [selected,setSelected]=useState<DataRow|null>(null);
  const focus=focusPlayer(catalog.entities);
  const byPlayer=result.rows.some(r=>r.player_id!=null);
  const key=(r:DataRow)=>String((byPlayer?r.player_id:r.team_id)??'all');
  const ids=[...new Set(result.rows.map(key))];
  const colors=seriesColors(ids,String(byPlayer?focus?.player_id:focus?.team_id),ON_PITCH);
  const seriesName=(id:string)=>id==='all'?'Todos':label(byPlayer?'player_id':'team_id',Number(id),catalog);
  const located=result.rows.filter(r=>num(r.location_x)!==null&&num(r.location_y)!==null);
  const rows=located.filter(r=>!hidden.includes(key(r)));
  const shots=located.length>0&&located.every(r=>r.type_name==='Shot');
  const radius=(r:DataRow)=>shots?1+2.2*Math.sqrt(Math.max(0,num(r.statsbomb_xg)??0)):.95;
  const solid=(r:DataRow)=>shots?truthy(r.is_goal)||r.outcome_name==='Goal':r.is_complete!==0&&r.outcome_name!=='Incomplete';
  const interactive=rows.length<=80;
  const drawn=[...rows].sort((a,b)=>radius(b)-radius(a));
  const tip=(r:DataRow)=>{const d=describeEvent(r,catalog);return <><strong>{d.who}</strong><span>{d.what}</span>{d.xg?<span>{d.xg}</span>:null}<span>{d.when}</span><span>{d.match}</span></>;};
  const name=(r:DataRow)=>{const d=describeEvent(r,catalog);return [d.who,d.what,d.xg,d.when,d.match].filter(Boolean).join('. ');};
  return <><div className="agent-legend"><span>Dirección de ataque →</span>
      {ids.length>1&&ids.length<=24?<div className="agent-chips" role="group" aria-label="Mostrar u ocultar">{ids.map(id=><button type="button" key={id} className="agent-chip" aria-pressed={!hidden.includes(id)} onClick={()=>setHidden(h=>h.includes(id)?h.filter(x=>x!==id):[...h,id])}><i style={{background:colors.get(id)}}/>{seriesName(id)} <b>{located.filter(r=>key(r)===id).length}</b></button>)}</div>
        :ids.length===1?<span className="agent-key"><i style={{background:colors.get(ids[0])}}/>{seriesName(ids[0])}</span>:null}</div>
    <div className="agent-plot" ref={wrap}><svg viewBox="-4 -5 128 90" className="agent-pitch" aria-label={`Cancha: ${result.visualization}`}><PitchLines/>
      {rows.map((r,i)=>num(r.end_x)!==null&&num(r.end_y)!==null?<line key={i} x1={r.location_x as number} y1={r.location_y as number} x2={r.end_x as number} y2={r.end_y as number} stroke={colors.get(key(r))} strokeWidth=".35" opacity={solid(r)?.75:.4}/>:null)}
      {drawn.map((r,i)=>{
        const color=colors.get(key(r)),x=r.location_x as number,y=r.location_y as number,size=radius(r)*(selected===r?1.25:1);
        const action=interactive?{role:'button',tabIndex:0,'aria-label':name(r),onClick:()=>setSelected(r),onKeyDown:(e:{key:string;preventDefault():void})=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelected(r);}}}:{};
        return <g key={i} {...bind(tip(r))} {...action}>
          <circle cx={x} cy={y} r={Math.max(2.2,size+.8)} fill="transparent"/>
          <circle cx={x} cy={y} r={size} fill={color} fillOpacity={solid(r)?1:.16} stroke={solid(r)?PITCH_SURFACE:color} strokeWidth={solid(r)?.3:.45}/>
        </g>;
      })}
    </svg>{node}</div>
    <p className="agent-muted">{shots?'Cada círculo es un tiro en el lugar desde donde salió. Relleno: gol. Hueco: no fue gol. Cuanto más grande, más fácil era convertirlo (más xG). La línea marca hacia dónde fue.':'Cada punto es una acción en el lugar donde ocurrió; la línea indica su destino registrado. Relleno: completada. Hueco: no completada.'}{located.length<result.rows.length?` ${result.rows.length-located.length} registros sin ubicación no aparecen en la cancha.`:''}{interactive?' Selecciona un punto para ver su detalle.':''}</p>
    {selected?(()=>{const d=describeEvent(selected,catalog);return <p className="agent-detail" role="status"><strong>{d.who}</strong> · {d.what}{d.xg?` · ${d.xg}`:''} · {d.when} · {d.match}</p>;})():null}
  </>;
}

/* ---------- Activity zones ---------- */
function Heat({result,catalog}:Props){
  const {wrap,bind,node}=useTip();
  const maximum=Math.max(1,...result.rows.map(r=>num(r.count)??0));
  const peak=result.rows.reduce((best,r)=>(num(r.count)??0)>(num(best.count)??0)?r:best,result.rows[0]);
  const focus=focusPlayer(catalog.entities);
  const hue=result.query.filters.some(f=>f.op==='eq'&&f.column==='player_id'&&f.value===focus?.player_id)?ON_PITCH.focus:ON_PITCH.series[0];
  const zone=(r:DataRow)=>`${nf(0).format(num(r.count)??0)} acciones en la zona x ${Number(r.bin_x)*10}–${Number(r.bin_x)*10+10}, y ${Number(r.bin_y)*10}–${Number(r.bin_y)*10+10}`;
  return <><div className="agent-legend"><span>Dirección de ataque →</span><span className="agent-scale">Menos<i style={{background:`linear-gradient(90deg,${hue}22,${hue})`}}/>Más · máximo {nf(0).format(maximum)} por zona</span></div>
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
          <circle cx={x} cy={y} r={1.5+1.9*Math.sqrt((n.given+n.received)/busiest)} fill={isFocus?ON_PITCH.focus:ON_PITCH.series[0]} stroke={PITCH_SURFACE} strokeWidth=".35"/>
          <text x={x} y={y+5.2} textAnchor="middle" fontSize="2.1" fontWeight={isFocus?700:400} fill={PITCH_INK} stroke={PITCH_SURFACE} strokeWidth=".7" paintOrder="stroke">{surname(full)}</text>
        </g>;})}
    </svg>{node}</div>
    <p className="agent-muted">Cada círculo es un jugador, en el lugar promedio de sus pases. Cuanto más gruesa la línea, más pases completados entre esos dos jugadores. No son posiciones de seguimiento.{edges.length>shown.length?` Se dibujan las ${shown.length} conexiones más frecuentes de ${edges.length}.`:''}</p></>;
}

/* ---------- Starting XI ---------- */
type LineupPlayer={player:{id:number;name:string};position:{id:number;name:string};jersey_number:number};
const positionMap:Record<number,[number,number]>={1:[8,40],2:[27,70],3:[26,55],4:[25,40],5:[26,25],6:[27,10],7:[45,70],8:[45,10],9:[44,55],10:[44,40],11:[44,25],12:[62,70],13:[62,55],14:[62,40],15:[62,25],16:[62,10],17:[82,70],18:[82,55],19:[82,40],20:[82,25],21:[82,10],22:[101,55],23:[101,40],24:[101,25],25:[108,40]};
function LineupPitch({row,catalog}:{row:DataRow;catalog:VisualCatalog}){
  const focus=focusPlayer(catalog.entities);
  const players=row.players as unknown as LineupPlayer[];
  const inLineup=players.some(p=>p.player.id===focus?.player_id);
  return <><div className="agent-legend"><span>Dirección de ataque →</span>{inLineup?<span className="agent-key agent-lineup-key"><i style={{background:ON_PITCH.focus}}/>{playerName(focus!.player_id,catalog.entities)}</span>:null}</div>
    <svg viewBox="-4 -5 128 90" className="agent-pitch" aria-label="Cancha: lineup"><PitchLines/>
      {players.map(p=>{
        const [x,y]=positionMap[p.position.id]||[60,40];
        const highlighted=p.player.id===focus?.player_id,full=playerName(p.player.id,catalog.entities);
        // Neighbouring tactical lines are 18 units apart, narrower than a name: alternate the label side per line.
        const above=Math.ceil((p.position.id-1)/5)%2===1;
        return <g key={p.player.id}><title>{full} · {p.position.name}</title><circle cx={x} cy={y} r={highlighted?2.9:2.4} fill={highlighted?ON_PITCH.focus:'#7bd4fa'} stroke="#0b2027" strokeWidth=".25"/><text x={x} y={y+.9} textAnchor="middle" fill="#10252c" fontSize="2.7" fontWeight="600">{p.jersey_number}</text><text x={x} y={above?y-3.8:y+5.4} textAnchor="middle" fill={PITCH_INK} fontSize="2" fontWeight={highlighted?700:400}>{surname(full)}</text></g>;
      })}
    </svg>
    <p className="agent-muted">Formación {format(row.formation_code)} · esquema de las posiciones declaradas al inicio. Representan roles tácticos, no ubicaciones medidas.</p></>;
}
function Lineups({result,catalog}:Props){
  const [page,setPage]=useState(0);
  const start=Math.min(page*2,Math.max(0,Math.ceil(result.rows.length/2)-1)*2);
  return <>{result.rows.length>2?<div className="agent-lineup-pagination"><span>Alineaciones {start+1}–{Math.min(start+2,result.rows.length)} de {result.rows.length}</span><button type="button" disabled={start===0} onClick={()=>setPage(p=>p-1)}>Anteriores</button><button type="button" disabled={start+2>=result.rows.length} onClick={()=>setPage(p=>p+1)}>Siguientes</button></div>:null}
    <div className="agent-lineup-comparison">{result.rows.slice(start,start+2).map((row,i)=><div key={`${row.match_id}-${row.team_id}-${i}`} role="group" aria-label={'Once de '+label('team_id',row.team_id,catalog)}><h4>{label('team_id',row.team_id,catalog)}</h4><p className="agent-muted">{matchLabel(row.match_id,catalog.entities)}</p><LineupPitch row={row} catalog={catalog}/></div>)}</div></>;
}

/* ---------- Chronology ---------- */
function Timeline({result,catalog}:Props){
  const {wrap,bind,node}=useTip();
  const focus=focusPlayer(catalog.entities);
  const ids=[...new Set(result.rows.map(r=>String(r.player_id??'all')))];
  const colors=seriesColors(ids,String(focus?.player_id),ON_CARD);
  const oneMatch=new Set(result.rows.map(r=>r.match_id)).size===1&&result.rows.length<=200;
  const last=Math.max(90,Math.ceil((Math.max(...result.rows.map(r=>num(r.minute)??0))+1)/15)*15);
  const W=1000,L=30,R=30,axis=74;
  const x=(r:DataRow)=>L+((num(r.minute)??0)+(num(r.second)??0)/60)/last*(W-L-R);
  const goal=(r:DataRow)=>truthy(r.is_goal)||r.outcome_name==='Goal';
  const text=(r:DataRow)=>{const d=describeEvent(r,catalog);return `${d.who} · ${d.what}${d.xg?` · ${d.xg}`:''}`;};
  return <>{oneMatch?<><div className="agent-legend"><span>{matchLabel(result.rows[0].match_id,catalog.entities)}</span><p className="agent-keys">{ids.slice(0,6).map(id=><span className="agent-key" key={id}><i style={{background:colors.get(id)}}/>{id==='all'?'Acciones':playerName(Number(id),catalog.entities)}</span>)}</p></div>
      <div className="agent-plot" ref={wrap}><svg viewBox={`0 0 ${W} 104`} className="agent-strip" aria-label="Línea de tiempo del partido">
        <line x1={L} x2={W-R} y1={axis} y2={axis} stroke="#c3ccc9"/>
        {Array.from({length:last/15+1},(_,i)=>i*15).map(t=><g key={t}><line x1={L+t/last*(W-L-R)} x2={L+t/last*(W-L-R)} y1={axis} y2={axis+6} stroke="#c3ccc9"/><text x={L+t/last*(W-L-R)} y={axis+22} textAnchor="middle" fontSize="13">{t}′</text></g>)}
        {result.rows.map((r,i)=>{const lane=Math.min(2,ids.indexOf(String(r.player_id??'all'))),color=colors.get(String(r.player_id??'all'));
          return <g key={i} role="img" tabIndex={0} aria-label={`Minuto ${format(r.minute)}. ${text(r)}`} {...bind(<><strong>Minuto {format(r.minute)}</strong><span>{text(r)}</span></>)}>
            <circle cx={x(r)} cy={axis-16-lane*18} r="12" fill="transparent"/>
            <circle cx={x(r)} cy={axis-16-lane*18} r={goal(r)?7:5} fill={goal(r)?color:'#fff'} stroke={goal(r)?'#fff':color} strokeWidth="2"/></g>;})}
      </svg>{node}</div>
      <p className="agent-muted">Cada marca es una acción en el minuto en que ocurrió. Rellena: gol.</p></>:null}
    <ol className="agent-timeline" tabIndex={0} aria-label="Acciones en orden">{result.rows.map((r,i)=><li key={i}><strong>{format(r.minute)}′</strong><span>{text(r)}{oneMatch?'':` · ${matchLabel(r.match_id,catalog.entities)}`}</span><em>{num(r.period)!==null?PERIOD_ES[r.period as number]:''}</em></li>)}</ol></>;
}

/* ---------- Exact data ---------- */
function Table({result,catalog}:Props){
  const keys=[...new Set(result.rows.flatMap(Object.keys))];
  const perspective=perspectiveTeam(result,catalog.entities);
  const numeric=(k:string)=>!k.endsWith('_id')&&result.rows.some(r=>typeof r[k]==='number');
  return <div className="agent-table-wrap" tabIndex={0} role="region" aria-label="Datos exactos"><table><thead><tr>{keys.map(k=><th key={k} title={k} className={numeric(k)?'agent-num':undefined}>{metricLabel(k,catalog)}</th>)}</tr></thead>
    <tbody>{result.rows.map((r,i)=><tr key={i}>{keys.map(k=><td key={k} className={numeric(k)?'agent-num':undefined}>{label(k,r[k],catalog,perspective)}</td>)}</tr>)}</tbody></table></div>;
}

export default function AgentVisual({result,catalog}:Props){
  const view=result.visualization,query=result.query;
  const aggregated=(query.metrics?.length??0)>0;
  const viewLabel=catalog.views[view]?.label??view;
  const body=!result.rows.length?null
    :view==='pitch'?<EventPitch result={result} catalog={catalog}/>
    :view==='heatmap'?<Heat result={result} catalog={catalog}/>
    :view==='network'?<Network result={result} catalog={catalog}/>
    :view==='lineup'?<Lineups result={result} catalog={catalog}/>
    :view==='timeline'?<Timeline result={result} catalog={catalog}/>
    :view==='trend'?<Trend result={result} catalog={catalog}/>
    :view==='bars'||(aggregated&&result.rows.length<=40)?<MetricPanels result={result} catalog={catalog}/>
    :null;
  return <section className="agent-result">
    <header><div><span className="agent-kicker">{query.title?viewLabel:DATASET_ES[query.dataset]??query.dataset}</span><h3>{query.title||viewLabel}</h3></div><span>{result.matched_source_rows.toLocaleString('es')} registros</span></header>
    {result.rows.length===0?<p>No hay registros para esta selección.</p>:body}
    {result.truncated?<p role="status" className="agent-warning">Se muestran solo {result.rows.length} filas. Afina los filtros: esto no representa el conjunto completo.</p>:null}
    {result.rows.length?<details open={body===null}><summary>Datos exactos y alternativa accesible</summary><Table result={result} catalog={catalog}/></details>:null}
    <details><summary>Procedencia y consulta reproducible</summary><pre>{JSON.stringify({query:result.query,provenance:result.provenance},null,2)}</pre></details>
  </section>;
}
