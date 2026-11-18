// backend/src/middleware/timing.middleware.js
//
// Meranie času spracovania requestu.
//  • pridá hlavičku Server-Timing (vidno v DevTools → Network → Timing),
//  • stránky pomalšie než SLOW_REQUEST_MS (predvolene 800 ms) zaloguje,
//    aby sa dalo v `pm2 logs` zistiť, čo ešte brzdí.
const SLOW_MS = Number(process.env.SLOW_REQUEST_MS || 800);

module.exports = function timing(req, res, next) {
  const start = process.hrtime.bigint();
  const origWriteHead = res.writeHead;
  res.writeHead = function writeHead(...args) {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (!res.headersSent) {
      try { res.setHeader('Server-Timing', `app;dur=${ms.toFixed(1)}`); } catch (e) { /* ignore */ }
    }
    return origWriteHead.apply(this, args);
  };
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    if (ms >= SLOW_MS && !/^\/(css|js|branding)\//.test(req.path)) {
      console.warn(`[slow] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(0)} ms`);
    }
  });
  next();
};
