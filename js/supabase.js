/**
 * supabase.js — Supabase 好友系统模块
 *
 * 依赖：store.js（window.PF）、api.js（window.API.NAV_CACHE）
 * 需要：Supabase JS SDK v2（CDN 加载，挂载到 window.supabase）
 *
 * 提供：
 * - 匿名登录 / 昵称管理
 * - 房间创建 / 加入 / 离开
 * - 持仓快照同步
 * - 排行榜查询
 * - 好友持仓查看
 * - 房间成员变动实时订阅
 */

// ===========================
//  配置（创建 Supabase 项目后替换）
// ===========================

const SB_CONFIG = {
  url: 'https://kcfqjyaltfkxdzzqekwt.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjZnFqeWFsdGZreGR6enFla3d0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NDMwMjgsImV4cCI6MjA5NjAxOTAyOH0.PlNCBPolZ_1k63cwmedQYJCQsYtxYEFV2HDGkJK36mM',
};

// ===========================
//  初始化
// ===========================

let sb = null;                    // Supabase 客户端实例
let currentUser = null;           // { id, username }
let currentRoom = null;           // { id, invite_code, name }
let realtimeChannel = null;       // 当前房间的实时订阅

/**
 * 启动 Supabase，完成匿名登录，确保 profiles 行存在
 * 在 app.js 初始化阶段调用
 */
async function supabaseInit() {
  if (!window.supabase) {
    console.warn('Supabase SDK 未加载，好友功能不可用');
    return null;
  }

  sb = window.supabase.createClient(SB_CONFIG.url, SB_CONFIG.anonKey);

  // 1. 检查是否已有会话
  let { data: { session } } = await sb.auth.getSession();

  // 2. 没有会话 → 匿名登录
  if (!session) {
    const { data, error } = await sb.auth.signInAnonymously();
    if (error) {
      console.warn('Supabase 匿名登录失败:', error.message, '好友功能不可用');
      return null;
    }
    session = data.session;
  }

  const userId = session.user.id;
  console.log('Supabase 已连接, uid:', userId.slice(0, 8) + '…');

  // 3. 确保 profiles 行存在
  const { data: profile } = await sb
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) {
    await sb.from('profiles').insert({ id: userId, username: '' });
    currentUser = { id: userId, username: '' };
  } else {
    currentUser = { id: userId, username: profile.username || '' };
  }

  // 4. 检查是否已在房间中
  const { data: membership } = await sb
    .from('room_members')
    .select('room_id, rooms(id, invite_code, name)')
    .eq('user_id', userId)
    .maybeSingle();

  if (membership && membership.rooms) {
    currentRoom = {
      id: membership.rooms.id,
      invite_code: membership.rooms.invite_code,
      name: membership.rooms.name,
    };
  }

  return currentUser;
}

// ===========================
//  昵称
// ===========================

async function setMyUsername(name) {
  if (!sb || !currentUser) return;
  const trimmed = name.trim().slice(0, 12); // 最多 12 字
  if (!trimmed) return;

  await sb.from('profiles').update({ username: trimmed, updated_at: new Date() }).eq('id', currentUser.id);
  currentUser.username = trimmed;

  // 如果已在房间，更新快照中的用户名
  if (currentRoom) {
    await sb.from('portfolio_snapshots')
      .update({ username: trimmed })
      .eq('user_id', currentUser.id)
      .eq('room_id', currentRoom.id);
  }
}

function getMyUsername() {
  return currentUser ? currentUser.username : '';
}

function getMyUserId() {
  return currentUser ? currentUser.id : null;
}

// ===========================
//  房间操作
// ===========================

/** 生成 6 位易读邀请码（不含 0/O/1/I/L） */
function generateInviteCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** 创建房间 */
async function createRoom(name) {
  if (!sb || !currentUser) return { error: '未连接到服务器' };

  const inviteCode = generateInviteCode();

  const { data: room, error } = await sb
    .from('rooms')
    .insert({
      invite_code: inviteCode,
      name: name || '投资好友房间',
      created_by: currentUser.id,
      member_count: 1,
    })
    .select()
    .single();

  if (error) {
    // 邀请码碰撞（极小概率），重试一次
    if (error.message.includes('invite_code')) {
      return createRoom(name);
    }
    return { error: '创建房间失败: ' + error.message };
  }

  // 将自己加入房间
  await sb.from('room_members').insert({ room_id: room.id, user_id: currentUser.id });

  currentRoom = { id: room.id, invite_code: room.invite_code, name: room.name };

  // 推送初始快照
  await syncPortfolioToRoom();

  return { room: currentRoom };
}

/** 通过邀请码加入房间 */
async function joinRoom(inviteCode) {
  if (!sb || !currentUser) return { error: '未连接到服务器' };

  const code = inviteCode.trim().toUpperCase();

  // 查找房间
  const { data: room, error } = await sb
    .from('rooms')
    .select('*')
    .eq('invite_code', code)
    .maybeSingle();

  if (error || !room) return { error: '房间不存在，请检查邀请码' };

  // 检查是否已在房间
  const { data: existing } = await sb
    .from('room_members')
    .select('*')
    .eq('room_id', room.id)
    .eq('user_id', currentUser.id)
    .maybeSingle();

  if (existing) {
    currentRoom = { id: room.id, invite_code: room.invite_code, name: room.name };
    return { room: currentRoom, alreadyIn: true };
  }

  // 加入
  const { error: joinErr } = await sb
    .from('room_members')
    .insert({ room_id: room.id, user_id: currentUser.id });

  if (joinErr) return { error: '加入失败: ' + joinErr.message };

  currentRoom = { id: room.id, invite_code: room.invite_code, name: room.name };

  // 推送初始快照
  await syncPortfolioToRoom();

  // 如有实时订阅，触发刷新
  if (realtimeChannel) {
    setTimeout(() => fetchRoomMembers(currentRoom.id), 500);
  }

  return { room: currentRoom };
}

/** 离开当前房间 */
async function leaveRoom() {
  if (!sb || !currentUser || !currentRoom) return { error: '你不在任何房间中' };

  // 删除快照
  await sb.from('portfolio_snapshots')
    .delete()
    .eq('user_id', currentUser.id)
    .eq('room_id', currentRoom.id);

  // 离开
  await sb.from('room_members')
    .delete()
    .eq('room_id', currentRoom.id)
    .eq('user_id', currentUser.id);

  unsubscribeRoomRealtime();
  currentRoom = null;
  return { success: true };
}

function isInRoom() {
  return !!currentRoom;
}

function getCurrentRoom() {
  return currentRoom;
}

// ===========================
//  持仓同步
// ===========================

/** 将当前 window.PF 推送到 Supabase */
async function syncPortfolioToRoom() {
  if (!sb || !currentUser || !currentRoom) return;

  // 构造携带净值数据的持仓快照
  const holdingsData = window.PF.holdings.map(h => {
    const cache = window.API ? window.API.NAV_CACHE : {};
    const fd = cache[h.code];
    const nav = fd ? (parseFloat(fd.gsz) || parseFloat(fd.dwjz)) : h.costNav;
    const name = fd ? fd.name : h.code;
    const mv = h.shares * nav;
    const cost = h.shares * h.costNav;
    const pnl = mv - cost;
    const pnlPct = cost > 0 ? (pnl / cost * 100) : 0;
    return { code: h.code, name, shares: h.shares, costNav: h.costNav, nav, mv, pnl, pnlPct };
  });

  const totalMv = holdingsData.reduce((s, h) => s + h.mv, 0);
  const totalCost = holdingsData.reduce((s, h) => s + h.shares * h.costNav, 0);
  const totalPnl = totalMv - totalCost;
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost * 100) : 0;

  // upsert: 按 (user_id, room_id) 主键去重
  await sb.from('portfolio_snapshots').upsert({
    user_id: currentUser.id,
    room_id: currentRoom.id,
    username: currentUser.username || '无名玩家',
    cash: window.PF.cash,
    total_market_value: totalMv,
    total_cost: totalCost,
    total_pnl: totalPnl,
    total_pnl_pct: Math.round(totalPnlPct * 100) / 100,
    holdings_json: holdingsData,
    snapped_at: new Date().toISOString(),
  }, { onConflict: 'user_id,room_id' });
}

/** 供 store.js 调用的同步钩子 */
function onPortfolioChanged() {
  if (currentRoom) {
    syncPortfolioToRoom().catch(e => console.warn('同步快照失败:', e.message));
  }
}

// ===========================
//  排行榜 & 好友持仓
// ===========================

/** 获取房间排行榜（按累计收益率排序） */
async function getLeaderboard(roomId) {
  if (!sb) return [];
  const rid = roomId || (currentRoom ? currentRoom.id : null);
  if (!rid) return [];

  const { data } = await sb
    .from('portfolio_snapshots')
    .select('user_id, username, cash, total_market_value, total_cost, total_pnl, total_pnl_pct, snapped_at')
    .eq('room_id', rid)
    .order('total_pnl_pct', { ascending: false });

  return (data || []).map(row => ({
    ...row,
    total_assets: parseFloat(row.cash) + parseFloat(row.total_market_value),
    isMe: row.user_id === (currentUser ? currentUser.id : null),
  }));
}

/** 获取某位好友的完整持仓 */
async function getFriendPortfolio(userId, roomId) {
  if (!sb) return null;
  const rid = roomId || (currentRoom ? currentRoom.id : null);
  if (!rid) return null;

  const { data } = await sb
    .from('portfolio_snapshots')
    .select('username, holdings_json, snapped_at')
    .eq('user_id', userId)
    .eq('room_id', rid)
    .maybeSingle();

  return data || null;
}

/** 获取房间成员列表 */
async function fetchRoomMembers(roomId) {
  if (!sb) return [];
  const rid = roomId || (currentRoom ? currentRoom.id : null);
  if (!rid) return [];

  const { data } = await sb
    .from('room_members')
    .select('user_id, profiles(username)')
    .eq('room_id', rid);

  return (data || []).map(row => ({
    user_id: row.user_id,
    username: row.profiles ? row.profiles.username : '',
    isMe: row.user_id === (currentUser ? currentUser.id : null),
  }));
}

// ===========================
//  实时订阅
// ===========================

/** 订阅房间成员变动（有人加入/离开时触发回调） */
function subscribeRoomRealtime(roomId, onMemberChange) {
  if (!sb || !currentUser) return;
  const rid = roomId || (currentRoom ? currentRoom.id : null);
  if (!rid) return;

  unsubscribeRoomRealtime();

  realtimeChannel = sb
    .channel('room-' + rid)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'room_members',
      filter: 'room_id=eq.' + rid,
    }, (payload) => {
      if (onMemberChange) onMemberChange(payload);
    })
    .subscribe();
}

function unsubscribeRoomRealtime() {
  if (realtimeChannel) {
    try { sb.removeChannel(realtimeChannel); } catch (e) { /* ignore */ }
    realtimeChannel = null;
  }
}

// ===========================
//  暴露到全局
// ===========================
window.SB = {
  init: supabaseInit,
  setUsername: setMyUsername,
  getUsername: getMyUsername,
  getUserId: getMyUserId,
  createRoom,
  joinRoom,
  leaveRoom,
  isInRoom,
  getCurrentRoom,
  syncPortfolio: syncPortfolioToRoom,
  onPortfolioChanged,
  getLeaderboard,
  getFriendPortfolio,
  fetchRoomMembers,
  subscribeRoomRealtime,
  unsubscribeRoomRealtime,
};
