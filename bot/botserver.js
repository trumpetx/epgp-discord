const Discord = require('discord.js');
const { logger, infoHandler, warnHandler, errorHandler } = require('../logger.js');

module.exports = (clientId, token, botPermissions) => {
  const client = new Discord.Client();
  client.on('error', errorHandler);
  client.on('warn', warnHandler);
  client.on('info', infoHandler);
  client.on('debug', msg => { });
  client.once('ready', () => {
    logger.info(`Bot has started, with ${client.users.size} users, in ${client.channels.size} channels of ${client.guilds.size} guilds:`);
    client.user.setActivity(`on ${client.guilds.size} servers`).catch(logger.error);
    const guilds = [];
    client.guilds.map(guild => guilds.push(guild.name));
    logger.info(guilds);
  });

  client.on('guildCreate', guild => {
    logger.info(`New guild joined: ${guild.name} (id: ${guild.id}). This guild has ${guild.memberCount} members!`);
    client.user.setActivity(`on ${client.guilds.size} servers`).catch(logger.error);
  });

  client.on('guildDelete', guild => {
    logger.info(`Bot has been removed from: ${guild.name} (id: ${guild.id})`);
    client.user.setActivity(`on ${client.guilds.size} servers`).catch(logger.error);
  });

  client.on('message', require('./message'));
  client.login(token).catch(e => logger.error(e.toString()));
  logger.info('https://discordapp.com/oauth2/authorize?client_id=' + clientId + '&scope=bot&permissions=' + botPermissions + '\n');
}
