/**
 * icons.js — SVG 图标工具集
 *
 * 科技风简洁几何图标，stroke-based，24x24 viewBox
 * 每个函数返回内联 SVG HTML 字符串，颜色通过 currentColor 继承
 *
 * CSS 图标尺寸类：.icon-sm(14px) .icon-md(18px) .icon-lg(22px) .icon-xl(28px)
 */

// ===========================
//  工具函数
// ===========================

function makeIcon(cls, paths) {
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round">${paths}</svg>`;
}

// ===========================
//  导航 / Logo
// ===========================

function iconLogo(cls) {
  return makeIcon(cls,
    '<rect x="2" y="13" width="3" height="8" rx="0.5"/>' +
    '<rect x="7" y="9" width="3" height="12" rx="0.5"/>' +
    '<rect x="12" y="6" width="3" height="15" rx="0.5"/>' +
    '<rect x="17" y="3" width="3" height="18" rx="0.5"/>' +
    '<line x1="1" y1="21" x2="23" y2="21"/>');
}

function iconDashboard(cls) {
  return makeIcon(cls,
    '<rect x="3" y="3" width="7" height="7" rx="1"/>' +
    '<rect x="14" y="3" width="7" height="7" rx="1"/>' +
    '<rect x="3" y="14" width="7" height="7" rx="1"/>' +
    '<rect x="14" y="14" width="7" height="7" rx="1"/>');
}

function iconHoldings(cls) {
  return makeIcon(cls,
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>' +
    '<path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>');
}

function iconHistory(cls) {
  return makeIcon(cls,
    '<circle cx="12" cy="12" r="10"/>' +
    '<polyline points="12 6 12 12 16 14"/>');
}

// ===========================
//  统计卡片
// ===========================

function iconWallet(cls) {
  return makeIcon(cls,
    '<rect x="2" y="5" width="20" height="14" rx="2"/>' +
    '<path d="M16 12a2 2 0 1 0 0 4h4v-4z"/>');
}

function iconTrendUp(cls) {
  return makeIcon(cls,
    '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>' +
    '<polyline points="17 6 23 6 23 12"/>');
}

function iconCalendar(cls) {
  return makeIcon(cls,
    '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>' +
    '<line x1="16" y1="2" x2="16" y2="6"/>' +
    '<line x1="8" y1="2" x2="8" y2="6"/>' +
    '<line x1="3" y1="10" x2="21" y2="10"/>');
}

function iconCash(cls) {
  return makeIcon(cls,
    '<rect x="2" y="5" width="20" height="14" rx="2"/>' +
    '<circle cx="12" cy="12" r="2"/>' +
    '<line x1="6" y1="9" x2="6" y2="9.01"/>' +
    '<line x1="18" y1="9" x2="18" y2="9.01"/>');
}

// ===========================
//  操作按钮
// ===========================

function iconSearch(cls) {
  return makeIcon(cls,
    '<circle cx="11" cy="11" r="8"/>' +
    '<path d="M21 21l-4.35-4.35"/>');
}

function iconRefresh(cls) {
  return makeIcon(cls,
    '<polyline points="23 4 23 10 17 10"/>' +
    '<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>');
}

function iconPlus(cls) {
  return makeIcon(cls,
    '<line x1="12" y1="5" x2="12" y2="19"/>' +
    '<line x1="5" y1="12" x2="19" y2="12"/>');
}

function iconBuy(cls) {
  return makeIcon(cls,
    '<circle cx="12" cy="12" r="10"/>' +
    '<path d="M12 8v8M8 12h8"/>');
}

function iconSell(cls) {
  return makeIcon(cls,
    '<circle cx="12" cy="12" r="10"/>' +
    '<path d="M8 12h8"/>');
}

function iconCopy(cls) {
  return makeIcon(cls,
    '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>');
}

function iconTrash(cls) {
  return makeIcon(cls,
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>');
}

function iconClose(cls) {
  return makeIcon(cls,
    '<line x1="18" y1="6" x2="6" y2="18"/>' +
    '<line x1="6" y1="6" x2="18" y2="18"/>');
}

// ===========================
//  状态 / 通知
// ===========================

function iconCheck(cls) {
  return makeIcon(cls,
    '<polyline points="20 6 9 17 4 12"/>');
}

function iconConfetti(cls) {
  return makeIcon(cls,
    '<path d="M12 2l1.5 4.5L18 5l-3 3 2 4-5-1.5L7 12l2-4-3-3 4.5.5z"/>');
}

function iconWave(cls) {
  return makeIcon(cls,
    '<path d="M2 12h2M6 8h2M10 12h2M14 9h2M18 12h2M22 12h0"/>');
}

function iconEmpty(cls) {
  return makeIcon(cls,
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<line x1="3" y1="9" x2="21" y2="9"/>' +
    '<line x1="9" y1="21" x2="9" y2="9"/>');
}

// ===========================
//  好友/房间
// ===========================

function iconUsers(cls) {
  return makeIcon(cls,
    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>' +
    '<circle cx="9" cy="7" r="4"/>' +
    '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>' +
    '<path d="M16 3.13a4 4 0 0 1 0 7.75"/>');
}

function iconTarget(cls) {
  return makeIcon(cls,
    '<circle cx="12" cy="12" r="10"/>' +
    '<circle cx="12" cy="12" r="6"/>' +
    '<circle cx="12" cy="12" r="2"/>');
}

function iconHome(cls) {
  return makeIcon(cls,
    '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>' +
    '<polyline points="9 22 9 12 15 12 15 22"/>');
}

function iconLink(cls) {
  return makeIcon(cls,
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
    '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>');
}

function iconRocket(cls) {
  return makeIcon(cls,
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>' +
    '<path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>' +
    '<path d="M9 12H4l.5-2.5L9 9"/>' +
    '<path d="M15 12h5l-.5 2.5L15 15"/>');
}

function iconTrophy(cls) {
  return makeIcon(cls,
    '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>' +
    '<path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>' +
    '<path d="M4 22h16"/>' +
    '<path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>' +
    '<path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>' +
    '<path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>');
}

function iconUser(cls) {
  return makeIcon(cls,
    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
    '<circle cx="12" cy="7" r="4"/>');
}

function iconClipboard(cls) {
  return makeIcon(cls,
    '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>' +
    '<rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>');
}

function iconSparkle(cls) {
  return makeIcon(cls,
    '<path d="M12 2l2.5 6.5L21 9l-4.5 3.5L18 19l-6-3.5L6 19l1.5-6.5L3 9l6.5-.5z"/>');
}

// ===========================
//  图表 / 数据
// ===========================

function iconChartLine(cls) {
  return makeIcon(cls,
    '<polyline points="3 20 9 13 13 16 21 7"/>');
}

function iconTrendDown(cls) {
  return makeIcon(cls,
    '<polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/>' +
    '<polyline points="17 18 23 18 23 14"/>');
}

function iconPieChart(cls) {
  return makeIcon(cls,
    '<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>' +
    '<path d="M22 12A10 10 0 0 0 12 2v10z"/>');
}

function iconChartBar(cls) {
  return makeIcon(cls,
    '<line x1="1" y1="20" x2="23" y2="20"/>' +
    '<rect x="4" y="12" width="3" height="8" rx="0.5"/>' +
    '<rect x="9" y="7" width="3" height="13" rx="0.5"/>' +
    '<rect x="14" y="3" width="3" height="17" rx="0.5"/>' +
    '<rect x="19" y="9" width="3" height="11" rx="0.5"/>');
}

// ===========================
//  奖牌（排行榜）
// ===========================

function iconMedal(cls, rank) {
  var colors = { gold: '#fbbf24', silver: '#94a3b8', bronze: '#d97706' };
  var fill = colors[rank] || colors.silver;
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none"
    stroke="${fill}" stroke-width="1.5" stroke-linecap="round"
    stroke-linejoin="round">
    <circle cx="12" cy="8" r="6" fill="${fill}" fill-opacity="0.2"/>
    <circle cx="12" cy="8" r="6"/>
    <path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>
  </svg>`;
}

// ===========================
//  主题
// ===========================

function iconSun(cls) {
  return makeIcon(cls,
    '<circle cx="12" cy="12" r="5"/>' +
    '<line x1="12" y1="1" x2="12" y2="3"/>' +
    '<line x1="12" y1="21" x2="12" y2="23"/>' +
    '<line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>' +
    '<line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>' +
    '<line x1="1" y1="12" x2="3" y2="12"/>' +
    '<line x1="21" y1="12" x2="23" y2="12"/>' +
    '<line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>' +
    '<line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>');
}

function iconMoon(cls) {
  return makeIcon(cls,
    '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>');
}

// ===========================
//  SVG 头像生成器（替代 emoji）
// ===========================

var AVATAR_COLORS = [
  '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#06B6D4', '#F97316', '#6366F1', '#14B8A6',
  '#D946EF', '#84CC16'
];

function getAvatarColor(str) {
  var hash = 0;
  for (var i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function iconAvatar(initial, bgColor, cls) {
  return '<svg class="' + (cls || '') + '" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">' +
    '<circle cx="24" cy="24" r="24" fill="' + bgColor + '"/>' +
    '<text x="24" y="24" text-anchor="middle" dominant-baseline="central" ' +
    'fill="white" font-size="20" font-weight="600" ' +
    'font-family="-apple-system, \'PingFang SC\', \'Microsoft YaHei\', sans-serif">' + initial + '</text>' +
    '</svg>';
}

window.getAvatarColor = getAvatarColor;
window.iconAvatar = iconAvatar;

// ===========================
//  图标注入（data-icon 属性 → SVG）
// ===========================

function injectIcons() {
  var map = {
    logo: iconLogo, dashboard: iconDashboard, holdings: iconHoldings,
    history: iconHistory, wallet: iconWallet, trendup: iconTrendUp,
    calendar: iconCalendar, cash: iconCash, search: iconSearch,
    refresh: iconRefresh, plus: iconPlus, buy: iconBuy, sell: iconSell,
    copy: iconCopy, trash: iconTrash, close: iconClose, check: iconCheck,
    confetti: iconConfetti, wave: iconWave, empty: iconEmpty,
    users: iconUsers, target: iconTarget, home: iconHome, link: iconLink,
    rocket: iconRocket, trophy: iconTrophy, user: iconUser,
    clipboard: iconClipboard, sparkle: iconSparkle, chartline: iconChartLine,
    trenddown: iconTrendDown, piechart: iconPieChart, chartbar: iconChartBar,
    sun: iconSun, moon: iconMoon
  };

  document.querySelectorAll('[data-icon]').forEach(function(el) {
    var name = el.getAttribute('data-icon');
    var fn = map[name.toLowerCase()];
    if (fn) {
      var cls = el.className.match(/icon-\w+/);
      el.innerHTML = fn(cls ? cls[0] : '');
    }
  });
}
