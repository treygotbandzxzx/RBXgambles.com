const socket = io();
let signedIn = null;
let currentPhrase = '';
let currentUser = null;

const brainrotValues = {};

async function api(path, data) {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  return res.json();
}

function $(id) { return document.getElementById(id); }

function set(chatText) {
  const p = document.createElement('div');
  p.textContent = chatText;
  $('chatBox').appendChild(p);
  $('chatBox').scrollTop = $('chatBox').scrollHeight;
}

function refreshInventory() {
  const ul = $('inventoryList'); ul.innerHTML = '';
  if (!currentUser) return;
  currentUser.inventory.forEach(item => { const li = document.createElement('li'); li.innerText = item; ul.appendChild(li); });
}

function setOnline(count) {
  $('chatCount').innerText = `${count} online`;
  $('topOnline').innerText = `${count} online`;
}

async function loadValues() {
  const r = await fetch('/api/items');
  const data = await r.json();
  Object.assign(brainrotValues, data);
  ['coinItem','jackpotItem','upgradeFrom','upgradeTo'].forEach(id => {
    const sel = $(id); sel.innerHTML = '';
    Object.keys(brainrotValues).forEach(name => { const opt = document.createElement('option'); opt.value = name; opt.textContent = name; sel.appendChild(opt); });
  });
}

$('loginBtn').onclick = () => { $('loginModal').classList.remove('hidden'); };
$('closeModal').onclick = () => { $('loginModal').classList.add('hidden'); };

$('checkPfpBtn').onclick = async () => {
  const username = $('userNameRole').value.trim();
  if (!username) { $('loginStatus').innerText = 'Enter username'; return; }
  $('loginStatus').innerText = '';
  $('pfpImg').src = `https://www.roblox.com/headshot-thumbnail/image?userId=${encodeURIComponent(username)}&width=420&height=420&format=png`;
  $('pfpConfirm').style.display = 'flex';
};

$('pfpNo').onclick = () => { $('loginStatus').innerText = 'Please use correct roblox username'; };

$('pfpYes').onclick = async () => {
  const username = $('userNameRole').value.trim();
  const res = await api('/api/login', { username });
  if (res.error) { $('loginStatus').innerText = res.error; return; }
  currentPhrase = res.phrase;
  $('loginPhrase').textContent = `Put this phrase in your Roblox bio: ${res.phrase}`;
  $('phraseContainer').style.display = 'block';
  $('loginStatus').innerText = 'Now verify after updating bio.';
};

$('verifyBtn').onclick = async () => {
  const username = $('userNameRole').value.trim();
  const bio = $('robloxBio').value;
  const res = await api('/api/verify', { username, phrase: currentPhrase, bio });
  if (res.error) { $('loginStatus').innerText = res.error; return; }
  currentUser = res.user;
  signedIn = username;
  $('loginModal').classList.add('hidden');
  $('loginStatus').innerText = '';
  $('loginBtn').innerText = `Logout (${username})`;
  set(`✔ ${username} logged in`);
  refreshInventory();
};

$('loginBtn').onclick = () => {
  if (signedIn) {
    signedIn = null; currentUser = null; $('loginBtn').innerText = 'Login'; set('Logged out'); refreshInventory();
  } else { $('loginModal').classList.remove('hidden'); }
};

$('chatSend').onclick = () => {
  const text = $('chatInput').value.trim(); if (!text) return;
  if (!signedIn) return alert('Login first');
  socket.emit('chat', text); $('chatInput').value = '';
};

$('coinflipBtn').onclick = async () => {
  if (!signedIn) return alert('Login first');
  const item = $('coinItem').value; const side = $('coinSide').value;
  if (!currentUser.inventory.includes(item)) { $('coinflipStatus').innerText = 'You do not have this item'; return; }
  const res = await api('/api/coinflip', { username: signedIn, item, side });
  if (res.error) {$('coinflipStatus').innerText = res.error;return;}
  $('coinflipStatus').innerText = JSON.stringify(res);
  if (res.inventory) currentUser.inventory = res.inventory;
  refreshInventory();
};

$('jackpotBtn').onclick = async () => {
  if (!signedIn) return alert('Login first');
  const item = $('jackpotItem').value;
  const res = await api('/api/jackpot', { username: signedIn, item });
  $('jackpotStatus').innerText = JSON.stringify(res);
  if (res.inventory) { currentUser.inventory = res.inventory; refreshInventory(); }
};

$('upgradeBtn').onclick = async () => {
  if (!signedIn) return alert('Login first');
  const from = $('upgradeFrom').value; const to = $('upgradeTo').value;
  if (!currentUser.inventory.includes(from)) { $('upgradeStatus').innerText = 'You do not have this item'; return; }
  const res = await api('/api/upgrade', { username: signedIn, from, to });
  if (res.error) { $('upgradeStatus').innerText = res.error; return; }
  $('upgradeStatus').innerText = res.win ? `Win ${(res.chance*100).toFixed(1)}%` : `Lose ${(res.chance*100).toFixed(1)}%`;
  $('spinWheel').style.transform = `rotate(${Math.random()*720 + 720}deg)`;
  currentUser.inventory = res.inventory;
  refreshInventory();
};

$('grantAdminBtn').onclick = async () => {
  if (!signedIn) return alert('Login first');
  const target = $('adminUsername').value.trim();
  const res = await api('/api/admin/grant', { username: signedIn, target });
  $('adminStatus').innerText = JSON.stringify(res);
};

socket.on('message', (payload) => { set(`[${payload.user}] ${payload.text}`); });
socket.on('onlineCount', setOnline);

window.onload = async () => {
  await loadValues();
};
