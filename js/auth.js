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
// AVATAR_COLORS 在 icons.js 中定义（var），此处直接引用
// 12 色调色板: #3B82F6, #EF4444, #10B981, #F59E0B, #8B5CF6,
//              #EC4899, #06B6D4, #F97316, #6366F1, #14B8A6,
//              #D946EF, #84CC16

// 将旧版 emoji 头像迁移为新版 {letter, color} 格式
function migrateAvatar(avatar, username, phone) {
  if (!avatar || typeof avatar !== 'string') return avatar;
  // 已经是新格式（JSON 对象）
  if (avatar.startsWith('{')) {
    try { return JSON.parse(avatar); } catch (e) { /* 继续迁移 */ }
  }
  // 旧版 emoji — 用法名首字+手机号哈希颜色
  var letter = (username || '?').charAt(0);
  var color = getAvatarColor(phone || 'default');
  return { letter: letter, color: color };
}

function defaultAvatar(username, phone) {
  return {
    letter: (username || '牛').charAt(0),
    color: getAvatarColor(phone || '00000000000')
  };
}

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
  var avatarData = avatar || defaultAvatar(username.trim(), phone);
  if (typeof avatarData === 'string') {
    try { avatarData = JSON.parse(avatarData); } catch (e) { avatarData = defaultAvatar(username.trim(), phone); }
  }
  const authData = {
    phone,
    passwordHash,
    username: username.trim().slice(0, 12),
    avatar: avatarData,
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

  // 迁徙旧版 emoji 头像到新版格式
  var avatar = migrateAvatar(authData.avatar, authData.username, authData.phone);
  if (JSON.stringify(avatar) !== JSON.stringify(authData.avatar)) {
    authData.avatar = avatar;
    localStorage.setItem(AUTH_KEY, JSON.stringify(authData));
  }

  authUser = { phone: authData.phone, username: authData.username, avatar: avatar };
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
  AVATAR_COLORS: window.AVATAR_COLORS,  // 引用 icons.js 中的全局变量
  defaultAvatar,
  renderAutoLoginAvatar,
};

// ===========================
//  UI 交互（供 HTML onclick 调用）
// ===========================

let currentLoginTab = 'login';

function switchLoginTab(tab) {
  currentLoginTab = tab;
  // 确保主卡片可见，自动登录卡片隐藏
  document.getElementById('auto-login-info').style.display = 'none';
  document.getElementById('login-main-card').style.display = '';
  document.getElementById('login-tabs').style.display = '';
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
  // 销毁登录页着色器（释放 GPU 资源）
  if (window.ShaderBG) {
    window.ShaderBG.destroy();
  }
  // 同步用户名到 Supabase
  setTimeout(function() { window.Auth.syncUsernameToSupabase(); }, 1000);
}

// 在自动登录卡片中渲染 SVG 头像
function renderAutoLoginAvatar(user) {
  var avatarEl = document.getElementById('auto-avatar');
  var nameEl = document.getElementById('auto-name');
  var phoneEl = document.getElementById('auto-phone');
  if (!avatarEl || !nameEl || !phoneEl) return;

  var avatar = user.avatar;
  if (!avatar || typeof avatar === 'string') {
    try { avatar = JSON.parse(avatar); } catch (e) { avatar = null; }
  }
  if (!avatar) { avatar = window.Auth.defaultAvatar(user.username, user.phone); }

  nameEl.textContent = user.username || '--';
  phoneEl.textContent = user.phone ? user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '--';
  avatarEl.innerHTML = iconAvatar(avatar.letter, avatar.color, '');
  avatarEl.style.cssText = '';
}

function doLogout() {
  window.Auth.logout();
  document.body.classList.remove('logged-in');
  // 重新初始化着色器背景
  if (window.ShaderBG) {
    window.ShaderBG.init(document.getElementById('shader-background'));
  }
  // 重置为登录视图
  document.getElementById('auto-login-info').style.display = 'none';
  document.getElementById('login-main-card').style.display = '';
  document.getElementById('login-tabs').style.display = '';
  document.getElementById('login-form').style.display = 'block';
  document.getElementById('register-form').style.display = 'none';
  document.getElementById('tab-login-btn').classList.add('active');
  document.getElementById('tab-register-btn').classList.remove('active');
  document.getElementById('login-phone').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').style.display = 'none';
  document.getElementById('reg-error').style.display = 'none';
}

// 初始化头像颜色选择器
function initAvatarGrid() {
  const grid = document.getElementById('avatar-grid');
  if (!grid) return;
  var defaultColor = window.Auth.AVATAR_COLORS[3]; // 金色 #F59E0B 作为默认
  grid.innerHTML = window.Auth.AVATAR_COLORS.map(function(color, i) {
    var isSelected = (i === 3) ? ' selected' : '';
    return '<button type="button" class="avatar-option' + isSelected + '" ' +
      'style="background:' + color + ';" ' +
      'onclick="selectAvatar(\'' + color + '\', this)" ' +
      'aria-label="选择头像颜色"></button>';
  }).join('');
  document.getElementById('reg-avatar').value = JSON.stringify({ letter: '?', color: defaultColor });
}

function selectAvatar(color, btn) {
  var username = document.getElementById('reg-username').value.trim();
  var letter = username ? username.charAt(0) : '?';
  var avatarData = JSON.stringify({ letter: letter, color: color });
  document.getElementById('reg-avatar').value = avatarData;
  document.querySelectorAll('.avatar-option').forEach(function(b) { b.classList.remove('selected'); });
  btn.classList.add('selected');
}

// 当昵称输入变化时同步更新头像首字母
document.addEventListener('DOMContentLoaded', function() {
  var usernameInput = document.getElementById('reg-username');
  if (usernameInput) {
    usernameInput.addEventListener('input', function() {
      var regAvatar = document.getElementById('reg-avatar');
      var current = regAvatar.value;
      if (!current || !current.startsWith('{')) return;
      try {
        var data = JSON.parse(current);
        data.letter = usernameInput.value.trim() ? usernameInput.value.trim().charAt(0) : '?';
        regAvatar.value = JSON.stringify(data);
      } catch (e) { /* ignore */ }
    });
  }
});

// 页面加载时初始化头像
initAvatarGrid();
