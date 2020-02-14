const _ = require('lodash');
const { oauth } = require('../discord');
const { me } = require('../discord');

module.exports = (req, res) => {
  if (req.query.state !== req.session.state) {
    throw new Error('Invalid state');
  }

  oauth(req.query.code, body => {
    req.session.refresh_token = body.refresh_token;
    req.session.access_token = body.access_token;
    req.session.expires_at = new Date(_.toInteger(body.expires_in) + new Date().getTime());
    me(req.session.access_token, body => {
      req.session.discord_user = body;
      res.redirect('/epgp');
    });
  });
};
