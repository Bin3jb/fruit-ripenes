function notFound(_req, res) {
  res.status(404).json({ error: 'endpoint not found' });
}

function errorHandler(err, _req, res, _next) {
  const status = err.status || (err.code === 'LIMIT_FILE_SIZE' ? 413 : 500);
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: status >= 500 && process.env.NODE_ENV === 'production'
      ? 'internal server error'
      : err.message,
  });
}

module.exports = { notFound, errorHandler };
