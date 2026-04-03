"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const users = [
    { username: 'auditor1', password: 'password', role: 'auditor' },
    { username: 'agent1', password: 'password', role: 'agent' },
    { username: 'admin1', password: 'password', role: 'admin' },
];
function login(req, res) {
    const { username, password } = req.body;
    const user = users.find((u) => u.username === username && u.password === password);
    if (!user) {
        res.status(401).json({ message: 'Invalid credentials' });
        return;
    }
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        res.status(500).json({ message: 'Server configuration error' });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ username: user.username, role: user.role }, secret, { expiresIn: process.env.JWT_EXPIRES_IN || '1h' });
    res.status(200).json({ token });
}
