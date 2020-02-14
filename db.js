const homedir = require('os').homedir();
const Datastore = require('nedb');

module.exports = new Datastore({ filename: homedir + '/guilds.db', autoload: true });
module.exports.persistence.setAutocompactionInterval(1000 * 60);
