import * as THREE from 'three';
import './style.css';

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const skills = [
  { id: 'phantom', name: 'PHANTOM STEP', icon: '⌁', color: '#78f6e8', desc: 'A sudden burst that leaves defenders behind.', effect: 'QUICK BURST · 5 SEC' },
  { id: 'eagle', name: 'EAGLE VISION', icon: '⌖', color: '#7fc7ff', desc: 'Read the field. Your next shot finds the gap.', effect: 'PRECISION SHOT · 1 USE' },
  { id: 'beast', name: 'BEAST IMPACT', icon: 'ϟ', color: '#ff806d', desc: 'A fierce strike with explosive power.', effect: 'POWER SHOT · 1 USE' },
  { id: 'flow', name: 'FLOW STATE', icon: '✳', color: '#d49cff', desc: 'Move faster and bend the ball in your zone.', effect: 'FLOW MODE · 8 SEC' },
];
const SAVE_KEY = 'striker-protocol-profile-v1';
const cleanProfile = () => ({ name: 'KAI', coins: 10, goals: 0, games: 0, wins: 0, skills: [], banned: false });
let profile;
try {
  const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  profile = saved && Number.isFinite(saved.coins) && saved.coins >= 0 && saved.coins <= 100000 && Array.isArray(saved.skills) && saved.skills.every(id => skills.some(skill => skill.id === id)) && typeof saved.banned === 'boolean'
    ? { ...cleanProfile(), ...saved, skills: [...new Set(saved.skills)] } : cleanProfile();
  if (saved && profile.coins !== saved.coins) profile.banned = true;
} catch { profile = cleanProfile(); }
function saveProfile() { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); syncProfile(); }
function syncProfile() {
  $('#player-name').textContent = profile.name;
  $('#shop-coins').textContent = profile.coins === Infinity ? '∞' : profile.coins;
  $('#locker-coins').textContent = profile.coins === Infinity ? '∞' : profile.coins;
  $('#locker-goals').textContent = profile.goals;
  $('#locker-skills').textContent = `${profile.skills.length} / ${skills.length}`;
  const owned = $('#owned-skills');
  owned.innerHTML = profile.skills.length ? profile.skills.map(id => `<span class="owned-tag">✦ ${skills.find(s => s.id === id)?.name || id}</span>`).join('') : '<span class="no-skills">No abilities yet. Make your mark on the pitch.</span>';
}

// Lightweight arena renderer: capped DPR, no postprocessing and no real-time shadows for mobile stability.
const canvas = $('#game-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
scene.background = new THREE.Color('#081522');
scene.fog = new THREE.FogExp2('#081522', 0.012);
const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, .1, 140);
scene.add(new THREE.HemisphereLight('#a5d9f0', '#14202c', 1.05));
const keyLight = new THREE.DirectionalLight('#c3f5ff', 2.3); keyLight.position.set(-12, 24, 10); scene.add(keyLight);
const glowLight = new THREE.PointLight('#22d9de', 28, 62, 2); glowLight.position.set(1, 9, -7); scene.add(glowLight);
const warmLight = new THREE.PointLight('#ff526d', 17, 52, 2); warmLight.position.set(-14, 8, 1); scene.add(warmLight);
const mat = (color, roughness = .78, emissive = '#000000', intensity = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness: .04, emissive, emissiveIntensity: intensity });
const turf = mat('#0b584e'), stripeA = mat('#106b5b'), stripeB = mat('#0c6053'), lineMat = mat('#b8e3d8', .65, '#7cebd4', .12);
const pitch = new THREE.Mesh(new THREE.PlaneGeometry(43, 68), turf); pitch.rotation.x = -Math.PI / 2; pitch.position.y = -.12; scene.add(pitch);
for (let i=0;i<10;i++) { const band = new THREE.Mesh(new THREE.PlaneGeometry(43, 6.8), i%2 ? stripeA : stripeB); band.rotation.x=-Math.PI/2; band.position.set(0,-.105,-30.6+i*6.8); scene.add(band); }
function line(x1,z1,x2,z2,width=.09) { const g=new THREE.Mesh(new THREE.BoxGeometry(Math.abs(x2-x1)||width,.015,Math.abs(z2-z1)||width),lineMat); g.position.set((x1+x2)/2,-.065,(z1+z2)/2); scene.add(g); return g; }
line(-21.5,-34,21.5,-34);line(-21.5,34,21.5,34);line(-21.5,-34,-21.5,34);line(21.5,-34,21.5,34);line(-21.5,0,21.5,0,.065);
const circle = new THREE.Mesh(new THREE.TorusGeometry(6.6,.055,4,64),lineMat);circle.rotation.x=Math.PI/2;circle.position.y=-.055;scene.add(circle);
const spot = new THREE.Mesh(new THREE.CircleGeometry(.15,12),lineMat);spot.rotation.x=-Math.PI/2;spot.position.set(0,-.05,0);scene.add(spot);
function addBox(x,y,z,w,h,d,material) { const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);m.position.set(x,y,z);scene.add(m);return m; }
// Penalty areas and a compact dark stadium bowl frame the playable field.
for (const end of [-1,1]) {
  const z=end*26.8, pz=end*22.2;
  line(-9.2,z,9.2,z,.06);line(-9.2,z,-9.2,pz,.06);line(9.2,z,9.2,pz,.06);line(-9.2,pz,9.2,pz,.06);
  line(-4.3,z,4.3,z,.06);line(-4.3,z,-4.3,end*29,.06);line(4.3,z,4.3,end*29,.06);line(-4.3,end*29,4.3,end*29,.06);
  const goalMat = mat(end === -1 ? '#51e7e5' : '#ff647c',.4,end === -1 ? '#25cbd3' : '#ff334d',.5);
  addBox(-4.2,1.25,end*32.1,.12,2.5,.12,goalMat);addBox(4.2,1.25,end*32.1,.12,2.5,.12,goalMat);addBox(0,2.5,end*32.1,8.5,.12,.12,goalMat);
  const net = new THREE.Mesh(new THREE.BoxGeometry(8.35,2.4,.08),new THREE.MeshBasicMaterial({color:end===-1?0x4bdddb:0xff526d,wireframe:true,transparent:true,opacity:.22})); net.position.set(0,1.2,end*33.5);scene.add(net);
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(160,160),mat('#07111b'));ground.rotation.x=-Math.PI/2;ground.position.y=-.36;scene.add(ground);
for (let tier=0;tier<3;tier++) {
  const z=-38-tier*3.1; addBox(0,3.8+tier*2.7,z,64,3.5,2.2,mat(tier===1?'#102638':'#0b1c2b',.85));
  const ribbon=addBox(0,2.35+tier*2.7,z+1.12,62,.11,.08,mat(tier===1?'#31d9d5':'#e04b68',.4,tier===1?'#16aaa9':'#b82f50',1.8));
  ribbon.material.emissiveIntensity = tier===0 ? 1.2 : .8;
}
for (let side of [-1,1]) {
  for(let tier=0;tier<3;tier++) {const wall=addBox(side*(24+tier*2.2),3+tier*2.7,0,2.3,3.5,58,mat(tier===2?'#101b28':'#0d2433'));}
  for(let i=0;i<8;i++){const lamp=new THREE.Mesh(new THREE.BoxGeometry(.8,.15,.15),mat('#9bf9f0',.4,'#69f4eb',3));lamp.position.set(side*(26+i%2),9,-27+i*8);scene.add(lamp);}
}
// Instanced spectator glow dots: a small number of draw calls with a low-poly silhouette.
const crowdGeo=new THREE.SphereGeometry(.12,5,4);const crowdMats=['#1b4754','#7b394e','#b17d55','#3a6772','#d5a35b'].map(c=>mat(c));
for(let row=0;row<3;row++) { const count=140;const inst=new THREE.InstancedMesh(crowdGeo,crowdMats[row%crowdMats.length],count);const dummy=new THREE.Object3D();for(let i=0;i<count;i++){const x=(Math.random()-.5)*53;const z=-38-row*3.1+(Math.random()-.5)*1.5;dummy.position.set(x,3.3+row*2.7+Math.random()*1.5,z);dummy.scale.set(.8,1+Math.random()*.9,.8);dummy.updateMatrix();inst.setMatrixAt(i,dummy.matrix);inst.setColorAt(i,new THREE.Color(crowdMats[Math.floor(Math.random()*crowdMats.length)].color));}scene.add(inst); }
const lineGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-40,0,-38),new THREE.Vector3(40,0,-38)]);
// Stylized low-poly striker, with separate limbs for a readable run cycle.
function makePlayer(team='blue') {
  const group=new THREE.Group();const blue=team==='blue';
  const jersey=mat(blue?'#14acc0':'#d4435b',.47,blue?'#087e91':'#842838',.22), dark=mat('#111d2a'), skin=mat(blue?'#d9aa87':'#d99b88'), hair=mat(blue?'#101c31':'#290f1b');
  const torso=new THREE.Mesh(new THREE.CylinderGeometry(.42,.52,1.05,7),jersey);torso.position.y=1.38;group.add(torso);
  const chest=new THREE.Mesh(new THREE.BoxGeometry(.76,.44,.28),jersey);chest.position.set(0,1.45,.12);group.add(chest);
  const head=new THREE.Mesh(new THREE.SphereGeometry(.31,8,7),skin);head.position.y=2.14;group.add(head);
  const hairCap=new THREE.Mesh(new THREE.SphereGeometry(.325,8,5,0,Math.PI*2,0,Math.PI*.53),hair);hairCap.position.y=2.22;group.add(hairCap);
  const fringe=new THREE.Mesh(new THREE.ConeGeometry(.21,.42,5),hair);fringe.position.set(.13,2.1,.24);fringe.rotation.z=-.42;group.add(fringe);
  const eyeMat=mat(blue?'#48f3e8':'#ffb17e',.35,blue?'#2cded9':'#ff694d',.7);const eye=new THREE.Mesh(new THREE.BoxGeometry(.22,.045,.045),eyeMat);eye.position.set(0,2.13,.285);group.add(eye);
  const legs=[];for(let s of [-1,1]){const thigh=new THREE.Mesh(new THREE.CylinderGeometry(.16,.13,.56,6),dark);thigh.position.set(s*.2,.78,0);group.add(thigh);const leg=new THREE.Group();leg.position.set(s*.2,.55,0);const shin=new THREE.Mesh(new THREE.CylinderGeometry(.12,.1,.48,6),blue?mat('#e6f4f4'):dark);shin.position.y=-.24;leg.add(shin);const shoe=new THREE.Mesh(new THREE.BoxGeometry(.22,.12,.4),mat(blue?'#c5fbf4':'#f3d9d7'));shoe.position.set(0,-.48,.08);leg.add(shoe);group.add(leg);legs.push(leg);}
  const arms=[];for(let s of [-1,1]){const arm=new THREE.Group();arm.position.set(s*.48,1.7,0);const upper=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.56,6),jersey);upper.position.y=-.26;arm.add(upper);const hand=new THREE.Mesh(new THREE.SphereGeometry(.11,6,5),skin);hand.position.y=-.58;arm.add(hand);group.add(arm);arms.push(arm);}
  group.userData={legs,arms,team,jersey};scene.add(group);return group;
}
const player=makePlayer('blue'), rival=makePlayer('red'), teammate=makePlayer('blue');
player.position.set(0,0,13);rival.position.set(-1.5,0,-13);teammate.position.set(8,0,7);teammate.scale.setScalar(.82);teammate.visible=false;
const ball=new THREE.Group();const ballCore=new THREE.Mesh(new THREE.SphereGeometry(.34,12,10),mat('#f2f4e9',.48));ball.add(ballCore);const ballStripe=new THREE.Mesh(new THREE.TorusGeometry(.24,.032,5,16),mat('#16202b'));ballStripe.rotation.x=.8;ball.add(ballStripe);const ballStripe2=ballStripe.clone();ballStripe2.rotation.y=1.2;ball.add(ballStripe2);scene.add(ball);ball.position.set(0,.35,11.3);
const shadowGeo=new THREE.CircleGeometry(.55,16);const shadowMat=new THREE.MeshBasicMaterial({color:0x06100e,transparent:true,opacity:.3});const shadow=new THREE.Mesh(shadowGeo,shadowMat);shadow.rotation.x=-Math.PI/2;scene.add(shadow);
const glowGeo=new THREE.RingGeometry(.5,.62,32);const playerGlow=new THREE.Mesh(glowGeo,new THREE.MeshBasicMaterial({color:0x4beae2,transparent:true,opacity:.6,side:THREE.DoubleSide}));playerGlow.rotation.x=-Math.PI/2;playerGlow.position.y=-.03;player.add(playerGlow);
const state={playing:false,training:false,paused:false,ended:false,playerScore:0,rivalScore:0,time:120,stamina:100,flow:0,velocity:new THREE.Vector3(),ballVelocity:new THREE.Vector3(),keys:new Set(),joy:{x:0,y:0},sprinting:false,activeSpecial:0,specialCooldown:0,toastTimer:0,scoreFlash:0};
let toastTimer;
function toast(msg){const el=$('#game-toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),1500);}
function setVectorDirection(a,b){const dx=a.x-b.x,dz=a.z-b.z;return new THREE.Vector3(dx,0,dz).normalize();}
function nearestOpponent(){return rival;}
function kickBall(direction,power=12){state.ballVelocity.copy(direction).multiplyScalar(power);state.ballVelocity.y=1.4;state.flow=Math.min(100,state.flow+18);}
function action(name){if(!state.playing||state.paused||state.ended)return;const pos=player.position;const d=pos.distanceTo(ball.position);
  if(name==='sprint'){state.sprinting=true;return;}
  if(name==='shoot'){
    if(d<3.5){let dir=new THREE.Vector3(-ball.position.x*.08,0,-1).normalize();let power=23;if(state.activeSpecial&&state.specialType==='power'){power=30;state.activeSpecial=0;}else if(state.activeSpecial&&state.specialType==='aim'){dir.x=rival.position.x>ball.position.x?-.07:.07;dir.normalize();power=27;state.activeSpecial=0;}kickBall(dir,power);toast('STRIKE!');}
    else toast('GET CLOSER TO THE BALL');return;
  }
  if(name==='pass'){if(d<4){const target=teammate.visible?setVectorDirection(teammate.position,ball.position):new THREE.Vector3(.35,0,-1);kickBall(target.normalize(),8);toast('PASS');}else toast('MOVE TO THE BALL');return;}
  if(name==='tackle'){const opp=nearestOpponent();if(pos.distanceTo(opp.position)<3.2){opp.position.add(new THREE.Vector3((Math.random()-.5)*2,0,2.7));if(d<4){kickBall(new THREE.Vector3((Math.random()-.5)*.8,0,1),8);toast('CLEAN TACKLE');}else toast('TACKLE WON');}else toast('NO RIVAL IN RANGE');return;}
  if(name==='special'){
    if(!profile.skills.length){toast('UNLOCK A SKILL IN THE ARSENAL');return;}if(state.specialCooldown>0){toast(`COOLDOWN ${Math.ceil(state.specialCooldown)}S`);return;}
    const skill=skills.find(s=>s.id===profile.skills[0]);state.specialCooldown=13;
    if(skill.id==='phantom'){state.activeSpecial=5;state.specialType='burst';toast('PHANTOM STEP · BURST');}
    if(skill.id==='eagle'){state.activeSpecial=1;state.specialType='aim';toast('EAGLE VISION · LOCKED IN');}
    if(skill.id==='beast'){state.activeSpecial=1;state.specialType='power';toast('BEAST IMPACT · CHARGED');}
    if(skill.id==='flow'){state.activeSpecial=8;state.specialType='flow';toast('FLOW STATE · AWAKENED');}
  }
}
function resetPositions(){player.position.set(0,0,11);rival.position.set(-1.5,0,-13);teammate.position.set(8,0,7);teammate.visible=false;ball.position.set(.7,.36,9);state.velocity.set(0,0,0);state.ballVelocity.set(0,0,0);state.stamina=100;state.flow=0;state.activeSpecial=0;}
function startMatch(training=false){state.playing=true;state.training=training;state.paused=false;state.ended=false;state.playerScore=0;state.rivalScore=0;state.time=120;resetPositions();$('#score-you').textContent='0';$('#score-rival').textContent='0';$('#match-clock').textContent='02:00';$('#home-screen').classList.add('hidden');$('#matchmaking').classList.add('hidden');$('#match-screen').classList.remove('hidden');$('#pause-modal').classList.add('hidden');$('#result-modal').classList.add('hidden');$('#objective b').textContent=training?'TRAINING · TAKE YOUR SHOT':'SCORE THE NEXT GOAL';toast(training?'TRAINING SESSION START':'RIVAL FOUND · STRIKE FIRST');}
function endMatch(){state.ended=true;state.playing=false;$('#result-title').textContent=state.playerScore>state.rivalScore?'YOU OWNED THE PITCH':state.playerScore===state.rivalScore?'A DRAW. RUN IT BACK?':'THE RIVAL TAKES THIS ONE';let reward=state.training?0:(state.playerScore>state.rivalScore?40:25);$('#result-copy').textContent=state.training?'Training complete. No match rewards awarded.':`Final score ${state.playerScore} — ${state.rivalScore}. Keep sharpening your ego.`;$('#result-reward').textContent=`+${reward} G`;$('#result-modal').classList.remove('hidden');if(!state.training){profile.coins+=reward;profile.games++;profile.wins+=state.playerScore>state.rivalScore?1:0;profile.goals+=state.playerScore;saveProfile();}}
function goal(who){if(who==='you'){state.playerScore++;if(!state.training){profile.goals++;profile.coins+=20;saveProfile();}toast('GOAL! +20 GOLD');}else{state.rivalScore++;toast('RIVAL GOAL');}$('#score-you').textContent=state.playerScore;$('#score-rival').textContent=state.rivalScore;state.flow=Math.min(100,state.flow+34);state.scoreFlash=.6;resetPositions();if(state.playerScore>=3||state.rivalScore>=3)endMatch();}
function buySkill(id){const skill=skills.find(s=>s.id===id);if(!skill||profile.skills.includes(id))return;if(profile.coins<100){toast('NOT ENOUGH GOLD · PLAY A MATCH TO EARN MORE');return;}profile.coins-=100;profile.skills.push(id);saveProfile();renderShop();toast(`${skill.name} UNLOCKED`);}
function renderShop(){const grid=$('#skill-grid');grid.innerHTML=skills.map(s=>{const owned=profile.skills.includes(s.id);const affordable=profile.coins>=100;return `<article class="skill-card" style="--skill-color:${s.color}"><div class="skill-art">${s.icon}</div><div class="skill-details"><b>${s.name}</b><small>${s.desc}</small></div><div class="skill-effect">${s.effect}</div><button class="buy-skill" data-buy="${s.id}" ${owned?'disabled':''}>${owned?'✓  UNLOCKED':affordable?'◉  UNLOCK · 100 G':'◉  NEED 100 G'}</button></article>`;}).join('');grid.querySelectorAll('[data-buy]').forEach(button=>button.addEventListener('click',()=>buySkill(button.dataset.buy)));}
function openOverlay(id){$(id).classList.remove('hidden');if(id==='#shop-modal')renderShop();}
$('#play-button').addEventListener('click',()=>{if(profile.banned){toast('ACCOUNT RESTRICTED · INTEGRITY REVIEW REQUIRED');return;}$('#matchmaking').classList.remove('hidden');$('#queue-title').textContent='FINDING YOUR RIVAL';$('#queue-status').textContent='Pairing with a local AI striker · estimated 00:02';setTimeout(()=>{if(!$('#matchmaking').classList.contains('hidden')){startMatch(false);}},1500);});
$('#training-button').addEventListener('click',()=>startMatch(true));
$('#cancel-queue').addEventListener('click',()=>$('#matchmaking').classList.add('hidden'));
$('#shop-open').addEventListener('click',()=>openOverlay('#shop-modal'));
$('#locker-open').addEventListener('click',()=>openOverlay('#locker-modal'));
$('#profile-open').addEventListener('click',()=>openOverlay('#locker-modal'));
$('#home-nav').addEventListener('click',()=>{if(state.playing){state.paused=true;$('#pause-modal').classList.remove('hidden');}});
document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>$('#'+button.dataset.close).classList.add('hidden')));
$('#pause-button').addEventListener('click',()=>{state.paused=true;$('#pause-modal').classList.remove('hidden');});
$('#resume-button').addEventListener('click',()=>{state.paused=false;$('#pause-modal').classList.add('hidden');});
$('#quit-button').addEventListener('click',()=>{state.playing=false;state.paused=false;$('#pause-modal').classList.add('hidden');$('#match-screen').classList.add('hidden');$('#home-screen').classList.remove('hidden');camera.position.set(0,25,50);camera.lookAt(0,0,0);});
$('#result-home').addEventListener('click',()=>{$('#result-modal').classList.add('hidden');$('#match-screen').classList.add('hidden');$('#home-screen').classList.remove('hidden');camera.position.set(0,25,50);camera.lookAt(0,0,0);});
$('#sound-toggle').addEventListener('click',e=>{e.currentTarget.classList.toggle('muted');toast(e.currentTarget.classList.contains('muted')?'SOUND OFF':'SOUND ON');});
document.querySelectorAll('[data-action]').forEach(button=>{
  const name=button.dataset.action;
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.classList.add('pressed');if(name==='sprint'){action(name);}else action(name);});
  const release=()=>{button.classList.remove('pressed');if(name==='sprint')state.sprinting=false;};button.addEventListener('pointerup',release);button.addEventListener('pointerleave',release);button.addEventListener('pointercancel',release);
});
const joystick=$('#joystick'),knob=$('#stick-knob');let joyPointer=null;
function updateJoy(e){const rect=joystick.getBoundingClientRect();const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;const max=rect.width*.31;let dx=e.clientX-cx,dy=e.clientY-cy;const len=Math.hypot(dx,dy);if(len>max){dx=dx/len*max;dy=dy/len*max;}knob.style.transform=`translate(${dx}px,${dy}px)`;state.joy.x=dx/max;state.joy.y=dy/max;}
joystick.addEventListener('pointerdown',e=>{e.preventDefault();joyPointer=e.pointerId;joystick.setPointerCapture(joyPointer);updateJoy(e);});joystick.addEventListener('pointermove',e=>{if(joyPointer===e.pointerId)updateJoy(e);});function releaseJoy(){joyPointer=null;state.joy.x=0;state.joy.y=0;knob.style.transform='';}joystick.addEventListener('pointerup',releaseJoy);joystick.addEventListener('pointercancel',releaseJoy);
window.addEventListener('keydown',e=>{const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();state.keys.add(k);if(k===' '||k==='j')action('shoot');if(k==='e')action('pass');if(k==='q')action('tackle');if(k==='f')action('special');if(k==='shift')state.sprinting=true;if(k==='escape'&&state.playing){state.paused=!state.paused;$('#pause-modal').classList.toggle('hidden',!state.paused);}});
window.addEventListener('keyup',e=>{state.keys.delete(e.key.toLowerCase());if(e.key==='Shift')state.sprinting=false;});
window.addEventListener('blur',()=>{state.keys.clear();state.sprinting=false;releaseJoy();});

function animatePlayer(model,t,moving,speed=1){const {legs,arms}=model.userData;const swing=moving?Math.sin(t*speed*9)*.58:0;legs[0].rotation.x=swing;legs[1].rotation.x=-swing;arms[0].rotation.x=-swing*.7;arms[1].rotation.x=swing*.7;model.position.y=moving?Math.abs(Math.sin(t*speed*9))*.045:Math.sin(t*1.6)*.025;}
let last=performance.now(),gameElapsed=0;
function update(dt,now){const t=now*.001;const live=state.playing&&!state.paused&&!state.ended;
  if(live){state.time=Math.max(0,state.time-dt);if(state.time===0){endMatch();}state.specialCooldown=Math.max(0,state.specialCooldown-dt);state.activeSpecial=Math.max(0,state.activeSpecial-dt);
    let ix=0,iz=0;if(state.keys.has('a')||state.keys.has('arrowleft'))ix-=1;if(state.keys.has('d')||state.keys.has('arrowright'))ix+=1;if(state.keys.has('w')||state.keys.has('arrowup'))iz-=1;if(state.keys.has('s')||state.keys.has('arrowdown'))iz+=1;ix+=state.joy.x;iz+=state.joy.y;if(Math.abs(ix)+Math.abs(iz)>1){const l=Math.hypot(ix,iz);ix/=l;iz/=l;}
    const sprint=state.sprinting&&state.stamina>2;const speed=(sprint?8.2:5.7)*(state.activeSpecial&&state.specialType==='burst'?1.5:state.activeSpecial&&state.specialType==='flow'?1.25:1);if(sprint)state.stamina=Math.max(0,state.stamina-dt*23);else state.stamina=Math.min(100,state.stamina+dt*13);
    state.velocity.x=ix*speed;state.velocity.z=iz*speed;player.position.x=clamp(player.position.x+state.velocity.x*dt,-20,20);player.position.z=clamp(player.position.z+state.velocity.z*dt,-31,31);if(ix||iz)player.rotation.y=Math.atan2(ix,-iz);
    const dist=player.position.distanceTo(ball.position);if(dist<1.6){const n=new THREE.Vector3(ix,0,iz);if(n.lengthSq()<.1)n.set(0,0,-1);ball.position.x+=n.x*dt*2.4;ball.position.z+=n.z*dt*2.4;}
    // Opponent AI: chase and clear toward the player's goal when in possession.
    const toward=new THREE.Vector3(ball.position.x-rival.position.x,0,ball.position.z-rival.position.z);const rd=toward.length();if(rd>.1){toward.normalize();rival.position.x+=toward.x*3.7*dt;rival.position.z+=toward.z*3.7*dt;rival.rotation.y=Math.atan2(toward.x,-toward.z);}
    const rivalDist=rival.position.distanceTo(ball.position);if(rivalDist<1.65){ball.position.x+=(Math.random()-.5)*.035;ball.position.z+=dt*2.6;if(Math.random()<dt*.75)state.ballVelocity.z=7.8;}
    state.ballVelocity.y-=9.8*dt;ball.position.addScaledVector(state.ballVelocity,dt);if(ball.position.y<.35){ball.position.y=.35;if(state.ballVelocity.y<0)state.ballVelocity.y*=-.23;}state.ballVelocity.x*=Math.pow(.992,dt*60);state.ballVelocity.z*=Math.pow(.992,dt*60);if(Math.abs(state.ballVelocity.x)+Math.abs(state.ballVelocity.z)<.06){state.ballVelocity.x=0;state.ballVelocity.z=0;}
    if(ball.position.x<-21||ball.position.x>21){state.ballVelocity.x*=-.65;ball.position.x=clamp(ball.position.x,-21,21);}if(ball.position.z<-34){if(Math.abs(ball.position.x)<4.4)goal('you');else{ball.position.z=-33;state.ballVelocity.z*= -.55;}}if(ball.position.z>34){if(Math.abs(ball.position.x)<4.4)goal('rival');else{ball.position.z=33;state.ballVelocity.z*= -.55;}}
    $('#match-clock').textContent=`${String(Math.floor(state.time/60)).padStart(2,'0')}:${String(Math.floor(state.time%60)).padStart(2,'0')}`;$('#stamina-value').textContent=`${Math.round(state.stamina)}%`;$('#stamina-meter').style.width=`${state.stamina}%`;$('#flow-value').textContent=`${Math.round(state.flow)}%`;$('#flow-meter').style.width=`${state.flow}%`;
  } else {state.ballVelocity.multiplyScalar(Math.pow(.985,dt*60));ball.position.addScaledVector(state.ballVelocity,dt);if(ball.position.y<.35)ball.position.y=.35;}
  animatePlayer(player,t,live&&(Math.abs(state.velocity.x)+Math.abs(state.velocity.z)>.1),1);animatePlayer(rival,t,live&&rival.position.distanceTo(ball.position)>1.9,.9);animatePlayer(teammate,t,false,.7);
  ball.rotation.x+=dt*3;ball.rotation.z+=dt*1.2;shadow.position.set(ball.position.x,.005,ball.position.z);shadow.scale.setScalar(1+Math.max(0,ball.position.y-.35)*.15);
  if(state.playing){camera.position.lerp(new THREE.Vector3(player.position.x*.65,16.3,player.position.z+19.5),1-Math.exp(-dt*2.2));camera.lookAt(player.position.x*.4,0,player.position.z-7.5);}else{camera.position.lerp(new THREE.Vector3(0,23,48),1-Math.exp(-dt*1.5));camera.lookAt(0,0,0);}
  glowLight.position.x=Math.sin(t*.25)*12;warmLight.intensity=15+Math.sin(t*1.7)*3;glowLight.intensity=24+Math.sin(t*1.3)*5;
  if(state.scoreFlash>0)state.scoreFlash-=dt;
}
function render(now){const dt=Math.min(.04,(now-last)/1000);last=now;update(dt,now);renderer.render(scene,camera);requestAnimationFrame(render);}requestAnimationFrame(render);
function resize(){const w=window.innerWidth,h=window.innerHeight;renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=window.matchMedia('(orientation: portrait)').matches?55:43;camera.updateProjectionMatrix();}
window.addEventListener('resize',resize,{passive:true});window.addEventListener('orientationchange',()=>setTimeout(resize,120),{passive:true});
renderShop();syncProfile();resize();
