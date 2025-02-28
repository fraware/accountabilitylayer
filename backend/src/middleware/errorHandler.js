module.exports = function (err, req, res, next) {
    console.error(err.stack);
    // If the error object has a status property, use it; otherwise default to 500
    const statusCode = err.status || 500;
    res.status(statusCode).json({ error: err.message });
  };
  