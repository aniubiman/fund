/**
 * charts.js — Canvas 图表渲染
 *
 * 提供两个图表：
 * 1. renderTrendChart(canvasId, period) — 组合收益走势折线图
 * 2. renderAllocationChart(canvasId, legendId) — 资产配置环形图
 *
 * 所有图表使用原生 Canvas 2D API，无外部依赖。
 * 自动适配浅色/深色主题和 devicePixelRatio。
 */

// ===========================
//  工具函数
// ===========================

function $(id) { return document.getElementById(id); }

function getCtx(canvasId, width, height) {
  const canvas = $(canvasId);
  if (!canvas) return null;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width, height };
}

function isDark() {
  return window.Theme ? window.Theme.isDark() : false;
}

function chartFont(size, weight) {
  var bodyFont = getComputedStyle(document.body).fontFamily;
  return (weight || '') + ' ' + size + 'px ' + bodyFont;
}

function themeColors() {
  var dark = isDark();
  var accent = getComputedStyle(document.body).getPropertyValue('--accent').trim() || '#007AFF';
  return {
    textPrimary: dark ? '#e2e8f0' : '#1d1d1f',
    textSecondary: dark ? '#94a3b8' : '#6e6e73',
    grid: dark ? '#1e293b' : '#e8e8ed',
    line: accent,
    area: dark ? 'rgba(6,182,212,0.08)' : 'rgba(0,122,255,0.06)',
    dot: accent,
    costLine: dark ? '#334155' : '#d2d2d7',
  };
}

function fmtShortMoney(v) {
  const abs = Math.abs(v);
  if (abs >= 10000) return '¥' + (v / 10000).toFixed(2) + '万';
  return '¥' + v.toFixed(0);
}

// ===========================
//  折线图：组合收益走势
// ===========================

// 图表周期由 ui.js 的 setChartPeriod() 统一管理
let currentTrendPeriod = '1M';

function renderTrendChart() {
  const canvas = $('trendChart');
  if (!canvas) return;

  const container = canvas.parentElement;
  const w = container.clientWidth;
  const h = 300;
  const { ctx, width, height } = getCtx('trendChart', w, h);
  if (!ctx) return;
  const c = themeColors();

  // ---- 生成模拟走势数据 ----
  const periods = { '1M': 22, '3M': 66, '6M': 132, '1Y': 252, 'ALL': 365 };
  const days = periods[currentTrendPeriod] || 22;
  const totalCost = getTotalCost();
  const totalMv = getTotalMarketValue();

  if (totalCost <= 0) {
    // 无持仓时显示空状态
    ctx.fillStyle = c.textSecondary;
    ctx.font = chartFont(14);
    ctx.textAlign = 'center';
    ctx.fillText('暂无持仓数据，买入基金后将显示收益走势', w / 2, h / 2);
    return;
  }

  const data = [];
  const steps = Math.max(days, 1);
  const drift = (totalMv - totalCost) / steps;
  const volatility = 0.008 * totalCost;
  let value = totalCost;

  for (let i = 0; i <= steps; i++) {
    if (i === 0) value = totalCost;
    else if (i === steps) value = totalMv;
    else value += drift + (Math.random() - 0.48) * volatility;

    const d = new Date();
    d.setDate(d.getDate() - (steps - i));
    data.push({ date: d, value: Math.max(value, totalCost * 0.7) });
  }

  // ---- 坐标计算 ----
  const pad = { top: 16, right: 16, bottom: 36, left: 56 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  const minVal = Math.min(...data.map(d => d.value)) * 0.97;
  const maxVal = Math.max(...data.map(d => d.value)) * 1.03;
  const range = maxVal - minVal || 1;

  function x(i) { return pad.left + (i / steps) * cw; }
  function y(v) { return pad.top + ch - ((v - minVal) / range) * ch; }

  // ---- 网格线 ----
  for (let i = 0; i <= 4; i++) {
    const vy = pad.top + (ch / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, vy);
    ctx.lineTo(pad.left + cw, vy);
    ctx.strokeStyle = c.grid;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    const val = maxVal - (range / 4) * i;
    ctx.fillStyle = c.textSecondary;
    ctx.font = chartFont(11);
    ctx.textAlign = 'right';
    ctx.fillText(fmtShortMoney(val), pad.left - 8, vy + 4);
  }

  // ---- X 轴标签 ----
  ctx.textAlign = 'center';
  const xLabels = Math.min(6, steps);
  for (let i = 0; i <= xLabels; i++) {
    const idx = Math.round((steps / xLabels) * i);
    const dx = x(idx);
    ctx.fillStyle = c.textSecondary;
    ctx.font = chartFont(11);
    const d = data[idx].date;
    ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, dx, height - pad.bottom + 18);
  }

  // ---- 面积填充 ----
  var gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + ch);
  gradient.addColorStop(0, c.area);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.beginPath();
  ctx.moveTo(x(0), y(minVal));
  for (let i = 0; i <= steps; i++) ctx.lineTo(x(i), y(data[i].value));
  ctx.lineTo(x(steps), y(minVal));
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  // ---- 折线 ----
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    i === 0 ? ctx.moveTo(x(i), y(data[i].value)) : ctx.lineTo(x(i), y(data[i].value));
  }
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // ---- 终点圆点 ----
  const lx = x(steps), ly = y(data[steps].value);
  // Outer glow ring
  ctx.beginPath();
  ctx.arc(lx, ly, 9, 0, Math.PI * 2);
  ctx.fillStyle = c.area;
  ctx.fill();
  // Inner dot
  ctx.beginPath();
  ctx.arc(lx, ly, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lx, ly, 4, 0, Math.PI * 2);
  ctx.fillStyle = c.dot;
  ctx.fill();

  // ---- 成本基准线 ----
  ctx.setLineDash([3, 5]);
  ctx.beginPath();
  const costY = y(totalCost);
  ctx.moveTo(pad.left, costY);
  ctx.lineTo(pad.left + cw, costY);
  ctx.strokeStyle = c.costLine;
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = c.textSecondary;
  ctx.font = chartFont(10);
  ctx.textAlign = 'right';
  ctx.fillText('成本线', pad.left + cw, costY - 5);
}

// ===========================
//  环形图：资产配置
// ===========================

function getChartPalette() {
  const style = getComputedStyle(document.body);
  var colors = [];
  for (var i = 1; i <= 10; i++) {
    var c = style.getPropertyValue('--chart-' + i).trim();
    if (c) colors.push(c);
  }
  if (colors.length === 0) {
    // Fallback if CSS vars aren't available
    colors = ['#007AFF', '#5856D6', '#34C759', '#FF9500', '#FF3B30',
      '#AF52DE', '#5AC8FA', '#FF2D55', '#00C7BE', '#8E8E93'];
  }
  return colors;
}

function getChartCashColor() {
  var c = getComputedStyle(document.body).getPropertyValue('--chart-cash').trim();
  return c || '#8E8E93';
}

function renderAllocationChart() {
  const { ctx, width, height } = getCtx('allocationChart', 220, 220);
  if (!ctx) return;
  const size = width;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 92;
  const innerR = 52;
  const c = themeColors();

  // 构建数据
  var palette = getChartPalette();
  var cashColor = getChartCashColor();
  const segments = window.PF.holdings.map((h, i) => ({
    name: (window.API.NAV_CACHE[h.code] && window.API.NAV_CACHE[h.code].name) || h.code,
    code: h.code,
    value: getHoldingMarketValue(h),
    color: palette[i % palette.length]
  }));

  const total = getTotalAssets();

  if (window.PF.cash > 0) {
    segments.push({ name: '可用现金', code: 'CASH', value: window.PF.cash, color: cashColor });
  }

  // 清空 & 绘制
  ctx.clearRect(0, 0, size, size);

  if (segments.length === 0 || total <= 0) {
    ctx.fillStyle = c.textSecondary;
    ctx.font = chartFont(14);
    ctx.textAlign = 'center';
    ctx.fillText('暂无持仓', cx, cy);
    renderAllocationLegend(segments);
    return;
  }

  let startAngle = -Math.PI / 2;
  segments.forEach(seg => {
    const slice = (seg.value / total) * Math.PI * 2;
    if (slice <= 0) return;

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
    ctx.arc(cx, cy, innerR, startAngle + slice, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = seg.color;
    ctx.fill();

    // 超过 5% 的扇区画分割线
    if (seg.value / total > 0.05) {
      ctx.strokeStyle = isDark() ? '#141c2b' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    startAngle += slice;
  });

  // 中心文字
  ctx.fillStyle = c.textSecondary;
  ctx.font = chartFont(11, '600');
  ctx.textAlign = 'center';
  ctx.fillText('总资产', cx, cy - 6);
  ctx.fillStyle = c.textPrimary;
  ctx.font = chartFont(14, 'bold');
  const totalStr = total >= 10000
    ? '¥' + (total / 10000).toFixed(2) + '万'
    : '¥' + total.toFixed(2);
  ctx.fillText(totalStr, cx, cy + 14);

  // 图例
  renderAllocationLegend(segments);
}

function renderAllocationLegend(segments) {
  const legend = $('allocationLegend');
  if (!legend) return;

  const total = getTotalAssets();
  legend.innerHTML = segments.length === 0
    ? '<span style="font-size:12px;color:var(--text-muted);">暂无数据</span>'
    : segments.map(seg => `
      <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-secondary);max-width:160px;">
        <span style="width:10px;height:10px;border-radius:3px;background:${seg.color};flex-shrink:0;"></span>
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${seg.code === 'CASH' ? iconCash('icon-sm') + ' 现金' : seg.name}</span>
        <span style="font-weight:600;color:var(--text-primary);flex-shrink:0;">${total > 0 ? (seg.value / total * 100).toFixed(1) : '0'}%</span>
      </div>
    `).join('');
}

// ===========================
//  响应式处理
// ===========================

window.addEventListener('resize', () => {
  clearTimeout(window._chartResizeTimer);
  window._chartResizeTimer = setTimeout(renderAllCharts, 150);
});

function renderAllCharts() {
  renderTrendChart();
  renderAllocationChart();
}

// ===========================
//  Sparkline 迷你走势图（布朗桥算法）
// ===========================

/**
 * 绘制迷你走势图
 * @param {string} canvasId 画布ID
 * @param {number} actualPnL 真实的盈亏金额
 */
// ===========================
//  流体波浪动画（替代迷你走势图）
// ===========================

var _fluidWaves = {}; // 按 canvasId 存动画状态

function initFluidWave(canvasId, fillRatio, isProfit) {
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // 如果已有动画在跑，先停掉
  if (_fluidWaves[canvasId]) {
    _fluidWaves[canvasId].active = false;
    delete _fluidWaves[canvasId];
  }

  var ctx = canvas.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  var width = 0, height = 0;
  var time = 0;
  var state = { active: true };
  _fluidWaves[canvasId] = state;

  // fillRatio: 0=贴底, 0.5=一半, 1=满
  fillRatio = Math.min(Math.max(fillRatio || 0, 0), 1);

  function resize() {
    var w = canvas.clientWidth;
    var h = canvas.clientHeight;
    if (w === 0 || h === 0) return false;
    width = w;
    height = h;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function waitAndStart() {
    if (resize()) {
      draw();
    } else {
      requestAnimationFrame(waitAndStart);
    }
  }

  function draw() {
    if (!state.active) return;
    ctx.clearRect(0, 0, width, height);

    var waves = [
      { length: 0.006, amplitude: 5,  speed: 0.018, alpha: 0.10 },
      { length: 0.010, amplitude: 3,  speed: 0.028, alpha: 0.20 },
      { length: 0.008, amplitude: 6,  speed: 0.022, alpha: 0.35 }
    ];

    // 红涨绿跌
    var r, g, b;
    if (isProfit) { r = 238; g = 44;  b = 44; }
    else          { r = 28;  g = 168; b = 77; }

    waves.forEach(function(wave) {
      ctx.beginPath();

      if (isProfit) {
        // 赚：从左下贴底 → 往右上涌起
        ctx.moveTo(0, height);
        for (var x = 0; x <= width; x += 2) {
          var progress = x / width;
          var baseY = height * (1 - progress * fillRatio);
          var y = baseY + Math.sin(x * wave.length + time * wave.speed) * wave.amplitude;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
      } else {
        // 亏：从左上最高 → 往右下泄落
        ctx.moveTo(0, 0);
        for (var x = 0; x <= width; x += 2) {
          var progress = x / width;
          var baseY = height * progress * fillRatio;
          var y = baseY + Math.sin(x * wave.length + time * wave.speed) * wave.amplitude;
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, 0);
      }

      ctx.closePath();

      var grad = ctx.createLinearGradient(0, isProfit ? 0 : height, 0, isProfit ? height : 0);
      grad.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + (wave.alpha + 0.15) + ')');
      grad.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0.02)');
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // 表层高光线
    ctx.beginPath();
    var topWave = waves[2];
    for (var x = 0; x <= width; x += 2) {
      var progress = x / width;
      var baseY;
      if (isProfit) {
        baseY = height * (1 - progress * fillRatio);
      } else {
        baseY = height * progress * fillRatio;
      }
      var y = baseY + Math.sin(x * topWave.length + time * topWave.speed) * topWave.amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    var hl = isProfit ? 'rgba(238,44,44,0.6)' : 'rgba(28,168,77,0.6)';
    ctx.strokeStyle = hl;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    time++;
    requestAnimationFrame(draw);
  }

  waitAndStart();

  window.addEventListener('resize', resize);
}

function renderFluidWaves() {
  var dailyPnL = 0, totalPnL = 0, totalMv = 1, totalPnLPct = 0;
  if (typeof getDailyPnL === 'function')       dailyPnL = getDailyPnL();
  if (typeof getTotalPnLAmount === 'function') totalPnL = getTotalPnLAmount();
  if (typeof getTotalMarketValue === 'function') totalMv = getTotalMarketValue();
  if (typeof getTotalPnLPercent === 'function') totalPnLPct = getTotalPnLPercent();

  // 当日收益率
  var dailyPct = totalMv > 0 ? (dailyPnL / totalMv * 100) : 0;
  // fillRatio = |pct| / 10，上限 1
  var dailyFill = Math.min(Math.abs(dailyPct) / 10, 1);
  var totalFill = Math.min(Math.abs(totalPnLPct) / 10, 1);

  initFluidWave('dailyWave', dailyFill, dailyPnL >= 0);
  initFluidWave('totalWave', totalFill, totalPnL >= 0);
}

// 保持兼容旧调用名
function renderSparklines() {
  renderFluidWaves();
}
