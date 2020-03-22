const _ = require('lodash');
const { oauth } = require('../discord');
const { me } = require('../discord');

module.exports = (req, res) => {
  if (req.query.state !== req.session.state) {
    throw new Error('Invalid state');
  }
  /*
    {
      "access_token": "6qrZcUqja7812RVdnEKjpzOL4CvHBFG",
      "token_type": "Bearer",
      "expires_in": 604800,
      "refresh_token": "D43f5y0ahjqew82jZ4NViEr2YafMKhue",
      "scope": "identify"
    }
  */
  oauth(req.query.code, body => {
    req.session.refresh_token = body.refresh_token;
    req.session.access_token = body.access_token;
    req.session.expires_at = new Date(_.toInteger(body.expires_in) * 1000 + new Date().getTime());
    me(req.session.access_token, body => {
      req.session.discord_user = body;
      res.redirect('/epgp');
    });
  });
};
