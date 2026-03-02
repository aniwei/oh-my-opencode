"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InspectorServer = void 0;
var path = require("node:path");
var node_fs_1 = require("node:fs");
var node_http_1 = require("node:http");
var express_1 = require("express");
var agents_1 = require("./api/agents");
var config_client_1 = require("./api/config-client");
var files_1 = require("./api/files");
var logs_1 = require("./api/logs");
var models_1 = require("./api/models");
var sessions_1 = require("./api/sessions");
var web_ui_1 = require("./api/web-ui");
var auth_1 = require("./middleware/auth");
var rate_limit_1 = require("./middleware/rate-limit");
var websocket_hub_1 = require("./websocket-hub");
var InspectorServer = /** @class */ (function () {
    function InspectorServer(options) {
        var _a;
        this.options = options;
        this.app = (0, express_1.default)();
        this.port = (_a = options.port) !== null && _a !== void 0 ? _a : 9229;
        this.httpServer = (0, node_http_1.createServer)(this.app);
        this.wsHub = new websocket_hub_1.WebSocketHub(this.httpServer);
        this.setupMiddleware();
        this.setupRoutes();
    }
    InspectorServer.prototype.setupMiddleware = function () {
        this.app.use(express_1.default.json());
        this.app.use((0, rate_limit_1.rateLimit)(60000, 1000)); // 1000 requests per minute
        this.app.use((0, auth_1.createTokenAuthMiddleware)(this.options.auth));
        // CORS
        this.app.use(function (req, res, next) {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            }
            else {
                next();
            }
        });
    };
    InspectorServer.prototype.setupRoutes = function () {
        // Inspector Frontend Serve
        this.app.use('/', express_1.default.static(new URL('../dist/inspector', import.meta.url).pathname));
        // Health check
        this.app.get('/api/health', function (_req, res) {
            res.json({ status: 'ok' });
        });
        // Log Replay API
        this.app.get('/api/logs', (0, logs_1.createLogReplayRoute)(this.options.logHub));
        // Log SSE Stream
        this.app.get('/api/logs/stream', (0, logs_1.createLogStreamRoute)(this.options.logHub));
        // Session and Agent APIs
        this.app.use('/api/sessions', (0, sessions_1.createSessionsRouter)(this.options.sessionManager));
        this.app.post('/api/sessions/:id/messages', (0, web_ui_1.createMessageEndpoint)({}));
        this.app.post('/api/sessions/:id/messages/:mid/stop', (0, web_ui_1.createStopEndpoint)({}));
        this.app.post('/api/sessions/:id/fork', (0, web_ui_1.createForkEndpoint)());
        this.app.use('/api/agents', (0, agents_1.createAgentsRouter)(this.options.agentRegistry));
        this.app.use('/api/files', (0, files_1.createFilesRouter)(this.options.fileStore));
        this.app.use('/api/models', (0, models_1.createModelsRouter)(this.options.modelRegistry));
        this.app.use('/api/config', (0, config_client_1.createClientConfigRouter)(this.options.configProvider));
        // Web UI 静态文件托管（检测 dist/web-ui 存在时挂载 /app）
        var webUiDistPath = path.resolve(new URL('../dist/web-ui', import.meta.url).pathname);
        if ((0, node_fs_1.existsSync)(webUiDistPath)) {
            this.app.use('/app', express_1.default.static(webUiDistPath));
            // SPA fallback — 所有 /app 子路径回退到 index.html
            this.app.get('/app/*', function (_req, res) {
                res.sendFile(path.join(webUiDistPath, 'index.html'));
            });
        }
    };
    InspectorServer.prototype.start = function () {
        return __awaiter(this, void 0, void 0, function () {
            var host;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                host = (_a = this.options.host) !== null && _a !== void 0 ? _a : '127.0.0.1';
                return [2 /*return*/, new Promise(function (resolve) {
                        _this.httpServer.listen(_this.port, host, function () {
                            resolve();
                        });
                    })];
            });
        });
    };
    InspectorServer.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                this.wsHub.close();
                return [2 /*return*/, new Promise(function (resolve, reject) {
                        _this.httpServer.close(function (err) {
                            if (err)
                                reject(err);
                            else
                                resolve();
                        });
                    })];
            });
        });
    };
    return InspectorServer;
}());
exports.InspectorServer = InspectorServer;
