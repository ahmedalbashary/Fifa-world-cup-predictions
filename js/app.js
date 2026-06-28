/**
 * app.js
 * Main application entry point.
 * Loads JSON data, wires up tabs, renders all views.
 */

import { buildLeaderboard, calcTotalPoints, calcMatchPoints } from './calculator.js';
import { resolveBracket, getChampion, countPlayedMatches }    from './bracket.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const PARTICIPANTS = ['Tweety', 'Omy', 'Honda', 'K. Embaby', 'O. Embaby', 'Khaled Alaa', 'Karim', 'Swariekh'];
const ROUND_ORDER  = ['round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'final'];
const ROUND_LABELS = {
  round_of_32:    'Round of 32',
  round_of_16:    'Round of 16',
  quarter_finals: 'Quarter Finals',
  semi_finals:    'Semi Finals',
  final:          'Final'
};

// ─── Global State ─────────────────────────────────────────────────────────────

let state = {
  teams:       {},
  matchesDef:  {},
  results:     {},
  predictions: {},
  resolved:    {},
  leaderboard: [],
  currentTab:  'leaderboard',
  searchQuery: '',
  roundFilter: 'all'
};

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

async function loadAllData() {
  const [teamsData, matchesData, resultsData, predictionsData] = await Promise.all([
    fetchJSON('./data/teams.json'),
    fetchJSON('./data/matches.json'),
    fetchJSON('./data/results.json'),
    fetchJSON('./data/predictions.json')
  ]);

  state.teams       = teamsData.teams;
  state.matchesDef  = matchesData;
  state.results     = resultsData;
  state.predictions = predictionsData;
  state.resolved    = resolveBracket(matchesData, resultsData);
  state.leaderboard = buildLeaderboard(PARTICIPANTS, predictionsData, resultsData);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function flag(teamName) {
  return state.teams[teamName]?.flag ?? '🏳️';
}

function formatScore(home, away) {
  if (home === null || away === null) return '— : —';
  return `${home} : ${away}`;
}

function teamDisplay(teamName, size = '') {
  if (!teamName) return '<span class="tbd">TBD</span>';
  const f = flag(teamName);
  return `<span class="team-display ${size}">${f} ${teamName}</span>`;
}

function matchStatus(matchId) {
  const r = state.results[matchId];
  if (!r || r.home_score === null) return 'upcoming';
  return 'played';
}

// ─── Tab Navigation ───────────────────────────────────────────────────────────

function initTabs() {
  const tabBar = document.getElementById('tab-bar');
  tabBar.innerHTML = '';

  // Leaderboard tab
  tabBar.appendChild(createTabBtn('leaderboard', '🏆 Leaderboard'));
  tabBar.appendChild(createTabBtn('bracket',     '🎯 Bracket'));
  tabBar.appendChild(createTabBtn('stats',       '📊 Stats'));

  // Separator
  const sep = document.createElement('div');
  sep.className = 'tab-separator';
  tabBar.appendChild(sep);

  // Player tabs
  for (const p of PARTICIPANTS) {
    tabBar.appendChild(createTabBtn(p, `${flag('Argentina').replace('🇦🇷', '')}${p}`));
  }

  // Set player tab icons dynamically
  updatePlayerTabIcons();
  activateTab(state.currentTab);
}

function createTabBtn(id, label) {
  const btn = document.createElement('button');
  btn.className = 'tab-btn';
  btn.dataset.tab = id;
  btn.textContent = label;
  btn.onclick = () => activateTab(id);
  return btn;
}

function updatePlayerTabIcons() {
  for (const p of PARTICIPANTS) {
    const btn = document.querySelector(`[data-tab="${p}"]`);
    if (!btn) continue;
    const stats = state.leaderboard.find(x => x.name === p);
    btn.textContent = p;
    if (stats) {
      const pts = document.createElement('span');
      pts.className = 'tab-pts';
      pts.textContent = stats.total + 'pts';
      btn.appendChild(pts);
    }
  }
}

function activateTab(tabId) {
  state.currentTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  renderContent(tabId);
}

// ─── Content Rendering ────────────────────────────────────────────────────────

function renderContent(tabId) {
  const main = document.getElementById('main-content');
  main.innerHTML = '';

  if (tabId === 'leaderboard') {
    main.appendChild(renderLeaderboard());
  } else if (tabId === 'bracket') {
    main.appendChild(renderBracket());
  } else if (tabId === 'stats') {
    main.appendChild(renderStats());
  } else if (PARTICIPANTS.includes(tabId)) {
    main.appendChild(renderPlayer(tabId));
  }

  // Fade-in animation
  main.classList.remove('fade-in');
  void main.offsetWidth;
  main.classList.add('fade-in');
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function updateProgressBar() {
  const played = countPlayedMatches(state.results);
  const total  = 31; // 16+8+4+2+1
  const pct    = Math.round((played / total) * 100);
  document.getElementById('progress-fill').style.width  = pct + '%';
  document.getElementById('progress-label').textContent = `${played}/${total} matches played`;

  const champion = getChampion(state.resolved, state.results);
  const champEl  = document.getElementById('champion-display');
  if (champion) {
    champEl.innerHTML = `🏆 Champion: ${flag(champion)} ${champion}`;
    champEl.style.display = 'block';
  } else {
    champEl.style.display = 'none';
  }
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

function renderLeaderboard() {
  const wrap = document.createElement('div');
  wrap.className = 'section leaderboard-section';

  wrap.innerHTML = `
    <h2 class="section-title">🏆 Leaderboard</h2>
    <div class="search-bar">
      <input type="text" id="search-input" placeholder="Search player…" value="${state.searchQuery}">
    </div>
  `;

  const grid = document.createElement('div');
  grid.className = 'leaderboard-grid';

  const maxPts = state.leaderboard[0]?.total || 1;

  for (const entry of state.leaderboard) {
    if (state.searchQuery && !entry.name.toLowerCase().includes(state.searchQuery.toLowerCase())) continue;

    const isLeader  = entry.rank === 1;
    const card      = document.createElement('div');
    card.className  = `lb-card ${isLeader ? 'leader' : ''} ${entry.rank === 2 ? 'rank-2' : ''} ${entry.rank === 3 ? 'rank-3' : ''}`;
    card.onclick    = () => activateTab(entry.name);

    const barPct    = maxPts > 0 ? (entry.total / maxPts) * 100 : 0;
    const medal     = entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`;

    card.innerHTML = `
      <div class="lb-rank">${medal}</div>
      <div class="lb-info">
        <div class="lb-name">${entry.name}</div>
        <div class="lb-bar-wrap">
          <div class="lb-bar" style="width: ${barPct}%"></div>
        </div>
        <div class="lb-stats">
          <span title="Exact scores">🎯 ${entry.exactScores}</span>
          <span title="Correct winners">✅ ${entry.correctWinners}</span>
          <span title="Matches scored">${entry.playedMatches} played</span>
        </div>
      </div>
      <div class="lb-pts">${entry.total}<span>pts</span></div>
    `;
    grid.appendChild(card);
  }

  wrap.appendChild(grid);

  // Wire search
  wrap.querySelector('#search-input').oninput = (e) => {
    state.searchQuery = e.target.value;
    renderContent('leaderboard');
  };

  return wrap;
}

// ─── Player Predictions ───────────────────────────────────────────────────────

function renderPlayer(name) {
  const wrap = document.createElement('div');
  wrap.className = 'section player-section';

  const stats = calcTotalPoints(name, state.predictions, state.results);
  const lbPos = state.leaderboard.find(x => x.name === name);

  wrap.innerHTML = `
    <div class="player-header">
      <h2 class="section-title">${name}</h2>
      <div class="player-stats-bar">
        <div class="pstat"><span class="pstat-val">${stats.total}</span><span class="pstat-label">Points</span></div>
        <div class="pstat"><span class="pstat-val">#${lbPos?.rank}</span><span class="pstat-label">Rank</span></div>
        <div class="pstat"><span class="pstat-val">${stats.exactScores}</span><span class="pstat-label">Exact Scores</span></div>
        <div class="pstat"><span class="pstat-val">${stats.correctWinners}</span><span class="pstat-label">Correct Winners</span></div>
      </div>
      <div class="round-filter">
        <label>Filter: </label>
        ${['all', 'round_of_32', 'round_of_16', 'quarter_finals', 'semi_finals', 'final']
          .map(r => `<button class="filter-btn ${state.roundFilter === r ? 'active' : ''}" data-round="${r}">${r === 'all' ? 'All' : ROUND_LABELS[r]}</button>`)
          .join('')}
      </div>
    </div>
  `;

  // Wire filter buttons
  wrap.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      state.roundFilter = btn.dataset.round;
      renderContent(name);
    };
  });

  const myPreds = state.predictions[name] || {};

  for (const roundKey of ROUND_ORDER) {
    if (state.roundFilter !== 'all' && state.roundFilter !== roundKey) continue;

    const round = state.resolved.rounds[roundKey];
    if (!round) continue;

    const roundEl = document.createElement('div');
    roundEl.className = `round-block round-${roundKey}`;
    roundEl.innerHTML = `<h3 class="round-title">${round.label}</h3>`;

    const table = document.createElement('table');
    table.className = 'predictions-table';
    table.innerHTML = `
      <thead>
        <tr>
          <th>Home</th>
          <th class="score-col">Prediction</th>
          <th class="score-col">Result</th>
          <th>Away</th>
          <th class="pts-col">Pts</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector('tbody');

    for (const match of round.matches) {
      const result = state.results[match.id];
      const pred   = myPreds[match.id];
      const scored = result ? calcMatchPoints(pred, result) : { points: null, exactScore: false, correctWinner: false };

      const played   = result && result.home_score !== null;
      const rowClass = played
        ? (scored.points === 2 ? 'row-perfect' : scored.points === 1 ? 'row-partial' : 'row-miss')
        : '';

      const predScore   = pred ? formatScore(pred.home, pred.away) : '—';
      const actualScore = played ? formatScore(result.home_score, result.away_score) : '—';
      const ptsDisplay  = played ? (scored.points ?? 0) : '—';

      // Penalty indicator
      const penNote = played && result.penalties_winner
        ? `<div class="pen-note">🥅 ${result.penalties_winner} (pens)</div>` : '';

      const tr = document.createElement('tr');
      tr.className = rowClass;
      tr.innerHTML = `
        <td class="team-cell home">${teamDisplay(match.home)}</td>
        <td class="score-col pred-score ${scored.exactScore ? 'exact' : ''}">${predScore}</td>
        <td class="score-col actual-score">${actualScore}${penNote}</td>
        <td class="team-cell away">${teamDisplay(match.away)}</td>
        <td class="pts-col pts-badge pts-${ptsDisplay}">${ptsDisplay}</td>
      `;
      tbody.appendChild(tr);
    }

    roundEl.appendChild(table);
    wrap.appendChild(roundEl);
  }

  return wrap;
}

// ─── Visual Bracket ───────────────────────────────────────────────────────────

function renderBracket() {
  const wrap = document.createElement('div');
  wrap.className = 'section bracket-section';
  wrap.innerHTML = '<h2 class="section-title">🎯 Tournament Bracket</h2>';

  const champion = getChampion(state.resolved, state.results);
  if (champion) {
    wrap.innerHTML += `<div class="champion-banner">🏆 ${flag(champion)} ${champion} — World Champion!</div>`;
  }

  const bracketWrap = document.createElement('div');
  bracketWrap.className = 'bracket-wrap';

  for (const roundKey of ROUND_ORDER) {
    const round = state.resolved.rounds[roundKey];
    if (!round) continue;

    const col = document.createElement('div');
    col.className = `bracket-col bracket-${roundKey}`;

    const header = document.createElement('div');
    header.className = 'bracket-col-header';
    header.textContent = round.label;
    col.appendChild(header);

    for (const match of round.matches) {
      const result = state.results[match.id];
      const played = result && result.home_score !== null;
      const winner = played ? (state.resolved && getWinnerFromResolved(match, result)) : null;

      const card = document.createElement('div');
      card.className = `bracket-match ${played ? 'played' : 'upcoming'}`;

      const homeWon = winner === match.home;
      const awayWon = winner === match.away;

      card.innerHTML = `
        <div class="bracket-team ${homeWon ? 'winner' : ''} ${!match.home ? 'tbd-slot' : ''}">
          <span class="bracket-flag">${match.home ? flag(match.home) : ''}</span>
          <span class="bracket-name">${match.home || 'TBD'}</span>
          ${played ? `<span class="bracket-score">${result.home_score}</span>` : ''}
        </div>
        <div class="bracket-team ${awayWon ? 'winner' : ''} ${!match.away ? 'tbd-slot' : ''}">
          <span class="bracket-flag">${match.away ? flag(match.away) : ''}</span>
          <span class="bracket-name">${match.away || 'TBD'}</span>
          ${played ? `<span class="bracket-score">${result.away_score}</span>` : ''}
        </div>
        ${result?.penalties_winner ? `<div class="bracket-pens">🥅 Pens: ${result.penalties_winner}</div>` : ''}
      `;

      col.appendChild(card);
    }

    bracketWrap.appendChild(col);
  }

  wrap.appendChild(bracketWrap);
  return wrap;
}

function getWinnerFromResolved(match, result) {
  if (!result || result.home_score === null) return null;
  if (result.penalties_winner) return result.penalties_winner;
  if (result.home_score > result.away_score) return match.home;
  if (result.away_score > result.home_score) return match.away;
  return null;
}

// ─── Stats Page ───────────────────────────────────────────────────────────────

function renderStats() {
  const wrap = document.createElement('div');
  wrap.className = 'section stats-section';
  wrap.innerHTML = '<h2 class="section-title">📊 Statistics</h2>';

  const played = countPlayedMatches(state.results);

  if (played === 0) {
    wrap.innerHTML += '<p class="empty-msg">No matches played yet. Stats will appear here once games begin!</p>';
    return wrap;
  }

  // Per-player stats table
  const table = document.createElement('table');
  table.className = 'stats-table';
  table.innerHTML = `
    <thead>
      <tr>
        <th>Player</th>
        <th>Points</th>
        <th>Exact Scores</th>
        <th>Correct Winners</th>
        <th>Accuracy %</th>
        <th>Pts/Match</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  for (const entry of state.leaderboard) {
    const accuracy = entry.playedMatches > 0
      ? Math.round((entry.correctWinners / entry.playedMatches) * 100)
      : 0;
    const ppm = entry.playedMatches > 0
      ? (entry.total / entry.playedMatches).toFixed(2)
      : '0.00';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${entry.name}</strong></td>
      <td>${entry.total}</td>
      <td>🎯 ${entry.exactScores}</td>
      <td>✅ ${entry.correctWinners}</td>
      <td>
        <div class="acc-bar-wrap">
          <div class="acc-bar" style="width:${accuracy}%"></div>
          <span>${accuracy}%</span>
        </div>
      </td>
      <td>${ppm}</td>
    `;
    tbody.appendChild(tr);
  }

  wrap.appendChild(table);

  // Match-by-match breakdown
  wrap.innerHTML += '<h3 class="sub-title">Match Leaderboard — Who got each game right?</h3>';

  for (const roundKey of ROUND_ORDER) {
    const round = state.resolved.rounds[roundKey];
    if (!round) continue;

    for (const match of round.matches) {
      const result = state.results[match.id];
      if (!result || result.home_score === null) continue;

      const matchCard = document.createElement('div');
      matchCard.className = 'stat-match-card';

      const homeStr = match.home ? `${flag(match.home)} ${match.home}` : 'TBD';
      const awayStr = match.away ? `${flag(match.away)} ${match.away}` : 'TBD';

      matchCard.innerHTML = `
        <div class="stat-match-header">
          <span>${homeStr}</span>
          <span class="stat-result">${result.home_score} – ${result.away_score}</span>
          <span>${awayStr}</span>
        </div>
        <div class="stat-match-preds">
          ${PARTICIPANTS.map(p => {
            const pred   = state.predictions[p]?.[match.id];
            const scored = calcMatchPoints(pred, result);
            const cls    = scored.points === 2 ? 'pred-perfect' : scored.points === 1 ? 'pred-partial' : 'pred-miss';
            const predStr = pred ? `${pred.home}:${pred.away}` : '?';
            return `<span class="pred-chip ${cls}" title="${p}: ${predStr} (${scored.points ?? 0}pts)">${p.split(' ')[0]}<br>${predStr}</span>`;
          }).join('')}
        </div>
      `;
      wrap.appendChild(matchCard);
    }
  }

  return wrap;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function init() {
  try {
    await loadAllData();
  } catch (err) {
    document.getElementById('main-content').innerHTML =
      `<div class="error-msg">⚠️ Failed to load data: ${err.message}<br>Make sure you're running this via a local server (not file://).</div>`;
    return;
  }

  initTabs();
  updateProgressBar();
  renderContent(state.currentTab);
}

document.addEventListener('DOMContentLoaded', init);
