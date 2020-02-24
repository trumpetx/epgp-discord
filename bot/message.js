const { logger, errorHandler } = require('../logger.js');
const { chunk, deleteMsg, isAdmin } = require('./discord-util');
const { startsWithIgnoreCase } = require('../util');
const { props } = require('../props');
const { db, bots } = require('../db');
const _ = require('lodash');

module.exports = async function message(message) {
  if (message.author.bot) return;
  if (!startsWithIgnoreCase(message.content, props.prefix)) return;

  const args = message.content
    .slice(props.prefix.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  if (!message.guild) {
    message.author.send("I don't respond to direct messages (yet)").catch(errorHandler);
    return;
  }

  db.findOne({ id: message.guild.id }, (err, guild) => {
    if (err) logger.error(err);
    guild = guild || {};
    bots.findOne({ id: message.guild.id }, (err, bot) => {
      if (err) throw new Error(err);
      if (bot === null) throw new Error('Bot for guild ' + message.guild.id + 'has not been initialized');
      handleMessage(guild, bot, message, args, command);
    });
  });
};

const handleMessage = (guild, bot, message, args, command) => {
  let msg = [];
  let reply = [];
  const notConfigured = _.size(guild) === 0 || _.size(guild.backups) === 0;
  const memberAdmin = isAdmin(message);
  if (!(memberAdmin && command === 'config') && bot.disabled) {
    // Silently return unless an admin is processing configuration
    return;
  } else if (startsWithIgnoreCase(command, 'help')) {
    reply.push('EP/GP Bot Instructions:\n\n!epgp YourWowCharName');
  } else if (notConfigured && !memberAdmin) {
    reply.push('EPGP needs to be configured by an administrator: http://www.epgp.net/epgp');
  } else if (notConfigured && memberAdmin) {
    reply.push(`Please visit ${props.hostname}${props.extPortString}/epgp to configure your guild and upload your EP/GP data.`);
  } else if (command === 'config') {
    if (!memberAdmin) {
      reply.push('Only server administrators can update the bot configuration');
    } else if (args.length === 0) {
      reply.push('disabled=' + bot.disabled === true);
    } else if (args.length > 1) {
      const key = args[0];
      let value = args[1];
      if (value === 'true' || value === 'false') {
        value = value === 'true';
      }
      bots.update({ id: guild.id }, { $set: { [key]: value } }, {}, (err, _updatedCount) => err && logger.error(err));
      reply.push(`OK! ${key}=${value}`);
    }
  } else if (args.length === 0 && !_.isEmpty(command)) {
    const current = guild.backups[guild.backups.length - 1];
    const entry = current.roster.find(entry => startsWithIgnoreCase(entry[0], command));
    if (!entry) {
      reply.push('No match :/');
    } else {
      //bots.update({ id: guild.id }, { $inc: 'requestCount' }, {}, (err, _updatedCount) => err && logger.error(err));
      reply.push(entry[0] + '\nEP: ' + entry[1] + '\nGP: ' + entry[2] + '\nPR: ' + _.toNumber(entry[1]) / _.toNumber(entry[2]));
      deleteMsg(message);
    }
  }
  if (msg.length > 0) {
    chunk(msg, 1900, c => message.channel.send(c).catch(errorHandler));
  }
  if (reply.length > 0) {
    chunk(reply, 1900, c => message.author.send(c).catch(errorHandler));
  }
  if (reply.length > 0 || msg.length > 0) {
    deleteMsg(message);
  }
};
