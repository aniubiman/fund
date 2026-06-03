/**
 * api.js — 基金数据接口层
 *
 * 提供两个核心 API：
 * 1. fetchFundNAV(code) — 获取单只基金实时净值估算 (天天基金 JSONP)
 * 2. searchFunds(keyword) — 按代码/名称搜索基金 (东方财富搜索接口 JSONP)
 *
 * 两个 API 都采用 JSONP 方式绕过跨域限制。
 * 因为 JSONP 依赖全局回调函数，同一时间只能有一个请求在执行，
 * 本模块内部维护一个请求队列确保顺序执行。
 */

// ===========================
//  JSONP 通用工具
// ===========================

/**
 * 通过动态创建 <script> 发起 JSONP 请求
 * @param {string} url - 请求 URL
 * @param {string} callbackName - 全局回调函数名，API 返回时会调用 window[callbackName](data)
 * @param {number} timeoutMs - 超时毫秒数
 * @returns {Promise<object>} 解析后的数据对象
 */
function jsonpRequest(url, callbackName, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) { settled = true; cleanup(); reject(new Error('请求超时')); }
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function (data) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    script.onerror = function () {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('网络请求失败'));
    };

    script.src = url;
    document.head.appendChild(script);
  });
}

// ===========================
//  API 1：基金净值估算
// ===========================

const NAV_CACHE = {};          // { [code]: { ...data, _ts: timestamp } }
const NAV_CACHE_TTL = 30000;   // 30 秒缓存

/**
 * 获取基金实时净值估算
 * API: fundgz.1234567.com.cn/js/{code}.js
 * 返回固定调用 jsonpgz({...})，所以 callbackName 固定为 "jsonpgz"
 *
 * @param {string} code - 6 位基金代码
 * @returns {Promise<object>} { fundcode, name, jzrq, dwjz, gsz, gszzl, gztime }
 */
function fetchFundNAV(code) {
  if (NAV_CACHE[code] && Date.now() - NAV_CACHE[code]._ts < NAV_CACHE_TTL) {
    return Promise.resolve(NAV_CACHE[code]);
  }

  const url = `https://fundgz.1234567.com.cn/js/${code}.js?rt=${Date.now()}`;

  return jsonpRequest(url, 'jsonpgz').then(data => {
    data._ts = Date.now();
    NAV_CACHE[code] = data;
    return data;
  });
}

// ===========================
//  API 2：基金搜索
// ===========================

let searchRequestId = 0;

/**
 * 按关键字搜索基金
 * API: fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx
 * 参数: m=1 (搜索模式), key=关键字
 * 返回 JSONP，callback 参数可指定回调名
 *
 * @param {string} keyword - 基金代码或名称关键字
 * @returns {Promise<Array<{code: string, name: string, type: string}>>}
 */
function searchFunds(keyword) {
  const trimmed = keyword.trim();
  if (!trimmed) return Promise.resolve([]);

  const id = ++searchRequestId;
  const callbackName = 'fundSearchCb_' + id;

  // 东方财富搜索接口
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx`
    + `?callback=${callbackName}&m=1&key=${encodeURIComponent(trimmed)}`;

  return jsonpRequest(url, callbackName, 5000).then(raw => {
    if (!raw || raw.ErrCode !== 0 || !Array.isArray(raw.Datas)) {
      return [];
    }
    // API 返回字段全大写: CODE, NAME, CATEGORYDESC
    return raw.Datas.map(item => ({
      code: item.CODE || item.Code || '',
      name: item.NAME || item.Name || '',
      type: item.CATEGORYDESC || item.Type || ''
    }));
  }).catch(async err => {
    console.warn('基金搜索 API 请求失败:', err.message);
    // 降级：如果输入是纯 6 位数字，尝试通过净值 API 验证
    if (/^\d{6}$/.test(trimmed)) {
      try {
        const data = await fetchFundNAV(trimmed);
        if (data && data.name) {
          return [{ code: data.fundcode || trimmed, name: data.name, type: '基金' }];
        }
      } catch (e2) { /* 静默失败 */ }
    }
    return [];
  });
}

// ===========================
//  API 3：批量获取净值
// ===========================

/**
 * 批量获取多只基金净值（顺序执行，因为共用 jsonpgz 回调）
 * @param {string[]} codes
 * @returns {Promise<object[]>}
 */
function fetchAllFundNAV(codes) {
  const results = [];
  const chain = (async () => {
    for (const code of codes) {
      try {
        const data = await fetchFundNAV(code);
        results.push(data);
      } catch (e) {
        console.warn(`获取基金 ${code} 净值失败: ${e.message}`);
      }
    }
  })();
  return chain.then(() => results);
}

/**
 * 获取当前持仓基金代码列表去重
 * @param {Array<{code: string}>} holdings
 * @returns {string[]}
 */
function getHoldingCodes(holdings) {
  return [...new Set(holdings.map(h => h.code))];
}

// 暴露到全局（供其他模块通过 window.API 访问）
window.API = {
  fetchFundNAV,
  searchFunds,
  fetchAllFundNAV,
  getHoldingCodes,
  NAV_CACHE,       // 共享缓存，其他模块可直接读取
};
