"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectVendor = connectVendor;
const supabase_1 = require("../config/supabase");
const encryption_1 = require("../utils/encryption");
const vendor_types_1 = require("../types/vendor.types");
const logger_1 = require("../config/logger");
async function connectVendor(req, res) {
    const user = req.user;
    const { vendor_name, api_key } = req.body;
    if (!(0, vendor_types_1.isVendorName)(vendor_name)) {
        res.status(400).json({
            error: 'Invalid vendor',
            supported: ['OpenAI', 'Anthropic', 'Google Vertex AI', 'Pinecone', 'LangSmith'],
        });
        return;
    }
    const supabase = (0, supabase_1.getSupabaseAdmin)();
    const { data: company } = await supabase
        .from('companies')
        .select('id')
        .eq('owner_user_id', user.id)
        .single();
    if (!company) {
        res.status(404).json({ error: 'Company not found. Create a company first.' });
        return;
    }
    let encryptedKey;
    try {
        encryptedKey = (0, encryption_1.encrypt)(api_key);
    }
    catch (err) {
        logger_1.logger.error('Encryption failed', { vendor: vendor_name });
        res.status(500).json({ error: 'Failed to store API key securely' });
        return;
    }
    const { data: connection, error } = await supabase
        .from('vendor_connections')
        .upsert({
        company_id: company.id,
        vendor_name,
        encrypted_api_key: encryptedKey,
        connection_status: 'active',
    }, { onConflict: 'company_id,vendor_name', ignoreDuplicates: false })
        .select('id, vendor_name, connection_status, created_at')
        .single();
    if (error) {
        logger_1.logger.error('Vendor connect failed', { error: error.message, vendor: vendor_name });
        res.status(500).json({ error: 'Failed to save vendor connection' });
        return;
    }
    logger_1.logger.info('Vendor connected', { vendor: vendor_name, companyId: company.id });
    res.status(201).json(connection);
}
//# sourceMappingURL=vendor.controller.js.map