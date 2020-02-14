const { guilds } = require('../discord');
const db = require('../db');
const _ = require('lodash');
const ADMIN_PERMISSION = 0x00000008;

module.exports = (req, res) => {
  guilds(req.session.access_token, body => {
    console.log(body);
    req.session.guilds = body;
    _.forEach(req.session.guilds, guild => {
      guild.admin = guild.owner || (guild.permissions | ADMIN_PERMISSION) === ADMIN_PERMISSION;
    });
    const myGuildIds = req.session.guilds.map(g => g.id);
    db.find({ id: { $in: myGuildIds } }, (err, docs) => {
      if (err) throw new Error(err);
      const guildsWithEpgp = docs.map(g => g.id);
      const nonGuildsWithAdmin = req.session.guilds.filter(el => el.admin).filter(el => !guildsWithEpgp.includes(el.id));
      res.render('epgp'), { nonGuildsWithAdmin: nonGuildsWithAdmin, guildsWithEpgp, docs };
    });
  });
};
