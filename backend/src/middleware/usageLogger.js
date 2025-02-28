module.exports = function (req, res, next) {
    // Log method, URL, query parameters, and timestamp for each API call
    console.log(`[API USAGE] ${new Date().toISOString()} ${req.method} ${req.originalUrl} Query: ${JSON.stringify(req.query)}`);
    next();
  };
  