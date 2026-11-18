import {test,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for(const size of [{width:1440,height:800},{width:1440,height:1000},{width:1920,height:1080}]){
 test(`Messi explorer and pitch at ${size.width}x${size.height}`,async({page})=>{
  await page.setViewportSize(size);
  await page.goto('/agent');
  await expect(page.getByText('833',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Messi. El juego. El contexto.'})).toBeVisible();
  await expect(page.getByRole('button',{name:'Analizar →'})).toBeDisabled();
  await page.getByRole('button',{name:'02 Explorar los datos'}).click();
  await expect(page.getByLabel('Jugador',{exact:true})).toHaveValue('5503');
  await page.getByRole('button',{name:'Ejecutar consulta'}).click();
  await expect(page.getByRole('heading',{name:'Mapa de eventos',exact:true})).toBeVisible();
  await expect(page.getByText('Relleno: gol.',{exact:false})).toBeVisible();
  await expect(page.getByLabel('Cancha: pitch')).toBeVisible();
  await expect(page.getByText('Resultado limitado',{exact:false})).toHaveCount(0);
  await page.screenshot({path:`test-results/messi-agent-${size.width}x${size.height}.png`,fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 });
}
test('Gold heatmap, empty data and accessible reading',async({page})=>{
 await page.goto('/agent');
 await page.getByRole('button',{name:'02 Explorar los datos'}).click();
 await page.getByLabel('Dataset',{exact:true}).selectOption('receipts');
 await page.getByLabel('Visualización',{exact:true}).selectOption('heatmap');
 await page.getByRole('button',{name:'Ejecutar consulta'}).click();
 await expect(page.getByLabel('Cancha: heatmap')).toBeVisible();
 await page.getByText('Datos exactos y alternativa accesible').click();
 await expect(page.locator('table')).toBeVisible();
 const violations=(await new AxeBuilder({page}).analyze()).violations;
 expect(violations).toEqual([]);
});

test('All eight registered views render real Messi Gold results',async({page,request})=>{
 const catalog=await (await request.get('/api/agent/catalog')).json();
 const final=catalog.entities.matches.find((m:{stage_name:string})=>m.stage_name==='Final');
 await page.goto('/agent');
 await expect(page.getByText('833',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'02 Explorar los datos'}).click();
 for(const [dataset,view] of [['actions','pitch'],['receipts','heatmap'],['connections','network'],['initial_lineups','lineup'],['player_match','bars'],['player_match','trend'],['shot_creations','table']]){
  await page.getByLabel('Dataset',{exact:true}).selectOption(dataset);
  await page.getByLabel('Visualización',{exact:true}).selectOption(view);
  if(await page.getByLabel('Partido',{exact:true}).count()) await page.getByLabel('Partido',{exact:true}).selectOption(view==='trend'?'':String(final.match_id));
  if(view==='trend') await page.getByLabel('Agrupar por',{exact:true}).selectOption('match_id');
  await page.getByRole('button',{name:'Ejecutar consulta'}).click();
  await expect(page.getByRole('heading',{name:catalog.views[view].label,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Ejecutar consulta'})).toBeEnabled();
  if(['pitch','heatmap','network','lineup'].includes(view))await expect(page.getByLabel('Cancha: '+view)).toBeVisible();
  if(view==='trend')await expect(page.getByLabel('Evolución de Tiros')).toBeVisible();
 }
});

test('Both starting XIs are visible for a Messi match comparison',async({page,request})=>{
 const catalog=await (await request.get('/api/agent/catalog')).json();
 const match=catalog.entities.matches.find((m:{team_name:string;opponent_name:string})=>[m.team_name,m.opponent_name].includes('Argentina')&&[m.team_name,m.opponent_name].includes('Netherlands'));
 await page.goto('/agent');
 await expect(page.getByText('833',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'02 Explorar los datos'}).click();
 await page.getByLabel('Dataset',{exact:true}).selectOption('initial_lineups');
 await page.getByLabel('Visualización',{exact:true}).selectOption('lineup');
 await page.getByLabel('Partido',{exact:true}).selectOption(String(match.match_id));
 await page.getByLabel('Selección',{exact:true}).selectOption('');
 await page.getByRole('button',{name:'Ejecutar consulta'}).click();
 await expect(page.getByRole('group',{name:'Once de Argentina',exact:true})).toBeVisible();
 await expect(page.getByRole('group',{name:'Once de Países Bajos',exact:true})).toBeVisible();
 await expect(page.getByLabel('Cancha: lineup',{exact:true})).toHaveCount(2);
 await expect(page.getByRole('group',{name:'Once de Argentina',exact:true}).locator('.agent-lineup-key')).toHaveText('Lionel Messi');
 await expect(page.getByRole('group',{name:'Once de Países Bajos',exact:true}).locator('.agent-lineup-key')).toHaveCount(0);
 const violations=(await new AxeBuilder({page}).analyze()).violations;
 expect(violations).toEqual([]);
 await page.screenshot({path:'test-results/messi-lineup-comparison.png',fullPage:true});
});

// Session, model catalog and model text are mocked here; every visualization payload is a real Gold query result.
test('Conversation renders dashboards of real Gold visuals, keeps context and restores history',async({page,request})=>{
 const catalog=await (await request.get('/api/agent/catalog')).json();
 const player=(fragment:string)=>catalog.entities.players.find((p:{player_name:string})=>p.player_name.includes(fragment));
 const messi=player('Messi'),mbappe=player('Mbapp');
 const final=catalog.entities.matches.find((m:{stage_name:string})=>m.stage_name==='Final');
 const gold=async(data:object)=>{const r=await request.post('/api/agent/query',{data});expect(r.ok(),JSON.stringify(data)).toBeTruthy();return r.json();};
 const me={column:'player_id',value:messi.player_id},inFinal={column:'match_id',value:final.match_id},both={column:'player_id',op:'in',value:[messi.player_id,mbappe.player_id]};
 const first=[
  await gold({dataset:'player_match',filters:[me],metrics:['shots','goals','xg','assists'],title:'Los números de Messi en el Mundial'}),
  await gold({dataset:'actions',visualization:'pitch',filters:[me,{column:'type_name',value:'Shot'}],title:'Todos los tiros de Messi'}),
  await gold({dataset:'player_match',visualization:'bars',filters:[both],metrics:['shots','goals','npxg','xg_assisted'],group_by:['player_id'],title:'Messi y Mbappé en el torneo'}),
  await gold({dataset:'player_match',visualization:'trend',filters:[me],metrics:['npxg','xg_assisted'],group_by:['match_id'],order_by:'match_id',descending:false,title:'Peligro generado partido a partido'}),
 ];
 const second=[
  await gold({dataset:'initial_lineups',visualization:'lineup',filters:[inFinal],limit:2,title:'Los onces de la final'}),
  await gold({dataset:'connections',visualization:'network',filters:[inFinal,{column:'team_id',value:messi.team_id}],limit:300,title:'Red de pases de Argentina en la final'}),
  await gold({dataset:'receipts',visualization:'heatmap',filters:[me],title:'Dónde recibió Messi'}),
  await gold({dataset:'actions',visualization:'pitch',filters:[inFinal,both,{column:'type_name',value:'Shot'}],title:'Tiros de Messi y Mbappé en la final'}),
 ];
 expect(first[1].rows).toHaveLength(32);
 expect(second[0].rows).toHaveLength(2);
 const bodies:{question:string;conversation_id:string|null;model:string;audience:string}[]=[];
 const turns:object[]=[];
 await page.route('**/api/auth/status',r=>r.fulfill({json:{authenticated:true,account_id:'test',email:'demo@example.com'}}));
 await page.route('**/api/agent/models',r=>r.fulfill({json:{models:[{slug:'model-a',display_name:'Model A'},{slug:'model-b',display_name:'Model B'}],selected:'model-a'}}));
 await page.route('**/api/agent/conversations/c-1',r=>r.fulfill({json:{conversation_id:'c-1',turns}}));
 await page.route('**/api/agent/chat',async r=>{
  const body=r.request().postDataJSON();bodies.push(body);
  if(bodies.length===3)return r.fulfill({status:502,json:{detail:'La inferencia no se completó. Revisa los límites de tu plan o vuelve a intentarlo.'}});
  const turn={question:body.question,answer:bodies.length===1?'## Resumen\n**Respuesta verificada uno.**':'Respuesta verificada dos.',model:body.model,trace:[{tool:'find_entities',ok:true},{tool:'query_gold',ok:true}],visualizations:bodies.length===1?first:second};
  turns.push(turn);
  return r.fulfill({json:{conversation_id:'c-1',turn}});
 });
 await page.goto('/agent');
 await expect(page.getByText('demo@example.com')).toBeVisible();
 await expect(page.getByText('Continue with ChatGPT')).toHaveCount(0);
 await expect(page.getByLabel('Modelo')).toHaveValue('model-a');
 await expect(page.locator('.agent-suggestions button')).toHaveCount(6);
 await page.locator('.agent-suggestions button').first().click();
 await expect(page.getByLabel('Tu pregunta sobre el Mundial de Messi')).toHaveValue(/Messi/);
 await page.getByRole('button',{name:'Analizar →'}).click();
 // Markdown the model may still emit is shown as clean text.
 await expect(page.locator('.agent-answer').first()).toHaveText('Resumen\nRespuesta verificada uno.');
 await expect(page.getByText('model-a · find_entities ✓ → query_gold ✓')).toBeVisible();
 for(const title of ['Los números de Messi en el Mundial','Todos los tiros de Messi','Messi y Mbappé en el torneo','Peligro generado partido a partido'])await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
 // Headline numbers as cards, straight from Gold.
 const tiles=page.locator('.agent-tiles').first();
 await expect(tiles.locator('.agent-tile')).toHaveCount(4);
 await expect(tiles.getByText('Tiros',{exact:true})).toBeVisible();
 await expect(tiles.getByText('32',{exact:true})).toBeVisible();
 await expect(tiles.getByText('7',{exact:true})).toBeVisible();
 await expect(page.getByLabel('Cancha: pitch')).toBeVisible();
 await expect(page.getByLabel('Cancha: pitch').getByRole('button')).toHaveCount(32);
 // One panel per metric: no shared axis for different scales.
 await expect(page.getByLabel('Evolución de xG sin penales')).toBeVisible();
 await expect(page.getByLabel('Evolución de xG asistido')).toBeVisible();
 await expect(page.getByRole('region',{name:'Tiros',exact:true}).getByText('Kylian Mbappé')).toBeVisible();
 expect(bodies[0]).toMatchObject({conversation_id:null,model:'model-a',audience:'fan'});
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 await page.screenshot({path:'test-results/messi-dashboard-1.png',fullPage:true});
 await page.getByLabel('Modelo').selectOption('model-b');
 await page.getByLabel('Nivel de explicación').selectOption('simple');
 await page.getByLabel('Tu pregunta sobre el Mundial de Messi').fill('Ahora compara los dos onces de ese partido.');
 await page.getByRole('button',{name:'Analizar →'}).click();
 await expect(page.getByText('Respuesta verificada dos.')).toBeVisible();
 await expect(page.getByRole('group',{name:'Once de Argentina',exact:true})).toBeVisible();
 await expect(page.getByRole('group',{name:'Once de Francia',exact:true})).toBeVisible();
 await expect(page.getByLabel('Cancha: network')).toBeVisible();
 await expect(page.getByLabel('Cancha: heatmap')).toBeVisible();
 await expect(page.getByLabel('Línea de tiempo del partido')).toBeVisible();
 expect(bodies[1]).toMatchObject({conversation_id:'c-1',model:'model-b',audience:'simple'});
 await page.getByLabel('Tu pregunta sobre el Mundial de Messi').fill('Pregunta que falla');
 await page.getByRole('button',{name:'Analizar →'}).click();
 await expect(page.getByRole('alert').filter({hasText:'La inferencia no se completó'})).toBeVisible();
 await expect(page.getByLabel('Tu pregunta sobre el Mundial de Messi')).toHaveValue('Pregunta que falla');
 expect((await new AxeBuilder({page}).analyze()).violations).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.screenshot({path:'test-results/messi-dashboard-2.png',fullPage:true});
 await page.reload();
 await expect(page.getByText('Respuesta verificada dos.')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Los onces de la final',exact:true})).toBeVisible();
 await expect(page.getByLabel('Nivel de explicación')).toHaveValue('simple');
 for(const size of [{width:1920,height:1080},{width:1440,height:800}]){
  await page.setViewportSize(size);
  await expect(page.getByLabel('Cancha: network')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.screenshot({path:`test-results/messi-dashboard-${size.width}x${size.height}.png`,fullPage:true});
 }
});
