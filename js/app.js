/**
 * app.js — 应用入口，初始化与定时刷新
 *
 * 启动流程：
 * 1. 主题
 * 2. Supabase 初始化（匿名登录 + 房间信息）
 * 3. 拉取基金净值
 * 4. 首屏渲染
 * 5. 定时 NAV 刷新 (60s) + 定时快照同步 (5min)
 */
(async function init() {
  // 1. 主题
  loadTheme();
  const themeLabel = document.getElementById('theme-label');
  if (themeLabel) {
    themeLabel.textContent = document.body.getAttribute('data-theme') === 'dark'
      ? '☀️ 亮色模式' : '🌙 暗色模式';
  }

  // 2. Supabase 初始化（不阻塞主流程）
  const updateEl = document.getElementById('updateTime');
  if (updateEl) updateEl.textContent = '正在连接服务器…';

  const sbInit = window.SB ? window.SB.init() : Promise.resolve(null);
  sbInit.then(user => {
    if (user && window.SB.isInRoom()) {
      // 已在房间中，订阅成员变动
      const room = window.SB.getCurrentRoom();
      window.SB.subscribeRoomRealtime(room.id, (payload) => {
        const evt = payload.eventType;
        if (evt === 'INSERT') showToast('👋 有新朋友加入了房间！', 'info');
        if (evt === 'DELETE') showToast('👋 有人离开了房间', 'info');
        // 刷新成员列表和排行榜
        if (currentPage === 'friends') renderFriendsPage();
      });
      // 推送当前快照
      setTimeout(() => window.SB.syncPortfolio(), 2000);
    }
  }).catch(() => {});

  // 3. 拉取净值数据
  if (updateEl) updateEl.textContent = '正在获取实时数据…';
  const codes = window.API ? window.API.getHoldingCodes(window.PF.holdings) : [];

  if (codes.length > 0) {
    const results = await window.API.fetchAllFundNAV(codes);
    if (updateEl) {
      updateEl.textContent = results.length > 0
        ? `数据更新于 ${results[0].gztime || '--'}`
        : '数据获取失败，请检查网络';
    }
  } else {
    if (updateEl) updateEl.textContent = '暂无持仓，搜索基金开始交易吧';
  }

  // 4. 首屏渲染
  renderAll();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => renderAllCharts());
  });

  // 5. 定时：NAV 刷新 (60s)
  setInterval(async () => {
    const currentCodes = window.API ? window.API.getHoldingCodes(window.PF.holdings) : [];
    if (currentCodes.length === 0) return;
    await window.API.fetchAllFundNAV(currentCodes);
    renderAll();
    const el = document.getElementById('updateTime');
    if (el) {
      const allData = currentCodes.map(c => window.API.NAV_CACHE[c]).filter(Boolean);
      el.textContent = allData.length > 0
        ? `数据更新于 ${allData[0].gztime || '--'}（自动刷新）`
        : '刷新失败';
    }
  }, 60000);

  // 6. 定时：快照同步 (5min)
  setInterval(() => {
    if (window.SB && window.SB.isInRoom()) {
      window.SB.syncPortfolio();
    }
  }, 300000);
})();
