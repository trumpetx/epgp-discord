module.exports = (err, _req, res, _next) => {
  res.status(err.status || 500);
  console.error(err.stack);
  res.render('500');
};
