"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const auth_middleware_1 = require("../middleware/auth.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const vendor_controller_1 = require("../controllers/vendor.controller");
const connectVendorSchema = zod_1.z.object({
    vendor_name: zod_1.z.enum(['OpenAI', 'Anthropic', 'Google Vertex AI', 'Pinecone', 'LangSmith']),
    api_key: zod_1.z.string().min(1),
});
const router = (0, express_1.Router)();
router.post('/connect', auth_middleware_1.authMiddleware, (0, validation_middleware_1.validate)(connectVendorSchema), vendor_controller_1.connectVendor);
exports.default = router;
//# sourceMappingURL=vendor.routes.js.map