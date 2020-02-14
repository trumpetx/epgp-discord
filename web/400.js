module.exports = (req, res, _next) => {
  res.status(404);
  res.format({
    html: () => {
      res.render('404', { url: req.url });
    },
    json: () => {
      res.json({ error: 'Not found' });
    },
    default: () => {
      res.type('txt').send('Not found');
    }
  });
};
