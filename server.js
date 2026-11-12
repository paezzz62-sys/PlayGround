const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.ALLOWED_ORIGIN || '*' } });
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_KEY = process.env.ADMIN_KEY || '';
app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, players: Object.keys(players).length }));

const players = Object.create(null);
const bans = new Map();
const SKILLS = ['PHANTOM_STRIKE', 'CURVE_SHOT', 'BURST_DRIBBLE'];
const FIELD = { halfX: 24, halfZ: 13 };
let ball = { x: 0, y: 0.6, z: 0, vx: 0, vy: 0, vz: 0, owner: null };
let score = { red: 0, blue: 0 };
let lastTick = Date.now();

function publicState(p) {
  return { id: p.id, name: p.name, team: p.team, x: p.x, y: 0, z: p.z, ry: p.ry, action: p.action, stats: p.stats, coins: p.coins, skills: p.skills, admin: p.admin };
}
function snapshot() { return { players: Object.fromEntries(Object.entries(players).map(([id, p]) => [id, publicState(p)])), ball, score }; }
function rejectCheat(socket, reason) {
  const p = players[socket.id];
  if (!p) return;
  p.strikes++;
  socket.emit('securityWarning', { message: reason, strikes: p.strikes, max: 3 });
  if (p.strikes >= 3) {
    bans.set(socket.handshake.address, Date.now() + 60 * 60 * 1000);
    socket.emit('banned', { message: 'Repeated invalid game actions detected. Access is temporarily restricted.' });
    socket.disconnect(true);
  }
}
function finite(n) { return typeof n === 'number' && Number.isFinite(n); }

io.on('connection', (socket) => {
  const address = socket.handshake.address;
  if ((bans.get(address) || 0) > Date.now()) return socket.disconnect(true);
  const supplied = socket.handshake.auth || {};
  const name = String(supplied.name || 'Rookie').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 16) || 'Rookie';
  const admin = Boolean(ADMIN_KEY && supplied.adminKey === ADMIN_KEY);
  const active = Object.values(players);
  const redCount = active.filter((p) => p.team === 'red').length;
  const blueCount = active.filter((p) => p.team === 'blue').length;
  const team = redCount <= blueCount ? 'red' : 'blue';
  players[socket.id] = {
    id: socket.id, name, team,
    x: team === 'red' ? -9 : 9, z: Math.random() * 8 - 4, ry: team === 'red' ? Math.PI / 2 : -Math.PI / 2,
    action: 'idle', coins: admin ? 999999 : 10, skills: admin ? [...SKILLS] : [],
    stats: admin ? { speed: 10, power: 10, control: 10 } : { speed: 5, power: 5, control: 5 },
    admin, strikes: 0, lastMove: Date.now(), lastKick: 0, lastSkill: 0,
  };
  socket.emit('init', { id: socket.id, self: publicState(players[socket.id]), ...snapshot(), skills: SKILLS, online: true });
  socket.broadcast.emit('playerJoined', publicState(players[socket.id]));

  socket.on('move', (data = {}) => {
    const p = players[socket.id]; if (!p) return;
    if (!finite(data.x) || !finite(data.z) || !finite(data.ry) || !['idle', 'run'].includes(data.action)) return rejectCheat(socket, 'Invalid movement data was rejected.');
    const now = Date.now(); const elapsed = Math.max(0.016, Math.min(0.25, (now - p.lastMove) / 1000));
    const dx = data.x - p.x; const dz = data.z - p.z; const maxStep = (p.admin ? 14 : 8) * elapsed + 0.8;
    if (Math.hypot(dx, dz) > maxStep || Math.abs(data.x) > FIELD.halfX || Math.abs(data.z) > FIELD.halfZ) return rejectCheat(socket, 'Movement exceeded the server speed or field limits.');
    p.x = data.x; p.z = data.z; p.ry = Math.max(-Math.PI * 2, Math.min(Math.PI * 2, data.ry)); p.action = data.action; p.lastMove = now;
    socket.broadcast.emit('playerMoved', publicState(p));
  });

  socket.on('buySkill', (skill) => {
    const p = players[socket.id]; if (!p || !SKILLS.includes(skill)) return rejectCheat(socket, 'Unknown skill purchase was rejected.');
    if (p.admin) return socket.emit('shopResult', { ok: true, coins: p.coins, skills: p.skills });
    if (p.skills.includes(skill)) return socket.emit('shopResult', { ok: false, message: 'Already unlocked.' });
    if (p.coins < 100) return socket.emit('shopResult', { ok: false, message: 'You need 100 gold to unlock a skill.' });
    p.coins -= 100; p.skills.push(skill);
    socket.emit('shopResult', { ok: true, coins: p.coins, skills: p.skills });
    io.emit('playerUpdated', publicState(p));
  });

  socket.on('kickBall', (data = {}) => {
    const p = players[socket.id]; if (!p) return;
    const now = Date.now();
    if (!finite(data.vx) || !finite(data.vy) || !finite(data.vz) || Math.hypot(data.vx, data.vy, data.vz) > (p.admin ? 42 : 30)) return rejectCheat(socket, 'Ball impulse exceeded the server limit.');
    if (now - p.lastKick < 450 || Math.hypot(ball.x - p.x, ball.z - p.z) > 3.2 || ball.y > 3) return;
    const skill = data.skill || null;
    if (skill && (!SKILLS.includes(skill) || (!p.admin && !p.skills.includes(skill)))) return rejectCheat(socket, 'An ability was used without an unlock.');
    if (skill && now - p.lastSkill < 8000) return socket.emit('securityWarning', { message: 'That ability is recharging.', strikes: p.strikes, max: 3 });
    p.lastKick = now; if (skill) p.lastSkill = now;
    ball.owner = p.id;
    const boost = skill === 'PHANTOM_STRIKE' ? 1.65 : skill === 'CURVE_SHOT' ? 1.25 : skill === 'BURST_DRIBBLE' ? 0.8 : 1;
    ball.vx = data.vx * boost; ball.vy = Math.max(2, data.vy * boost); ball.vz = data.vz * boost;
    io.emit('ballKicked', { by: p.id, name: p.name, skill, ball });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    if (ball.owner === socket.id) ball.owner = null;
    io.emit('playerLeft', socket.id);
  });
});

setInterval(() => {
  const now = Date.now(); const dt = Math.min(0.05, (now - lastTick) / 1000); lastTick = now;
  ball.x += ball.vx * dt; ball.y += ball.vy * dt; ball.z += ball.vz * dt;
  ball.vy -= 9.8 * dt;
  if (ball.y < 0.45) { ball.y = 0.45; ball.vy = Math.abs(ball.vy) > 1 ? -ball.vy * 0.48 : 0; ball.vx *= 0.88; ball.vz *= 0.88; }
  ball.vx *= Math.pow(0.985, dt * 30); ball.vz *= Math.pow(0.985, dt * 30);
  if (Math.abs(ball.x) > FIELD.halfX - 0.5 && Math.abs(ball.z) < 3.5) {
    const team = ball.x > 0 ? 'red' : 'blue'; score[team]++;
    ball = { x: 0, y: 0.6, z: 0, vx: 0, vy: 0, vz: 0, owner: null };
    io.emit('goal', { team, score });
  } else {
    ball.x = Math.max(-FIELD.halfX, Math.min(FIELD.halfX, ball.x));
    ball.z = Math.max(-FIELD.halfZ, Math.min(FIELD.halfZ, ball.z));
  }
  io.emit('world', { ball, score });
}, 33);

server.listen(PORT, '0.0.0.0', () => console.log(`Striker Arena listening on ${PORT}`));
