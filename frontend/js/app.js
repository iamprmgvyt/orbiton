/* ============================================================
   Orbiton — Frontend Application Logic
   Auth, Navigation, Socket.IO, App management,
   File manager, AIO Terminal, System monitor, Import
   ============================================================ */

// ─── Auth Guard ───────────────────────────────────────────────
const token = localStorage.getItem('orbiton_token');
const user  = JSON.parse(localStorage.getItem('orbiton_user') || 'null');
if (!token || !user) window.location.href = '/';

// ─── API Helper ───────────────────────────────────────────────
async function api(path, method = 'GET', body = null) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res  = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { localStorage.clear(); window.location.href = '/'; }
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ─── Toast ────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 4000) {
  const icons = { success:'✅', error:'❌', warning:'⚠️', info:'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type} fade-in`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ─── Formatters ───────────────────────────────────────────────
function fmtBytes(b) {
  if (!b) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB','TB'], i = Math.floor(Math.log(b)/Math.log(k));
  return (b/Math.pow(k,i)).toFixed(1)+' '+s[i];
}
function fmtUptime(s) {
  return `${Math.floor(s/86400)}d ${Math.floor((s%86400)/3600)}h ${Math.floor((s%3600)/60)}m`;
}
function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}
function statusBadge(status) {
  const labels = { running:'Running', stopped:'Stopped', starting:'Starting', stopping:'Stopping', error:'Error' };
  return `<span class="status-badge ${status}"><span class="status-dot"></span>${labels[status]||status}</span>`;
}
function runtimeBadge(r) {
  const icons = { nodejs:'🟩', python:'🐍', java:'☕', docker:'🐳', bash:'🔧', deno:'🦕', bun:'🥟', go:'🔵', rust:'🦀', php:'🐘', ruby:'💎', custom:'⚙️' };
  return `<span class="runtime-badge runtime-${r}">${icons[r]||'⚙️'} ${r}</span>`;
}
function runtimeIcon(r) {
  const icons = { nodejs:'🟩', python:'🐍', java:'☕', docker:'🐳', bash:'🔧', deno:'🦕', bun:'🥟', go:'🔵', rust:'🦀', php:'🐘', ruby:'💎', custom:'⚙️' };
  return icons[r] || '⚙️';
}

// ─── User Info ────────────────────────────────────────────────
document.getElementById('user-name').textContent   = user.username;
document.getElementById('user-role').textContent   = user.role === 'admin' ? 'Administrator' : 'User';
document.getElementById('user-avatar').textContent = user.username[0].toUpperCase();
if (user.role !== 'admin') document.getElementById('nav-users').style.display = 'none';

// ─── Logout ───────────────────────────────────────────────────
document.getElementById('btn-logout').addEventListener('click', () => {
  localStorage.clear(); window.location.href = '/';
});

// ─── Navigation ───────────────────────────────────────────────
const pages    = document.querySelectorAll('.page');
const navItems = document.querySelectorAll('.nav-item[data-page]');
const TITLES   = {
  dashboard: ['Dashboard','Overview'],
  apps:      ['Applications','Manage your processes'],
  files:     ['File Manager','Browse & edit files'],
  terminal:  ['AIO Terminal','Run any language or command'],
  monitor:   ['System Monitor','Realtime resource usage'],
  runtimes:  ['Runtimes','Installed languages & tools'],
  users:     ['User Management','Manage panel users'],
  settings:  ['Settings','Panel configuration'],
};

function showPage(pageId) {
  pages.forEach(p => p.classList.remove('active'));
  navItems.forEach(n => n.classList.remove('active'));
  const page = document.getElementById(`page-${pageId}`);
  const nav  = document.getElementById(`nav-${pageId}`);
  if (page) page.classList.add('active');
  if (nav)  nav.classList.add('active');
  const [title, sub] = TITLES[pageId] || [pageId,''];
  document.getElementById('topbar-title').innerHTML = `${title} <span>${sub}</span>`;
  if (pageId === 'dashboard') loadDashboard();
  else if (pageId === 'apps')     loadApps();
  else if (pageId === 'monitor')  loadMonitor();
  else if (pageId === 'runtimes') loadRuntimes();
  else if (pageId === 'users')    loadUsers();
  else if (pageId === 'files')    loadFileAppSelect();
  else if (pageId === 'terminal') initTerminal();
}

navItems.forEach(n => n.addEventListener('click', () => showPage(n.dataset.page)));
document.getElementById('sidebar-toggle').addEventListener('click', () =>
  document.getElementById('sidebar').classList.toggle('open'));
document.getElementById('btn-refresh').addEventListener('click', () => {
  const active = document.querySelector('.page.active');
  if (active) showPage(active.id.replace('page-',''));
  toast('Refreshed','success',2000);
});

// ─── Socket.IO ────────────────────────────────────────────────
const socket = io({ auth: { token } });
socket.on('app:status', ({ appId, status }) => {
  document.querySelectorAll(`[data-app-id="${appId}"] .status-badge`).forEach(el => {
    el.className = `status-badge ${status}`;
    el.innerHTML = `<span class="status-dot"></span>${status}`;
  });
  updateAppCardActions(appId, status);
});
function updateAppCardActions(appId, status) {
  const el = document.querySelector(`[data-app-id="${appId}"] .app-actions`);
  if (el) { el.innerHTML = appActionButtons(appId, status); bindAppActionBtns(el, appId); }
}

// ─── CREATE/EDIT APP MODAL ────────────────────────────────────
const modalApp = document.getElementById('modal-app');

function openAppModal(editData = null) {
  document.getElementById('modal-app-title').textContent = editData ? 'Edit Application' : 'Create Application';
  document.getElementById('modal-app-submit').textContent = editData ? 'Save Changes' : 'Create App';
  document.getElementById('app-id').value      = editData?.id || '';
  document.getElementById('app-name').value    = editData?.name || '';
  document.getElementById('app-desc').value    = editData?.description || '';
  document.getElementById('app-runtime').value = editData?.runtime || 'nodejs';
  document.getElementById('app-cmd').value     = editData?.start_cmd || '';
  document.getElementById('app-ram').value     = editData?.max_ram || 512;
  document.getElementById('app-autorestart').checked = !!(editData?.auto_restart);
  document.getElementById('app-env').value     = JSON.stringify(editData?.env_vars || {}, null, 2);
  switchCreateTab('manual', document.getElementById('tab-manual-btn'));
  modalApp.classList.add('open');
  loadTemplatesGrid();
}

['modal-app-close','modal-app-cancel'].forEach(id =>
  document.getElementById(id).addEventListener('click', () => modalApp.classList.remove('open')));
modalApp.addEventListener('click', e => { if (e.target === modalApp) modalApp.classList.remove('open'); });

['btn-new-app','btn-new-app2','btn-create-app'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', () => openAppModal());
});

// Import shortcut button
document.getElementById('btn-import-app')?.addEventListener('click', () => {
  openAppModal();
  setTimeout(() => switchCreateTab('git', document.getElementById('tab-git-btn')), 50);
});

// ─── Create Tab switcher ──────────────────────────────────────
window.switchCreateTab = function(tab, btn) {
  ['manual','template','git','zip','docker'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('#create-tabs .btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.getElementById('import-type').value = tab;
}

// ─── Templates Grid ───────────────────────────────────────────
async function loadTemplatesGrid() {
  const grid = document.getElementById('templates-grid');
  if (!grid || grid.children.length > 0) return;
  try {
    const tpls = await api('/apps/templates');
    grid.innerHTML = Object.entries(tpls).map(([key, t]) => `
      <div class="template-card" onclick="selectTemplate('${key}',this)" data-key="${key}">
        <div class="template-icon">${t.icon || '📦'}</div>
        <div class="template-name">${t.name}</div>
        <div class="template-desc">${t.description || ''}</div>
      </div>`).join('');
  } catch (_) {}
}

let selectedTemplate = null;
window.selectTemplate = function(key, el) {
  document.querySelectorAll('.template-card').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedTemplate = key;
  document.getElementById('selected-template').value = key;
  // Pre-fill env hint
  api('/apps/templates').then(tpls => {
    if (tpls[key]?.env_hint) {
      document.getElementById('tpl-env').value = tpls[key].env_hint;
    }
  }).catch(() => {});
}

// ─── ZIP drag & drop ──────────────────────────────────────────
const zipInput = document.getElementById('zip-input');
const zipDrop  = document.getElementById('zip-drop');
if (zipDrop) {
  zipDrop.addEventListener('dragover', e => { e.preventDefault(); zipDrop.style.borderColor = 'var(--accent)'; });
  zipDrop.addEventListener('dragleave', () => { zipDrop.style.borderColor = ''; });
  zipDrop.addEventListener('drop', e => {
    e.preventDefault(); zipDrop.style.borderColor = '';
    const f = e.dataTransfer.files[0];
    if (f) { zipInput.files = e.dataTransfer.files; document.getElementById('zip-filename').textContent = f.name; }
  });
  zipInput?.addEventListener('change', e => {
    const f = e.target.files[0];
    if (f) document.getElementById('zip-filename').textContent = f.name;
  });
}

// ─── App Form Submit ──────────────────────────────────────────
document.getElementById('app-form').addEventListener('submit', async e => {
  e.preventDefault();
  const submitBtn = document.getElementById('modal-app-submit');
  submitBtn.disabled = true; submitBtn.textContent = 'Saving...';

  const importType = document.getElementById('import-type').value;
  const appId      = document.getElementById('app-id').value;

  try {
    let envVars = {};
    let newAppId = appId;

    if (importType === 'manual' || appId) {
      // Manual create/edit
      try { envVars = JSON.parse(document.getElementById('app-env').value); } catch (_) {}
      const payload = {
        name:         document.getElementById('app-name').value.trim(),
        description:  document.getElementById('app-desc').value.trim(),
        runtime:      document.getElementById('app-runtime').value,
        start_cmd:    document.getElementById('app-cmd').value.trim(),
        max_ram:      parseInt(document.getElementById('app-ram').value),
        auto_restart: document.getElementById('app-autorestart').checked,
        env_vars:     envVars,
      };
      if (appId) {
        await api(`/apps/${appId}`, 'PATCH', payload);
        toast('App updated!','success');
      } else {
        const created = await api('/apps', 'POST', payload);
        newAppId = created.id;
        toast('App created!','success');
      }

    } else if (importType === 'template') {
      try { envVars = JSON.parse(document.getElementById('tpl-env').value); } catch (_) {}
      const created = await api('/apps', 'POST', {
        name:     document.getElementById('tpl-name').value.trim(),
        template: selectedTemplate,
        env_vars: envVars,
      });
      newAppId = created.id;
      toast('App created from template!','success');

    } else if (importType === 'git') {
      try { envVars = JSON.parse(document.getElementById('git-env').value); } catch (_) {}
      const created = await api('/apps', 'POST', {
        name:     document.getElementById('git-name').value.trim(),
        runtime:  document.getElementById('git-runtime').value,
        start_cmd:document.getElementById('git-cmd').value.trim(),
        env_vars: envVars,
      });
      newAppId = created.id;
      // Start git clone (non-blocking)
      api(`/apps/${newAppId}/import/git`, 'POST', {
        url:    document.getElementById('git-url').value.trim(),
        branch: document.getElementById('git-branch').value.trim(),
      }).catch(() => {});
      toast('App created! Cloning repo (check console)...','info', 5000);

    } else if (importType === 'zip') {
      const zipFile = document.getElementById('zip-input').files[0];
      if (!zipFile) { toast('Please select a ZIP file','warning'); return; }
      const created = await api('/apps', 'POST', {
        name:     document.getElementById('zip-name').value.trim(),
        runtime:  document.getElementById('zip-runtime').value,
        start_cmd:document.getElementById('zip-cmd').value.trim(),
      });
      newAppId = created.id;
      // Upload zip
      const fd = new FormData(); fd.append('file', zipFile);
      await fetch(`/api/apps/${newAppId}/import/zip`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
      });
      toast('App created & ZIP extracted!','success');

    } else if (importType === 'docker') {
      try { envVars = JSON.parse(document.getElementById('docker-env').value); } catch (_) {}
      const image   = document.getElementById('docker-image').value.trim();
      const cmd     = document.getElementById('docker-cmd').value.trim() || `docker run --rm ${image}`;
      const created = await api('/apps', 'POST', {
        name:     document.getElementById('docker-name').value.trim(),
        runtime:  'docker',
        start_cmd: cmd,
        env_vars: envVars,
      });
      newAppId = created.id;
      api(`/apps/${newAppId}/import/docker`, 'POST', { image }).catch(() => {});
      toast('App created! Pulling Docker image...','info', 5000);
    }

    modalApp.classList.remove('open');
    loadApps(); loadDashboard();

    // Open detail after create
    if (!appId && newAppId) setTimeout(() => openAppDetail(newAppId), 500);

  } catch (err) {
    toast(err.message,'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = appId ? 'Save Changes' : 'Create App';
  }
});

// ─── DASHBOARD ────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const [stats, apps] = await Promise.all([api('/system/stats'), api('/apps')]);
    renderStats(stats);
    renderDashboardApps(apps);
  } catch (err) { toast('Dashboard error: '+err.message,'error'); }
}

function renderStats(s) {
  document.getElementById('stat-cpu').textContent   = s.cpu.usage+'%';
  document.getElementById('stat-cpu-model').textContent = s.cpu.model.slice(0,35);
  document.getElementById('cpu-bar').style.width    = s.cpu.usage+'%';
  document.getElementById('stat-ram').textContent   = s.memory.usedPercent+'%';
  document.getElementById('stat-ram-detail').textContent = `${fmtBytes(s.memory.used)} / ${fmtBytes(s.memory.total)}`;
  document.getElementById('ram-bar').style.width    = s.memory.usedPercent+'%';
  const disk = s.disk[0];
  if (disk) {
    document.getElementById('stat-disk').textContent = disk.usedPercent+'%';
    document.getElementById('stat-disk-detail').textContent = `${fmtBytes(disk.used)} / ${fmtBytes(disk.size)}`;
    document.getElementById('disk-bar').style.width = disk.usedPercent+'%';
  }
  document.getElementById('sys-info').innerHTML = [
    ['OS',        `${s.os.distro} ${s.os.release}`],
    ['Hostname',  s.os.hostname],
    ['Arch',      s.os.arch],
    ['Uptime',    fmtUptime(s.os.uptime)],
    ['CPU Cores', s.cpu.cores],
    ['Load Avg',  s.cpu.load.map(l=>l.toFixed(2)).join(', ')],
  ].map(([k,v]) => `
    <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:12px">
      <div style="font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:.8px">${k}</div>
      <div style="font-size:14px;font-weight:600;margin-top:4px">${v}</div>
    </div>`).join('');
}

function renderDashboardApps(apps) {
  const running = apps.filter(a => a.liveStatus === 'running').length;
  document.getElementById('stat-apps').textContent       = running;
  document.getElementById('stat-apps-total').textContent = `of ${apps.length} total`;
  document.getElementById('app-count').textContent       = apps.length;
  const el = document.getElementById('dashboard-apps-list');
  if (!apps.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🚀</div><div class="empty-title">No applications yet</div><div class="empty-sub">Click "+ New App" to create your first one</div></div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Name</th><th>Runtime</th><th>Status</th><th>Command</th><th>Actions</th></tr></thead>
    <tbody>${apps.map(a => `
      <tr data-app-id="${a.id}">
        <td><strong>${a.name}</strong></td>
        <td>${runtimeBadge(a.runtime)}</td>
        <td>${statusBadge(a.liveStatus)}</td>
        <td><code style="font-size:11px;opacity:.6">${a.start_cmd.slice(0,40)}</code></td>
        <td><div class="app-actions" style="flex-wrap:nowrap">${appActionButtons(a.id,a.liveStatus)}</div></td>
      </tr>`).join('')}
    </tbody></table></div>`;
  document.querySelectorAll('#dashboard-apps-list [data-app-id]').forEach(row => {
    bindAppActionBtns(row.querySelector('.app-actions'), row.dataset.appId);
  });
}

// ─── APPS PAGE ────────────────────────────────────────────────
async function loadApps() {
  const grid = document.getElementById('apps-grid');
  grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px"><div class="spinner"></div></div>';
  try {
    const apps = await api('/apps');
    document.getElementById('app-count').textContent = apps.length;
    if (!apps.length) {
      grid.innerHTML = `<div style="grid-column:1/-1" class="empty-state">
        <div class="empty-icon">🚀</div>
        <div class="empty-title">No applications yet</div>
        <div class="empty-sub">Click "+ New App" or "📥 Import" to get started</div>
      </div>`;
      return;
    }
    grid.innerHTML = apps.map(a => appCard(a)).join('');
    apps.forEach(a => {
      const card = document.querySelector(`[data-app-id="${a.id}"]`);
      if (!card) return;
      bindAppActionBtns(card.querySelector('.app-actions'), a.id);
      card.addEventListener('click', e => {
        if (e.target.closest('.btn')) return;
        openAppDetail(a.id);
      });
    });
  } catch (err) { toast('Error: '+err.message,'error'); }
}

function appCard(a) {
  return `
  <div class="app-card fade-in" data-app-id="${a.id}">
    <div class="app-card-header">
      <div class="app-runtime-icon">${runtimeIcon(a.runtime)}</div>
      <div class="app-info">
        <div class="app-name">${a.name}</div>
        <div class="app-desc">${a.description || a.owner_name || ''}</div>
        <div class="app-cmd">${a.start_cmd}</div>
      </div>
      ${statusBadge(a.liveStatus)}
    </div>
    <div class="app-actions">${appActionButtons(a.id, a.liveStatus)}</div>
  </div>`;
}

function appActionButtons(appId, status) {
  const running = status === 'running' || status === 'starting';
  return `
    ${running
      ? `<button class="btn btn-warning btn-sm" data-action="stop">⏹ Stop</button>
         <button class="btn btn-ghost btn-sm" data-action="restart">🔄</button>`
      : `<button class="btn btn-success btn-sm" data-action="start">▶ Start</button>`
    }
    <button class="btn btn-ghost btn-sm" data-action="console">💬</button>
    <button class="btn btn-ghost btn-sm" data-action="edit">✏️</button>
    <button class="btn btn-danger btn-sm" data-action="delete">🗑️</button>`;
}

function bindAppActionBtns(container, appId) {
  if (!container) return;
  container.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      const a = btn.dataset.action;
      if (a === 'start')   await appAction(appId,'start');
      if (a === 'stop')    await appAction(appId,'stop');
      if (a === 'restart') await appAction(appId,'restart');
      if (a === 'console') openAppDetail(appId,'console');
      if (a === 'edit')    openEditApp(appId);
      if (a === 'delete')  deleteApp(appId);
    });
  });
}

window.appAction = async function(appId, action) {
  try {
    await api(`/apps/${appId}/${action}`, 'POST');
    toast(`App ${action}ed!`,'success');
    setTimeout(() => { loadApps(); loadDashboard(); }, 800);
  } catch (err) { toast(err.message,'error'); }
}

window.openEditApp = async function(appId) {
  try { openAppModal(await api(`/apps/${appId}`)); } catch (err) { toast(err.message,'error'); }
}

window.deleteApp = async function(appId) {
  if (!confirm('Delete this application and all its files? This cannot be undone.')) return;
  try { await api(`/apps/${appId}`,'DELETE'); toast('App deleted','success'); loadApps(); loadDashboard(); }
  catch (err) { toast(err.message,'error'); }
}

// ─── APP DETAIL ───────────────────────────────────────────────
async function openAppDetail(appId, tab = 'logs') {
  showPage('app-detail');
  document.getElementById('nav-apps').classList.add('active');
  const content = document.getElementById('app-detail-content');
  content.innerHTML = '<div class="spinner" style="margin-top:40px"></div>';
  try {
    const [app, logsData] = await Promise.all([
      api(`/apps/${appId}`),
      api(`/apps/${appId}/logs?lines=300`),
    ]);
    renderAppDetail(app, logsData.logs || []);
    if (tab === 'console') setTimeout(() => initAppTerminal(appId), 100);
  } catch (err) {
    content.innerHTML = `<div class="empty-state"><div class="empty-title">Error: ${err.message}</div></div>`;
  }
}

function renderAppDetail(app, logs) {
  const content = document.getElementById('app-detail-content');
  content.innerHTML = `
  <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
    <div style="font-size:40px">${runtimeIcon(app.runtime)}</div>
    <div style="flex:1">
      <h2 style="font-size:22px;font-weight:700">${app.name}</h2>
      <div style="color:var(--muted);font-size:13px">${app.description||'No description'}</div>
      <div style="display:flex;gap:8px;margin-top:8px">
        ${statusBadge(app.status)} ${runtimeBadge(app.runtime)}
        ${app.pid?`<span style="font-size:11px;color:var(--muted)">PID: ${app.pid}</span>`:''}
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <button class="btn btn-success btn-sm" onclick="appAction('${app.id}','start')">▶ Start</button>
      <button class="btn btn-warning btn-sm" onclick="appAction('${app.id}','stop')">⏹ Stop</button>
      <button class="btn btn-ghost btn-sm"   onclick="appAction('${app.id}','restart')">🔄 Restart</button>
      <button class="btn btn-danger btn-sm"  onclick="appAction('${app.id}','kill')">💀 Kill</button>
      <button class="btn btn-ghost btn-sm"   onclick="openEditApp('${app.id}')">✏️ Edit</button>
    </div>
  </div>
  <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:20px" id="detail-tabs">
    <button class="btn btn-ghost btn-sm active" onclick="switchDetailTab('logs',this)">📋 Logs</button>
    <button class="btn btn-ghost btn-sm"        onclick="switchDetailTab('terminal',this)">⌨️ Terminal</button>
    <button class="btn btn-ghost btn-sm"        onclick="switchDetailTab('info',this)">ℹ️ Info</button>
  </div>
  <div id="detail-tab-logs">
    <div class="log-output" id="detail-log-output">${logs.length?logs.join(''):'<span style="color:var(--muted)">No logs yet. Start the app to see output.</span>'}</div>
    <div class="console-input-row">
      <span style="color:var(--muted);font-size:13px;white-space:nowrap">stdin ❯</span>
      <input class="console-input" id="stdin-${app.id}" placeholder="Send input to process stdin (works for any runtime)..." />
      <button class="btn btn-primary btn-sm" onclick="sendAppInput('${app.id}')">Send</button>
    </div>
  </div>
  <div id="detail-tab-terminal" style="display:none">
    <div class="terminal-container" style="margin-top:8px">
      <div class="terminal-topbar">
        <div class="terminal-dots"><div class="terminal-dot dot-red"></div><div class="terminal-dot dot-yellow"></div><div class="terminal-dot dot-green"></div></div>
        <div class="terminal-title">bash — ${app.name}</div>
      </div>
      <div id="detail-xterm-${app.id}" style="height:420px"></div>
    </div>
  </div>
  <div id="detail-tab-info" style="display:none">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
      ${[['ID',app.id.slice(0,8)+'...'],['Runtime',app.runtime],['Start Command',app.start_cmd],
         ['Max RAM',app.max_ram+' MB'],['Auto Restart',app.auto_restart?'Yes':'No'],
         ['Created',fmtDate(app.created_at)],['Import Source',app.import_source||'Manual'],
         ['Status',app.status],
      ].map(([k,v]) => `
        <div style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px;margin-bottom:6px">${k}</div>
          <div style="font-size:13px;font-weight:500;word-break:break-all">${v}</div>
        </div>`).join('')}
    </div>
    <div style="margin-top:16px">
      <div style="font-size:12px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.8px">Environment Variables</div>
      <pre style="background:rgba(0,0,0,0.3);padding:14px;border-radius:10px;font-size:12px;overflow:auto">${JSON.stringify(app.env_vars||{},null,2)}</pre>
    </div>
  </div>`;

  // Subscribe to live logs
  socket.emit('app:subscribe', { appId: app.id });
  socket.off('app:log');
  socket.on('app:log', ({ appId, line }) => {
    if (appId !== app.id) return;
    const logEl = document.getElementById('detail-log-output');
    if (!logEl) return;
    logEl.innerHTML += line; logEl.scrollTop = logEl.scrollHeight;
  });

  const logEl = document.getElementById('detail-log-output');
  if (logEl) logEl.scrollTop = logEl.scrollHeight;
}

window.switchDetailTab = function(tab, btn) {
  ['logs','terminal','info'].forEach(t => {
    const el = document.getElementById(`detail-tab-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('#detail-tabs .btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  if (tab === 'terminal') {
    const xt = document.querySelector('[id^="detail-xterm-"]');
    if (xt) initAppTerminal(xt.id.replace('detail-xterm-',''));
  }
}

window.sendAppInput = async function(appId) {
  const el = document.getElementById(`stdin-${appId}`);
  if (!el?.value.trim()) return;
  try { await api(`/apps/${appId}/input`,'POST',{ input: el.value }); el.value=''; }
  catch (err) { toast(err.message,'error'); }
}

document.getElementById('btn-back-apps').addEventListener('click', () => {
  socket.emit('app:unsubscribe',{});
  showPage('apps');
});

// ─── App Terminal (in detail page) ───────────────────────────
const detailTerms = {};
function initAppTerminal(appId) {
  const el = document.getElementById(`detail-xterm-${appId}`);
  if (!el || detailTerms[appId]) return;
  const term = new Terminal({ theme:{ background:'#0a0a0f',foreground:'#e2e8f0',cursor:'#7c3aed' }, fontFamily:"'JetBrains Mono','Fira Code',monospace", fontSize:13, cursorBlink:true });
  const fit  = new FitAddon.FitAddon();
  term.loadAddon(fit); term.open(el); fit.fit();
  detailTerms[appId] = { term, fit };
  socket.emit('terminal:create', { appId, cols:term.cols, rows:term.rows });
  socket.on('terminal:data', ({ data }) => term.write(data));
  term.onData(d => socket.emit('terminal:input', { input:d }));
  window.addEventListener('resize', () => fit.fit());
}

// ─── AIO TERMINAL PAGE ────────────────────────────────────────
let sysTerm = null, sysFit = null, termReady = false;

async function initTerminal() {
  if (termReady && sysTerm) return;
  const container = document.getElementById('xterm-container');
  container.innerHTML = '';
  const term = new Terminal({
    theme: { background:'#0a0a0f', foreground:'#e2e8f0', cursor:'#7c3aed', cursorAccent:'#7c3aed', selection:'rgba(124,58,237,0.25)', black:'#1e1e2e', red:'#f38ba8', green:'#a6e3a1', yellow:'#f9e2af', blue:'#89b4fa', magenta:'#cba6f7', cyan:'#89dceb', white:'#cdd6f4' },
    fontFamily:"'JetBrains Mono','Fira Code','Courier New',monospace",
    fontSize:13, lineHeight:1.4, cursorBlink:true, cols:120, rows:30,
  });
  const fit  = new FitAddon.FitAddon();
  const link = new WebLinksAddon.WebLinksAddon();
  term.loadAddon(fit); term.loadAddon(link); term.open(container); fit.fit();
  sysTerm = term; sysFit = fit; termReady = true;

  socket.emit('terminal:create', { cols:term.cols, rows:term.rows });
  socket.off('terminal:data');
  socket.on('terminal:data', ({ data }) => term.write(data));
  socket.on('terminal:exit', () => { term.write('\r\n\x1b[33m[Orbiton] Session ended.\x1b[0m\r\n'); termReady=false; });
  term.onData(d => socket.emit('terminal:input', { input:d }));
  term.onResize(({ cols,rows }) => socket.emit('terminal:resize',{ cols,rows }));
  window.addEventListener('resize', () => fit.fit());

  buildRuntimeShortcuts();

  // Populate app selector
  const apps = await api('/apps').catch(()=>[]);
  const sel  = document.getElementById('term-app-select');
  sel.innerHTML = '<option value="">System Terminal</option>';
  apps.forEach(a => { const o=document.createElement('option'); o.value=a.id; o.textContent=`🚀 ${a.name}`; sel.appendChild(o); });
}

function buildRuntimeShortcuts() {
  const shortcuts = document.getElementById('runtime-shortcuts');
  const cmds = [
    {l:'node',c:'node --version'},{l:'python3',c:'python3 --version'},{l:'java',c:'java --version'},
    {l:'docker',c:'docker --version'},{l:'npm',c:'npm --version'},{l:'pip3',c:'pip3 --version'},
    {l:'df -h',c:'df -h'},{l:'free -h',c:'free -h'},{l:'whoami',c:'whoami && pwd'},{l:'env',c:'env | head -20'},
  ];
  shortcuts.innerHTML = '<span style="color:var(--muted);font-size:12px;display:flex;align-items:center">Quick:</span>' +
    cmds.map(c => `<button class="btn btn-ghost btn-sm" onclick="runShortcut(${JSON.stringify(c.c)})" style="font-size:11px">${c.l}</button>`).join('');
}

window.runShortcut = function(cmd) { if (sysTerm) socket.emit('terminal:input',{ input:cmd+'\n' }); }
document.getElementById('btn-clear-term').addEventListener('click', () => sysTerm?.clear());
document.getElementById('btn-kill-term').addEventListener('click', () => socket.emit('terminal:input',{ input:'\x03' }));

// ─── FILE MANAGER ─────────────────────────────────────────────
let curAppId=null, curPath='/', curFile=null;

async function loadFileAppSelect() {
  const sel = document.getElementById('file-app-select');
  sel.innerHTML = '<option value="">Select an app...</option>';
  const apps = await api('/apps').catch(()=>[]);
  apps.forEach(a => { const o=document.createElement('option'); o.value=a.id; o.textContent=`🚀 ${a.name}`; sel.appendChild(o); });
}

document.getElementById('file-app-select').addEventListener('change', e => {
  curAppId=e.target.value; curPath='/'; curFile=null;
  if (curAppId) loadFileTree('/');
  else { document.getElementById('file-tree').innerHTML='<div class="file-tree-header">📁 Files</div><div class="empty-state" style="padding:32px"><div class="empty-sub">Select an app</div></div>'; }
});

async function loadFileTree(path='/') {
  if (!curAppId) return;
  curPath=path;
  const tree=document.getElementById('file-tree');
  try {
    const data = await api(`/files/${curAppId}/list?path=${encodeURIComponent(path)}`);
    const parent = path!=='/'?`<div class="file-item" onclick="loadFileTree('${path.split('/').slice(0,-1).join('/')||'/'}')"><span class="file-icon">⬅️</span><span class="file-name">..</span></div>`:'';
    tree.innerHTML=`<div class="file-tree-header">📁 ${path}</div>${parent}${data.files.map(f=>`
      <div class="file-item" onclick="${f.type==='dir'?`loadFileTree('${(path==='/'?'':path)}/${f.name}')`:`openFile('${(path==='/'?'':path)}/${f.name}')`}">
        <span class="file-icon">${f.type==='dir'?'📁':getFileIcon(f.name)}</span>
        <span class="file-name">${f.name}</span>
        <span class="file-size">${f.type==='file'?fmtBytes(f.size):''}</span>
      </div>`).join('')}`;
  } catch(err) { tree.innerHTML=`<div style="padding:16px;color:var(--danger);font-size:13px">Error: ${err.message}</div>`; }
}

function getFileIcon(n) {
  const ext=n.split('.').pop().toLowerCase();
  return ({js:'🟨',ts:'🔷',py:'🐍',java:'☕',json:'📋',md:'📝',sh:'🔧',env:'🔒',txt:'📄',log:'📋',jar:'☕',html:'🌐',css:'🎨',xml:'📄',yml:'⚙️',yaml:'⚙️',zip:'📦',dockerfile:'🐳'})[ext]||'📄';
}

async function openFile(fp) {
  if (!curAppId) return;
  curFile=fp;
  document.getElementById('file-path').textContent=fp;
  ['btn-save-file','btn-download-file','btn-delete-file'].forEach(id=>document.getElementById(id).style.display='inline-flex');
  document.getElementById('file-content').value='Loading...';
  try { const d=await api(`/files/${curAppId}/read?path=${encodeURIComponent(fp)}`); document.getElementById('file-content').value=d.content; }
  catch(err) { document.getElementById('file-content').value=`// Error: ${err.message}`; }
}

document.getElementById('btn-save-file').addEventListener('click', async()=>{
  if(!curAppId||!curFile) return;
  try { await api(`/files/${curAppId}/write`,'POST',{path:curFile,content:document.getElementById('file-content').value}); toast('File saved!','success'); }
  catch(err) { toast(err.message,'error'); }
});
document.getElementById('btn-delete-file').addEventListener('click', async()=>{
  if(!curAppId||!curFile||!confirm(`Delete ${curFile}?`)) return;
  try { await api(`/files/${curAppId}/delete?path=${encodeURIComponent(curFile)}`,'DELETE'); toast('Deleted!','success'); document.getElementById('file-content').value=''; curFile=null; loadFileTree(curPath); }
  catch(err) { toast(err.message,'error'); }
});
document.getElementById('btn-download-file').addEventListener('click', ()=>{
  if(curAppId&&curFile) window.open(`/api/files/${curAppId}/download?path=${encodeURIComponent(curFile)}`);
});
document.getElementById('btn-new-file').addEventListener('click', async()=>{
  if(!curAppId){toast('Select an app first','warning');return;}
  const name=prompt('File name:'); if(!name) return;
  const fp=`${curPath==='/'?'':curPath}/${name}`;
  try { await api(`/files/${curAppId}/write`,'POST',{path:fp,content:''}); loadFileTree(curPath); openFile(fp); toast('File created!','success'); }
  catch(err) { toast(err.message,'error'); }
});
document.getElementById('btn-new-folder').addEventListener('click', async()=>{
  if(!curAppId){toast('Select an app first','warning');return;}
  const name=prompt('Folder name:'); if(!name) return;
  try { await api(`/files/${curAppId}/mkdir`,'POST',{path:`${curPath==='/'?'':curPath}/${name}`}); loadFileTree(curPath); toast('Folder created!','success'); }
  catch(err) { toast(err.message,'error'); }
});
document.getElementById('btn-upload-file').addEventListener('click', ()=>{
  if(!curAppId){toast('Select an app first','warning');return;}
  document.getElementById('upload-input').click();
});
document.getElementById('upload-input').addEventListener('change', async e=>{
  const files=e.target.files; if(!files.length||!curAppId) return;
  const fd=new FormData();
  Array.from(files).forEach(f=>fd.append('files',f));
  try {
    const res=await fetch(`/api/files/${curAppId}/upload?path=${encodeURIComponent(curPath)}`,{method:'POST',headers:{Authorization:`Bearer ${token}`},body:fd});
    if(res.ok){toast(`Uploaded ${files.length} file(s)!`,'success');loadFileTree(curPath);}
    else{const d=await res.json();toast(d.error,'error');}
  }catch(err){toast(err.message,'error');}
  e.target.value='';
});

// ─── MONITOR ──────────────────────────────────────────────────
let cpuChart=null,ramChart=null;
const cpuData=[],ramData=[],chartLabels=[];
const MAX_PTS=30;

async function loadMonitor() {
  if (!cpuChart) initCharts();
  updateMonitor(); loadProcesses();
}

function initCharts() {
  const opts = { responsive:true, maintainAspectRatio:false, animation:{duration:0}, scales:{ x:{display:false}, y:{min:0,max:100,grid:{color:'rgba(255,255,255,0.05)'},ticks:{color:'#64748b',callback:v=>v+'%'}} }, plugins:{legend:{display:false}}, elements:{point:{radius:0}} };
  cpuChart = new Chart(document.getElementById('cpu-chart').getContext('2d'),{ type:'line', data:{ labels:chartLabels, datasets:[{data:cpuData,borderColor:'#f59e0b',backgroundColor:'rgba(245,158,11,0.1)',borderWidth:2,fill:true,tension:.4}] }, options:opts });
  ramChart = new Chart(document.getElementById('ram-chart').getContext('2d'),{ type:'line', data:{ labels:chartLabels, datasets:[{data:ramData,borderColor:'#7c3aed',backgroundColor:'rgba(124,58,237,0.1)',borderWidth:2,fill:true,tension:.4}] }, options:opts });
}

async function updateMonitor() {
  try {
    const s=await api('/system/stats');
    const t=new Date().toLocaleTimeString();
    chartLabels.push(t); cpuData.push(s.cpu.usage); ramData.push(s.memory.usedPercent);
    if(chartLabels.length>MAX_PTS){chartLabels.shift();cpuData.shift();ramData.shift();}
    cpuChart?.update(); ramChart?.update();
    document.getElementById('cpu-live').textContent=s.cpu.usage+'%';
    document.getElementById('ram-live').textContent=s.memory.usedPercent+'%';
  }catch(_){}
}

async function loadProcesses() {
  try {
    const data=await api('/system/processes');
    document.getElementById('proc-table').innerHTML=data.list.map(p=>`
      <tr>
        <td style="color:var(--muted);font-family:monospace">${p.pid}</td>
        <td style="font-weight:500">${p.name}</td>
        <td style="color:${p.cpu>50?'#ef4444':p.cpu>20?'#f59e0b':'inherit'}">${p.cpu}%</td>
        <td>${p.mem}%</td>
        <td style="font-size:11px;color:var(--muted);max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.cmd}</td>
      </tr>`).join('');
  }catch(_){}
}

document.getElementById('btn-refresh-procs').addEventListener('click',()=>{updateMonitor();loadProcesses();});
setInterval(()=>{ if(document.getElementById('page-monitor').classList.contains('active')) updateMonitor(); },5000);

// ─── RUNTIMES ─────────────────────────────────────────────────
async function loadRuntimes() {
  const grid=document.getElementById('runtimes-grid');
  grid.innerHTML='<div class="spinner"></div>';
  try {
    const data=await api('/system/runtimes');
    const icons={nodejs:'🟩',npm:'📦',python3:'🐍',pip3:'📦',java:'☕',docker:'🐳',git:'🔀',curl:'🌐',wget:'⬇️',gradle:'🏗️',mvn:'🏗️',go:'🔵',rust:'🦀',deno:'🦕',bun:'🥟',php:'🐘',ruby:'💎',perl:'🐪',lua:'🌙',bash:'🔧'};
    grid.innerHTML=Object.entries(data).map(([k,r])=>`
      <div style="background:${r.installed?'rgba(34,197,94,0.08)':'rgba(255,255,255,0.03)'};border:1px solid ${r.installed?'rgba(34,197,94,0.2)':'var(--border)'};border-radius:12px;padding:14px;display:flex;align-items:center;gap:10px">
        <span style="font-size:22px">${icons[k]||'⚙️'}</span>
        <div><div style="font-weight:600;font-size:13px">${r.name}</div><div style="font-size:11px;color:${r.installed?'#86efac':'var(--muted)'};margin-top:2px">${r.installed?r.version:'Not installed'}</div></div>
        <div style="margin-left:auto">${r.installed?'✅':'❌'}</div>
      </div>`).join('');
  }catch(err){grid.innerHTML=`<div style="color:var(--danger)">${err.message}</div>`;}
}
document.getElementById('btn-refresh-runtimes').addEventListener('click',loadRuntimes);

// ─── USERS ────────────────────────────────────────────────────
const modalUser=document.getElementById('modal-user');
document.getElementById('btn-create-user').addEventListener('click',()=>modalUser.classList.add('open'));
['modal-user-close','modal-user-cancel'].forEach(id=>document.getElementById(id).addEventListener('click',()=>modalUser.classList.remove('open')));
modalUser.addEventListener('click',e=>{if(e.target===modalUser)modalUser.classList.remove('open');});
document.getElementById('user-form').addEventListener('submit',async e=>{
  e.preventDefault();
  try { await api('/auth/users','POST',{username:document.getElementById('new-username').value,password:document.getElementById('new-userpass').value,role:document.getElementById('new-userrole').value}); toast('User created!','success'); modalUser.classList.remove('open'); loadUsers(); }
  catch(err){toast(err.message,'error');}
});
async function loadUsers() {
  const tbody=document.getElementById('users-table');
  try {
    const users=await api('/auth/users');
    tbody.innerHTML=users.map(u=>`
      <tr><td style="color:var(--muted)">${u.id}</td><td><strong>${u.username}</strong></td>
      <td><span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;background:${u.role==='admin'?'rgba(124,58,237,0.15)':'rgba(255,255,255,0.05)'};color:${u.role==='admin'?'#c4b5fd':'var(--text2)'}">${u.role}</span></td>
      <td style="color:var(--muted);font-size:12px">${fmtDate(u.created_at)}</td>
      <td>${u.id!==user.id?`<button class="btn btn-danger btn-sm" onclick="deleteUser(${u.id},'${u.username}')">Delete</button>`:'<span style="color:var(--muted);font-size:12px">You</span>'}</td></tr>`).join('');
  }catch(err){tbody.innerHTML=`<tr><td colspan="5" style="color:var(--danger)">${err.message}</td></tr>`;}
}
window.deleteUser = async function(id,name) {
  if(!confirm(`Delete user "${name}"?`)) return;
  try { await api(`/auth/users/${id}`,'DELETE'); toast('User deleted','success'); loadUsers(); }
  catch(err){toast(err.message,'error');}
}

// ─── SETTINGS ─────────────────────────────────────────────────
document.getElementById('change-pass-form').addEventListener('submit',async e=>{
  e.preventDefault();
  const cur=document.getElementById('cur-pass').value;
  const newp=document.getElementById('new-pass').value;
  const conf=document.getElementById('confirm-pass').value;
  if(newp!==conf){toast('Passwords do not match','error');return;}
  try { await api('/auth/change-password','POST',{currentPassword:cur,newPassword:newp}); toast('Password changed! Please re-login.','success'); setTimeout(()=>{localStorage.clear();window.location.href='/';},2000); }
  catch(err){toast(err.message,'error');}
});

// ─── Init ─────────────────────────────────────────────────────
loadDashboard();
