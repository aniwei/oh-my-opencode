"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTokenAuthMiddleware = createTokenAuthMiddleware;
function resolveExpectedToken(options) {
    if (options.token) {
        return options.token;
    }
    return process.env.VITAMIN_WEB_UI_TOKEN;
}
function parseBearerToken(header) {
    if (!header) {
        return null;
    }
    var _a = header.split(' '), scheme = _a[0], token = _a[1];
    if ((scheme === null || scheme === void 0 ? void 0 : scheme.toLowerCase()) !== 'bearer' || !token) {
        return null;
    }
    return token;
}
function createTokenAuthMiddleware(options) {
    if (options === void 0) { options = {}; }
    return function (req, res, next) {
        if (options.enabled === false) {
            next();
            return;
        }
        var expectedToken = resolveExpectedToken(options);
        if (!expectedToken) {
            next();
            return;
        }
        var actualToken = parseBearerToken(req.headers.authorization);
        if (!actualToken || actualToken !== expectedToken) {
            res.status(401).json({ error: 'Unauthorized' });
            return;
        }
        next();
    };
}
