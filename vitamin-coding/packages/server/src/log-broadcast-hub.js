"use strict";
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
var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogBroadcastHub = void 0;
exports.matchesFilter = matchesFilter;
var node_events_1 = require("node:events");
var ring_buffer_1 = require("./ring-buffer");
var LEVEL_WEIGHT = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};
function matchesFilter(event, filter) {
    if (filter.sessionId && event.sessionId !== filter.sessionId)
        return false;
    if (filter.userId && event.userId !== filter.userId)
        return false;
    if (filter.minLevel && LEVEL_WEIGHT[event.level] < LEVEL_WEIGHT[filter.minLevel])
        return false;
    if (filter.sources && !filter.sources.includes(event.source))
        return false;
    return true;
}
var LogBroadcastHub = /** @class */ (function () {
    function LogBroadcastHub(maxListeners, bufferSize, alwaysBuffer) {
        if (maxListeners === void 0) { maxListeners = 1000; }
        if (bufferSize === void 0) { bufferSize = 10000; }
        if (alwaysBuffer === void 0) { alwaysBuffer = false; }
        this.emitter = new node_events_1.EventEmitter();
        this.subscriberCount = 0;
        this.nextEventId = 1;
        this.emitter.setMaxListeners(maxListeners);
        this.logsBuffer = new ring_buffer_1.RingBuffer(bufferSize);
        this.alwaysBuffer = alwaysBuffer;
    }
    Object.defineProperty(LogBroadcastHub.prototype, "activeSubscribers", {
        get: function () {
            return this.subscriberCount;
        },
        enumerable: false,
        configurable: true
    });
    LogBroadcastHub.prototype.getRecentLogs = function (filter, sinceId) {
        var logs = this.logsBuffer.toArray();
        if (sinceId !== undefined) {
            logs = logs.filter(function (l) { return l.id !== undefined && l.id > sinceId; });
        }
        if (filter) {
            logs = logs.filter(function (l) { return matchesFilter(l, filter); });
        }
        return logs;
    };
    LogBroadcastHub.prototype.publish = function (event) {
        if (this.subscriberCount === 0 && !this.alwaysBuffer) {
            // 零生产开销：如果没有订阅者，且未强制缓存，直接返回不做任何处理
            return;
        }
        event.id = this.nextEventId++;
        this.logsBuffer.push(event);
        // Global channel
        this.emitter.emit('log:*', event);
        // Session specific channel
        if (event.sessionId) {
            this.emitter.emit("log:session:".concat(event.sessionId), event);
        }
        // User specific channel
        if (event.userId) {
            this.emitter.emit("log:user:".concat(event.userId), event);
        }
    };
    LogBroadcastHub.prototype.subscribe = function (filter) {
        var _a;
        var _this = this;
        var channel = filter.sessionId
            ? "log:session:".concat(filter.sessionId)
            : filter.userId
                ? "log:user:".concat(filter.userId)
                : 'log:*';
        this.subscriberCount++;
        var subscriberActive = true;
        var emitter = this.emitter;
        var decrementSubscribers = function () {
            if (!subscriberActive)
                return;
            subscriberActive = false;
            _this.subscriberCount--;
        };
        var listeners = [];
        return _a = {},
            _a[Symbol.asyncIterator] = function () {
                return __asyncGenerator(this, arguments, function _a() {
                    var queue, resolve, handler, event_1, index;
                    return __generator(this, function (_b) {
                        switch (_b.label) {
                            case 0:
                                queue = [];
                                resolve = null;
                                handler = function (event) {
                                    if (matchesFilter(event, filter)) {
                                        queue.push(event);
                                        resolve === null || resolve === void 0 ? void 0 : resolve();
                                    }
                                };
                                emitter.on(channel, handler);
                                listeners.push(handler);
                                _b.label = 1;
                            case 1:
                                _b.trys.push([1, , 10, 11]);
                                _b.label = 2;
                            case 2:
                                if (!subscriberActive) return [3 /*break*/, 9];
                                if (!(queue.length > 0)) return [3 /*break*/, 6];
                                event_1 = queue.shift();
                                if (!event_1) return [3 /*break*/, 5];
                                return [4 /*yield*/, __await(event_1)];
                            case 3: return [4 /*yield*/, _b.sent()];
                            case 4:
                                _b.sent();
                                _b.label = 5;
                            case 5: return [3 /*break*/, 8];
                            case 6: return [4 /*yield*/, __await(new Promise(function (r) {
                                    resolve = r;
                                }))];
                            case 7:
                                _b.sent();
                                _b.label = 8;
                            case 8: return [3 /*break*/, 2];
                            case 9: return [3 /*break*/, 11];
                            case 10:
                                emitter.off(channel, handler);
                                decrementSubscribers();
                                index = listeners.indexOf(handler);
                                if (index > -1) {
                                    listeners.splice(index, 1);
                                }
                                return [7 /*endfinally*/];
                            case 11: return [2 /*return*/];
                        }
                    });
                });
            },
            _a.close = function () {
                if (!subscriberActive)
                    return;
                decrementSubscribers();
                for (var _i = 0, listeners_1 = listeners; _i < listeners_1.length; _i++) {
                    var handler = listeners_1[_i];
                    emitter.off(channel, handler);
                }
            },
            _a;
    };
    return LogBroadcastHub;
}());
exports.LogBroadcastHub = LogBroadcastHub;
