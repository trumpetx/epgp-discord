const Discord = require('discord.js');
const { logger, infoHandler, warnHandler, errorHandler } = require('../logger.js');
const { bots } = require('../db');
const moment = require('moment');

const upsert = guid => {
  bots.update({ id: guid }, { $set: { id: guid } }, { upsert: true }, (err, _numReplaced, _newDoc) => {
    if (err) {
      logger.error(err);
    } else {
      // Do something?
    }
  });
};

module.exports.client = new Discord.Client();
module.exports.botServer = token => {
  const client = module.exports.client;
  client.on('error', errorHandler);
  client.on('warn', warnHandler);
  client.on('info', infoHandler);
  client.on('debug', msg => {});
  client.once('ready', () => {
    logger.info(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds:`);
    client.user.setActivity(`on ${client.guilds.size} servers`).catch(logger.error);
    const guilds = [];
    client.guilds.forEach(guild => {
      guilds.push(guild.name);
      upsert(guild.id);
    });
    logger.info(guilds);
  });

  client.on('guildCreate', guild => {
    logger.info(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
    upsert(guild.id);
    client.user.setActivity(`on ${client.guilds.size} servers`).catch(logger.error);
  });

  client.on('guildDelete', guild => {
    logger.info(`Bot has been removed from: ${guild.name} (id: ${guild.id})`);
    bots.remove({ id: guild.id }, (err, _numRemoved) => err && logger.error(err));
    client.user.setActivity(`on ${client.guilds.size} servers`).catch(logger.error);
  });

  client.on('message', require('./message'));
  client.login(token).catch(e => logger.error(e.toString()));
};

module.exports.serverStatus = () => {
  return {
    online: module.exports.client.uptime && module.exports.client.uptime > 0,
    uptime: moment.duration(module.exports.client.uptime, 'milliseconds').humanize()
  };
};
