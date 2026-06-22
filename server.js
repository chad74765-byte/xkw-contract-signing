/**
 * 学科网 CCM 电子签合同 — 签约链接查询服务
 *
 * 安全设计:
 * - 前端只能拿到一次性 token，无法直接获取签约链接
 * - token 5 分钟过期，使用后立即销毁
 * - 后端通过 302 重定向到真实签约地址
 * - 支持用户名格式校验、账户限制、简单限流
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── 配置 ─────────────────────────────────────────────────

const PORT = 3456;
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5分钟

// ─── 合同数据 (生产环境应放在数据库) ─────────────────────

const contracts = new Map([
  ['xkw_054877889', {
    contractId: '115530',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=jwpUDPG7Jp73ctOPYYFwwA',
    createdAt: '2026-06-15 16:23',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['15521262963', {
    contractId: '115531',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=1xBWO5_a07j72_f5K490og',
    createdAt: '2026-06-15 16:36',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['fei890626', {
    contractId: '115532',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=6ytFS4V-aXEzNXbYoBjIuA',
    createdAt: '2026-06-15 16:38',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_087268940', {
    contractId: '115533',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=zE-jl9g5JNkHcuEcp23SoQ',
    createdAt: '2026-06-15 16:41',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  // ── 2026-06-17 ──
  ['xkw_087925624', {
    contractId: '115598',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=7hQGUMap8y0Pu3UdX8vCw',
    createdAt: '2026-06-17 15:02',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_053288385', {
    contractId: '115599',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=SdLCceTTPEiTeoC2eLmtCw',
    createdAt: '2026-06-17 15:03',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  // ── 2026-06-18 ──
  ['xkw_087744042', {
    contractId: '115631',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=8qaITEv-zTL4eiugDK2ApA',
    createdAt: '2026-06-18 09:51',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_087732981', {
    contractId: '115633',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=xVy9o9LrWneTRY2fNo9aVQ',
    createdAt: '2026-06-18 09:59',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_087994052', {
    contractId: '115637',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=qIUrDqPn4QcwL-IaC9p-hQ',
    createdAt: '2026-06-18 10:46',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  // ── 2026-06-22 (batch 1) ──
  ['xkw_087827224', {
    contractId: '115665',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=CBw39a_q8lWhiCkOD7yS3w',
    createdAt: '2026-06-22 09:33',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_088086553', {
    contractId: '115666',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=96hkijCimzIcvpay7idYbg',
    createdAt: '2026-06-22 09:39',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  // ── 2026-06-22 (batch 2 — 23 users) ──
  ['xkw_078385905', {
    contractId: '115671',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=oVajgxzUV93PM1bpD6oqww',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_082451774', {
    contractId: '115672',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=85PyOLR5nZyNt0dnOXFhQw',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['tiefengzheng', {
    contractId: '115673',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=hnphPIksZQY8lLS0tw8l1Q',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['hysh13579', {
    contractId: '115674',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=k59PwbLHf7Q6SDxm5TdaTg',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_087924645', {
    contractId: '115675',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=lunIqOJEQIBJi5i3cFuxLQ',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_087979392', {
    contractId: '115676',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=t3Ou6YSOLgT-sVsuHhekjg',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_087940452', {
    contractId: '115677',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=XPjnbFhpbfPNZZMuWUZJYw',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_078428030', {
    contractId: '115679',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=lNDnn7zBNtCKo5Gf11k6dA',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['qwpoi', {
    contractId: '115680',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=OPBvKuLBijbvnaNbchBUUQ',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_087956646', {
    contractId: '115681',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=Q7IZmxY2sDHdVH3HKrZIqA',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['Yqn920416', {
    contractId: '115682',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=jjMvcNegL38AVr6Fnkl91A',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_060891086', {
    contractId: '115683',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=5rzEPWyAdHjJ88t1C4pScw',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_075880297', {
    contractId: '115684',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=x1uGrItNGg11U-eM6-Z-uQ',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_074991329', {
    contractId: '115685',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=PZwbDcc-VLbaSoRvuCv5lQ',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['hhhh082', {
    contractId: '115686',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=84Ra5MdgTh-OxB1gZZSO8g',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_086937520', {
    contractId: '115687',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=6aBWa21mRr2b9416dp2jsQ',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_054106244', {
    contractId: '115688',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=mofgznSmCn--C1yaK7r8Hw',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_066137490', {
    contractId: '115689',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=On09kSfAL4lZLUSFTWwXGA',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_075466916', {
    contractId: '115690',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=FAwpBP8ki99VdqcXuuCICg',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_088085299', {
    contractId: '115691',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=vfGZW5nB-XxZ3W8dqTunyg',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_070851081', {
    contractId: '115692',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=toRzw5Fnb_Rvp6xWgXArtw',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_048543665', {
    contractId: '115693',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=QP3FqID3SaDJilqN8Qzs4g',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }],
  ['xkw_078254783', {
    contractId: '115694',
    signingUrl: 'https://esign.xkw.com/mobile/contract-sign?id=9SQ64c98ODXlU4LkvLwz0Q',
    createdAt: '2026-06-22',
    template: '题库-委托加工v24.11',
    agent: '车悦'
  }]
]);

// ─── 令牌存储 (内存) ─────────────────────────────────────

const tokenStore = new Map(); // token → { username, signingUrl, createdAt, used }

// 定期清理过期 token
setInterval(() => {
  const now = Date.now();
  for (const [token, entry] of tokenStore) {
    if (now - entry.createdAt > TOKEN_TTL_MS) {
      tokenStore.delete(token);
    }
  }
}, 60 * 1000);

// ─── 辅助函数 ─────────────────────────────────────────────

function generateToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseQuery(url) {
  const idx = url.indexOf('?');
  if (idx === -1) return {};
  const query = {};
  const search = url.slice(idx + 1);
  for (const pair of search.split('&')) {
    const [key, val] = pair.split('=');
    query[decodeURIComponent(key)] = decodeURIComponent(val || '');
  }
  return query;
}

// 简单限流: IP → { count, resetAt }
const ratelimit = new Map();
const RATE_LIMIT_MAX = 10;      // 10次
const RATE_LIMIT_WINDOW = 60000; // 每分钟

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = ratelimit.get(ip);
  if (!entry || now > entry.resetAt) {
    ratelimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─── 用户名校验 ───────────────────────────────────────────

function validateUsername(username) {
  if (!username || typeof username !== 'string') {
    return { valid: false, message: '请输入用户名' };
  }
  const trimmed = username.trim();
  if (trimmed.length === 0) {
    return { valid: false, message: '用户名不能为空' };
  }
  if (trimmed.length > 64) {
    return { valid: false, message: '用户名长度不能超过64个字符' };
  }
  // 允许: 字母、数字、下划线、连字符、中文
  if (!/^[a-zA-Z0-9_\-\u4e00-\u9fa5]+$/.test(trimmed)) {
    return { valid: false, message: '用户名包含非法字符（仅支持字母、数字、下划线、连字符、中文）' };
  }
  return { valid: true, username: trimmed };
}

// ─── 静态文件服务 ─────────────────────────────────────────

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      res.writeHead(404);
      res.end('Not Found');
    } else {
      res.writeHead(500);
      res.end('Internal Server Error');
    }
  }
}

// ─── 路由处理 ─────────────────────────────────────────────

function handleRequest(req, res) {
  const clientIP = req.socket.remoteAddress || 'unknown';
  const url = req.url;
  const method = req.method;

  // CORS 预检
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const pathname = url.split('?')[0];

  // ── API: 查询合同 ──────────────────────────────────
  if (pathname === '/api/contract/lookup' && method === 'GET') {
    // 限流检查
    if (!checkRateLimit(clientIP)) {
      sendJSON(res, 429, {
        success: false,
        error: '请求过于频繁，请稍后再试'
      });
      return;
    }

    const query = parseQuery(url);
    const rawUsername = query.username || '';

    // 1. 校验用户名
    const validation = validateUsername(rawUsername);
    if (!validation.valid) {
      sendJSON(res, 400, {
        success: false,
        error: validation.message
      });
      return;
    }

    const username = validation.username;

    // 2. 查询合同
    const contract = contracts.get(username);
    if (!contract) {
      // 给出一些建议（模糊匹配提示）
      const suggestions = [];
      for (const key of contracts.keys()) {
        if (key.toLowerCase().includes(username.toLowerCase()) ||
            username.toLowerCase().includes(key.toLowerCase())) {
          suggestions.push(key);
        }
      }

      sendJSON(res, 404, {
        success: false,
        error: '未找到该用户名对应的签约合同',
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        hint: suggestions.length > 0
          ? '您是否想查询以下用户？'
          : '请确认用户名是否正确，或联系管理员确认合同是否已创建'
      });
      return;
    }

    // 3. 生成一次性令牌（不直接返回真实链接）
    const token = generateToken();
    tokenStore.set(token, {
      username,
      signingUrl: contract.signingUrl,
      createdAt: Date.now(),
      used: false
    });

    // 4. 返回成功（只返回合同信息 + token，不暴露真实链接）
    sendJSON(res, 200, {
      success: true,
      data: {
        username,
        contractId: contract.contractId,
        template: contract.template,
        agent: contract.agent,
        createdAt: contract.createdAt,
        redirectToken: token
      }
    });
    return;
  }

  // ── API: 安全跳转 ──────────────────────────────────
  if (pathname === '/api/contract/redirect' && method === 'GET') {
    const query = parseQuery(url);
    const token = query.token || '';

    if (!token) {
      sendJSON(res, 400, { success: false, error: '缺少令牌参数' });
      return;
    }

    const entry = tokenStore.get(token);

    // 令牌不存在
    if (!entry) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>链接已失效</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5}.card{background:#fff;padding:48px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;max-width:420px}.icon{font-size:64px;margin-bottom:16px}h2{color:#e74c3c;margin:0 0 12px}p{color:#666;margin:0 0 8px;line-height:1.6}a{color:#1890ff}</style>
</head><body><div class="card"><div class="icon">⏰</div><h2>链接已失效</h2><p>该签约链接已过期或被使用过，请重新查询获取新的链接。</p><p style="font-size:13px;color:#999">令牌有效期为 5 分钟，且仅可使用一次</p></div></body></html>`);
      return;
    }

    // 令牌已使用
    if (entry.used) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>链接已使用</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5}.card{background:#fff;padding:48px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;max-width:420px}.icon{font-size:64px;margin-bottom:16px}h2{color:#f39c12;margin:0 0 12px}p{color:#666;margin:0 0 8px;line-height:1.6}a{color:#1890ff}</style>
</head><body><div class="card"><div class="icon">🔒</div><h2>链接已被使用</h2><p>该签约链接已经被使用过。出于安全考虑，请重新查询获取新的链接。</p></div></body></html>`);
      return;
    }

    // 令牌过期
    if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
      tokenStore.delete(token);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>链接已过期</title>
<style>body{font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f5f5f5}.card{background:#fff;padding:48px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);text-align:center;max-width:420px}.icon{font-size:64px;margin-bottom:16px}h2{color:#e74c3c;margin:0 0 12px}p{color:#666;margin:0 0 8px;line-height:1.6}a{color:#1890ff}</style>
</head><body><div class="card"><div class="icon">⏰</div><h2>链接已过期</h2><p>该签约链接已过期（有效期 5 分钟），请返回重新查询获取新的链接。</p></div></body></html>`);
      return;
    }

    // 标记为已使用（一次性）
    entry.used = true;

    // 302 跳转到真实签约链接
    res.writeHead(302, {
      'Location': entry.signingUrl,
      'Cache-Control': 'no-store, no-cache, must-revalidate'
    });
    res.end();
    return;
  }

  // ── 静态文件 ───────────────────────────────────────
  if (pathname === '/' || pathname === '') {
    serveStatic(res, path.join(__dirname, 'public', 'index.html'));
    return;
  }
  serveStatic(res, path.join(__dirname, 'public', pathname));
}

// ─── 启动服务器 ───────────────────────────────────────────

const server = http.createServer(handleRequest);

server.listen(PORT, () => {
  console.log(`\n  📋 学科网电子签合同查询服务`);
  console.log(`  ────────────────────────────────`);
  console.log(`  👉 本地地址: http://localhost:${PORT}`);
  console.log(`  🔒 安全模式: Token 代理（链接不暴露到前端）`);
  console.log(`  ⏱️  Token TTL: ${TOKEN_TTL_MS / 1000}s`);
  console.log(`  📊 已加载 ${contracts.size} 份合同\n`);
});
