"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOAuthAuthMiddleware = createOAuthAuthMiddleware;
function createOAuthAuthMiddleware() {
    return function (req, _res, next) {
        var provider = req.headers['x-oauth-provider'];
        var userId = req.headers['x-oauth-user-id'];
        if ((provider === 'github' || provider === 'google')
            && typeof userId === 'string'
            && userId.length > 0) {
            ;
            req.oauthUser = {
                id: userId,
                provider: provider,
            };
        }
        next();
    };
}
