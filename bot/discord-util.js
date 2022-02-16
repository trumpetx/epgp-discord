const { ADMINISTRATOR } = require('../discord');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports.chunk = async (msg, chunkSize, sendFn, chuckHeader = '', chunkFooter = '') => {
  chunkSize = chunkSize - chuckHeader.length - chunkFooter.length;
  let msgLength = 0;
  let idx = 0;
  for (let i = 0; i < msg.length; i++) {
    if (msgLength + msg[i].length > chunkSize) {
      sendFn(chuckHeader + msg.slice(idx, i).join('\n') + chunkFooter);
      idx = i;
      msgLength = 0;
      await sleep(1000);
    }
    msgLength += msg[i].length;
  }
  sendFn(chuckHeader + msg.slice(idx, msg.length).join('\n') + chunkFooter);
};

module.exports.deleteMsg = async msg => {
  msg.delete(1000).catch(e => {});
};

module.exports.mapToNick = member => {
  const arr = message.guild.members.array();
  for (let i = 0; i < arr.length; i++) {
    if (arr[i].user.username === member) {
      if (arr[i].nickname === null) {
        break;
      }
      return { userid: member, nick: arr[i].nickname };
    }
  }
  return { userid: member, nick: member };
};

module.exports.isOwner = message => message.channel.guild.ownerID === message.author.id;
module.exports.isAdmin = message => module.exports.isOwner(message) || message.member.permissions.has(ADMINISTRATOR);
