const { logger, errorHandler } = require('../logger.js');
const { chunk, deleteMsg, isAdmin } = require('./discord-util');
const { startsWithIgnoreCase } = require('../util');
const { props } = require('../props');


module.exports = async function message(message) {
  if (message.author.bot) return;
  if (!startsWithIgnoreCase(message.content, props.prefix)) return;
  logger.info(message);

  const args = message.content
    .slice(props.prefix.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  let msg = [];
  let reply = [];

  console.log(message);

  switch (command) {
    case 'config':
      if (!isAdmin(message)) {
        reply.push('Only server administrators can update the bot configuration');
        break;
      }
      // display config or update
      break;
    default:
      reply.push(`EP/GP Bot Instructions:\n`);
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

