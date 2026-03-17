"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = authMiddleware;
const supabase_1 = require("../config/supabase");
const logger_1 = require("../config/logger");
const env_1 = require("../config/env");
const DEV_MOCK_USER = {
    id: '11111111-1111-1111-1111-111111111111', // ✅ valid UUID
    email: 'dev@clauseai.local',
};
async function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        if (env_1.env.NODE_ENV === 'development') {
            req.user = DEV_MOCK_USER;
            next();
            return;
        }
        res.status(401).json({ error: 'Missing or invalid Authorization header' });
        return;
    }
    const token = authHeader.slice(7);
    try {
        const supabase = (0, supabase_1.getSupabaseAdmin)();
        const { data: { user }, error, } = await supabase.auth.getUser(token);
        if (error || !user) {
            logger_1.logger.warn('Auth failed', { error: error?.message });
            res.status(401).json({ error: 'Invalid or expired token' });
            return;
        }
        req.user = {
            id: "11111111-1111-1111-1111-111111111111",
            email: "dev@clauseai.local"
        };
        next();
    }
    catch (err) {
        logger_1.logger.error('Auth middleware error', { error: err instanceof Error ? err.message : err });
        res.status(500).json({ error: 'Authentication failed' });
    }
}
//# sourceMappingURL=auth.middleware.js.map