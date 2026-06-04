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
const DEFAULT_PORTFOLIO = {
  cash: 500000,        // 初始现金 50 万
  holdings: [],        // { code, shares, costNav, addedAt, realizedPnL }
  transactions: [],    // { id, type, code, name, shares, nav, amount, date }
  closedPnL: 0         // 已全部赎回的基金的历史盈亏合计
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
 * 累计盈亏 = 所有现存持仓的总盈亏 + 已清仓基金的历史盈亏
 * 每只持仓的总盈亏 = 未实现(市值-成本) + 已实现(该基金部分赎回盈亏)
 */
function getTotalPnLAmount() {
  var today = new Date().toISOString().split('T')[0];
  var total = window.PF.holdings.reduce(function(sum, h) {
    if (h.addedAt >= today) return sum; // 确认日及之前无盈亏
    var unrealized = getHoldingMarketValue(h) - getHoldingCost(h);
    var realized = h.realizedPnL || 0;
    return sum + unrealized + realized;
  }, 0);
  return total + (window.PF.closedPnL || 0);
}

/**
 * 累计盈亏百分比
 */
function getTotalPnLPercent() {
  const cost = getTotalCost();
  return cost > 0 ? (getTotalPnLAmount() / cost) * 100 : 0;
}

/**
 * 计算基金交易的确认日期（仿支付宝规则）
 * - 交易日（周一至周五）9:30-15:00 买入 → 当天确认
 * - 交易日 15:00 之后 或 非交易日 → 顺延到下一个交易日
 */
function getEffectiveTradeDate() {
  var now = new Date();
  var day = now.getDay(); // 0=Sun, 6=Sat
  var hour = now.getHours();
  var minute = now.getMinutes();
  var isWeekday = day >= 1 && day <= 5;
  // 9:30 开盘，15:00 收盘
  var inTradingHours = (hour > 9 || (hour === 9 && minute >= 30)) && hour < 15;

  // 工作日交易时段内 → 今天确认
  if (isWeekday && inTradingHours) {
    return now.toISOString().split('T')[0];
  }

  // 否则跳到下一个交易日
  var next = new Date(now);
  if (!isWeekday || hour >= 15) {
    next.setDate(next.getDate() + 1);
  }
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString().split('T')[0];
}

/**
 * 今日预估盈亏
 */
function getDailyPnL() {
  // 获取今天的日期字符串 (YYYY-MM-DD)
  const today = new Date().toISOString().split('T')[0];
  
  return window.PF.holdings.reduce((sum, h) => {
    const cache = window.API ? window.API.NAV_CACHE : {};
    const fd = cache[h.code];
    if (!fd) return sum;
    const gsz = parseFloat(fd.gsz);    // 今日估算净值
    const dwjz = parseFloat(fd.dwjz);  // 昨日确认收盘净值
    if (!gsz || !dwjz) return sum;
    
    // 核心逻辑：
    if (h.addedAt >= today) {
      // 确认日当天及之前：还未确认 / 刚确认，没有盈亏
      return sum;
    } else {
      // 确认日之后：当日盈亏 = 份额 × (今日估算净值 - 昨日收盘净值)
      return sum + h.shares * (gsz - dwjz);
    }
  }, 0);
}

/**
 * 一次性修正：如果旧持仓的 costNav 更接近 gsz（估算净值）而非 dwjz（收盘净值），
 * 说明买入时错误用了估算值，修正为 dwjz。只执行一次，之后 costNav 永不再动。
 */
var COST_FIXED_KEY = '_costNavFix_v1';
function normalizeHoldingsCostNav() {
  if (localStorage.getItem(COST_FIXED_KEY)) return;

  var cache = window.API ? window.API.NAV_CACHE : {};
  var changed = false;
  window.PF.holdings.forEach(function(h) {
    var fd = cache[h.code];
    if (!fd) return;
    var dwjz = parseFloat(fd.dwjz);
    var gsz = parseFloat(fd.gsz);
    if (!dwjz || !gsz) return;
    // 仅当 costNav 明显更接近 gsz 而远离 dwjz 时才修正（说明当初错用了估算值买入）
    var diffToDwjz = Math.abs(h.costNav - dwjz) / dwjz;
    var diffToGsz = Math.abs(h.costNav - gsz) / gsz;
    if (diffToGsz < 0.001 && diffToDwjz > 0.002) {
      h.costNav = dwjz;
      changed = true;
    }
  });
  if (changed) savePortfolio();
  localStorage.setItem(COST_FIXED_KEY, '1');
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
      addedAt: getEffectiveTradeDate()  // 交易日 9:30-15:00 买的才算今天，否则顺延
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
  // 已实现盈亏 = 卖出金额 - 卖出份额的成本 → 记在该持仓上
  var realized = shares * (nav - existing.costNav);
  existing.realizedPnL = (existing.realizedPnL || 0) + realized;

  existing.shares -= shares;
  window.PF.cash += amount;

  if (existing.shares <= 0) {
    // 全部赎回：该基金的总盈亏转入 closedPnL，持仓删除
    window.PF.closedPnL = (window.PF.closedPnL || 0) + (existing.realizedPnL || 0);
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
//  初始化
// ===========================

window.PF = loadPortfolio();

// 一次性修复：从交易记录恢复被 normalizeHoldingsCostNav 损坏的 costNav
(function() {
  var FIX_KEY = '_costFix_v3';
  if (localStorage.getItem(FIX_KEY)) return;

  var changed = false;
  window.PF.holdings.forEach(function(h) {
    // 汇总该基金所有买入交易
    var invested = 0, bought = 0;
    window.PF.transactions.forEach(function(t) {
      if (t.code === h.code && t.type === 'buy') {
        invested += t.amount;
        bought += t.shares;
      }
    });
    if (bought > 0) {
      var realCostNav = invested / bought;
      if (Math.abs(h.costNav - realCostNav) > 0.0001) {
        console.log('[数据修复]', h.code,
          '损坏的costNav:', h.costNav.toFixed(4),
          '→ 恢复为:', realCostNav.toFixed(4));
        h.costNav = realCostNav;
        changed = true;
      }
    }
  });

  if (changed) savePortfolio();
  localStorage.setItem(FIX_KEY, '1');
})();
