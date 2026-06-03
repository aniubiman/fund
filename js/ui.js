/**
 * ui.js — UI 渲染与交互层
 *
 * 负责：
 * - 页面视图切换 (仪表盘 / 持仓 / 交易 / 记录)
 * - 统计卡片渲染
 * - 持仓表格渲染
 * - 交易记录表格渲染
 * - 基金搜索交互（接入 API.searchFunds）
 * - 买入/卖出模态框
 * - Toast 消息
 * - 主题切换
 *
 * 依赖：store.js、api.js、charts.js（通过 window 全局访问）
 */

// ===========================
//  格式化工具
// ===========================

function fmtMoney(val) {
  if (Math.abs(val) >= 10000) return '¥' + (val / 10000).toFixed(2) + '万';
  return '¥' + val.toFixed(2);
}

function fmtMoneyFull(val) {
  const sign = val < 0 ? '-' : '';
  return sign + '¥' + Math.abs(val).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtPct(val) {
  return (val >= 0 ? '+' : '') + val.toFixed(2) + '%';
}

function fmtNum(val) {
  return val.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtDate(isoStr) {
  return isoStr ? isoStr.slice(0, 10) : '--';
}

// ===========================
//  通用 DOM 工具
// ===========================

function gel(id) { return document.getElementById(id); }

function qs(selector) { return document.querySelector(selector); }

function qsa(selector) { return document.querySelectorAll(selector); }

// ===========================
//  统计卡片
// ===========================

function renderStats() {
  const totalMv = getTotalMarketValue();
  const totalAssets = totalMv + window.PF.cash;
  const totalPnL = getTotalPnLAmount();
  const totalPnLPct = getTotalPnLPercent();
  const dailyPnL = getDailyPnL();
  const posRatio = getPositionRatio();

  gel('totalAssets').textContent = fmtMoneyFull(totalAssets);
  gel('cashBalance').textContent = fmtMoneyFull(window.PF.cash);
  gel('totalPnL').textContent = (totalPnL >= 0 ? '+' : '') + fmtMoneyFull(totalPnL);

  const pctEl = gel('totalPnLPercent');
  pctEl.textContent = fmtPct(totalPnLPct);
  pctEl.className = 'stat-change ' + (totalPnLPct >= 0 ? 'up' : 'down');

  gel('positionRatio').textContent = `持仓 ${posRatio.toFixed(1)}%`;

  // 今日盈亏
  const dEl = gel('dailyPnL');
  const dPctEl = gel('dailyPnLPercent');
  const dCard = gel('dailyCard');
  dEl.textContent = (dailyPnL >= 0 ? '+' : '') + fmtMoneyFull(dailyPnL);

  const tv = getTotalMarketValue();
  const dailyPct = tv > 0 ? (dailyPnL / tv * 100) : 0;
  dPctEl.textContent = fmtPct(dailyPct);
  dPctEl.className = 'stat-change ' + (dailyPnL >= 0 ? 'up' : 'down');
  dCard.className = 'stat-card ' + (dailyPnL >= 0 ? 'profit' : 'loss');

  const iconEl = dCard.querySelector('.stat-label .icon');
  if (iconEl) iconEl.className = 'icon ' + (dailyPnL >= 0 ? 'profit' : 'loss');
}

// ===========================
//  持仓表格
// ===========================

function renderHoldingsTable() {
  const summaryBody = gel('holdingsSummaryBody');
  const detailBody = gel('holdingsDetailBody');

  if (window.PF.holdings.length === 0) {
    const empty = '<tr><td colspan="11"><div class="empty-state"><p>📭 暂无持仓，快去搜索并买入你的第一只基金吧！</p></div></td></tr>';
    if (summaryBody) summaryBody.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>📭 暂无持仓</p></div></td></tr>';
    if (detailBody) detailBody.innerHTML = empty;
    return;
  }

  const rows = window.PF.holdings.map(h => buildHoldingRow(h));

  if (summaryBody) {
    summaryBody.innerHTML = rows.map(r => r.summary).join('');
  }
  if (detailBody) {
    detailBody.innerHTML = rows.map(r => r.detail).join('');
  }
}

function buildHoldingRow(h) {
  const cache = window.API ? window.API.NAV_CACHE : {};
  const fd = cache[h.code];
  const name = fd ? fd.name : h.code;
  const nav = fd ? (parseFloat(fd.gsz) || parseFloat(fd.dwjz)) : h.costNav;
  const mv = getHoldingMarketValue(h);
  const cost = getHoldingCost(h);
  const pnl = mv - cost;
  const pnlPct = cost > 0 ? (pnl / cost * 100) : 0;
  const dailyChange = fd ? (parseFloat(fd.gszzl) || 0) : 0;

  const pnlClass = pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
  const dailyClass = dailyChange >= 0 ? 'pnl-positive' : 'pnl-negative';
  const badgeClass = pnl >= 0 ? 'badge-profit' : 'badge-loss';
  const pnlSign = pnl >= 0 ? '+' : '';
  const dailySign = dailyChange >= 0 ? '+' : '';

  return {
    summary: `
      <tr>
        <td><div class="fund-name">${escHtml(name)}</div><div class="fund-code">${h.code}</div></td>
        <td>${fmtNum(h.shares)}</td>
        <td>¥${h.costNav.toFixed(4)}</td>
        <td>¥${nav.toFixed(4)}</td>
        <td class="right">${fmtMoneyFull(mv)}</td>
        <td class="right ${pnlClass}">${pnlSign}${fmtMoneyFull(pnl)}</td>
        <td class="right"><span class="badge ${badgeClass}">${fmtPct(pnlPct)}</span></td>
        <td class="right ${dailyClass}">${dailySign}${dailyChange.toFixed(2)}%</td>
      </tr>`,
    detail: `
      <tr>
        <td><span class="fund-code">${h.code}</span></td>
        <td><span class="fund-name">${escHtml(name)}</span></td>
        <td>${fmtNum(h.shares)}</td>
        <td>¥${h.costNav.toFixed(4)}</td>
        <td class="right">${fmtMoneyFull(cost)}</td>
        <td>¥${nav.toFixed(4)}</td>
        <td class="right">${fmtMoneyFull(mv)}</td>
        <td class="right ${pnlClass}">${pnlSign}${fmtMoneyFull(pnl)}</td>
        <td class="right"><span class="badge ${badgeClass}">${fmtPct(pnlPct)}</span></td>
        <td class="right ${dailyClass}">${dailySign}${dailyChange.toFixed(2)}%</td>
        <td>
          <div class="action-btns">
            <button class="btn-table" onclick="quickTradeFromHoldings('${h.code}','buy')">买入</button>
            <button class="btn-table sell" onclick="quickTradeFromHoldings('${h.code}','sell')">卖出</button>
          </div>
        </td>
      </tr>`
  };
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** 转义 JavaScript 单引号字符串内的内容（先转义 HTML，再转 JS） */
function escJsStr(str) {
  // HTML 实体先编码，避免注入；然后处理 JS 字符串中的特殊字符
  return escHtml(str)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\n/g, '\\n');
}

// ===========================
//  交易记录表格
// ===========================

function renderHistory() {
  const body = gel('historyBody');
  if (!body) return;

  if (window.PF.transactions.length === 0) {
    body.innerHTML = '<tr><td colspan="8"><div class="empty-state"><p>📝 暂无交易记录</p></div></td></tr>';
    return;
  }

  body.innerHTML = window.PF.transactions.slice().reverse().map(t => `
    <tr>
      <td>${escHtml(t.date)}</td>
      <td class="${t.type === 'buy' ? 'pnl-positive' : 'pnl-negative'}" style="font-weight:600;">
        ${t.type === 'buy' ? '🟢 买入' : '🔴 卖出'}
      </td>
      <td><span class="fund-code">${t.code}</span></td>
      <td>${escHtml(t.name)}</td>
      <td>${fmtNum(t.shares)}</td>
      <td>¥${t.nav.toFixed(4)}</td>
      <td class="right">${fmtMoneyFull(t.amount)}</td>
      <td><button class="btn-table sell" onclick="historyDeleteTransaction('${t.id}')">删除</button></td>
    </tr>
  `).join('');
}

function historyDeleteTransaction(id) {
  deleteTransaction(id);
  renderHistory();
  showToast('已删除交易记录', 'info');
}

function historyClearAll() {
  if (!confirm('确定要清空所有交易记录吗？此操作不可恢复。')) return;
  clearTransactions();
  renderHistory();
  showToast('交易记录已清空', 'info');
}

// ===========================
//  页面切换
// ===========================

let currentPage = 'dashboard';

function switchPage(page) {
  currentPage = page;
  qsa('.page').forEach(p => p.style.display = 'none');
  const target = gel('page-' + page);
  if (target) target.style.display = 'block';

  qsa('.nav-item').forEach(n => n.classList.remove('active'));
  const navBtn = qs(`[data-page="${page}"]`);
  if (navBtn) navBtn.classList.add('active');

  // 切换到特定页面时刷新对应内容
  if (page === 'history') renderHistory();
  if (page === 'trade') resetTradePage();
  if (page === 'friends') renderFriendsPage();

  setTimeout(renderAllCharts, 100);
}

// ===========================
//  基金搜索 (交易页面)
// ===========================

let selectedFund = null;       // { code, name }
let selectedFundNAV = null;    // 最新净值

function resetTradePage() {
  gel('fundSearchInput').value = '';
  gel('fundSearchResult').classList.remove('open');
  gel('fundSearchResult').innerHTML = '';
  gel('fundDetailCard').style.display = 'none';
  gel('tradeAmount').value = '';
  gel('tradeShares').value = '';
  selectedFund = null;
  selectedFundNAV = null;
}

async function onSearchInput(value) {
  const container = gel('fundSearchResult');
  const detail = gel('fundDetailCard');

  if (!value || value.trim().length < 1) {
    container.classList.remove('open');
    container.innerHTML = '';
    return;
  }

  // 显示加载状态
  container.classList.add('open');
  container.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--text-muted);">🔍 搜索中…</div>';

  const results = await window.API.searchFunds(value);

  if (results.length === 0) {
    container.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--text-muted);">未找到匹配的基金，请尝试其他关键字</div>';
    return;
  }

  container.innerHTML = results.slice(0, 10).map(f => `
    <div class="fund-search-item" onclick="onSelectFund('${f.code}','${escJsStr(f.name)}')">
      <div>
        <span class="name">${escHtml(f.name)}</span>
        <span class="code" style="margin-left:8px;">${f.code}</span>
      </div>
      <span style="font-size:11px;color:var(--text-muted);">${escHtml(f.type)}</span>
    </div>
  `).join('');
}

async function onSelectFund(code, name) {
  selectedFund = { code, name };
  gel('fundSearchResult').classList.remove('open');
  gel('fundSearchInput').value = `${code}  ${name}`;
  gel('fundDetailCard').style.display = 'block';

  gel('tradeFundName').textContent = name;
  gel('tradeFundCode').textContent = code;
  gel('tradeFundNav').textContent = '加载中…';
  gel('tradeFundChange').textContent = '';
  gel('tradeAmount').value = '';
  gel('tradeShares').value = '';

  // 获取实时净值
  try {
    const data = await window.API.fetchFundNAV(code);
    selectedFundNAV = parseFloat(data.gsz) || parseFloat(data.dwjz);
    gel('tradeFundName').textContent = data.name || name;
    gel('tradeFundCode').textContent = `${code} · 净值日期 ${data.jzrq || '--'} · 更新 ${data.gztime || '--'}`;
    gel('tradeFundNav').textContent = '¥' + selectedFundNAV.toFixed(4);
    const change = parseFloat(data.gszzl) || 0;
    const changeEl = gel('tradeFundChange');
    changeEl.textContent = (change >= 0 ? '+' : '') + change.toFixed(2) + '%';
    changeEl.className = 'stat-change ' + (change >= 0 ? 'up' : 'down');
    changeEl.style.justifyContent = 'flex-end';
  } catch (e) {
    gel('tradeFundNav').textContent = '加载失败';
    gel('tradeFundCode').textContent = code + ' · 请检查网络后重试';
    selectedFundNAV = null;
  }
}

function onTradeAmountInput(value) {
  const amount = parseFloat(value) || 0;
  if (!selectedFund || amount <= 0 || !selectedFundNAV) {
    gel('tradeShares').value = '';
    return;
  }
  const shares = amount / selectedFundNAV;
  gel('tradeShares').value = shares.toFixed(2) + ' 份';
}

function executeTradeFromPage(type) {
  if (!selectedFund) return showToast('请先搜索并选择一只基金', 'error');
  const amount = parseFloat(gel('tradeAmount').value) || 0;
  if (amount <= 0) return showToast('请输入有效的买入金额', 'error');
  if (!selectedFundNAV) return showToast('净值数据未加载，请稍后重试', 'error');

  const shares = Math.floor(amount / selectedFundNAV * 100) / 100; // 保留2位小数截断
  if (shares <= 0) return showToast('金额不足以购买1份，请增加金额', 'error');

  const result = type === 'buy'
    ? buyFund(selectedFund.code, selectedFund.name, shares, selectedFundNAV)
    : sellFund(selectedFund.code, selectedFund.name, shares, selectedFundNAV);

  if (!result.success) return showToast(result.error, 'error');

  const label = type === 'buy' ? '买入' : '卖出';
  showToast(`✅ 成功${label} ${selectedFund.name} ¥${amount.toFixed(2)}(${shares.toFixed(2)}份)`, 'success');

  gel('tradeAmount').value = '';
  gel('tradeShares').value = '';
  renderAll();
}

function quickTradeFromHoldings(code, type) {
  // 从持仓表快速跳转到交易页
  const cache = window.API ? window.API.NAV_CACHE : {};
  const fd = cache[code];
  const name = fd ? fd.name : code;
  switchPage('trade');
  setTimeout(() => onSelectFund(code, name), 200);
}

// ===========================
//  模态框 (快速交易)
// ===========================

let modalTradeType = 'buy';
let modalSelectedFund = null;
let modalFundNAV = null;

function openTradeModal() {
  gel('tradeModalOverlay').classList.add('open');
  gel('modalFundSearch').value = '';
  gel('modalSearchResult').classList.remove('open');
  gel('modalSearchResult').innerHTML = '';
  gel('modalFundInfo').style.display = 'none';
  gel('modalAmount').value = '';
  gel('modalShares').value = '';
  modalSelectedFund = null;
  modalFundNAV = null;
  modalTradeType = 'buy';
  updateModalTradeBtns();
}

function closeTradeModal(e) {
  if (e && e.target !== gel('tradeModalOverlay')) return;
  gel('tradeModalOverlay').classList.remove('open');
}

async function modalSearchInput(value) {
  const container = gel('modalSearchResult');
  if (!value || value.trim().length < 1) {
    container.classList.remove('open');
    container.innerHTML = '';
    return;
  }

  container.classList.add('open');
  container.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--text-muted);">🔍 搜索中…</div>';

  const results = await window.API.searchFunds(value);

  if (results.length === 0) {
    container.innerHTML = '<div style="padding:12px 14px;font-size:12px;color:var(--text-muted);">未找到匹配的基金</div>';
    return;
  }

  container.innerHTML = results.slice(0, 8).map(f => `
    <div class="fund-search-item" onclick="modalSelectFund('${f.code}','${escJsStr(f.name)}')">
      <div>
        <span class="name">${escHtml(f.name)}</span>
        <span class="code" style="margin-left:8px;">${f.code}</span>
      </div>
      <span style="font-size:11px;color:var(--text-muted);">${escHtml(f.type)}</span>
    </div>
  `).join('');
}

async function modalSelectFund(code, name) {
  modalSelectedFund = { code, name };
  gel('modalSearchResult').classList.remove('open');
  gel('modalFundSearch').value = `${code}  ${name}`;
  gel('modalFundInfo').style.display = 'block';
  gel('modalFundName').textContent = name;
  gel('modalFundNavInfo').textContent = '加载中…';
  gel('modalAmount').value = '';
  gel('modalShares').value = '';

  try {
    const data = await window.API.fetchFundNAV(code);
    modalFundNAV = parseFloat(data.gsz) || parseFloat(data.dwjz);
    const change = parseFloat(data.gszzl) || 0;
    gel('modalFundNavInfo').textContent =
      `最新净值 ¥${modalFundNAV.toFixed(4)} · ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
  } catch (e) {
    gel('modalFundNavInfo').textContent = '净值数据加载失败';
    modalFundNAV = null;
  }
  updateModalTradeBtns();
}

function setModalTradeType(type) {
  modalTradeType = type;
  updateModalTradeBtns();
}

function updateModalTradeBtns() {
  const buyBtn = gel('modalBuyBtn');
  const sellBtn = gel('modalSellBtn');
  if (!buyBtn || !sellBtn) return;

  if (modalTradeType === 'buy') {
    buyBtn.className = 'btn btn-primary btn-sm';
    buyBtn.style.cssText = 'flex:1;';
    sellBtn.className = 'btn btn-outline btn-sm';
    sellBtn.style.cssText = 'flex:1; color:var(--loss); border-color:var(--loss);';
  } else {
    sellBtn.className = 'btn btn-primary btn-sm';
    sellBtn.style.cssText = 'flex:1; background:var(--loss);';
    buyBtn.className = 'btn btn-outline btn-sm';
    buyBtn.style.cssText = 'flex:1;';
  }
}

function onModalAmountInput(value) {
  const amount = parseFloat(value) || 0;
  if (!modalSelectedFund || amount <= 0 || !modalFundNAV) {
    gel('modalShares').value = '';
    return;
  }
  gel('modalShares').value = (amount / modalFundNAV).toFixed(2) + ' 份';
}

function executeModalTrade() {
  if (!modalSelectedFund) return showToast('请先搜索并选择一只基金', 'error');
  const amount = parseFloat(gel('modalAmount').value) || 0;
  if (amount <= 0) return showToast('请输入有效的买入金额', 'error');
  if (!modalFundNAV) return showToast('净值数据未加载，请稍后重试', 'error');

  const shares = Math.floor(amount / modalFundNAV * 100) / 100;
  if (shares <= 0) return showToast('金额不足以购买1份，请增加金额', 'error');

  const result = modalTradeType === 'buy'
    ? buyFund(modalSelectedFund.code, modalSelectedFund.name, shares, modalFundNAV)
    : sellFund(modalSelectedFund.code, modalSelectedFund.name, shares, modalFundNAV);

  if (!result.success) return showToast(result.error, 'error');

  const label = modalTradeType === 'buy' ? '买入' : '卖出';
  showToast(`✅ 成功${label} ${modalSelectedFund.name} ¥${amount.toFixed(2)}(${shares.toFixed(2)}份)`, 'success');

  closeTradeModal();
  renderAll();
}

// ===========================
//  Toast 消息
// ===========================

function showToast(msg, type = 'info') {
  const container = gel('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast ' + type;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}

// ===========================
//  全局点击关闭搜索下拉
// ===========================

document.addEventListener('click', function (e) {
  // 关闭交易页搜索下拉
  const searchResult = gel('fundSearchResult');
  const searchInput = gel('fundSearchInput');
  if (searchResult && searchResult.classList.contains('open') &&
      !searchResult.contains(e.target) && e.target !== searchInput) {
    searchResult.classList.remove('open');
  }
  // 关闭模态框搜索下拉
  const modalResult = gel('modalSearchResult');
  const modalInput = gel('modalFundSearch');
  if (modalResult && modalResult.classList.contains('open') &&
      !modalResult.contains(e.target) && e.target !== modalInput) {
    modalResult.classList.remove('open');
  }
});

// ===========================
//  主题切换
// ===========================

function onToggleTheme() {
  const next = toggleTheme();
  const label = gel('theme-label');
  if (label) label.textContent = next === 'dark' ? '☀️ 亮色模式' : '🌙 暗色模式';
  setTimeout(renderAllCharts, 150);
}

// ===========================
//  移动端侧边栏
// ===========================

function toggleSidebar() {
  gel('sidebar').classList.toggle('open');
}

// ===========================
//  全量渲染
// ===========================

function renderAll() {
  renderStats();
  renderHoldingsTable();
  renderHistory();
  renderAllCharts();
}

// ===========================
//  数据刷新
// ===========================

async function refreshData() {
  const codes = window.API ? window.API.getHoldingCodes(window.PF.holdings) : [];
  if (codes.length === 0) {
    gel('updateTime').textContent = '暂无持仓，无需刷新';
    return;
  }
  gel('updateTime').textContent = '正在刷新…';
  const results = await window.API.fetchAllFundNAV(codes);
  gel('updateTime').textContent = results.length > 0
    ? `数据更新于 ${results[0].gztime || '--'}`
    : '刷新失败，请检查网络';
  renderAll();
  if (results.length > 0) showToast(`✅ 已更新 ${results.length} 只基金数据`, 'success');
}

// ===========================
//  图表周期切换
// ===========================

function setChartPeriod(period, btn) {
  qsa('.period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  currentTrendPeriod = period;
  if (typeof renderTrendChart === 'function') renderTrendChart();
}

// ===========================
//  好友对战页面
// ===========================

let friendViewUserId = null;

/** 好友页入口：根据当前状态显示不同面板 */
let friendsPageLoading = false;

async function renderFriendsPage() {
  if (!window.SB) {
    gel('friends-setup').style.display = 'block';
    gel('friends-lobby').style.display = 'none';
    gel('friends-room').style.display = 'none';
    gel('friends-setup').querySelector('p').textContent = 'Supabase 未加载，好友功能不可用。请检查网络后刷新页面。';
    return;
  }

  // 显示加载中，等待 init 完成（幂等，已完成则立即返回）
  if (!friendsPageLoading) {
    gel('friends-setup').style.display = 'block';
    gel('friends-lobby').style.display = 'none';
    gel('friends-room').style.display = 'none';
    gel('friends-setup').querySelector('p').textContent = '正在连接服务器…';
    friendsPageLoading = true;
  }

  await window.SB.waitForInit();
  friendsPageLoading = false;

  const username = window.SB.getUsername();

  // 状态 1：无昵称
  if (!username) {
    gel('friends-setup').style.display = 'block';
    gel('friends-lobby').style.display = 'none';
    gel('friends-room').style.display = 'none';
    return;
  }

  // 状态 2：有昵称但不在房间
  if (!window.SB.isInRoom()) {
    gel('friends-setup').style.display = 'none';
    gel('friends-lobby').style.display = 'block';
    gel('friends-room').style.display = 'none';
    return;
  }

  // 状态 3：在房间中
  gel('friends-setup').style.display = 'none';
  gel('friends-lobby').style.display = 'none';
  gel('friends-room').style.display = 'block';

  const room = window.SB.getCurrentRoom();
  gel('room-name-display').textContent = room.name;
  gel('room-invite-code').textContent = room.invite_code;

  await renderLeaderboard();
  await renderMemberList();
}

/** 保存昵称 */
async function saveNickname() {
  const input = gel('friends-nickname-input');
  const name = input.value.trim();
  if (!name) return showToast('请输入昵称', 'error');
  if (!window.SB) return showToast('服务未连接', 'error');

  await window.SB.setUsername(name);
  showToast('昵称设置成功！', 'success');
  renderFriendsPage();
}

/** 创建房间 */
async function createRoomAction() {
  if (!window.SB) return showToast('服务未连接', 'error');
  const name = gel('create-room-name').value.trim() || '投资好友房间';
  const result = await window.SB.createRoom(name);
  if (result.error) return showToast(result.error, 'error');

  showToast('🎉 房间创建成功！邀请码：' + result.room.invite_code, 'success');
  // 订阅实时变动
  window.SB.subscribeRoomRealtime(result.room.id, (payload) => {
    if (payload.eventType === 'INSERT') showToast('👋 有新朋友加入了房间！', 'info');
    if (payload.eventType === 'DELETE') showToast('👋 有人离开了房间', 'info');
    if (currentPage === 'friends') renderFriendsPage();
  });
  renderFriendsPage();
}

/** 加入房间 */
async function joinRoomAction() {
  if (!window.SB) return showToast('服务未连接', 'error');
  const code = gel('join-invite-code').value.trim().toUpperCase();
  if (code.length !== 6) return showToast('请输入 6 位邀请码', 'error');

  const result = await window.SB.joinRoom(code);
  if (result.error) return showToast(result.error, 'error');

  if (result.alreadyIn) {
    showToast('你已在此房间中', 'info');
  } else {
    showToast('🎉 成功加入房间！', 'success');
  }

  // 订阅实时变动
  const room = window.SB.getCurrentRoom();
  if (room) {
    window.SB.subscribeRoomRealtime(room.id, (payload) => {
      if (payload.eventType === 'INSERT') showToast('👋 有新朋友加入了房间！', 'info');
      if (payload.eventType === 'DELETE') showToast('👋 有人离开了房间', 'info');
      if (currentPage === 'friends') renderFriendsPage();
    });
  }
  renderFriendsPage();
}

/** 退出房间 */
async function leaveRoomAction() {
  if (!confirm('确定要退出当前房间吗？你的排行榜数据将被清除。')) return;
  const result = await window.SB.leaveRoom();
  if (result.error) return showToast(result.error, 'error');
  showToast('已退出房间', 'info');
  renderFriendsPage();
}

/** 复制邀请码 */
function copyInviteCode() {
  const room = window.SB.getCurrentRoom();
  if (!room) return;
  navigator.clipboard.writeText(room.invite_code).then(() => {
    showToast('📋 邀请码已复制！发给朋友吧', 'success');
  }).catch(() => {
    prompt('复制邀请码：', room.invite_code);
  });
}

/** 刷新好友页数据 */
async function refreshFriendsPage() {
  await renderFriendsPage();
  showToast('已刷新', 'info');
}

/** 渲染排行榜 */
async function renderLeaderboard() {
  const tbody = gel('leaderboard-body');
  if (!tbody) return;

  const data = await window.SB.getLeaderboard();
  if (!data || data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7"><div class="empty-state"><p>暂无数据，等待朋友同步持仓…</p></div></td></tr>';
    return;
  }

  // 更新时间
  const timeEl = gel('leaderboard-update-time');
  if (timeEl && data[0].snapped_at) {
    timeEl.textContent = '更新于 ' + new Date(data[0].snapped_at).toLocaleTimeString('zh-CN');
  }

  const medals = ['🥇', '🥈', '🥉'];

  tbody.innerHTML = data.map((row, i) => {
    const rank = i + 1;
    const rankDisplay = rank <= 3 ? medals[rank - 1] + ' ' + rank : rank;
    const pnlClass = parseFloat(row.total_pnl) >= 0 ? 'pnl-positive' : 'pnl-negative';
    const pnlPctClass = parseFloat(row.total_pnl_pct) >= 0 ? 'badge-profit' : 'badge-loss';
    const pnlSign = parseFloat(row.total_pnl) >= 0 ? '+' : '';

    return `
      <tr class="${row.isMe ? 'leaderboard-me' : ''}" style="cursor:pointer;"
        onclick="viewFriendPortfolio('${row.user_id}','${escJsStr(row.username)}')">
        <td style="font-weight:700; font-size:${rank <= 3 ? '18px' : '14px'};">${rankDisplay}</td>
        <td>
          <span style="font-weight:600;">${escHtml(row.username)}</span>
          ${row.isMe ? '<span style="font-size:11px; color:var(--accent); margin-left:4px;">(你)</span>' : ''}
        </td>
        <td class="right">${fmtMoneyFull(parseFloat(row.total_assets))}</td>
        <td class="right ${pnlClass}">${pnlSign}${fmtMoneyFull(parseFloat(row.total_pnl))}</td>
        <td class="right"><span class="badge ${pnlPctClass}">${pnlSign + parseFloat(row.total_pnl_pct).toFixed(2)}%</span></td>
        <td style="font-size:12px; color:var(--text-muted);">${row.snapped_at ? timeAgo(row.snapped_at) : '--'}</td>
        <td><button class="btn-table" onclick="event.stopPropagation(); viewFriendPortfolio('${row.user_id}','${escJsStr(row.username)}')">查看持仓</button></td>
      </tr>`;
  }).join('');
}

/** 查看好友持仓 */
async function viewFriendPortfolio(userId, username) {
  friendViewUserId = userId;
  const data = await window.SB.getFriendPortfolio(userId);
  if (!data || !data.holdings_json) {
    showToast('暂无该好友的持仓数据', 'info');
    return;
  }

  gel('friend-portfolio-title').textContent = '📋 ' + escHtml(username) + ' 的持仓';
  gel('friend-portfolio-panel').style.display = 'block';

  const tbody = gel('friend-portfolio-body');
  const holdings = data.holdings_json;
  tbody.innerHTML = holdings.map(h => {
    const pnlClass = h.pnl >= 0 ? 'pnl-positive' : 'pnl-negative';
    const badgeClass = h.pnl >= 0 ? 'badge-profit' : 'badge-loss';
    const pnlSign = h.pnl >= 0 ? '+' : '';
    return `
      <tr>
        <td><span class="fund-code">${h.code}</span></td>
        <td><span class="fund-name">${escHtml(h.name)}</span></td>
        <td>${fmtNum(h.shares)}</td>
        <td>¥${h.costNav.toFixed(4)}</td>
        <td>¥${h.nav.toFixed(4)}</td>
        <td class="right">${fmtMoneyFull(h.mv)}</td>
        <td class="right ${pnlClass}">${pnlSign}${fmtMoneyFull(h.pnl)}</td>
        <td class="right"><span class="badge ${badgeClass}">${pnlSign + h.pnlPct.toFixed(2)}%</span></td>
      </tr>`;
  }).join('');

  // 滚动到持仓面板
  gel('friend-portfolio-panel').scrollIntoView({ behavior: 'smooth' });
}

function closeFriendPortfolio() {
  friendViewUserId = null;
  gel('friend-portfolio-panel').style.display = 'none';
}

/** 渲染成员列表 */
async function renderMemberList() {
  const list = gel('member-list');
  const count = gel('member-count');
  if (!list) return;

  const members = await window.SB.fetchRoomMembers();
  if (count) count.textContent = `共 ${members.length} 人`;
  list.innerHTML = members.map(m => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--bg);border-radius:20px;font-size:13px;">
      <span style="width:28px;height:28px;border-radius:50%;background:var(--accent-light);color:var(--accent);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;">
        ${(m.username || '?')[0].toUpperCase()}
      </span>
      <span style="font-weight:600;color:var(--text-primary);">${escHtml(m.username || '未命名')}</span>
      ${m.isMe ? '<span style="font-size:11px;color:var(--accent);">(你)</span>' : ''}
    </div>
  `).join('');
}

/** 简易时间显示 */
function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return mins + '分钟前';
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + '小时前';
  return Math.floor(hours / 24) + '天前';
}
