"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const logger_1 = require("./config/logger");
const env_1 = require("./config/env");
const error_middleware_1 = require("./middleware/error.middleware");
const company_routes_1 = __importDefault(require("./routes/company.routes"));
const vendor_routes_1 = __importDefault(require("./routes/vendor.routes"));
const scan_routes_1 = __importDefault(require("./routes/scan.routes"));
const system_routes_1 = __importDefault(require("./routes/system.routes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: env_1.env.CORS_ORIGIN ?? true, credentials: true }));
app.use(express_1.default.json());
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/company', company_routes_1.default);
app.use('/api/vendors', vendor_routes_1.default);
app.use('/api/scan', scan_routes_1.default);
app.use('/api/systems', system_routes_1.default);
app.use(error_middleware_1.errorMiddleware);
const server = app.listen(env_1.env.PORT, () => {
    logger_1.logger.info('ClauseAI backend started', { port: env_1.env.PORT, nodeEnv: env_1.env.NODE_ENV });
});
process.on('SIGTERM', () => {
    logger_1.logger.info('SIGTERM received, shutting down');
    server.close(() => process.exit(0));
});
exports.default = app;
//# sourceMappingURL=server.js.map