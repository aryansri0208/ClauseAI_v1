"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectVendor = connectVendor;
const supabase_1 = require("../config/supabase");
const encryption_1 = require("../utils/encryption");
const logger_1 = require("../config/logger");
async function connectVendor(req, res) {
    const user = req.user;
    const { vendor_name, api_key, company_id: bodyCompanyId } = req.body;
    const supabase = (0, supabase_1.getSupabaseAdmin)();
    let companyId;
    if (bodyCompanyId) {
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('id')
            .eq('id', bodyCompanyId)
            .eq('owner_user_id', user.id)
            .single();
        if (companyError || !company) {
            logger_1.logger.warn('Vendor connect: company not found or access denied', {
                companyId: bodyCompanyId,
                userId: user.id,
            });
            res.status(404).json({ error: 'Company not found or access denied.' });
            return;
        }
        companyId = company.id;
    }
    else {
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('id')
            .eq('owner_user_id', user.id)
            .single();
        if (companyError || !company) {
            logger_1.logger.warn('Vendor connect: no company for user', { userId: user.id });
            res.status(404).json({ error: 'Company not found. Create a company first.' });
            return;
        }
        companyId = company.id;
    }
    let encryptedKey;
    try {
        encryptedKey = (0, encryption_1.encrypt)(api_key);
    }
    catch (err) {
        logger_1.logger.error('Vendor key encryption failed', {
            vendor: vendor_name,
            message: err instanceof Error ? err.message : 'Unknown error',
        });
        res.status(500).json({ error: 'Failed to store API key securely' });
        return;
    }
    const now = new Date().toISOString();
    const { error } = await supabase
        .from('vendor_connections')
        .upsert({
        company_id: companyId,
        vendor_name: vendor_name,
        encrypted_api_key: encryptedKey,
        connection_status: 'active',
        updated_at: now,
    }, { onConflict: 'company_id,vendor_name', ignoreDuplicates: false });
    if (error) {
        logger_1.logger.error('Vendor connect DB failed', {
            vendor: vendor_name,
            companyId,
            message: error.message,
        });
        res.status(500).json({ error: 'Failed to store API key securely' });
        return;
    }
    logger_1.logger.info('Vendor key stored', { vendor: vendor_name, companyId });
    res.status(200).json({
        message: 'Vendor key stored successfully',
        vendor_name,
    });
}
//# sourceMappingURL=vendor.controller.js.map