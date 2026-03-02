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
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogReplayRoute = createLogReplayRoute;
exports.createLogStreamRoute = createLogStreamRoute;
var shared_1 = require("@vitamin/shared");
var logger = (0, shared_1.createLogger)('server:api:logs');
function createLogReplayRoute(hub) {
    return function (req, res) {
        var sessionId = req.query.session;
        var since = req.query.since ? Number.parseInt(req.query.since, 10) : undefined;
        var filter = {};
        if (sessionId)
            filter.sessionId = sessionId;
        // Additional filters if needed
        if (req.query.level)
            filter.minLevel = req.query.level;
        if (req.query.sources) {
            filter.sources = req.query.sources.split(',');
        }
        // Using matchesFilter which will be exported from log-broadcast-hub.ts
        var logs = hub.getRecentLogs(filter, Number.isNaN(since) ? undefined : since);
        res.json(logs);
    };
}
function createLogStreamRoute(hub) {
    var _this = this;
    return function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var sessionId, userId, minLevel, sources, subscription, _a, subscription_1, subscription_1_1, event_1, e_1_1, err_1;
        var _b, e_1, _c, _d;
        var _e, _f;
        return __generator(this, function (_g) {
            switch (_g.label) {
                case 0:
                    sessionId = req.query.sessionId;
                    userId = (_e = req.user) === null || _e === void 0 ? void 0 : _e.id // Mock
                    ;
                    minLevel = (_f = req.query.level) !== null && _f !== void 0 ? _f : 'info';
                    sources = req.query.sources
                        ? req.query.sources.split(',')
                        : undefined;
                    res.setHeader('Content-Type', 'text/event-stream');
                    res.setHeader('Cache-Control', 'no-cache');
                    res.setHeader('Connection', 'keep-alive');
                    res.setHeader('X-Accel-Buffering', 'no');
                    res.flushHeaders();
                    subscription = hub.subscribe({
                        sessionId: sessionId,
                        userId: userId,
                        minLevel: minLevel,
                        sources: sources,
                    });
                    res.on('close', function () {
                        subscription.close();
                    });
                    _g.label = 1;
                case 1:
                    _g.trys.push([1, 14, , 15]);
                    _g.label = 2;
                case 2:
                    _g.trys.push([2, 7, 8, 13]);
                    _a = true, subscription_1 = __asyncValues(subscription);
                    _g.label = 3;
                case 3: return [4 /*yield*/, subscription_1.next()];
                case 4:
                    if (!(subscription_1_1 = _g.sent(), _b = subscription_1_1.done, !_b)) return [3 /*break*/, 6];
                    _d = subscription_1_1.value;
                    _a = false;
                    event_1 = _d;
                    res.write("event: log\ndata: ".concat(JSON.stringify(event_1), "\n\n"));
                    _g.label = 5;
                case 5:
                    _a = true;
                    return [3 /*break*/, 3];
                case 6: return [3 /*break*/, 13];
                case 7:
                    e_1_1 = _g.sent();
                    e_1 = { error: e_1_1 };
                    return [3 /*break*/, 13];
                case 8:
                    _g.trys.push([8, , 11, 12]);
                    if (!(!_a && !_b && (_c = subscription_1.return))) return [3 /*break*/, 10];
                    return [4 /*yield*/, _c.call(subscription_1)];
                case 9:
                    _g.sent();
                    _g.label = 10;
                case 10: return [3 /*break*/, 12];
                case 11:
                    if (e_1) throw e_1.error;
                    return [7 /*endfinally*/];
                case 12: return [7 /*endfinally*/];
                case 13: return [3 /*break*/, 15];
                case 14:
                    err_1 = _g.sent();
                    logger.error({ err: err_1 }, 'SSE stream error');
                    res.end();
                    return [3 /*break*/, 15];
                case 15: return [2 /*return*/];
            }
        });
    }); };
}
