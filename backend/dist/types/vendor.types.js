"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VENDOR_NAMES = void 0;
exports.isVendorName = isVendorName;
exports.VENDOR_NAMES = [
    'OpenAI',
    'Anthropic',
    'Google Vertex AI',
    'Pinecone',
    'LangSmith',
];
function isVendorName(name) {
    return exports.VENDOR_NAMES.includes(name);
}
//# sourceMappingURL=vendor.types.js.map