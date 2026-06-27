// =========================================
// DATA
// =========================================
const SYM = {coin:'🪙',chest:'📦',key:'🗝️',compass:'🧭',cannon:'💣',dagger:'🗡️',shield:'🛡️',serpent:'🐍',anchor:'⚓',map:'🗺️'};
const PLAYER_COLORS = ['#e0a020','#30a0d0','#d04050','#40c080'];
const PLAYER_EMOJIS = ['👑','⚓','🗡️','🔱'];

const FULL_DECK = [
  {id:"coin_4",name:"Gold Coin",symbol:"coin",value:4,type:"treasure",ability:"none"},
  {id:"coin_5",name:"Gold Coin",symbol:"coin",value:5,type:"treasure",ability:"none"},
  {id:"coin_6",name:"Gold Coin",symbol:"coin",value:6,type:"treasure",ability:"none"},
  {id:"coin_7",name:"Gold Coin",symbol:"coin",value:7,type:"treasure",ability:"none"},
  {id:"coin_8",name:"Gold Coin",symbol:"coin",value:8,type:"treasure",ability:"none"},
  {id:"coin_9",name:"Gold Coin",symbol:"coin",value:9,type:"treasure",ability:"none"},
  {id:"chest_2",name:"Chest",symbol:"chest",value:2,type:"treasure",ability:"double_loot"},
  {id:"chest_3",name:"Chest",symbol:"chest",value:3,type:"treasure",ability:"double_loot"},
  {id:"chest_4",name:"Chest",symbol:"chest",value:4,type:"treasure",ability:"double_loot"},
  {id:"chest_5",name:"Chest",symbol:"chest",value:5,type:"treasure",ability:"double_loot"},
  {id:"chest_6",name:"Chest",symbol:"chest",value:6,type:"treasure",ability:"double_loot"},
  {id:"chest_7",name:"Chest",symbol:"chest",value:7,type:"treasure",ability:"double_loot"},
  {id:"key_2",name:"Key",symbol:"key",value:2,type:"treasure",ability:"double_loot"},
  {id:"key_3",name:"Key",symbol:"key",value:3,type:"treasure",ability:"double_loot"},
  {id:"key_4",name:"Key",symbol:"key",value:4,type:"treasure",ability:"double_loot"},
  {id:"key_5",name:"Key",symbol:"key",value:5,type:"treasure",ability:"double_loot"},
  {id:"key_6",name:"Key",symbol:"key",value:6,type:"treasure",ability:"double_loot"},
  {id:"key_7",name:"Key",symbol:"key",value:7,type:"treasure",ability:"double_loot"},
  {id:"compass_2",name:"Compass",symbol:"compass",value:2,type:"action",ability:"look_and_choose"},
  {id:"compass_3",name:"Compass",symbol:"compass",value:3,type:"action",ability:"look_and_choose"},
  {id:"compass_4",name:"Compass",symbol:"compass",value:4,type:"action",ability:"look_and_choose"},
  {id:"compass_5",name:"Compass",symbol:"compass",value:5,type:"action",ability:"look_and_choose"},
  {id:"compass_6",name:"Compass",symbol:"compass",value:6,type:"action",ability:"look_and_choose"},
  {id:"compass_7",name:"Compass",symbol:"compass",value:7,type:"action",ability:"look_and_choose"},
  {id:"cannon_2",name:"Cannon",symbol:"cannon",value:2,type:"action",ability:"destroy_enemy_card"},
  {id:"cannon_3",name:"Cannon",symbol:"cannon",value:3,type:"action",ability:"destroy_enemy_card"},
  {id:"cannon_4",name:"Cannon",symbol:"cannon",value:4,type:"action",ability:"destroy_enemy_card"},
  {id:"cannon_5",name:"Cannon",symbol:"cannon",value:5,type:"action",ability:"destroy_enemy_card"},
  {id:"cannon_6",name:"Cannon",symbol:"cannon",value:6,type:"action",ability:"destroy_enemy_card"},
  {id:"cannon_7",name:"Cannon",symbol:"cannon",value:7,type:"action",ability:"destroy_enemy_card"},
  {id:"dagger_2",name:"Dagger",symbol:"dagger",value:2,type:"action",ability:"steal_unique_card"},
  {id:"dagger_3",name:"Dagger",symbol:"dagger",value:3,type:"action",ability:"steal_unique_card"},
  {id:"dagger_4",name:"Dagger",symbol:"dagger",value:4,type:"action",ability:"steal_unique_card"},
  {id:"dagger_5",name:"Dagger",symbol:"dagger",value:5,type:"action",ability:"steal_unique_card"},
  {id:"dagger_6",name:"Dagger",symbol:"dagger",value:6,type:"action",ability:"steal_unique_card"},
  {id:"dagger_7",name:"Dagger",symbol:"dagger",value:7,type:"action",ability:"steal_unique_card"},
  {id:"shield_2",name:"Shield",symbol:"shield",value:2,type:"action",ability:"protect_collection"},
  {id:"shield_3",name:"Shield",symbol:"shield",value:3,type:"action",ability:"protect_collection"},
  {id:"shield_4",name:"Shield",symbol:"shield",value:4,type:"action",ability:"protect_collection"},
  {id:"shield_5",name:"Shield",symbol:"shield",value:5,type:"action",ability:"protect_collection"},
  {id:"shield_6",name:"Shield",symbol:"shield",value:6,type:"action",ability:"protect_collection"},
  {id:"shield_7",name:"Shield",symbol:"shield",value:7,type:"action",ability:"protect_collection"},
  {id:"serpent_2",name:"Serpent",symbol:"serpent",value:2,type:"action",ability:"force_draw_two"},
  {id:"serpent_3",name:"Serpent",symbol:"serpent",value:3,type:"action",ability:"force_draw_two"},
  {id:"serpent_4",name:"Serpent",symbol:"serpent",value:4,type:"action",ability:"force_draw_two"},
  {id:"serpent_5",name:"Serpent",symbol:"serpent",value:5,type:"action",ability:"force_draw_two"},
  {id:"serpent_6",name:"Serpent",symbol:"serpent",value:6,type:"action",ability:"force_draw_two"},
  {id:"serpent_7",name:"Serpent",symbol:"serpent",value:7,type:"action",ability:"force_draw_two"},
  {id:"anchor_2",name:"Anchor",symbol:"anchor",value:2,type:"action",ability:"play_from_ship"},
  {id:"anchor_3",name:"Anchor",symbol:"anchor",value:3,type:"action",ability:"play_from_ship"},
  {id:"anchor_4",name:"Anchor",symbol:"anchor",value:4,type:"action",ability:"play_from_ship"},
  {id:"anchor_5",name:"Anchor",symbol:"anchor",value:5,type:"action",ability:"play_from_ship"},
  {id:"anchor_6",name:"Anchor",symbol:"anchor",value:6,type:"action",ability:"play_from_ship"},
  {id:"anchor_7",name:"Anchor",symbol:"anchor",value:7,type:"action",ability:"play_from_ship"},
  {id:"map_2",name:"Map",symbol:"map",value:2,type:"action",ability:"search_lost_loot"},
  {id:"map_3",name:"Map",symbol:"map",value:3,type:"action",ability:"search_lost_loot"},
  {id:"map_4",name:"Map",symbol:"map",value:4,type:"action",ability:"search_lost_loot"},
  {id:"map_5",name:"Map",symbol:"map",value:5,type:"action",ability:"search_lost_loot"},
  {id:"map_6",name:"Map",symbol:"map",value:6,type:"action",ability:"search_lost_loot"},
  {id:"map_7",name:"Map",symbol:"map",value:7,type:"action",ability:"search_lost_loot"},
];

// =========================================
// SETUP STATE
// =========================================
let setupPlayers = [];

function initSetup() {
  setPlayerCount(4);
}

function setPlayerCount(n) {
  document.querySelectorAll('.pc-btn').forEach((b,i)=>b.classList.toggle('sel',i===n-2));
  const defaultNames = ['کاپیتان جک','دزد دریایی','ماجراجو','شکارچی'];
  setupPlayers = Array.from({length:n},(_,i)=>({
    name: defaultNames[i],
    type: i===0?'human':'bot',
    diff: 'medium'
  }));
  renderPlayerRows();
}

function renderPlayerRows() {
  const el = document.getElementById('player-rows');
  el.innerHTML = '';
  setupPlayers.forEach((p,i)=>{
    const row = document.createElement('div');
    row.className='player-row';
    row.innerHTML=`
      <div class="pnum" style="background:${PLAYER_COLORS[i]}22;color:${PLAYER_COLORS[i]};border:1px solid ${PLAYER_COLORS[i]}44">${PLAYER_EMOJIS[i]}</div>
      <input type="text" value="${p.name}" maxlength="12" placeholder="نام بازیکن" oninput="setupPlayers[${i}].name=this.value">
      <div class="type-toggle">
        <button class="type-btn${p.type==='human'?' sel':''}" onclick="setType(${i},'human')">انسان</button>
        <button class="type-btn${p.type==='bot'?' sel':''}" onclick="setType(${i},'bot')">بات</button>
      </div>
      <select class="diff-sel${p.type==='bot'?' show':''}" onchange="setupPlayers[${i}].diff=this.value">
        <option value="easy"${p.diff==='easy'?' selected':''}>آسان</option>
        <option value="medium"${p.diff==='medium'?' selected':''}>متوسط</option>
        <option value="hard"${p.diff==='hard'?' selected':''}>سخت</option>
      </select>
    `;
    if(i===0){
      row.querySelectorAll('.type-btn').forEach(b=>b.disabled=true);
      row.querySelectorAll('.type-btn').forEach(b=>b.style.opacity='.4');
    }
    el.appendChild(row);
  });
}

function setType(i,type){
  setupPlayers[i].type=type;
  renderPlayerRows();
}

// =========================================
// GAME STATE
// =========================================
let GS = {};

function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

function calcScore(ship){
  const best={};
  for(const c of ship){if(!best[c.symbol]||c.value>best[c.symbol])best[c.symbol]=c.value;}
  return Object.values(best).reduce((a,b)=>a+b,0);
}

function startGame(){
  const pCount = setupPlayers.length;
  document.getElementById('setup-screen').style.display='none';

  GS = {
    deck: shuffle([...FULL_DECK]),
    lostLoot: [],
    exploration: [],
    shieldIndex: -1,
    players: setupPlayers.map((sp,i)=>({
      id:'p'+i, idx:i,
      name: sp.name||('بازیکن '+(i+1)),
      type: i===0?'human':sp.type,
      diff: sp.diff||'medium',
      ship: [], score: 0,
      color: PLAYER_COLORS[i],
      emoji: PLAYER_EMOJIS[i]
    })),
    currentPlayer: 0,
    phase: 'DRAW',
    forcedDraws: 0,
    gameOver: false,
  };

  buildShipZones();
  updateUI();
  // Show first player handoff if human
  showHandoff(0, true);
}

// =========================================
// UI BUILD
// =========================================
function buildShipZones(){
  const left=document.getElementById('left-ships');
  const right=document.getElementById('right-ships');
  left.innerHTML='';right.innerHTML='';
  GS.players.forEach((p,i)=>{
    const wrap=document.createElement('div');
    wrap.className='ship-zone-wrap zone';
    wrap.id='ship-zone-'+i;
    wrap.innerHTML=`<div class="zone-title" style="color:${p.color}">${p.emoji} ${p.name} <span id="ship-count-${i}">0</span><span class="ztbadge" id="ship-badge-${i}">${p.type==='human'?'انسان':diffLabel(p.diff)}</span></div><div class="cards-row" id="ship-cards-${i}"></div>`;
    if(i<2) left.appendChild(wrap);
    else right.appendChild(wrap);
  });
}

function diffLabel(d){return d==='easy'?'آسان 🟢':d==='hard'?'سخت 🔴':'متوسط 🟡';}

function updateUI(){
  if(!GS.players) return;
  const p=currentP();

  document.getElementById('deck-count').textContent=GS.deck.length;
  document.getElementById('lost-count').textContent=GS.lostLoot.length;

  // Exploration
  const expEl=document.getElementById('exploration-cards');
  expEl.innerHTML='';
  GS.exploration.forEach((c,i)=>{
    const el=makeCardEl(c);
    if(i===GS.shieldIndex)el.innerHTML+=`<span class="shield-badge">🛡️</span>`;
    expEl.appendChild(el);
  });
  document.getElementById('exp-count').textContent=GS.exploration.length;

  // Ships
  GS.players.forEach((pl,i)=>{
    const el=document.getElementById('ship-cards-'+i);
    if(!el)return;
    el.innerHTML='';
    const byS={};
    for(const c of pl.ship){if(!byS[c.symbol]||c.value>byS[c.symbol].value)byS[c.symbol]=c;}
    for(const c of Object.values(byS))el.appendChild(makeCardEl(c));
    document.getElementById('ship-count-'+i).textContent=pl.ship.length;
    pl.score=calcScore(pl.ship);
    const zone=document.getElementById('ship-zone-'+i);
    if(zone)zone.style.borderColor=GS.currentPlayer===i?pl.color:'var(--border)';
  });

  // Scoreboard
  const sb=document.getElementById('scoreboard');
  sb.innerHTML='';
  GS.players.forEach((pl,i)=>{
    const d=document.createElement('div');
    d.className='score-card'+(GS.currentPlayer===i?' active':'');
    d.style.borderColor=GS.currentPlayer===i?pl.color:'var(--border)';
    d.innerHTML=`${GS.currentPlayer===i?`<div class="sc-turn">نوبت</div>`:''}
      <div class="sc-name" style="color:${pl.color}">${pl.emoji} ${pl.name}</div>
      <div class="sc-val">${pl.score}</div>
      <div class="sc-type">${pl.type==='human'?'انسان':diffLabel(pl.diff)}</div>`;
    sb.appendChild(d);
  });

  // Buttons
  const isHuman = p.type==='human';
  const canAct = isHuman && GS.phase==='DRAW' && !GS.gameOver;
  document.getElementById('btn-draw').disabled=!canAct;
  document.getElementById('btn-load').disabled=!canAct||GS.exploration.length===0;
  document.getElementById('phase-label').textContent=GS.phase==='DRAW'?'انتخاب بازیکن':'در حال اجرا';
}

function makeCardEl(card,selectable){
  const d=document.createElement('div');
  d.className='card '+card.type+(selectable?' selectable':'');
  d.innerHTML=`<span class="cval2">${card.value}</span><span class="csymbol">${SYM[card.symbol]||'?'}</span><span class="cname">${card.name}</span><span class="cval">${card.value}</span>`;
  d.classList.add('new-card');
  return d;
}

// =========================================
// HAND-OFF POPUP
// =========================================
function showHandoff(idx, isStart=false){
  const p = GS.players[idx];
  if(p.type!=='human'){
    // skip handoff for bots, start bot turn
    GS.currentPlayer=idx;
    updateUI();
    setMsg('نوبت '+p.name+'...');
    GS.phase='DRAW';
    setTimeout(()=>botTurn(),700);
    return;
  }
  document.getElementById('ho-emoji').textContent=p.emoji;
  document.getElementById('ho-name').textContent=p.name;
  document.getElementById('ho-sub').textContent=isStart?'نوبت توست! آماده‌ای؟':'نوبت توست!';
  document.getElementById('ho-score').textContent='امتیاز فعلی: '+p.score+' | کشتی: '+p.ship.length+' کارت';
  document.getElementById('handoff-overlay').classList.add('show');
}

function hideHandoff(){
  document.getElementById('handoff-overlay').classList.remove('show');
  const p=currentP();
  GS.phase='DRAW';
  updateUI();
  setMsg(p.name+' — کارت بکش یا بارگیری کن!');
}

// =========================================
// TURN SYSTEM
// =========================================
function currentP(){return GS.players[GS.currentPlayer];}
function setMsg(m){document.getElementById('status-msg').textContent=m;}

function toast(msg,dur=2000){
  const t=document.getElementById('toast');
  t.textContent=msg;t.classList.add('show');
  clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove('show'),dur);
}

function endTurn(){
  GS.exploration=[];GS.shieldIndex=-1;GS.forcedDraws=0;
  updateUI();
  if(GS.deck.length===0){setTimeout(checkGameEnd,400);return;}

  const next=(GS.currentPlayer+1)%GS.players.length;
  GS.currentPlayer=next;
  updateUI();
  showHandoff(next);
}

function checkGameEnd(){
  if(GS.deck.length===0&&!GS.gameOver){
    GS.gameOver=true;showGameOver();
  }
}

function showGameOver(){
  const sorted=[...GS.players].sort((a,b)=>b.score-a.score);
  const winner=sorted[0];
  document.getElementById('go-title').textContent=winner.type==='human'?'🏆 '+winner.name+' برنده شد!':'💀 '+winner.name+' برنده شد!';
  const sc=document.getElementById('go-scores');
  sc.innerHTML='';
  sorted.forEach((p,i)=>{
    const d=document.createElement('div');
    d.className='go-score'+(i===0?' winner':'');
    d.style.borderColor=p.color;
    d.innerHTML=(i===0?'<div class="crown">👑</div>':'')+
      `<div class="gn" style="color:${p.color}">${p.score}</div><div class="gl">${p.emoji} ${p.name}</div>`;
    sc.appendChild(d);
  });
  document.getElementById('gameover').classList.add('show');
}

// =========================================
// PLAYER ACTIONS
// =========================================
function onDeckClick(){
  if(GS.phase==='DRAW'&&currentP().type==='human'&&!GS.gameOver)playerDraw();
}

function playerDraw(){
  if(GS.deck.length===0){checkGameEnd();return;}
  const card=GS.deck.shift();
  setMsg('کشیدی: '+SYM[card.symbol]+' '+card.name+' ('+card.value+')');
  GS.phase='ABILITY';updateUI();
  processCard(card);
}

function playerLoadCargo(){
  const p=currentP();
  if(GS.exploration.length===0){toast('هیچ کارتی در اکتشاف نیست');return;}
  doLoadCargo(p);
  toast('✅ بارگیری موفق!');
  endTurn();
}

function doLoadCargo(p){
  const hasChest=GS.exploration.some(c=>c.symbol==='chest');
  const hasKey=GS.exploration.some(c=>c.symbol==='key');
  const bonus=(hasChest&&hasKey)?GS.exploration.length:0;
  for(const c of GS.exploration)p.ship.push(c);
  if(bonus>0&&GS.lostLoot.length>0){
    const n=Math.min(bonus,GS.lostLoot.length);
    shuffle(GS.lostLoot);
    for(let i=0;i<n;i++)p.ship.push(GS.lostLoot.pop());
    toast('🗝️📦 کلید+صندوق: +'+n+' کارت بونوس!',2500);
  }
  GS.exploration=[];GS.shieldIndex=-1;GS.forcedDraws=0;
}

// =========================================
// CARD PIPELINE
// =========================================
function processCard(card){
  GS.exploration.push(card);updateUI();
  const dups=GS.exploration.filter(c=>c.symbol===card.symbol);
  if(dups.length>1){setTimeout(()=>processBurn(),400);return;}
  executeAbility(card);
}

function processBurn(){
  const dup=GS.exploration[GS.exploration.length-1];
  toast('💥 تکراری! '+SYM[dup.symbol]+' سوخت!');
  const p=currentP();
  if(GS.shieldIndex>=0){
    const before=GS.exploration.slice(0,GS.shieldIndex);
    const lost=GS.exploration.slice(GS.shieldIndex);
    for(const c of before)p.ship.push(c);
    for(const c of lost)GS.lostLoot.push(c);
    toast('🛡️ سپر نجات داد! '+before.length+' کارت ذخیره شد',2500);
  }else{
    for(const c of GS.exploration)GS.lostLoot.push(c);
  }
  GS.exploration=[];GS.shieldIndex=-1;GS.forcedDraws=0;
  updateUI();endTurn();
}

function executeAbility(card){
  const p=currentP();
  if(card.ability==='none'){afterAbility();return;}

  if(card.ability==='protect_collection'){
    GS.shieldIndex=GS.exploration.length-1;
    toast('🛡️ سپر فعال شد!');afterAbility();return;
  }
  if(card.ability==='force_draw_two'){
    toast('🐍 مار! ۲ کارت اجباری!');GS.forcedDraws=2;runForcedDraw();return;
  }
  if(card.ability==='look_and_choose'){
    if(GS.deck.length===0){afterAbility();return;}
    if(p.type==='human')showCompassPopup(GS.deck[0]);
    else{botCompassDecide();} return;
  }
  if(card.ability==='destroy_enemy_card'){
    const enemies=GS.players.filter((_,i)=>i!==GS.currentPlayer&&GS.players[i].ship.length>0);
    if(enemies.length===0){toast('توپ: هیچ هدفی نیست');afterAbility();return;}
    if(p.type==='human')showCannonPopup(enemies);
    else{botCannonDecide(enemies);} return;
  }
  if(card.ability==='steal_unique_card'){
    const mySymbols=new Set([...GS.exploration,...p.ship].map(c=>c.symbol));
    const enemies=GS.players.filter((_,i)=>i!==GS.currentPlayer);
    const allTargets=[];
    for(const e of enemies){
      const byS={};
      for(const c of e.ship)if(!mySymbols.has(c.symbol)){if(!byS[c.symbol]||c.value>byS[c.symbol].value)byS[c.symbol]={card:c,owner:e};}
      for(const v of Object.values(byS))allTargets.push(v);
    }
    if(allTargets.length===0){toast('🗡️ چیزی برای دزدیدن نیست');afterAbility();return;}
    if(p.type==='human')showDaggerPopup(allTargets);
    else{botDaggerDecide(allTargets);} return;
  }
  if(card.ability==='play_from_ship'){
    if(p.ship.length===0){toast('⚓ کشتی خالیه');afterAbility();return;}
    if(p.type==='human')showAnchorPopup(p);
    else{botAnchorDecide(p);} return;
  }
  if(card.ability==='search_lost_loot'){
    if(GS.lostLoot.length===0){toast('🗺️ لوت سوخته خالیه');afterAbility();return;}
    if(p.type==='human')showMapPopup();
    else{botMapDecide();} return;
  }
  afterAbility();
}

function afterAbility(){
  if(GS.forcedDraws>0){runForcedDraw();return;}
  const p=currentP();
  if(p.type==='bot'){botDecide();return;}
  GS.phase='DRAW';updateUI();
  setMsg(p.name+' — کارت بکش یا بارگیری کن!');
}

function runForcedDraw(){
  if(GS.forcedDraws<=0||GS.deck.length===0){GS.forcedDraws=0;afterAbility();return;}
  GS.forcedDraws--;
  const card=GS.deck.shift();
  setMsg('🐍 اجباری: '+SYM[card.symbol]+' '+card.name);
  setTimeout(()=>processCard(card),350);
}

// =========================================
// BOT AI (3 difficulties)
// =========================================
function botTurn(){
  if(GS.deck.length===0){checkGameEnd();return;}
  const card=GS.deck.shift();
  const p=currentP();
  setMsg(p.name+' کشید: '+SYM[card.symbol]+' '+card.name);
  setTimeout(()=>processCard(card),500);
}

function botDecide(){
  const p=currentP();
  const d=p.diff;
  const expVal=GS.exploration.reduce((a,c)=>a+c.value,0);
  const expLen=GS.exploration.length;

  // Estimate duplicate risk based on how many symbols already exposed
  const usedSyms=new Set(GS.exploration.map(c=>c.symbol));
  const remainDeck=GS.deck.length;
  const dupRisk=remainDeck>0?(usedSyms.size/10):1;

  let loadThreshold, riskTolerance;
  if(d==='easy'){loadThreshold=8;riskTolerance=0.5;}
  else if(d==='hard'){loadThreshold=22;riskTolerance=0.15;}
  else{loadThreshold=14;riskTolerance=0.3;}

  const shouldLoad = expVal>=loadThreshold || dupRisk>riskTolerance || expLen>=5 || GS.deck.length===0 || (Math.random()<(d==='easy'?0.4:d==='hard'?0.1:0.2));

  setTimeout(()=>{
    if(shouldLoad){
      doLoadCargo(p);
      setMsg(p.name+' بارگیری کرد!');
      updateUI();endTurn();
    }else{
      botTurn();
    }
  },600);
}

// Bot ability decisions
function botCompassDecide(){
  const p=currentP();
  const peek=GS.deck[0];
  const dupIfDraw=GS.exploration.some(c=>c.symbol===peek.symbol);
  const d=p.diff;
  let draw;
  if(d==='easy') draw=Math.random()>0.4;
  else if(d==='hard') draw=!dupIfDraw&&peek.value>=4;
  else draw=!dupIfDraw&&Math.random()>0.3;

  setTimeout(()=>{
    if(draw){GS.deck.shift();processCard(peek);}
    else afterAbility();
  },500);
}

function botCannonDecide(enemies){
  // Target highest value card of richest enemy
  let best=null,bestVal=0,bestEnemy=null;
  for(const e of enemies){
    for(const c of e.ship){if(c.value>bestVal){bestVal=c.value;best=c;bestEnemy=e;}}
  }
  setTimeout(()=>{
    if(best){
      bestEnemy.ship=bestEnemy.ship.filter(x=>x.id!==best.id);
      GS.lostLoot.push(best);
      toast('💣 '+currentP().name+' کارت '+best.name+' رو نابود کرد!');
      updateUI();
    }
    afterAbility();
  },600);
}

function botDaggerDecide(targets){
  // Pick highest value target
  targets.sort((a,b)=>b.card.value-a.card.value);
  const pick=targets[0];
  setTimeout(()=>{
    pick.owner.ship=pick.owner.ship.filter(x=>x.id!==pick.card.id);
    toast('🗡️ '+currentP().name+' '+pick.card.name+' رو دزدید!');
    processCard(pick.card);
  },600);
}

function botAnchorDecide(p){
  const byS={};
  for(const c of p.ship){if(!byS[c.symbol]||c.value>byS[c.symbol].value)byS[c.symbol]=c;}
  const cards=Object.values(byS);
  if(cards.length===0){afterAbility();return;}
  // pick lowest value (risk least)
  cards.sort((a,b)=>a.value-b.value);
  const pick=cards[0];
  setTimeout(()=>{
    p.ship=p.ship.filter(x=>x.id!==pick.id);
    toast('⚓ '+p.name+' '+pick.name+' رو به اکتشاف برگردوند!');
    processCard(pick);
  },600);
}

function botMapDecide(){
  shuffle(GS.lostLoot);
  const picks=GS.lostLoot.slice(0,Math.min(3,GS.lostLoot.length));
  if(picks.length===0){afterAbility();return;}
  // pick highest value
  picks.sort((a,b)=>b.value-a.value);
  const pick=picks[0];
  setTimeout(()=>{
    GS.lostLoot=GS.lostLoot.filter(x=>x.id!==pick.id);
    toast('🗺️ '+currentP().name+' '+pick.name+' رو پیدا کرد!');
    processCard(pick);
  },700);
}

// =========================================
// POPUPS (human)
// =========================================
function showPopup(title,desc,choices,btns){
  document.getElementById('popup-title').textContent=title;
  document.getElementById('popup-desc').textContent=desc;
  const cc=document.getElementById('popup-choices');cc.innerHTML='';
  choices.forEach(c=>cc.appendChild(c));
  const pb=document.getElementById('popup-btns');pb.innerHTML='';
  btns.forEach(b=>pb.appendChild(b));
  document.getElementById('popup-overlay').classList.add('show');
}
function hidePopup(){document.getElementById('popup-overlay').classList.remove('show');}

function showCompassPopup(peek){
  const el=makeCardEl(peek,true);
  const b1=document.createElement('button');b1.className='primary';b1.textContent='رو کن 🃏';
  b1.onclick=()=>{hidePopup();GS.deck.shift();processCard(peek);};
  const b2=document.createElement('button');b2.textContent='بارگیری 🚢';
  b2.onclick=()=>{hidePopup();playerLoadCargo();};
  const b3=document.createElement('button');b3.textContent='رد کن ❌';
  b3.onclick=()=>{hidePopup();afterAbility();};
  showPopup('🧭 قطب‌نما','کارت بعدی رو دیدی. انتخاب کن:',[el],[b1,b2,b3]);
}

function showCannonPopup(enemies){
  const choices=[];
  for(const e of enemies){
    const byS={};
    for(const c of e.ship){if(!byS[c.symbol]||c.value>byS[c.symbol].value)byS[c.symbol]=c;}
    for(const c of Object.values(byS)){
      const el=makeCardEl(c,true);
      const label=document.createElement('div');
      label.style.cssText='font-size:.6rem;color:var(--muted);text-align:center;margin-top:3px';
      label.textContent=e.name;el.appendChild(label);
      el.onclick=()=>{
        hidePopup();
        e.ship=e.ship.filter(x=>x.id!==c.id);
        GS.lostLoot.push(c);
        toast('💣 '+c.name+' از کشتی '+e.name+' نابود شد!');
        updateUI();afterAbility();
      };
      choices.push(el);
    }
  }
  const skip=document.createElement('button');skip.textContent='رد کن';skip.onclick=()=>{hidePopup();afterAbility();};
  showPopup('💣 توپ','کدوم کارت دشمن رو نابود کنی؟',choices,[skip]);
}

function showDaggerPopup(targets){
  const choices=targets.map(({card:c,owner:e})=>{
    const el=makeCardEl(c,true);
    const label=document.createElement('div');
    label.style.cssText='font-size:.6rem;color:var(--muted);text-align:center;margin-top:3px';
    label.textContent=e.name;el.appendChild(label);
    el.onclick=()=>{
      hidePopup();
      e.ship=e.ship.filter(x=>x.id!==c.id);
      toast('🗡️ '+c.name+' از '+e.name+' دزدیده شد!');
      processCard(c);
    };
    return el;
  });
  const skip=document.createElement('button');skip.textContent='رد کن';skip.onclick=()=>{hidePopup();afterAbility();};
  showPopup('🗡️ خنجر','کدوم کارت دشمن رو بدزدی؟',choices,[skip]);
}

function showAnchorPopup(p){
  const byS={};
  for(const c of p.ship){if(!byS[c.symbol]||c.value>byS[c.symbol].value)byS[c.symbol]=c;}
  const choices=Object.values(byS).map(c=>{
    const el=makeCardEl(c,true);
    el.onclick=()=>{
      hidePopup();p.ship=p.ship.filter(x=>x.id!==c.id);
      toast('⚓ '+c.name+' به اکتشاف برگشت!');processCard(c);
    };
    return el;
  });
  const skip=document.createElement('button');skip.textContent='رد کن';skip.onclick=()=>{hidePopup();afterAbility();};
  showPopup('⚓ لنگر','کدوم کارت از کشتی رو برگردونی؟',choices,[skip]);
}

function showMapPopup(){
  shuffle(GS.lostLoot);
  const picks=GS.lostLoot.slice(0,Math.min(3,GS.lostLoot.length));
  const choices=picks.map(c=>{
    const el=makeCardEl(c,true);
    el.onclick=()=>{
      hidePopup();GS.lostLoot=GS.lostLoot.filter(x=>x.id!==c.id);
      toast('🗺️ '+c.name+' پیدا شد!');processCard(c);
    };
    return el;
  });
  const skip=document.createElement('button');skip.textContent='رد کن';skip.onclick=()=>{hidePopup();afterAbility();};
  showPopup('🗺️ نقشه','از لوت سوخته انتخاب کن:',choices,[skip]);
}

// =========================================
// INIT
// =========================================
initSetup();