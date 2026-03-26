const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const admins = new Set(['admin']);
const sessions = {};
const users = {};
const offerQueue = [];

const brainrotValues = {
  'Strawberry Elephant': 1000000,
  'Meowl': 700000,
  'Headless Horseman': 600000,
  'Skibidi Toilet': 300000,
  'Dragon Gingerini': 150000,
  'Hydra Dragon Cannelloni': 150000,
  'La Supreme Combinasion': 95000,
  'Dragon Cannelloni': 90000,
  'Cerberus': 80000,
  'Ketupat Bros': 45000,
  'Ginger Gerat': 42000,
  'La Casa Boo': 40000,
  'Capitano Moby': 30000,
  'Cookie and Milki': 25000,
  'Spooky and Pumpky': 20000,
  'Burguro and Fryuro': 20000,
  'Garama and Madungdung': 17500,
  'Fragrama and Chocrama': 17500,
  'Popcuru and Fizzuru': 13000,
  'Lavadorito Spinito': 8000,
  'Ketchuru and Musturu': 7500,
  'Tic Tac Sahur': 7500,
  'La Secret Combination': 7000,
  'Ketupat Kepat': 6500,
  'Tang Tang Keletang': 3000,
  'Los Hotspotsitos': 2500,
  'Money Money Puggy': 2250,
  'Nuclearo Dinossauro': 1000
};

function genPhrase() {
  return `RBXGambles verification token ${Math.random().toString(36).slice(2,12)}`;
}

function ensureUser(username) {
  if (!users[username]) {
    users[username] = { username, balance: 5000000, inventory: ['Meowl', 'Skibidi Toilet', 'Cerberus'], isAdmin: admins.has(username) };
  }
  return users[username];
}

app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username required' });
  const phrase = genPhrase();
  sessions[username] = { username, phrase, verified: false };
  ensureUser(username);
  res.json({ phrase });
});

app.post('/api/verify', (req, res) => {
  const { username, phrase, bio } = req.body;
  const session = sessions[username];
  if (!session || session.phrase !== phrase) return res.status(400).json({ error: 'Invalid phrase/session' });
  if (!bio || !bio.includes(phrase)) return res.status(400).json({ error: 'Phrase missing in Roblox bio' });
  session.verified = true;
  res.json({ ok: true, user: ensureUser(username) });
});

app.get('/api/items', (req, res) => res.json(brainrotValues));
app.get('/api/users', (req, res) => res.json({ users, admins: Array.from(admins) }));

app.post('/api/jackpot', (req, res) => {
  const { username, item } = req.body;
  const user = users[username];
  if (!user || !sessions[username]?.verified) return res.status(403).json({ error: 'Not logged in' });
  if (!item || !brainrotValues[item]) return res.status(400).json({ error: 'Invalid item' });
  if (!user.inventory.includes(item)) return res.status(400).json({ error: 'Item not in inventory' });
  const value = brainrotValues[item];
  user.inventory = user.inventory.filter(i => i !== item);

  const existing = offerQueue.find(e => e.value === value && e.username !== username && !e.paired);
  if (existing) {
    existing.paired = true;
    const opponent = users[existing.username];
    const prize = [item, existing.item];
    if (Math.random() < 0.5) {
      user.inventory.push(...prize);
      io.emit('message', { user: 'system', text: `${username} won jackpot with ${item} vs ${existing.item}` });
      return res.json({ result: 'won', inventory: user.inventory });
    } else {
      opponent.inventory.push(...prize);
      io.emit('message', { user: 'system', text: `${existing.username} won jackpot with ${existing.item} vs ${item}` });
      return res.json({ result: 'lost', inventory: user.inventory });
    }
  }

  offerQueue.push({ username, item, value, paired: false });
  return res.json({ result: 'queued' });
});

app.post('/api/coinflip', (req, res) => {
  const { username, item, side, opponent } = req.body;
  const user = users[username];
  if (!user || !sessions[username]?.verified) return res.status(403).json({ error: 'Not logged in' });
  if (!item || !brainrotValues[item]) return res.status(400).json({ error: 'Invalid item' });
  if (!user.inventory.includes(item)) return res.status(400).json({ error: 'Item not in super list' });
  const value = brainrotValues[item];

  const match = offerQueue.find(q => !q.paired && q.value === value && q.username !== username);
  if (!match) {
    offerQueue.push({ username, side, item, value, paired: false });
    return res.json({ status: 'waiting' });
  }

  // pop and handle
  match.paired = true;
  const opponentUser = users[match.username];
  const total = [item, match.item];
  const coin = Math.random() < 0.5 ? 'heads' : 'tails';

  if (coin === side) {
    user.inventory.push(...total);
    user.balance += value;
    opponentUser.inventory = opponentUser.inventory.filter(i => i !== match.item);
    res.json({ outcome: 'win', coin, inventory: user.inventory });
    io.to(match.username).emit('coinflip-result', { outcome: 'lose', coin });
  } else {
    opponentUser.inventory.push(...total);
    opponentUser.balance += match.value;
    user.inventory = user.inventory.filter(i => i !== item);
    res.json({ outcome: 'lose', coin, inventory: user.inventory });
    io.to(match.username).emit('coinflip-result', { outcome: 'win', coin });
  }
});

app.post('/api/upgrade', (req, res) => {
  const { username, from, to } = req.body;
  const user = users[username];
  if (!user || !sessions[username]?.verified) return res.status(403).json({ error: 'Not logged in' });
  if (!user.inventory.includes(from)) return res.status(400).json({ error: 'You don\'t have from item' });
  if (!brainrotValues[from] || !brainrotValues[to]) return res.status(400).json({ error: 'Invalid item' });
  const fromVal = brainrotValues[from], toVal = brainrotValues[to];
  const chance = Math.min(0.95, 0.1 + (fromVal / toVal) * 0.25);

  user.inventory = user.inventory.filter(i => i !== from);
  const win = Math.random() < chance;
  if (win) { user.inventory.push(to); }
  res.json({ win, chance, inventory: user.inventory });
});

app.post('/api/admin/grant', (req, res) => {
  const { username, target } = req.body;
  if (!admins.has(username)) return res.status(403).json({ error: 'Admin only' });
  if (!users[target]) return res.status(400).json({ error: 'Target user missing' });
  admins.add(target);
  users[target].isAdmin = true;
  res.json({ ok: true });
});

io.on('connection', (socket) => {
  function broadcastOnline() {
    io.emit('onlineCount', io.engine.clientsCount);
  }
  broadcastOnline();

  socket.on('login', ({ username }) => {
    socket.data.username = username;
    socket.join(username);
    io.emit('message', { user: 'system', text: `${username} connected` });
    broadcastOnline();
  });

  socket.on('chat', (text) => {
    const from = socket.data.username || 'anon';
    io.emit('message', { user: from, text });
  });

  socket.on('disconnect', () => {
    broadcastOnline();
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('RBXGambles running on port', process.env.PORT || 3000);
});
