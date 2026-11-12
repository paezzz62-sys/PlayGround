import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.js';

const $ = (id) => document.getElementById(id);
const SKILLS = [
  { id: 'PHANTOM_STRIKE', name: 'PHANTOM STRIKE', icon: '影', desc: 'A sudden burst shot that tears through the defense.' },
  { id: 'CURVE_SHOT', name: 'CURVE SHOT', icon: '弧', desc: 'Bend the ball around defenders with a lethal arc.' },
  { id: 'BURST_DRIBBLE', name: 'BURST DRIBBLE', icon: '迅', desc: 'Explode past the line and keep the ball close.' },
];
let socket = null, playerId = null, connected = false, started = false, coins = 10, skills = [], team = 'red';
let playerName = 'Rookie', lastMoveSent = 0, lastKick = 0, activeSkill = null, toastTimer = 0, matchStart = Date.now();
const keys = new Set(), remotePlayers = new Map(), playerMeshes = new Map();
const world = { ball: { x: 0, y: .6, z: 0, vx: 0, vy: 0, vz: 0 }, score: { red: 0, blue: 0 }, ballMesh: null, local: null };
const scene = new THREE.Scene();
scene.background = new THREE.Color('#071311');
scene.fog = new THREE.FogExp2('#071311', .012);
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 180);
const renderer = new THREE.WebGLRenderer({ canvas: $('pitch'), antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

scene.add(new THREE.HemisphereLight(0xb9f9e3, 0x142522, 2.1));
const keyLight = new THREE.DirectionalLight(0xfff1d2, 3.2); keyLight.position.set(-15, 30, 18); keyLight.castShadow = true; keyLight.shadow.mapSize.set(1024, 1024); keyLight.shadow.camera.left = -34; keyLight.shadow.camera.right = 34; keyLight.shadow.camera.top = 25; keyLight.shadow.camera.bottom = -25; scene.add(keyLight);
const rimLight = new THREE.DirectionalLight(0x67d9c6, 1.8); rimLight.position.set(12, 12, -18); scene.add(rimLight);

const grassMatA = new THREE.MeshStandardMaterial({ color: '#15503e', roughness: .88 });
const grassMatB = new THREE.MeshStandardMaterial({ color: '#185743', roughness: .9 });
const pitch = new THREE.Group(); scene.add(pitch);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 150), new THREE.MeshStandardMaterial({ color: '#081514', roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -.25; ground.receiveShadow = true; scene.add(ground);
const field = new THREE.Mesh(new THREE.PlaneGeometry(50, 28), grassMatA); field.rotation.x = -Math.PI / 2; field.position.y = -.04; field.receiveShadow = true; pitch.add(field);
for (let i = 0; i < 10; i++) { const stripe = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 28), i % 2 ? grassMatA : grassMatB); stripe.rotation.x = -Math.PI / 2; stripe.position.set(-22.5 + i * 5, -.025, 0); pitch.add(stripe); }
const lineMat = new THREE.MeshBasicMaterial({ color: '#c4e4cb', transparent: true, opacity: .67 });
function line(x1, z1, x2, z2, thick = .08) { const dx = x2 - x1, dz = z2 - z1; const m = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(dx, dz), .035, thick), lineMat); m.position.set((x1 + x2) / 2, .015, (z1 + z2) / 2); m.rotation.y = -Math.atan2(dz, dx); pitch.add(m); }
line(-25,-14,25,-14); line(-25,14,25,14); line(-25,-14,-25,14); line(25,-14,25,14); line(0,-14,0,14);
const circle = new THREE.Mesh(new THREE.RingGeometry(4.95, 5.05, 64), lineMat); circle.rotation.x = -Math.PI/2; circle.position.y = .022; pitch.add(circle);
const centerSpot = new THREE.Mesh(new THREE.CircleGeometry(.15, 20), lineMat); centerSpot.rotation.x=-Math.PI/2; centerSpot.position.y=.025; pitch.add(centerSpot);
for (const sign of [-1, 1]) { line(sign*25, -5, sign*25, 5); line(sign*25,-5,sign*20,-5); line(sign*20,-5,sign*20,5); line(sign*20,5,sign*25,5); line(sign*25,-9,sign*25,9); line(sign*25,-9,sign*17,-9); line(sign*17,-9,sign*17,9); line(sign*17,9,sign*25,9); }
// Stadium border, vivid goal frames and luminous advertising rails.
const railMat = new THREE.MeshStandardMaterial({ color: '#a9db47', emissive: '#75a81b', emissiveIntensity: .65, metalness: .35, roughness: .4 });
function box(parent, size, pos, mat, cast = false) { const m = new THREE.Mesh(new THREE.BoxGeometry(...size), mat); m.position.set(...pos); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m; }
for (const z of [-14.45,14.45]) box(scene,[52,.28,.22],[0,.1,z],railMat);
for (const sign of [-1,1]) {
  const goal = new THREE.Group(); goal.position.x = sign * 25.2; scene.add(goal);
  const postMat = new THREE.MeshStandardMaterial({ color: '#f0f3db', metalness: .4, roughness: .28, emissive: '#567068', emissiveIntensity: .3 });
  for (const z of [-3.6,3.6]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,3.4,12),postMat); post.position.set(0,1.7,z); post.castShadow=true; goal.add(post); }
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,7.2,12),postMat); bar.rotation.x=Math.PI/2; bar.position.y=3.4; bar.castShadow=true; goal.add(bar);
  const netMat = new THREE.MeshBasicMaterial({ color: '#bbd7c6', wireframe: true, transparent: true, opacity: .18 }); const net = new THREE.Mesh(new THREE.BoxGeometry(2.5,3.3,7.1),netMat); net.position.set(sign*1.1,1.65,0); goal.add(net);
}
// Abstract, low-poly arena seating and luminous crowd lights.
const standMat = new THREE.MeshStandardMaterial({ color: '#101f1e', roughness: .96 });
for (const z of [-1,1]) { for (let row=0; row<3; row++) { const slab = box(scene,[59,1.2,3.2],[0,-.8-row*.3,z*(16.2+row*2)],standMat); slab.rotation.x = z * -.04; } }
const glowColors = ['#d8ff3e','#59d9c2','#ff6d74','#e9c65e'];
for(let i=0;i<80;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.055+Math.random()*.05,6,6),new THREE.MeshBasicMaterial({color:glowColors[i%4]})); m.position.set((Math.random()-.5)*53,Math.random()*1.8+1.3,(Math.random()<.5?-1:1)*(16+Math.random()*5));scene.add(m);}

function makePlayer(color, accent, isLocal=false) {
  const root = new THREE.Group(); const jersey = new THREE.MeshStandardMaterial({color, roughness:.52, metalness:.04}); const dark = new THREE.MeshStandardMaterial({color:'#101719',roughness:.7}); const trim = new THREE.MeshStandardMaterial({color:accent,emissive:accent,emissiveIntensity:.23,roughness:.35});
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.43,.58,5,8),jersey); torso.position.y=1.13; torso.castShadow=true; root.add(torso);
  const shirtStripe = new THREE.Mesh(new THREE.BoxGeometry(.09,.69,.79),trim); shirtStripe.position.set(.03,1.15,.016); root.add(shirtStripe);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.31,12,10),new THREE.MeshStandardMaterial({color:'#e4b49d',roughness:.76})); head.position.y=1.96; head.castShadow=true; root.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(.34,10,7,0,Math.PI*2,0,Math.PI*.52),new THREE.MeshStandardMaterial({color:isLocal?'#19202a':accent,roughness:.55})); hair.position.y=2.08; hair.castShadow=true; root.add(hair);
  const shorts = new THREE.Mesh(new THREE.BoxGeometry(.63,.28,.54),dark); shorts.position.y=.64; root.add(shorts);
  const legs=[]; for(const z of [-.19,.19]){const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.12,.48,4,6),dark);leg.position.set(0,.29,z);leg.castShadow=true;root.add(leg);legs.push(leg);}
  for(const z of [-.38,.38]){const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.105,.45,4,6),jersey);arm.position.set(0,1.13,z);arm.rotation.x=z>0?-.2:.2;root.add(arm);}
  const glow = new THREE.Mesh(new THREE.CircleGeometry(.72,24),new THREE.MeshBasicMaterial({color:accent,transparent:true,opacity:.18,depthWrite:false})); glow.rotation.x=-Math.PI/2;glow.position.y=.03;root.add(glow);
  if(isLocal){const ring=new THREE.Mesh(new THREE.RingGeometry(.69,.78,32),new THREE.MeshBasicMaterial({color:'#d8ff3e',transparent:true,opacity:.9,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.045;root.add(ring);}
  root.userData={legs,torso}; return root;
}
function addPlayer(data, isLocal=false) {
  const color=data.team==='red'?'#d94450':'#20b6b0', accent=data.team==='red'?'#ff6972':'#6ffff0';
  const model=makePlayer(color,accent,isLocal); model.position.set(data.x,0,data.z); model.rotation.y=data.ry||0; scene.add(model); playerMeshes.set(data.id,model);
  if(isLocal){world.local={...data,model};}
  return model;
}
const ballMesh=new THREE.Group();
const ballSphere=new THREE.Mesh(new THREE.SphereGeometry(.42,20,14),new THREE.MeshStandardMaterial({color:'#f5f1da',roughness:.34,metalness:.06}));ballSphere.castShadow=true;ballMesh.add(ballSphere);
const ballLines=new THREE.Mesh(new THREE.IcosahedronGeometry(.423,1),new THREE.MeshBasicMaterial({color:'#1a2522',wireframe:true,transparent:true,opacity:.85}));ballMesh.add(ballLines);
const ballHalo=new THREE.Mesh(new THREE.RingGeometry(.55,.65,32),new THREE.MeshBasicMaterial({color:'#e9f75e',transparent:true,opacity:.7,side:THREE.DoubleSide}));ballHalo.rotation.x=-Math.PI/2;ballHalo.position.y=-.36;ballMesh.add(ballHalo);scene.add(ballMesh);world.ballMesh=ballMesh;

function setStatus(label, online) { $('status-label').textContent=label; $('connection-detail').textContent=online?'SOCKET.IO · LIVE':'LOCAL PRACTICE MODE'; $('status-dot').classList.toggle('offline',!online); }
function setCoins(value) { coins=value; $('coin-count').textContent=value>=999999?'∞':String(value); $('shop-coins').textContent=value>=999999?'∞':String(value); }
function setStats(stats) { for(const [key,val] of [['pace',stats.speed],['power',stats.power],['control',stats.control]]){$(`${key}-value`).textContent=String(val).padStart(2,'0'); const bars=$(`${key}-bars`);bars.innerHTML='';for(let i=0;i<10;i++){const b=document.createElement('i');if(i<val)b.className='on';bars.appendChild(b);}} }
function renderShop(){const list=$('skill-list');list.innerHTML='';for(const skill of SKILLS){const owned=skills.includes(skill.id);const item=document.createElement('div');item.className='skill-item';item.innerHTML=`<div class="skill-symbol">${skill.icon}</div><div class="skill-copy"><b>${skill.name}</b><p>${skill.desc}</p></div><button ${owned||(!world.local?.admin&&coins<100)?'disabled':''} data-skill="${skill.id}">${owned?'UNLOCKED':world.local?.admin?'UNLOCKED':'₲ 100'}</button>`;const button=item.querySelector('button');if(!owned)button.addEventListener('click',()=>buySkill(skill.id));list.appendChild(item);} $('skill-count').textContent=String(skills.length).padStart(2,'0');}
function showToast(message){const el=$('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100);}
function buySkill(skill){if(!connected){showToast('Connect online to purchase skills.');return;}socket.emit('buySkill',skill);}
function updateIdentity(data){team=data.team;playerName=data.name;setCoins(data.coins);skills=data.skills||[];world.local={...world.local,...data};$('player-name-display').textContent=data.name.toUpperCase();$('team-label').textContent=`${data.team.toUpperCase()} TEAM · #${String(data.id||'').slice(0,4).toUpperCase()}`;$('role-label').textContent=data.admin?'ARENA ADMIN':'STRIKER';setStats(data.stats||{speed:5,power:5,control:5});renderShop();}
function connect(){if(!window.io){setStatus('LOCAL PRACTICE MODE',false);return;}
  socket=window.io({auth:{name:playerName,adminKey:$('admin-key-input').value},reconnection:true,timeout:5000});
  socket.on('connect',()=>{connected=true;setStatus('ARENA LINK ESTABLISHED',true);$('queue-button').querySelector('b').textContent='FIND A MATCH';$('player-count').textContent='ARENA OPEN · CONNECTED';});
  socket.on('init',(state)=>{playerId=state.id;world.score=state.score;world.ball=state.ball;updateScores();const me=state.self;updateIdentity(me);if(!playerMeshes.has(playerId))addPlayer(me,true);for(const [id,p] of Object.entries(state.players)){if(id!==playerId&&!playerMeshes.has(id)){remotePlayers.set(id,p);addPlayer(p);}}$('player-count').textContent=`ARENA OPEN · ${Object.keys(state.players).length} PLAYER${Object.keys(state.players).length===1?'':'S'}`;started=true;});
  socket.on('playerJoined',(p)=>{remotePlayers.set(p.id,p);if(!playerMeshes.has(p.id))addPlayer(p);updateCount();showToast(`${p.name} entered the arena`);});
  socket.on('playerMoved',(p)=>{remotePlayers.set(p.id,p);const m=playerMeshes.get(p.id);if(m){m.userData.target={x:p.x,z:p.z,ry:p.ry};}});
  socket.on('playerUpdated',(p)=>{if(p.id===playerId)updateIdentity(p);});
  socket.on('playerLeft',(id)=>{remotePlayers.delete(id);const m=playerMeshes.get(id);if(m){scene.remove(m);playerMeshes.delete(id);}updateCount();});
  socket.on('world',(s)=>{world.ball=s.ball;world.score=s.score;updateScores();});
  socket.on('ballKicked',(evt)=>{world.ball=evt.ball;if(evt.by!==playerId)showToast(evt.skill?`${evt.name} used ${evt.skill.replaceAll('_',' ')}`:`${evt.name} took a shot`);});
  socket.on('goal',(evt)=>{world.score=evt.score;updateScores();$('goal-team').textContent=`${evt.team.toUpperCase()} TEAM`;const flash=$('goal-flash');flash.classList.remove('show');void flash.offsetWidth;flash.classList.add('show');});
  socket.on('shopResult',(result)=>{if(result.ok){setCoins(result.coins);skills=result.skills;renderShop();showToast('Signature skill unlocked. Make it count.');}else showToast(result.message||'Purchase unavailable.');});
  socket.on('securityWarning',(data)=>{const el=$('security-toast');el.textContent=`SECURITY · ${data.message} (${data.strikes}/${data.max})`;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2500);});
  socket.on('banned',(data)=>{const el=$('security-toast');el.textContent=data.message;el.classList.add('show');});
  socket.on('disconnect',()=>{connected=false;setStatus('RECONNECTING TO ARENA',false);});
  socket.on('connect_error',()=>{connected=false;setStatus('LOCAL PRACTICE MODE',false);$('player-count').textContent='OFFLINE · PRACTICE READY';});
}
function updateCount(){const count=playerMeshes.size;$('player-count').textContent=`ARENA OPEN · ${count} PLAYER${count===1?'':'S'}`;}
function updateScores(){$('red-score').textContent=String(world.score.red||0).padStart(2,'0');$('blue-score').textContent=String(world.score.blue||0).padStart(2,'0');}
function skillFire(){if(!world.local)return;const owned=skills.filter((id)=>SKILLS.some(s=>s.id===id));if(!owned.length){showToast('Unlock a signature skill in the Skill Lab.');return;}activeSkill=owned[(Math.floor(Date.now()/9000))%owned.length];kick(activeSkill);}
function kick(skill=null){if(!world.local)return;const now=Date.now();if(now-lastKick<400)return;const p=world.local;const dx=world.ball.x-p.x,dz=world.ball.z-p.z;if(Math.hypot(dx,dz)>3.4){showToast('Get closer to the ball.');return;}lastKick=now;let dir=new THREE.Vector3(Math.cos(p.ry),0,-Math.sin(p.ry));if(Math.hypot(dx,dz)>.5)dir.set(dx,0,dz).normalize();const sprint=keys.has('Shift')?1.08:1;const force=skill==='PHANTOM_STRIKE'?27:skill==='CURVE_SHOT'?22:skill==='BURST_DRIBBLE'?18:18;const vz=dir.z*force*sprint+(skill==='CURVE_SHOT'?4:0);if(connected)socket.emit('kickBall',{vx:dir.x*force*sprint,vy:skill==='CURVE_SHOT'?11:6,vz,skill});else{world.ball.vx=dir.x*force*sprint;world.ball.vy=skill==='CURVE_SHOT'?11:6;world.ball.vz=vz;showToast(skill?`${skill.replaceAll('_',' ')}!`:'SHOT!');}}

window.addEventListener('keydown',(e)=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();keys.add(e.code);if(e.repeat)return;if(e.code==='Space')kick();if(e.code==='KeyQ')skillFire();if(e.code==='Digit1'&&skills[0])kick(skills[0]);if(e.code==='Digit2'&&skills[1])kick(skills[1]);if(e.code==='Digit3'&&skills[2])kick(skills[2]);});
window.addEventListener('keyup',(e)=>keys.delete(e.code));
$('mobile-shoot').addEventListener('pointerdown',(e)=>{e.preventDefault();kick();});$('mobile-skill').addEventListener('pointerdown',(e)=>{e.preventDefault();skillFire();});
for(const btn of document.querySelectorAll('[data-dir]')){const code={up:'KeyW',down:'KeyS',left:'KeyA',right:'KeyD'}[btn.dataset.dir];btn.addEventListener('pointerdown',(e)=>{e.preventDefault();keys.add(code);});for(const event of ['pointerup','pointercancel','pointerleave'])btn.addEventListener(event,()=>keys.delete(code));}
$('welcome-form').addEventListener('submit',(e)=>{e.preventDefault();playerName=$('name-input').value.trim().slice(0,16)||'Rookie';$('welcome-modal').classList.add('hidden');started=true;connect();});
$('open-shop').addEventListener('click',()=>{$('shop-modal').classList.remove('hidden');renderShop();});$('shop-teaser').addEventListener('click',()=>{$('shop-modal').classList.remove('hidden');renderShop();});$('close-shop').addEventListener('click',()=>$('shop-modal').classList.add('hidden'));$('shop-modal').addEventListener('click',(e)=>{if(e.target===$('shop-modal'))$('shop-modal').classList.add('hidden');});
$('queue-button').addEventListener('click',()=>{if(!connected){showToast('Enter the arena to join online matchmaking.');$('welcome-modal').classList.remove('hidden');return;}showToast('You are queued in the live 3v3 arena.');});
$('sound-toggle').addEventListener('click',(e)=>{const b=e.currentTarget;b.classList.toggle('muted');b.style.opacity=b.classList.contains('muted')?'.45':'1';showToast(b.classList.contains('muted')?'Sound muted':'Sound on');});

let prev=performance.now();
function animate(now){requestAnimationFrame(animate);const dt=Math.min(.05,(now-prev)/1000);prev=now;
  if(world.local&&started){const p=world.local;let mx=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);let mz=(keys.has('KeyS')||keys.has('ArrowDown')?1:0)-(keys.has('KeyW')||keys.has('ArrowUp')?1:0);const mag=Math.hypot(mx,mz);if(mag){mx/=mag;mz/=mag;const speed=(keys.has('ShiftLeft')||keys.has('ShiftRight')?9:6.3)*(p.stats?.speed>5?1+(p.stats.speed-5)*.045:1);p.x=THREE.MathUtils.clamp(p.x+mx*speed*dt,-24,24);p.z=THREE.MathUtils.clamp(p.z+mz*speed*dt,-13.5,13.5);p.ry=Math.atan2(-mz,mx);p.action='run';}else p.action='idle';p.model.position.x=p.x;p.model.position.z=p.z;p.model.rotation.y=p.ry;
    p.model.userData.legs.forEach((leg,i)=>{leg.rotation.x=mag?Math.sin(now*.018+i*Math.PI)*.65:0;});if(connected&&now-lastMoveSent>60){socket.emit('move',{x:p.x,z:p.z,ry:p.ry,action:mag?'run':'idle'});lastMoveSent=now;}}
  for(const [id,m]of playerMeshes){if(id===playerId)continue;const p=remotePlayers.get(id);if(!p)continue;const t=m.userData.target;if(t){m.position.x=THREE.MathUtils.lerp(m.position.x,t.x,.17);m.position.z=THREE.MathUtils.lerp(m.position.z,t.z,.17);m.rotation.y=THREE.MathUtils.lerp(m.rotation.y,t.ry,.17);}m.userData.legs.forEach((leg,i)=>{leg.rotation.x=p.action==='run'?Math.sin(now*.016+i*Math.PI)*.55:0;});}
  if(!connected){world.ball.x+=world.ball.vx*dt;world.ball.y+=world.ball.vy*dt;world.ball.z+=world.ball.vz*dt;world.ball.vy-=9.8*dt;if(world.ball.y<.42){world.ball.y=.42;world.ball.vy=Math.abs(world.ball.vy)>1?-world.ball.vy*.5:0;world.ball.vx*=.93;world.ball.vz*=.93;}world.ball.vx*=.985;world.ball.vz*=.985;world.ball.x=THREE.MathUtils.clamp(world.ball.x,-24,24);world.ball.z=THREE.MathUtils.clamp(world.ball.z,-13,13);if(Math.abs(world.ball.x)>24&&Math.abs(world.ball.z)<3.5){const scoring=world.ball.x>0?'red':'blue';world.score[scoring]++;world.ball={x:0,y:.6,z:0,vx:0,vy:0,vz:0};updateScores();$('goal-team').textContent=`${scoring.toUpperCase()} TEAM`;const f=$('goal-flash');f.classList.remove('show');void f.offsetWidth;f.classList.add('show');}}
  world.ballMesh.position.set(world.ball.x,world.ball.y,world.ball.z);world.ballMesh.rotation.z+=dt*2.7;
  if(world.local){const p=world.local;const target=new THREE.Vector3(p.x-9,15.7,p.z+18);camera.position.lerp(target,.045);camera.lookAt(p.x+1,0,p.z);}
  $('match-clock').innerHTML=`${String(Math.floor((Date.now()-matchStart)/60000)).padStart(2,'0')}:${String(Math.floor((Date.now()-matchStart)/1000)%60).padStart(2,'0')} <span>EXHIBITION</span>`;
  renderer.render(scene,camera);
}
requestAnimationFrame(animate);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.8));});
// Fit a cinematic opening view while the player chooses a name.
camera.position.set(-8,24,28);camera.lookAt(0,0,0);
setStatus('WAITING FOR STRIKER',false);setStats({speed:5,power:5,control:5});renderShop();
