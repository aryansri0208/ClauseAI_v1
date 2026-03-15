"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = errorMiddleware;
const logger_1 = require("../config/logger");
const zod_1 = require("zod");
function errorMiddleware(err, _req, res, _next) {
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            error: 'Validation failed',
            details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
        });
        return;
    }
    const statusCode = err.statusCode ?? 500;
    const message = statusCode >= 500 ? 'Internal server error' : err.message;
    if (statusCode >= 500) {
        logger_1.logger.error('Unhandled error', {
            error: err.message,
            stack: err.stack,
        });
    }
    res.status(statusCode).json({
        error: message,
        ...(err.code && { code: err.code }),
    });
}
//# sourceMappingURL=error.middleware.js.map