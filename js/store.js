/**
 * store.js — 数据持久化与投资组合计算
 *
 * 管理：
 * - 持仓列表 (holdings)
 * - 现金余额 (cash)
 * - 交易历史 (transactions)
 * - 盈亏计算逻辑
 *
 * 所有数据通过 localStorage 持久化。
 */

// ===========================
//  常量
// ===========================

const STORAGE_KEY = 'fund_portfolio_v2';
const THEME_KEY = 'fund_theme';

const DEFAULT_PORTFOLIO = {
  cash: 500000,        // 初始现金 50 万
  holdings: [],        // { code, shares, costNav, addedAt }
  transactions: [],    // { id, type, code, name, shares, nav, amount, date }
};

// ===========================
//  数据加载 / 保存
// ===========================

function loadPortfolio() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // 合并默认值，兼容未来新增字段
      return { ...DEFAULT_PORTFOLIO, ...data };
    }
  } catch (e) { /* ignore corrupt data */ }
  return JSON.parse(JSON.stringify(DEFAULT_PORTFOLIO));
}

function savePortfolio() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.PF));
  } catch (e) {
    console.warn('保存失败，localStorage 可能已满');
  }
}

// ===========================
//  投资组合计算
// ===========================

/**
 * 获取某只基金的最新净值（优先用估算值 gsz，否则用单位净值 dwjz）
 */
function getLatestNAV(code) {
  const cache = window.API ? window.API.NAV_CACHE : {};
  const fd = cache[code];
  if (!fd) return null;
  return parseFloat(fd.gsz) || parseFloat(fd.dwjz) || null;
}

/**
 * 单只持仓的当前市值
 */
function getHoldingMarketValue(holding) {
  const nav = getLatestNAV(holding.code);
  if (!nav) return holding.shares * holding.costNav; // fallback to cost
  return holding.shares * nav;
}

/**
 * 单只持仓的成本
 */
function getHoldingCost(holding) {
  return holding.shares * holding.costNav;
}

/**
 * 总持仓市值
 */
function getTotalMarketValue() {
  return window.PF.holdings.reduce((sum, h) => sum + getHoldingMarketValue(h), 0);
}

/**
 * 总成本
 */
function getTotalCost() {
  return window.PF.holdings.reduce((sum, h) => sum + getHoldingCost(h), 0);
}

/**
 * 累计盈亏金额
 */
function getTotalPnLAmount() {
  return getTotalMarketValue() - getTotalCost();
}

/**
 * 累计盈亏百分比
 */
function getTotalPnLPercent() {
  const cost = getTotalCost();
  return cost > 0 ? (getTotalPnLAmount() / cost) * 100 : 0;
}

/**
 * 今日预估盈亏（基于各持仓估算涨跌幅计算）
 */
function getDailyPnL() {
  return window.PF.holdings.reduce((sum, h) => {
    const cache = window.API ? window.API.NAV_CACHE : {};
    const fd = cache[h.code];
    if (!fd || fd.gszzl === undefined) return sum;
    const mv = getHoldingMarketValue(h);
    const gszzl = parseFloat(fd.gszzl);
    if (gszzl === 0) return sum;
    // 反推今日盈亏 = 市值 * 涨跌幅 / (1 + 涨跌幅)
    return sum + mv * gszzl / (100 + gszzl);
  }, 0);
}

/**
 * 持仓比例
 */
function getPositionRatio() {
  const tv = getTotalMarketValue();
  const total = tv + window.PF.cash;
  return total > 0 ? (tv / total) * 100 : 0;
}

/**
 * 总资产
 */
function getTotalAssets() {
  return getTotalMarketValue() + window.PF.cash;
}

// ===========================
//  交易操作
// ===========================

/** 触发外部同步钩子（由 supabase.js 注册） */
function notifyPortfolioChanged() {
  if (window.SB && window.SB.onPortfolioChanged) {
    try { window.SB.onPortfolioChanged(); } catch (e) { /* 不阻塞交易 */ }
  }
}

/**
 * 买入基金
 * @param {string} code
 * @param {string} name
 * @param {number} shares
 * @param {number} nav - 成交净值
 * @returns {{ success: boolean, error?: string }}
 */
function buyFund(code, name, shares, nav) {
  if (shares <= 0) return { success: false, error: '份额必须大于 0' };

  const amount = shares * nav;
  if (amount > window.PF.cash) return { success: false, error: '可用现金不足' };

  window.PF.cash -= amount;

  const existing = window.PF.holdings.find(h => h.code === code);
  if (existing) {
    const totalShares = existing.shares + shares;
    existing.costNav = (existing.shares * existing.costNav + amount) / totalShares;
    existing.shares = totalShares;
  } else {
    window.PF.holdings.push({
      code: code,
      shares: shares,
      costNav: nav,
      addedAt: new Date().toISOString().split('T')[0]
    });
  }

  addTransaction('buy', code, name, shares, nav, amount);
  savePortfolio();
  notifyPortfolioChanged();
  return { success: true };
}

/**
 * 卖出基金
 * @param {string} code
 * @param {string} name
 * @param {number} shares
 * @param {number} nav - 成交净值
 * @returns {{ success: boolean, error?: string }}
 */
function sellFund(code, name, shares, nav) {
  if (shares <= 0) return { success: false, error: '份额必须大于 0' };

  const existing = window.PF.holdings.find(h => h.code === code);
  if (!existing || existing.shares < shares) return { success: false, error: '持仓份额不足' };

  const amount = shares * nav;
  existing.shares -= shares;
  window.PF.cash += amount;

  if (existing.shares <= 0) {
    window.PF.holdings = window.PF.holdings.filter(h => h.code !== code);
  }

  addTransaction('sell', code, name, shares, nav, amount);
  savePortfolio();
  notifyPortfolioChanged();
  return { success: true };
}

/**
 * 添加交易记录
 */
function addTransaction(type, code, name, shares, nav, amount) {
  window.PF.transactions.push({
    id: 'tx_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    type: type,
    code: code,
    name: name,
    shares: shares,
    nav: nav,
    amount: amount,
    date: new Date().toLocaleString('zh-CN')
  });
}

/**
 * 删除交易记录
 */
function deleteTransaction(id) {
  window.PF.transactions = window.PF.transactions.filter(t => t.id !== id);
  savePortfolio();
}

/**
 * 清空交易记录
 */
function clearTransactions() {
  window.PF.transactions = [];
  savePortfolio();
}

// ===========================
//  主题
// ===========================

function loadTheme() {
  const theme = localStorage.getItem(THEME_KEY) || 'light';
  document.body.setAttribute('data-theme', theme);
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem(THEME_KEY, next);
  return next;
}

// ===========================
//  初始化
// ===========================

window.PF = loadPortfolio();
