(() => {
  'use strict';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const screens = ['home-screen','lobby-screen','shop-screen','match-screen'];
  const SKILLS = [
    {id:'speed',name:'SPEED BURST',type:'MOBILITY',glyph:'»',color:'#b8f34a',description:'Explode into open space with a lightning-fast dash.'},
    {id:'power',name:'POWER SHOT',type:'FINISHING',glyph:'◉',color:'#ff765e',description:'Load your ego into a devastating long-range strike.'},
    {id:'shadow',name:'SHADOW DRIBBLE',type:'TECHNIQUE',glyph:'〰',color:'#6bd9ee',description:'Slip through defenders with an elusive feint.'}
  ];
  const STORE_KEY='egoist-league-v1';
  const SEAL_KEY='egoist-league-seal-v1';
  const DEFAULT={coins:10,stats:{speed:42,power:45,control:40,stamina:50},skills:[],admin:false,matches:0,wins:0};
  let profile=loadProfile();
  let canonical=clone(profile);
  let signature=seal(canonical);
  let guardLock=false;
  let audioOn=true;
  let toastTimer;
  let match=null;
  let raf=0;
  let lastFrame=0;
  let joy={x:0,y:0,active:false,pointer:null};
  const keys=new Set();
  const input={sprint:false};

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function seal(v){return JSON.stringify(v);}
  function valid(p){
    if(!p||!Number.isInteger(p.coins)||p.coins<0||(!p.admin&&p.coins>100000)||!p.stats||!Array.isArray(p.skills))return false;
    if(!['speed','power','control','stamina'].every(k=>Number.isFinite(p.stats[k])&&p.stats[k]>=0&&p.stats[k]<=100))return false;
    if(p.admin&&(!p.skills.length||p.coins!==999999))return false;
    if(p.skills.some(s=>!SKILLS.some(k=>k.id===s))||new Set(p.skills).size!==p.skills.length)return false;
    if(!Number.isInteger(p.matches)||!Number.isInteger(p.wins)||p.wins>p.matches)return false;
    return true;
  }
  function loadProfile(){
    try{
      const raw=localStorage.getItem(STORE_KEY),p=JSON.parse(raw||'null');
      const storedSeal=localStorage.getItem(SEAL_KEY);
      if(valid(p)&&(!raw||storedSeal===seal(p)))return p;
    }catch(_){}
    return clone(DEFAULT);
  }
  function integrityCheck(){
    if(guardLock)return true;
    if(!valid(profile)||seal(profile)!==signature){
      guardLock=true;
      profile=clone(canonical);signature=seal(canonical);persist();renderProfile();
      showToast('INTEGRITY CHECK · Unauthorized stat or coin change blocked.',true);
      setTimeout(()=>guardLock=false,200);
      return false;
    }
    return true;
  }
  function commit(mutator){
    integrityCheck();
    const next=clone(canonical);mutator(next);
    if(!valid(next)){showToast('VALIDATION FAILED · Change rejected.',true);return false;}
    profile=next;canonical=clone(next);signature=seal(next);persist();renderProfile();return true;
  }
  function persist(){try{localStorage.setItem(STORE_KEY,JSON.stringify(profile));localStorage.setItem(SEAL_KEY,seal(profile));}catch(_){}}
  function showToast(message,warn=false){const el=$('#toast');el.textContent=message;el.classList.toggle('warn',warn);el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);}
  function renderProfile(){
    $('#coin-count').textContent=profile.admin?'∞':profile.coins;
    $('#shop-coins').textContent=profile.admin?'∞ GOLD':`${profile.coins} GOLD`;
    $('#profile-button').textContent=profile.admin?'A':'K';
    $('.rank-tag b').textContent=profile.admin?'S':'E';
    if(profile.admin){$('.profile-main h3').innerHTML='ADMIN <span>BLUE</span>';$('.profile-main small').innerHTML='LEVEL 99 <em>· MAX EGO</em>';$('.xp-track i').style.width='100%';}
    else{$('.profile-main h3').innerHTML='KAITO <span>ISAGI</span>';$('.profile-main small').innerHTML=`LEVEL 01 <em>· ${Math.min(499,120+profile.wins*45)} / 500 XP</em>`;$('.xp-track i').style.width=`${Math.min(100,24+profile.wins*8)}%`;}
    renderSkills();
  }
  function renderSkills(){
    $('#skill-grid').innerHTML=SKILLS.map((s,i)=>{
      const owned=profile.skills.includes(s.id);
      const label=owned?'EQUIPPED':profile.admin?'UNLOCKED':'◈ &nbsp; 100 GOLD';
      return `<article class="skill-card" style="--skill-color:${s.color}"><div class="skill-top"><span class="skill-number">WEAPON 0${i+1}</span><span>${s.type}</span></div><div class="skill-art"><div class="skill-glyph">${s.glyph}</div></div><h3 class="skill-name">${s.name}</h3><p class="skill-desc">${s.description}</p><div class="skill-bottom"><span class="skill-type">${owned?'READY TO DEPLOY':'SIGNATURE SKILL'}</span><button class="skill-buy ${owned?'equipped':''}" data-buy="${s.id}" ${owned?'disabled':''}>${label}</button></div></article>`;
    }).join('');
  }
  function navigate(id){
    if(!screens.includes(id))return;
    screens.forEach(s=>$('#'+s).classList.toggle('active',s===id));
    if(id!=='match-screen')stopMatchLoop();
    if(id==='match-screen')resizeCanvas();
    window.scrollTo(0,0);
  }
  $$('.back-button').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.back)));
  $('#play-button').addEventListener('click',()=>navigate('lobby-screen'));
  $('#training-button').addEventListener('click',()=>{navigate('match-screen');startMatch(true);});
  $('#shop-button').addEventListener('click',()=>navigate('shop-screen'));
  $('#admin-open').addEventListener('click',()=>{$('#admin-modal').classList.add('open');$('#admin-password').value='';$('#admin-error').textContent='';setTimeout(()=>$('#admin-password').focus(),80);});
  $('#admin-form').addEventListener('submit',e=>{
    e.preventDefault();
    if($('#admin-password').value==='ADMIN-BLUE-2026'){
      commit(p=>{p.admin=true;p.coins=999999;p.skills=SKILLS.map(s=>s.id);Object.keys(p.stats).forEach(k=>p.stats[k]=100);});
      $('#admin-modal').classList.remove('open');showToast('ADMIN OVERRIDE ACTIVE · ALL WEAPONS UNLOCKED');
    }else{$('#admin-error').textContent='ACCESS DENIED · Invalid authorization key.';$('#admin-password').value='';}
  });
  $$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('.modal-backdrop').classList.remove('open')));
  $('#skill-grid').addEventListener('click',e=>{
    const button=e.target.closest('[data-buy]');if(!button)return;
    const id=button.dataset.buy;
    if(profile.skills.includes(id))return;
    if(!profile.admin&&profile.coins<100){showToast('NOT ENOUGH GOLD · Win a match to earn coins.',true);return;}
    commit(p=>{if(!p.admin)p.coins-=100;p.skills.push(id);});
    showToast(`${SKILLS.find(s=>s.id===id).name} UNLOCKED · GO DEVOUR THE FIELD.`);
  });
  $('#sound-toggle').addEventListener('click',e=>{audioOn=!audioOn;e.currentTarget.textContent=audioOn?'♫':'♪';showToast(audioOn?'AUDIO FEEDBACK ON':'AUDIO FEEDBACK MUTED');});
  $('#queue-button').addEventListener('click',()=>{
    const btn=$('#queue-button');btn.disabled=true;btn.querySelector('span').textContent='SEARCHING FOR RIVALS';
    let secs=3;showToast('MATCHMAKING · Finding a rival squad...');
    const timer=setInterval(()=>{secs--;if(secs<=0){clearInterval(timer);btn.disabled=false;btn.querySelector('span').textContent='START MATCHMAKING';navigate('match-screen');startMatch(false);}},700);
  });
  $('#pause-button').addEventListener('click',()=>{if(match){match.paused=true;$('#pause-modal').classList.add('open');}});
  $('#resume-button').addEventListener('click',()=>{$('#pause-modal').classList.remove('open');if(match){match.paused=false;match.last=performance.now();requestAnimationFrame(frame);}});
  $('#quit-match').addEventListener('click',()=>finishMatch(false,true));
  $('#pause-quit').addEventListener('click',()=>{$('#pause-modal').classList.remove('open');finishMatch(false,true);});
  $('#result-home').addEventListener('click',()=>{$('#result-modal').classList.remove('open');navigate('home-screen');});

  // Keyboard + touch are routed through the same validated action handlers.
  window.addEventListener('keydown',e=>{
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))e.preventDefault();
    keys.add(e.key.toLowerCase());
    if(e.repeat)return;
    if(e.key===' ')action('shoot');if(e.key.toLowerCase()==='e')action('pass');if(e.key.toLowerCase()==='q')action('special');if(e.key.toLowerCase()==='f')action('tackle');
    if(e.key==='Shift')input.sprint=true;
  });
  window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());if(e.key==='Shift')input.sprint=false;});
  $$('[data-action]').forEach(btn=>{
    const name=btn.dataset.action;
    btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture?.(e.pointerId);if(name==='sprint')input.sprint=true;else action(name);});
    ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,()=>{if(name==='sprint')input.sprint=false;}));
  });
  const joyBase=$('#joystick-base'),joyKnob=$('#joystick-knob');
  joyBase.addEventListener('pointerdown',e=>{e.preventDefault();joy.active=true;joy.pointer=e.pointerId;joyBase.setPointerCapture(e.pointerId);moveJoy(e);});
  joyBase.addEventListener('pointermove',e=>{if(joy.active&&e.pointerId===joy.pointer)moveJoy(e);});
  ['pointerup','pointercancel','lostpointercapture'].forEach(ev=>joyBase.addEventListener(ev,()=>{joy.active=false;joy.x=joy.y=0;joyKnob.style.transform='translate(0,0)';}));
  function moveJoy(e){const r=joyBase.getBoundingClientRect(),dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2),max=r.width*.32,len=Math.hypot(dx,dy),scale=len>max?max/len:1;joy.x=dx*scale/max;joy.y=dy*scale/max;joyKnob.style.transform=`translate(${dx*scale}px,${dy*scale}px)`;}

  const W=1000,H=600;
  function createPlayer(x,y,team,id,role='field'){
    return {x,y,vx:0,vy:0,team,id,role,r:16,stamina:1,cd:0,flash:0,hasBall:false,trail:[],aiSeed:Math.random()*9};
  }
  function startMatch(training){
    integrityCheck();
    if(match)stopMatchLoop();
    const blue=[createPlayer(245,300,0,'YOU'),createPlayer(340,190,0,'REN'),createPlayer(365,405,0,'CHIGIRI'),createPlayer(180,300,0,'NIKO')];
    const red=[createPlayer(750,300,1,'RIVAL'),createPlayer(650,190,1,'BOT 02'),createPlayer(650,410,1,'BOT 03'),createPlayer(825,300,1,'BOT 04')];
    match={blue,red,players:[...blue,...red],ball:{x:W/2,y:H/2,vx:0,vy:0,r:9,owner:null,lastTeam:-1},score:[0,0],time:training?240:180,training,paused:false,last:performance.now(),goalPause:0,toast:0,skillCooldown:0,ended:false,joystick:false};
    $('#score-blue').textContent='0';$('#score-red').textContent='0';showMatchToast(training?'TRAINING MODE':'KICK OFF');resizeCanvas();lastFrame=performance.now();raf=requestAnimationFrame(frame);
  }
  function stopMatchLoop(){if(raf)cancelAnimationFrame(raf);raf=0;}
  function finishMatch(won,forfeit=false){
    if(!match||match.ended)return;
    match.ended=true;stopMatchLoop();
    const blue=match.score[0],red=match.score[1],victory=forfeit?false:(blue>=red);
    const reward=forfeit?0:(victory?25:10);
    commit(p=>{p.matches++;if(victory)p.wins++;if(!p.admin)p.coins+=reward;});
    $('#final-blue').textContent=blue;$('#final-red').textContent=red;
    $('#result-stamp').textContent=forfeit?'MATCH FORFEIT':victory?'VICTORY':'DEFEAT';
    $('#result-stamp').style.color=victory?'var(--lime)':'#ff8068';
    $('#result-copy').textContent=forfeit?'You left the arena before the final whistle.':victory?'A striker’s instinct. You devoured the field.':'Every loss is fuel. The next goal is yours.';
    $('#reward-amount').textContent=`+${reward} GOLD`;
    $('#result-modal').classList.add('open');
  }
  function showMatchToast(msg){const el=$('#match-toast');el.textContent=msg;el.classList.add('show');clearTimeout(match?.toastTimer);if(match)match.toastTimer=setTimeout(()=>el.classList.remove('show'),1450);}
  function action(kind){
    if(!match||match.paused||match.ended)return;
    integrityCheck();const me=match.blue[0],ball=match.ball;
    if(kind==='sprint'){input.sprint=true;setTimeout(()=>input.sprint=false,700);return;}
    if(kind==='special'){
      if(!profile.admin&&!profile.skills.length){showToast('NO WEAPON EQUIPPED · Visit the Egoist Shop.',true);return;}
      if(match.skillCooldown>0){showToast('WEAPON RECHARGING');return;}
      const skill=profile.admin?'speed':profile.skills[0];match.skillCooldown=7;me.flash=1.1;
      if(skill==='speed'){const [dx,dy]=aimVector();me.vx+=dx*330;me.vy+=dy*330;showMatchToast('SPEED BURST · DEVOUR THE SPACE');}
      else if(skill==='power'){shootBall(true);showMatchToast('POWER SHOT · EGO RELEASE');}
      else{me.flash=1.35;for(const p of match.red){if(distance(p,me)<105){p.stunned=.9;p.vx*=.2;p.vy*=.2;}}showMatchToast('SHADOW DRIBBLE · VANISH');}
      return;
    }
    if(kind==='shoot'){
      if(ball.owner===me||(!ball.owner&&distance(me,ball)<48)){shootBall(false);return;}
      if(distance(me,ball)<64){ball.owner=me;me.hasBall=true;shootBall(false);}else showMatchToast('GET TO THE BALL');
    }else if(kind==='pass'){
      if(ball.owner!==me){if(distance(me,ball)<50){ball.owner=me;me.hasBall=true;}else{showMatchToast('NO POSSESSION');return;}}
      const mate=match.blue.slice(1).sort((a,b)=>distance(a,me)-distance(b,me))[0];ball.owner=null;me.hasBall=false;const d=unit(mate.x-me.x,mate.y-me.y);ball.x=me.x;ball.y=me.y;ball.vx=d[0]*440;ball.vy=d[1]*440;ball.target=mate;showMatchToast('PASS · FIND YOUR EGOIST');
    }else if(kind==='tackle'){
      const target=match.red.filter(p=>distance(p,me)<58).sort((a,b)=>distance(a,me)-distance(b,me))[0];
      if(target){if(ball.owner===target){target.hasBall=false;ball.owner=me;me.hasBall=true;ball.vx=ball.vy=0;showMatchToast('CLEAN TACKLE · BALL WON');}else{target.stunned=.7;showMatchToast('DEFENDER STAGGERED');}}else showMatchToast('NO RIVAL IN RANGE');
    }
  }
  function aimVector(){let x=joy.x,y=joy.y;if(Math.hypot(x,y)<.2){x=1;y=(H/2-match.blue[0].y)/200;}return unit(x,y);}
  function shootBall(power){
    const ball=match.ball,me=match.blue[0];ball.owner=null;me.hasBall=false;
    let d=unit(W-me.x,(H/2-me.y)*.65);const isPower=power||profile.skills.includes('power');
    ball.x=me.x+ d[0]*22;ball.y=me.y+d[1]*22;ball.vx=d[0]*(isPower?750:590);ball.vy=d[1]*(isPower?750:590);ball.shot=1.2;ball.lastTeam=0;
    me.flash=.3;showMatchToast(isPower?'EGO SHOT!':'SHOT!');
  }
  function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
  function unit(x,y){const n=Math.hypot(x,y)||1;return[x/n,y/n];}
  function frame(now){
    if(!match||match.ended||!$('#match-screen').classList.contains('active'))return;
    raf=requestAnimationFrame(frame);
    if(match.paused)return;
    const dt=Math.min(.035,(now-match.last)/1000||.016);match.last=now;
    integrityCheck();update(dt);draw();
  }
  function update(dt){
    const m=match,ball=m.ball,me=m.blue[0];
    if(m.goalPause>0){m.goalPause-=dt;if(m.goalPause<=0)resetKickoff();return;}
    m.time-=dt;if(m.time<=0){m.time=0;finishMatch();return;}
    m.skillCooldown=Math.max(0,m.skillCooldown-dt);
    const dx=(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0)+joy.x;
    const dy=(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0)+joy.y;
    const v=unit(dx,dy),moving=Math.hypot(dx,dy)>.1,sprint=(input.sprint||keys.has('shift'))&&me.stamina>.08;
    const speed=(profile.admin?245:190)*(sprint?1.48:1)*(profile.skills.includes('speed')||profile.admin?1.04:1);
    me.vx+=(moving?v[0]*speed*7:0)*dt;me.vy+=(moving?v[1]*speed*7:0)*dt;
    const drag=moving?Math.pow(.08,dt):Math.pow(.001,dt);me.vx*=drag;me.vy*=drag;
    me.x+=me.vx*dt;me.y+=me.vy*dt;me.x=clamp(me.x,42,W-42);me.y=clamp(me.y,35,H-35);
    me.stamina=clamp(me.stamina+(sprint&&moving?-.28:.15)*dt,0,1);
    for(let i=1;i<m.blue.length;i++)updateTeammate(m.blue[i],dt,i);
    for(let i=0;i<m.red.length;i++)updateBot(m.red[i],dt,i);
    updateBall(dt);
    if(ball.owner===me||(!ball.owner&&distance(me,ball)<me.r+ball.r+3)){ball.owner=me;me.hasBall=true;ball.vx=ball.vy=0;}
    for(const p of m.players){p.cd=Math.max(0,p.cd-dt);p.flash=Math.max(0,p.flash-dt);p.stunned=Math.max(0,(p.stunned||0)-dt);p.trail.push({x:p.x,y:p.y,t:.22});p.trail=p.trail.filter(t=>(t.t-=dt)>0);}
  }
  function updateTeammate(p,dt,i){
    const ball=match.ball,owner=ball.owner;let tx,ty;
    if(!owner){tx=ball.x+(i===1?-35:28);ty=ball.y+(i===1?-40:40);}
    else if(owner.team===0){tx=owner.x+45;ty=owner.y+(i===1?-72:72);}
    else{tx=250+i*70;ty=H/2+(i-2)*90;}
    if(owner===p){tx=W-80;ty=H/2;}
    moveAI(p,tx,ty,dt,138);
    if(!owner&&distance(p,ball)<p.r+ball.r+3){ball.owner=p;p.hasBall=true;}
    if(owner===p&&p.x>W-210&&Math.random()<dt*.55){const d=unit(W-p.x,H/2-p.y);ball.owner=null;p.hasBall=false;ball.x=p.x;ball.y=p.y;ball.vx=d[0]*540;ball.vy=d[1]*540;ball.lastTeam=0;}
  }
  function updateBot(p,dt,i){
    const ball=match.ball,owner=ball.owner;
    let tx,ty;
    if(owner&&owner.team===1){tx=W-160;ty=H/2+(i-1.5)*55;}
    else if(owner&&owner.team===0){tx=owner.x+13;ty=owner.y+12;}
    else{const chaser=match.red[0];if(p===chaser){tx=ball.x;ty=ball.y;}else{tx=610+(i%2)*75;ty=H/2+(i-1.5)*96;}}
    if(p.stunned>0)return;
    moveAI(p,tx,ty,dt,126);
    if(!owner&&distance(p,ball)<p.r+ball.r+2){ball.owner=p;p.hasBall=true;}
    if(ball.owner===p){
      const approach=Math.max(0,(W-190-p.x)/500);
      if((p.x>W-230&&Math.random()<dt*1.6)||Math.random()<dt*.12){
        ball.owner=null;p.hasBall=false;const d=unit(-W+p.x,H/2-p.y);ball.x=p.x;ball.y=p.y;ball.vx=d[0]*470;ball.vy=d[1]*470;ball.lastTeam=1;ball.shot=.8;
      }else{p.x+=65*approach*dt;}
    }
  }
  function moveAI(p,x,y,dt,speed){const dx=x-p.x,dy=y-p.y,d=unit(dx,dy),len=Math.hypot(dx,dy);p.vx+=(len>8?d[0]*speed*4:0)*dt;p.vy+=(len>8?d[1]*speed*4:0)*dt;p.vx*=Math.pow(.04,dt);p.vy*=Math.pow(.04,dt);p.x=clamp(p.x+p.vx*dt,35,W-35);p.y=clamp(p.y+p.vy*dt,35,H-35);}
  function updateBall(dt){
    const b=match.ball;
    if(b.owner){b.x=b.owner.x+(b.owner.team===0?18:-18);b.y=b.owner.y+3;b.vx=b.vy=0;return;}
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.vx*=Math.pow(.24,dt);b.vy*=Math.pow(.24,dt);
    if(b.y<b.r+25){b.y=b.r+25;b.vy=Math.abs(b.vy)*.55;}if(b.y>H-b.r-25){b.y=H-b.r-25;b.vy=-Math.abs(b.vy)*.55;}
    // Goals are centered openings; the rest of the end line keeps the ball in play.
    if(b.x<27||b.x>W-27){
      if(Math.abs(b.y-H/2)<82){const scoring=b.x>W/2?0:1;match.score[scoring]++;$('#score-blue').textContent=match.score[0];$('#score-red').textContent=match.score[1];b.x=b.x<0?0:W;b.vx=b.vy=0;match.goalPause=1.5;showMatchToast(scoring===0?'GOAL! · BLUE LOCK':'RIVAL GOAL');return;}
      b.x=clamp(b.x,28,W-28);b.vx*=-.65;
    }
    for(const p of match.players){if(!b.owner&&distance(p,b)<p.r+b.r){if(p.team===0&&p===match.blue[0]){b.owner=p;p.hasBall=true;}else if(p.team===1&&b.lastTeam!==1){b.owner=p;p.hasBall=true;}else if(p.team===0&&b.lastTeam===1){b.owner=p;p.hasBall=true;}else{const d=unit(b.x-p.x,b.y-p.y);b.vx=d[0]*100;b.vy=d[1]*100;}}}
    if(b.target&&distance(b.target,b)<40){b.owner=b.target;b.target.hasBall=true;b.target=null;}
  }
  function resetKickoff(){match.ball={x:W/2,y:H/2,vx:0,vy:0,r:9,owner:null,lastTeam:-1};match.players.forEach(p=>{p.hasBall=false;p.x=p.team===0?245+Math.random()*110:645+Math.random()*110;p.y=120+Math.random()*360;p.vx=p.vy=0;});match.goalPause=0;}
  function clamp(n,a,b){return Math.max(a,Math.min(b,n));}

  const canvas=$('#game-canvas'),ctx=canvas.getContext('2d');
  function resizeCanvas(){if(!canvas)return;const rect=canvas.getBoundingClientRect();const dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.max(1,Math.floor(rect.width*dpr));canvas.height=Math.max(1,Math.floor(rect.height*dpr));ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);draw();}
  window.addEventListener('resize',()=>{if($('#match-screen').classList.contains('active'))resizeCanvas();});
  function draw(){
    if(!match||!ctx)return;
    ctx.clearRect(0,0,W,H);
    // Stripe-cut turf with a crisp, broadcast-style vector pitch.
    ctx.fillStyle='#267b51';ctx.fillRect(0,0,W,H);
    for(let i=0;i<10;i++){ctx.fillStyle=i%2?'rgba(15,76,51,.12)':'rgba(144,205,127,.045)';ctx.fillRect(i*W/10,0,W/10,H);}
    ctx.save();ctx.strokeStyle='rgba(232,250,221,.67)';ctx.lineWidth=2;ctx.strokeRect(26,26,W-52,H-52);ctx.beginPath();ctx.moveTo(W/2,26);ctx.lineTo(W/2,H-26);ctx.stroke();ctx.beginPath();ctx.arc(W/2,H/2,78,0,Math.PI*2);ctx.stroke();ctx.fillStyle='rgba(238,250,225,.8)';ctx.beginPath();ctx.arc(W/2,H/2,3,0,Math.PI*2);ctx.fill();
    ctx.strokeRect(26,H/2-125,125,250);ctx.strokeRect(W-151,H/2-125,125,250);ctx.strokeRect(26,H/2-65,45,130);ctx.strokeRect(W-71,H/2-65,45,130);
    ctx.fillStyle='#f1f3df';ctx.fillRect(3,H/2-69,24,138);ctx.fillRect(W-27,H/2-69,24,138);ctx.strokeStyle='rgba(238,250,225,.55)';ctx.beginPath();ctx.arc(103,H/2,3,0,Math.PI*2);ctx.arc(W-103,H/2,3,0,Math.PI*2);ctx.stroke();ctx.restore();
    // Soft tactical glow for the ball and active egoist.
    const active=match.blue[0];const g=ctx.createRadialGradient(active.x,active.y,6,active.x,active.y,68);g.addColorStop(0,'rgba(217,255,63,.14)');g.addColorStop(1,'rgba(217,255,63,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(active.x,active.y,68,0,Math.PI*2);ctx.fill();
    for(const p of match.players)drawPlayer(p);
    drawBall(match.ball);
    drawClockOverlay();
  }
  function drawPlayer(p){
    const isYou=p===match.blue[0],isBlue=p.team===0;
    if(p.flash>0){ctx.strokeStyle=`rgba(219,255,65,${Math.min(.7,p.flash)})`;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,p.r+9+Math.sin(performance.now()/60)*3,0,Math.PI*2);ctx.stroke();}
    ctx.fillStyle='rgba(4,27,19,.3)';ctx.beginPath();ctx.ellipse(p.x,p.y+9,15,7,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle=isBlue?(isYou?'#d9ff46':'#d7e5df'):'#f2775c';ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=isYou?3:2;ctx.strokeStyle=isYou?'#fffbd9':isBlue?'#96c9be':'#ffc0a3';ctx.stroke();
    // anime hair, face and directional fringe
    ctx.fillStyle=isBlue?(isYou?'#1a3568':'#2e7373'):'#722c3b';ctx.beginPath();ctx.arc(p.x,p.y-4,p.r*.73,Math.PI,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f9f2d9';ctx.beginPath();ctx.arc(p.x+5,p.y-1,1.8,0,Math.PI*2);ctx.fill();
    if(isYou){ctx.fillStyle='#17211e';ctx.font='800 10px sans-serif';ctx.textAlign='center';ctx.fillText('YOU',p.x,p.y-25);}
    if(p.hasBall){ctx.strokeStyle='rgba(243,255,226,.7)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(p.x,p.y,22,0,Math.PI*2);ctx.stroke();}
  }
  function drawBall(b){
    ctx.fillStyle='rgba(0,0,0,.24)';ctx.beginPath();ctx.ellipse(b.x,b.y+8,10,4,0,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#f8f6e8';ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#152a27';ctx.lineWidth=1.5;ctx.stroke();ctx.fillStyle='#18312c';ctx.beginPath();ctx.arc(b.x,b.y,3,0,Math.PI*2);ctx.fill();
  }
  function drawClockOverlay(){
    const t=Math.ceil(match.time),mins=String(Math.floor(t/60)).padStart(2,'0'),secs=String(t%60).padStart(2,'0');$('#match-clock').textContent=`${mins}:${secs}`;
  }
  renderProfile();
  // Initial integrity validation and conservative local-data recovery.
  if(!valid(profile)){profile=clone(DEFAULT);canonical=clone(profile);signature=seal(profile);persist();}
})();