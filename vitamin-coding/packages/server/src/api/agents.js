"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAgentsRouter = createAgentsRouter;
var express_1 = require("express");
function createAgentsRouter(agentRegistry) {
    var router = (0, express_1.Router)();
    router.get('/', function (_req, res) {
        if (agentRegistry && typeof agentRegistry.getAll === 'function') {
            var agents = agentRegistry.getAll();
            res.json(agents);
        }
        else {
            res.json([{ id: 'demo-agent', type: 'primary' }]);
        }
    });
    router.get('/:id', function (req, res) {
        res.json({ id: req.params.id, type: 'primary', state: 'idle' });
    });
    // 独立的 status 端点 — 实时 Agent 运行状态
    router.get('/:id/status', function (req, res) {
        var agentId = req.params.id;
        // 尝试从注册表获取实时状态
        if (agentRegistry && typeof agentRegistry.getStatus === 'function') {
            var status_1 = agentRegistry.getStatus(agentId);
            if (status_1) {
                res.json(status_1);
                return;
            }
        }
        // 默认返回 idle 状态
        res.json({
            state: 'idle',
            toolCalls: 0,
            inputTokens: 0,
            outputTokens: 0,
            recentToolCalls: [],
            lastUpdatedAt: Date.now(),
        });
    });
    return router;
}
