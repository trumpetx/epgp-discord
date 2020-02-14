module.exports = (req, res) => {
  req.session.destroy(err => {
    if (err) throw new Error(err);
    res.redirect('/');
  });
};
