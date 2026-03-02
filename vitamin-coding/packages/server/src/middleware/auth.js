"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = exports.createTokenAuthMiddleware = void 0;
var token_auth_1 = require("../auth/token-auth");
Object.defineProperty(exports, "createTokenAuthMiddleware", { enumerable: true, get: function () { return token_auth_1.createTokenAuthMiddleware; } });
exports.requireAuth = (0, token_auth_1.createTokenAuthMiddleware)();
