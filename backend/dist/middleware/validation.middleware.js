"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const zod_1 = require("zod");
function validate(schema, source = 'body') {
    return (req, _res, next) => {
        const data = req[source];
        try {
            req[source] = schema.parse(data);
            next();
        }
        catch (err) {
            next(err instanceof zod_1.ZodError ? err : new Error('Validation failed'));
        }
    };
}
//# sourceMappingURL=validation.middleware.js.map