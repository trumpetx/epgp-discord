// https://discordapp.com/developers/docs/topics/permissions
const PERM_ADMIN = 0x00000008;

module.exports.chunk = async (msg, chunkSize, sendFn) => {
  let msgLength = 0;
  let idx = 0;
  for (let i = 0; i < msg.length; i++) {
    if (msgLength + msg[i].length > chunkSize) {
      sendFn(msg.slice(idx, i).join('\n'));
      idx = i;
      msgLength = 0;
      await sleep(1000);
    }
    msgLength += msg[i].length;
  }
  sendFn(msg.slice(idx, msg.length).join('\n'));
}

module.exports.deleteMsg = async (msg) => { 
  msg.delete(1000).catch(e => {});
};

module.exports.mapToNick = (member) => {
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


module.exports.isOwner = (message) => message.channel.guild.ownerID === message.author.id;
module.exports.isAdmin = (message) => isOwner(message) || message.member.hasPermission(PERM_ADMIN);
