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
exports.createSessionsRouter = createSessionsRouter;
var express_1 = require("express");
function resolveSessionManager(input) {
    if (!input || typeof input !== 'object') {
        return null;
    }
    var manager = input;
    if (typeof manager.list !== 'function'
        || typeof manager.create !== 'function'
        || typeof manager.getTree !== 'function'
        || typeof manager.remove !== 'function'
        || typeof manager.fork !== 'function') {
        return null;
    }
    return manager;
}
function createSessionsRouter(sessionManager) {
    var _this = this;
    var router = (0, express_1.Router)();
    var manager = resolveSessionManager(sessionManager);
    router.post('/', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var title, created;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!manager) {
                        res.status(501).json({ error: 'session manager not configured' });
                        return [2 /*return*/];
                    }
                    title = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.title) === 'string' ? req.body.title : undefined;
                    return [4 /*yield*/, manager.create(title)];
                case 1:
                    created = _b.sent();
                    res.status(201).json(created);
                    return [2 /*return*/];
            }
        });
    }); });
    router.get('/', function (_req, res) { return __awaiter(_this, void 0, void 0, function () {
        var sessions;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!manager) {
                        res.json([{ id: 'demo-session', title: 'Demo Session', status: 'active' }]);
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, manager.list()];
                case 1:
                    sessions = _a.sent();
                    res.json(sessions);
                    return [2 /*return*/];
            }
        });
    }); });
    router.get('/:id', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var tree;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!manager) {
                        res.json({ id: req.params.id, status: 'active', messages: [] });
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, manager.getTree(req.params.id)];
                case 1:
                    tree = _a.sent();
                    res.json({ id: req.params.id, messages: tree.getActiveMessages() });
                    return [2 /*return*/];
            }
        });
    }); });
    router.patch('/:id', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var title, archived;
        var _a, _b;
        return __generator(this, function (_c) {
            title = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.title) === 'string' ? req.body.title : undefined;
            archived = typeof ((_b = req.body) === null || _b === void 0 ? void 0 : _b.archived) === 'boolean' ? req.body.archived : undefined;
            res.json({
                id: req.params.id,
                title: title,
                archived: archived,
                updatedAt: Date.now(),
            });
            return [2 /*return*/];
        });
    }); });
    router.delete('/:id', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!manager) {
                        res.status(501).json({ error: 'session manager not configured' });
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, manager.remove(req.params.id)];
                case 1:
                    _a.sent();
                    res.json({ removed: true });
                    return [2 /*return*/];
            }
        });
    }); });
    router.post('/:id/fork', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var fromMessageId, result;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!manager) {
                        res.status(501).json({ error: 'session manager not configured' });
                        return [2 /*return*/];
                    }
                    fromMessageId = typeof ((_a = req.body) === null || _a === void 0 ? void 0 : _a.fromMessageId) === 'string'
                        ? req.body.fromMessageId
                        : undefined;
                    return [4 /*yield*/, manager.fork(req.params.id, fromMessageId)];
                case 1:
                    result = _b.sent();
                    res.status(201).json({
                        sessionId: req.params.id,
                        fork: result,
                    });
                    return [2 /*return*/];
            }
        });
    }); });
    return router;
}
