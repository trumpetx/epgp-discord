const homedir = require('os').homedir();
const Datastore = require('nedb');

module.exports.db = new Datastore({ filename: homedir + '/guilds.db', autoload: true });
module.exports.db.persistence.setAutocompactionInterval(1000 * 60);
module.exports.bots = new Datastore({ filename: homedir + '/bots.db', autoload: true });
module.exports.bots.persistence.setAutocompactionInterval(1000 * 60);
