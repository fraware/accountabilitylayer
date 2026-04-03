module.exports = {
  'node-option': ['import=tsx'],
  require: ['./tests/setup.cjs'],
  recursive: true,
  spec: ['tests/**/*.test.js'],
  timeout: 15000,
};
