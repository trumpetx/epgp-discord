const { guilds } = require('../discord');
const db = require('../db');
const _ = require('lodash');
const ADMIN_PERMISSION = 8;
const MANAGE_GUILD = 20;
const CACHE_TIME = 10 * 60 * 1000;

function renderGuilds(req, res) {
  const myGuildIds = req.session.guilds.map(g => g.id);
  db.find({ id: { $in: myGuildIds } }, (err, docs) => {
    if (err) throw new Error(err);
    const guildsWithEpgp = docs.map(g => g.id);
    const nonGuilds = req.session.guilds.filter(el => !guildsWithEpgp.includes(el.id));
    const nonGuildsWithAdmin = nonGuilds.filter(el => el.admin);
    const nonGuildsWithoutAdminCount = nonGuilds.length - nonGuildsWithAdmin.length;
    res.render('epgp', { nonGuildsWithAdmin, guildsWithEpgp, nonGuildsWithoutAdminCount });
  });
}

module.exports = (req, res) => {
  if (req.session.guilds && req.session.guilds_timestamp + CACHE_TIME > new Date().getTime()) {
    renderGuilds(req, res);
  } else {
    guilds(req.session.access_token, body => {
      req.session.guilds = body;
      req.session.guilds_timestamp = new Date().getTime();
      _.forEach(req.session.guilds, guild => {
        guild.admin = guild.owner || (guild.permissions & MANAGE_GUILD) === MANAGE_GUILD || (guild.permissions & ADMIN_PERMISSION) === ADMIN_PERMISSION;
      });
      renderGuilds(req, res);
    });
  }
};
