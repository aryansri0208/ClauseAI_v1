"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const company_controller_1 = require("../controllers/company.controller");
const createCompanySchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(500),
    size: zod_1.z.string().optional(),
    ai_use_case: zod_1.z.string().optional(),
    monthly_ai_spend_estimate: zod_1.z.string().optional(),
    compliance_requirement: zod_1.z.string().optional(),
});
const router = (0, express_1.Router)();
router.post('/', auth_middleware_1.authMiddleware, (0, validation_middleware_1.validate)(createCompanySchema), company_controller_1.createCompany);
exports.default = router;
//# sourceMappingURL=company.routes.js.map