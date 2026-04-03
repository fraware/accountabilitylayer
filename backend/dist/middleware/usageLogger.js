"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = usageLogger;
function usageLogger(req, res, next) {
    console.log(`[API USAGE] ${new Date().toISOString()} ${req.method} ${req.originalUrl} Query: ${JSON.stringify(req.query)}`);
    next();
}
