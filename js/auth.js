/**
 * auth.js — 本地登录/注册模块
 *
 * 提供简单的手机号+密码本地认证，头像选择，自动登录。
 * 数据存储在 localStorage，密码使用 SHA-256 哈希。
 * 依赖：store.js（window.PF 需先初始化）
 */

// ===========================
//  常量
// ===========================

const AUTH_KEY = 'fund_user_auth';
const AVATAR_OPTIONS = ['🐂', '🐯', '🐰', '🐲', '🐴', '🐵', '🐷', '🐸', '🦊', '🐼',
  '🐨', '🐧', '🐤', '🦁', '🐮', '🐻', '🐶', '🐱', '🐭', '🐹',
  '🐰', '🦄', '🐝', '🐞', '🦋', '🐌', '🐢', '🦖', '🐳', '🦈',
  '🐊', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦌', '🐐', '🐑'];

// ===========================
//  状态
// ===========================

let authUser = null;  // { phone, username, avatar }

// ===========================
//  密码哈希 (SHA-256)
// ===========================

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'fund_sim_salt');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ===========================
//  注册
// ===========================

async function register(phone, password, username, avatar) {
  const phoneReg = /^1[3-9]\d{9}$/;
  if (!phoneReg.test(phone)) return { error: '请输入正确的手机号' };
  if (password.length < 6) return { error: '密码至少 6 位' };
  if (!username.trim()) return { error: '请输入昵称' };

  // 检查手机号是否已注册
  const existing = getAuthData();
  if (existing && existing.phone === phone) {
    return { error: '该手机号已注册，请直接登录' };
  }

  const passwordHash = await hashPassword(password);
  const authData = {
    phone,
    passwordHash,
    username: username.trim().slice(0, 12),
    avatar: avatar || '🐂',
    autoLogin: true,
  };

  localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
  authUser = { phone: authData.phone, username: authData.username, avatar: authData.avatar };
  return { success: true, user: authUser };
}

// ===========================
//  登录
// ===========================

async function login(phone, password, remember) {
  const authData = getAuthData();
  if (!authData) return { error: '未注册，请先创建账号' };
  if (authData.phone !== phone) return { error: '手机号未注册' };

  const passwordHash = await hashPassword(password);
  if (authData.passwordHash !== passwordHash) return { error: '密码错误' };

  // 更新自动登录标记
  authData.autoLogin = !!remember;
  localStorage.setItem(AUTH_KEY, JSON.stringify(authData));

  authUser = { phone: authData.phone, username: authData.username, avatar: authData.avatar };
  return { success: true, user: authUser };
}

// ===========================
//  自动登录
// ===========================

async function tryAutoLogin() {
  const authData = getAuthData();
  if (!authData || !authData.autoLogin) return null;

  authUser = { phone: authData.phone, username: authData.username, avatar: authData.avatar };
  return authUser;
}

// ===========================
//  退出登录
// ===========================

function logout() {
  const authData = getAuthData();
  if (authData) {
    authData.autoLogin = false;
    localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
  }
  authUser = null;
}

// ===========================
//  工具
// ===========================

function getAuthData() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function isLoggedIn() {
  return !!authUser;
}

function getCurrentUser() {
  return authUser;
}

// ===========================
//  同步用户名到 Supabase
// ===========================

function syncUsernameToSupabase() {
  if (authUser && window.SB && window.SB.getUserId()) {
    window.SB.setUsername(authUser.username);
  }
}

// ===========================
//  暴露到全局
// ===========================

window.Auth = {
  register,
  login,
  tryAutoLogin,
  logout,
  isLoggedIn,
  getCurrentUser,
  syncUsernameToSupabase,
  AVATAR_OPTIONS,
};

// ===========================
//  UI 交互（供 HTML onclick 调用）
// ===========================

let currentLoginTab = 'login';

function switchLoginTab(tab) {
  currentLoginTab = tab;
  document.getElementById('tab-login-btn').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register-btn').classList.toggle('active', tab === 'register');
  document.getElementById('login-form').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('reg-error').style.display = 'none';
}

async function handleLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('login-phone').value.trim();
  const password = document.getElementById('login-password').value;
  const remember = document.getElementById('login-remember').checked;
  const errEl = document.getElementById('login-error');

  const result = await window.Auth.login(phone, password, remember);
  if (result.error) {
    errEl.textContent = result.error;
    errEl.style.display = 'block';
    return false;
  }
  errEl.style.display = 'none';
  enterApp();
  return false;
}

async function handleRegister(e) {
  e.preventDefault();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const password2 = document.getElementById('reg-password2').value;
  const username = document.getElementById('reg-username').value.trim();
  const avatar = document.getElementById('reg-avatar').value;
  const errEl = document.getElementById('reg-error');

  if (password !== password2) {
    errEl.textContent = '两次密码不一致';
    errEl.style.display = 'block';
    return false;
  }

  const result = await window.Auth.register(phone, password, username, avatar);
  if (result.error) {
    errEl.textContent = result.error;
    errEl.style.display = 'block';
    return false;
  }
  errEl.style.display = 'none';
  enterApp();
  return false;
}

function enterApp() {
  document.body.classList.add('logged-in');
  // 同步用户名到 Supabase
  setTimeout(() => window.Auth.syncUsernameToSupabase(), 1000);
}

function doLogout() {
  window.Auth.logout();
  document.body.classList.remove('logged-in');
  // 重置为登录视图
  document.getElementById('auto-login-info').style.display = 'none';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('tab-login-btn').classList.add('active');
  document.getElementById('tab-register-btn').classList.remove('active');
  document.getElementById('login-phone').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('reg-error').style.display = 'none';
}

// 初始化头像选择器
function initAvatarGrid() {
  const grid = document.getElementById('avatar-grid');
  if (!grid) return;
  grid.innerHTML = window.Auth.AVATAR_OPTIONS.map(emoji =>
    `<button type="button" class="avatar-option ${emoji === '🐂' ? 'selected' : ''}"
       onclick="selectAvatar('${emoji}', this)">${emoji}</button>`
  ).join('');
}

function selectAvatar(emoji, btn) {
  document.getElementById('reg-avatar').value = emoji;
  document.querySelectorAll('.avatar-option').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
}

// 页面加载时初始化头像
initAvatarGrid();
