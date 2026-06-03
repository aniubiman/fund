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
  return document.body.getAttribute('data-theme') === 'dark';
}

function themeColors() {
  const dark = isDark();
  return {
    textPrimary: dark ? '#f1f5f9' : '#0f172a',
    textSecondary: dark ? '#94a3b8' : '#64748b',
    grid: dark ? '#1e293b' : '#f1f5f9',
    line: '#6366f1',
    area: dark ? 'rgba(99,102,241,0.15)' : 'rgba(99,102,241,0.08)',
    dot: '#6366f1',
    costLine: dark ? '#475569' : '#cbd5e1',
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
    ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
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
    ctx.lineWidth = 1;
    ctx.stroke();

    const val = maxVal - (range / 4) * i;
    ctx.fillStyle = c.textSecondary;
    ctx.font = '11px -apple-system, "PingFang SC", sans-serif';
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
    ctx.font = '11px -apple-system, "PingFang SC", sans-serif';
    const d = data[idx].date;
    ctx.fillText(`${d.getMonth() + 1}/${d.getDate()}`, dx, height - pad.bottom + 18);
  }

  // ---- 面积填充 ----
  ctx.beginPath();
  ctx.moveTo(x(0), y(minVal));
  for (let i = 0; i <= steps; i++) ctx.lineTo(x(i), y(data[i].value));
  ctx.lineTo(x(steps), y(minVal));
  ctx.closePath();
  ctx.fillStyle = c.area;
  ctx.fill();

  // ---- 折线 ----
  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    i === 0 ? ctx.moveTo(x(i), y(data[i].value)) : ctx.lineTo(x(i), y(data[i].value));
  }
  ctx.strokeStyle = c.line;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  // ---- 终点圆点 ----
  const lx = x(steps), ly = y(data[steps].value);
  ctx.beginPath();
  ctx.arc(lx, ly, 5, 0, Math.PI * 2);
  ctx.fillStyle = c.dot;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(lx, ly, 11, 0, Math.PI * 2);
  ctx.fillStyle = c.area;
  ctx.fill();

  // ---- 成本基准线 ----
  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  const costY = y(totalCost);
  ctx.moveTo(pad.left, costY);
  ctx.lineTo(pad.left + cw, costY);
  ctx.strokeStyle = c.costLine;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = c.textSecondary;
  ctx.textAlign = 'right';
  ctx.fillText('成本线', pad.left + cw, costY - 6);
}

// ===========================
//  环形图：资产配置
// ===========================

const DONUT_COLORS = [
  '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b',
  '#ef4444', '#ec4899', '#3b82f6', '#14b8a6', '#f97316',
  '#84cc16', '#e11d48'
];

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
  const segments = window.PF.holdings.map((h, i) => ({
    name: (window.API.NAV_CACHE[h.code] && window.API.NAV_CACHE[h.code].name) || h.code,
    code: h.code,
    value: getHoldingMarketValue(h),
    color: DONUT_COLORS[i % DONUT_COLORS.length]
  }));

  const total = getTotalAssets();

  if (window.PF.cash > 0) {
    segments.push({ name: '可用现金', code: 'CASH', value: window.PF.cash, color: '#94a3b8' });
  }

  // 清空 & 绘制
  ctx.clearRect(0, 0, size, size);

  if (segments.length === 0 || total <= 0) {
    ctx.fillStyle = c.textSecondary;
    ctx.font = '14px -apple-system, "PingFang SC", sans-serif';
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
      ctx.strokeStyle = isDark() ? '#1e293b' : '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    startAngle += slice;
  });

  // 中心文字
  ctx.fillStyle = c.textPrimary;
  ctx.font = 'bold 15px -apple-system, "PingFang SC", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('总资产', cx, cy - 4);
  ctx.font = 'bold 12px -apple-system, "PingFang SC", sans-serif';
  const totalStr = total >= 10000
    ? '¥' + (total / 10000).toFixed(2) + '万'
    : '¥' + total.toFixed(2);
  ctx.fillText(totalStr, cx, cy + 18);

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
        <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${seg.code === 'CASH' ? '💵 现金' : seg.name}</span>
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
