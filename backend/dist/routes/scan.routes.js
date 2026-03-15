"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_middleware_1 = require("../middleware/auth.middleware");
const scan_controller_1 = require("../controllers/scan.controller");
const router = (0, express_1.Router)();
router.post('/start', auth_middleware_1.authMiddleware, scan_controller_1.startScan);
router.get('/status/:jobId', auth_middleware_1.authMiddleware, scan_controller_1.getScanStatus);
exports.default = router;
//# sourceMappingURL=scan.routes.js.map