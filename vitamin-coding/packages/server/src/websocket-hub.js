"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebSocketHub = void 0;
var ws_1 = require("ws");
var shared_1 = require("@vitamin/shared");
var logger = (0, shared_1.createLogger)('server:websocket-hub');
var WebSocketHub = /** @class */ (function () {
    function WebSocketHub(server) {
        var _this = this;
        this.connections = new Set();
        this.wss = new ws_1.WebSocketServer({ server: server });
        this.wss.on('connection', function (ws) {
            ws.isAlive = true;
            _this.connections.add(ws);
            ws.on('pong', function () {
                ws.isAlive = true;
            });
            ws.on('close', function () {
                _this.connections.delete(ws);
            });
            ws.on('error', function (error) {
                logger.error({ error: error }, 'WebSocket Error:');
                _this.connections.delete(ws);
            });
            ws.on('message', function (data) {
                // Handle incoming WS messages (e.g. steer commands, debugging requests)
                try {
                    var msg = JSON.parse(data.toString());
                    logger.debug({ msg: msg }, 'WS message received');
                }
                catch (e) {
                    logger.error({ error: e }, 'Failed to parse WS message');
                }
            });
        });
        // 6.1.3: WebSocket 心跳 30s，断线自动清理
        this.heartbeatInterval = setInterval(function () {
            for (var _i = 0, _a = _this.connections; _i < _a.length; _i++) {
                var ws = _a[_i];
                if (ws.isAlive === false) {
                    _this.connections.delete(ws);
                    ws.terminate();
                    continue;
                }
                ws.isAlive = false;
                ws.ping();
            }
        }, 30000);
    }
    Object.defineProperty(WebSocketHub.prototype, "activeConnections", {
        get: function () {
            return this.connections.size;
        },
        enumerable: false,
        configurable: true
    });
    WebSocketHub.prototype.broadcast = function (data) {
        var payload = JSON.stringify(data);
        for (var _i = 0, _a = this.connections; _i < _a.length; _i++) {
            var client = _a[_i];
            if (client.readyState === ws_1.WebSocket.OPEN) {
                client.send(payload);
            }
        }
    };
    WebSocketHub.prototype.close = function () {
        clearInterval(this.heartbeatInterval);
        for (var _i = 0, _a = this.connections; _i < _a.length; _i++) {
            var client = _a[_i];
            client.close();
        }
        this.connections.clear();
        this.wss.close();
    };
    return WebSocketHub;
}());
exports.WebSocketHub = WebSocketHub;
