"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = errorHandler;
function errorHandler(err, _req, res, _next) {
    console.error(err.stack);
    const statusCode = err.status || 500;
    res.status(statusCode).json({ error: err.message });
}
