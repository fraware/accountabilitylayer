"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyToken = verifyToken;
exports.authorize = authorize;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ message: 'No token provided' });
        return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ message: 'Server configuration error' });
        return;
    }
    jsonwebtoken_1.default.verify(token, secret, (err, decoded) => {
        if (err) {
            res.status(401).json({ message: 'Invalid token' });
            return;
        }
        req.user = decoded;
        next();
    });
}
function authorize(roles = []) {
    const list = typeof roles === 'string' ? [roles] : roles;
    return (req, res, next) => {
        if (!req.user || (list.length > 0 && !list.includes(String(req.user.role)))) {
            res.status(403).json({ message: 'Forbidden: insufficient privileges' });
            return;
        }
        next();
    };
}
