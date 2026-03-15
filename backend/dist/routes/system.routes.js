"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const system_controller_1 = require("../controllers/system.controller");
const updateSystemSchema = zod_1.z.object({
    team_owner: zod_1.z.string().optional(),
    system_type: zod_1.z.string().optional(),
    environment: zod_1.z.string().optional(),
});
const router = (0, express_1.Router)();
router.get('/', auth_middleware_1.authMiddleware, system_controller_1.listSystems);
router.patch('/:id', auth_middleware_1.authMiddleware, (0, validation_middleware_1.validate)(updateSystemSchema, 'body'), system_controller_1.updateSystem);
exports.default = router;
//# sourceMappingURL=system.routes.js.map