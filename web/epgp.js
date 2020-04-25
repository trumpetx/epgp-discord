const { guilds, ADMIN_PERMISSION, MANAGE_GUILD } = require('../discord');
const { db } = require('../db');
const _ = require('lodash');
const { logger } = require('../logger');
const CACHE_TIME = 10 * 60 * 1000;

function renderGuilds(req, res) {
  let guilds = req.session.guilds;
  if (!guilds) {
    logger.warn('No guilds in session map.');
    guilds = {};
  }
  const myGuildIds = guilds.map(g => g.id);
  db.find({ id: { $in: myGuildIds } }, (err, guildsWithEpgp) => {
    if (err) throw new Error(err);
    const nonGuilds = guilds.filter(el => !guildsWithEpgp.some(g => g.id === el.id));
    const nonGuildsWithAdmin = nonGuilds.filter(el => el.admin);
    const nonGuildsWithoutAdminCount = nonGuilds.length - nonGuildsWithAdmin.length;
    res.render('epgp', { nonGuildsWithAdmin, guildsWithEpgp, nonGuildsWithoutAdminCount });
  });
}


function logout(req, res) {
      logger.warn('Forcing logout - invalid or expired token');
  req.session.destroy(err => {
    if (err) throw new Error(err);
    res.redirect('/');
  });
}

module.exports = (req, res) => {
  if (req.session.guilds && req.session.guilds_timestamp + CACHE_TIME > new Date().getTime()) {
    renderGuilds(req, res);
  } else {
    const expiresAt = req.session && req.session.expires_at;
    if (!expiresAt || req.session.expires_at < new Date()) {
      logout(res);
    } else {
      guilds(req.session.access_token, body => {
        if(!body){
          logout(req, res);
          return;
        }
        req.session.guilds = body;
        req.session.guilds_timestamp = new Date().getTime();
        _.forEach(req.session.guilds, guild => {
          guild.admin = guild.owner || (guild.permissions & MANAGE_GUILD) === MANAGE_GUILD || (guild.permissions & ADMIN_PERMISSION) === ADMIN_PERMISSION;
        });
        renderGuilds(req, res);
      });
    }
  }
};
