/**
 * theme.js — 多主题管理模块
 *
 * 4 种主题：light（亮色/Apple 风·默认）、dark（暗色/科技风）、
 *          warm（暖色/护眼）、auto（自动跟随系统）
 *
 * 通过 document.body.setAttribute('data-theme', name) 切换，
 * 选择持久化到 localStorage。
 */

const THEME_KEY = 'fund_theme_v2';
const THEME_NAMES = ['light', 'dark', 'warm', 'auto'];

let systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
let currentTheme = 'light';

// ===========================
//  初始化
// ===========================

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved && THEME_NAMES.includes(saved)) {
    applyTheme(saved);
  } else {
    applyTheme('light'); // 默认亮色
  }

  // 监听系统主题变化（仅 auto 模式下生效）
  systemDarkQuery.addEventListener('change', onSystemThemeChange);
}

// ===========================
//  切换主题
// ===========================

function switchTheme(name) {
  if (!THEME_NAMES.includes(name)) return;
  localStorage.setItem(THEME_KEY, name);
  applyTheme(name);
}

function applyTheme(name) {
  currentTheme = name;
  if (name === 'auto') {
    document.body.setAttribute('data-theme', systemDarkQuery.matches ? 'dark' : 'light');
  } else {
    document.body.setAttribute('data-theme', name);
  }

  // 通知图表重新渲染
  if (typeof renderAllCharts === 'function') {
    setTimeout(renderAllCharts, 150);
  }
}

function onSystemThemeChange(e) {
  if (currentTheme === 'auto') {
    document.body.setAttribute('data-theme', e.matches ? 'dark' : 'light');
    if (typeof renderAllCharts === 'function') {
      setTimeout(renderAllCharts, 150);
    }
  }
}

// ===========================
//  查询
// ===========================

function getCurrentTheme() {
  return currentTheme;
}

/** 判断当前实际显示是否为暗色背景 */
function isEffectivelyDark() {
  return document.body.getAttribute('data-theme') === 'dark';
}

function getThemeNames() {
  return THEME_NAMES;
}

// ===========================
//  UI：更新主题选择按钮状态
// ===========================

function updateThemePickerUI() {
  document.querySelectorAll('.theme-btn').forEach(function(btn) {
    var name = btn.getAttribute('data-theme-name');
    btn.classList.toggle('active', name === currentTheme);
  });
}

// ===========================
//  暴露到全局
// ===========================

window.Theme = {
  init: initTheme,
  switchTo: switchTheme,
  get: getCurrentTheme,
  isDark: isEffectivelyDark,
  names: getThemeNames,
};
window.updateThemePickerUI = updateThemePickerUI;
