"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimit = rateLimit;
// A simple sliding window rate limiter
var requests = new Map();
function rateLimit(windowMs, maxRequests) {
    return function (req, res, next) {
        var _a, _b;
        var ip = (_b = (_a = req.ip) !== null && _a !== void 0 ? _a : req.socket.remoteAddress) !== null && _b !== void 0 ? _b : 'unknown';
        var now = Date.now();
        if (!requests.has(ip)) {
            requests.set(ip, []);
        }
        // Evict old timestamps
        var timestamps = requests.get(ip) || [];
        var windowStart = now - windowMs;
        var recent = timestamps.filter(function (ts) { return ts > windowStart; });
        if (recent.length >= maxRequests) {
            res.status(429).json({ error: 'Too many requests' });
            return;
        }
        recent.push(now);
        requests.set(ip, recent);
        next();
    };
}
