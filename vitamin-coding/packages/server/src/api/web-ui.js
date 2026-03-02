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
exports.createMessageEndpoint = createMessageEndpoint;
exports.createStopEndpoint = createStopEndpoint;
exports.createForkEndpoint = createForkEndpoint;
var node_crypto_1 = require("node:crypto");
var globalStreams = new Map();
function toStreamKey(sessionId, messageId) {
    return "".concat(sessionId, ":").concat(messageId);
}
function getStreamStore(ctx) {
    var _a;
    return (_a = ctx.activeStreams) !== null && _a !== void 0 ? _a : globalStreams;
}
function createMessageEndpoint(ctx) {
    var _this = this;
    return function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var sessionId, content, messageId, streamKey, controller, store, text, chunks, offset, timer;
        var _a;
        return __generator(this, function (_b) {
            sessionId = req.params.id;
            if (!sessionId) {
                res.status(400).json({ error: 'session id is required' });
                return [2 /*return*/];
            }
            content = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.content) === 'string' ? req.body.content.trim() : '';
            if (!content) {
                res.status(400).json({ error: 'content is required' });
                return [2 /*return*/];
            }
            messageId = (0, node_crypto_1.randomUUID)();
            streamKey = toStreamKey(sessionId, messageId);
            controller = new AbortController();
            store = getStreamStore(ctx);
            store.set(streamKey, { controller: controller, sessionId: sessionId, messageId: messageId });
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.setHeader('X-Accel-Buffering', 'no');
            res.setHeader('X-Message-Id', messageId);
            res.flushHeaders();
            text = "\u5DF2\u6536\u5230\uFF1A".concat(content);
            chunks = text.split('');
            offset = 0;
            timer = setInterval(function () {
                var stream = store.get(streamKey);
                if (!stream || stream.controller.signal.aborted) {
                    res.write("event: error\ndata: ".concat(JSON.stringify({ messageId: messageId, stopped: true }), "\n\n"));
                    res.write("event: done\ndata: ".concat(JSON.stringify({ messageId: messageId, stopped: true }), "\n\n"));
                    clearInterval(timer);
                    store.delete(streamKey);
                    res.end();
                    return;
                }
                var next = chunks[offset];
                if (!next) {
                    res.write("event: done\ndata: ".concat(JSON.stringify({ messageId: messageId, stopped: false }), "\n\n"));
                    clearInterval(timer);
                    store.delete(streamKey);
                    res.end();
                    return;
                }
                res.write("event: text_delta\ndata: ".concat(JSON.stringify({ messageId: messageId, delta: next }), "\n\n"));
                offset += 1;
            }, 16);
            req.on('close', function () {
                clearInterval(timer);
                store.delete(streamKey);
            });
            return [2 /*return*/];
        });
    }); };
}
function createStopEndpoint(ctx) {
    return function (req, res) {
        var sessionId = req.params.id;
        var messageId = req.params.mid;
        if (!sessionId || !messageId) {
            res.status(400).json({ stopped: false, error: 'session id and message id are required' });
            return;
        }
        var streamKey = toStreamKey(sessionId, messageId);
        var stream = getStreamStore(ctx).get(streamKey);
        if (!stream) {
            res.status(404).json({ stopped: false, error: 'message stream not found' });
            return;
        }
        stream.controller.abort();
        res.json({ stopped: true });
    };
}
function createForkEndpoint() {
    return function (req, res) {
        var _a;
        var fromMessageId = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.fromMessageId) === 'string'
            ? req.body.fromMessageId
            : null;
        if (!fromMessageId) {
            res.status(400).json({ error: 'fromMessageId is required' });
            return;
        }
        res.status(201).json({
            sessionId: req.params.id,
            fromMessageId: fromMessageId,
            createdAt: Date.now(),
        });
    };
}
