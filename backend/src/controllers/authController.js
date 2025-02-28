const jwt = require('jsonwebtoken');
require('dotenv').config();

// In a production system, use a database for users.
const users = [
  { username: 'auditor1', password: 'password', role: 'auditor' },
  { username: 'agent1', password: 'password', role: 'agent' },
  { username: 'admin1', password: 'password', role: 'admin' }
];

exports.login = (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  // Generate JWT with expiration and role information.
  const token = jwt.sign({ username: user.username, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1h'
  });
  res.status(200).json({ token });
};
