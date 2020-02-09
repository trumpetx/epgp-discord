const homedir = require('os').homedir();
const Datastore = require('nedb');
const _ = require('lodash');
const db = {};
db.guilds = new Datastore({ filename: homedir + '/guilds.db', autoload: true });
db.users = new Datastore({ filename: homedir + '/users.db', autoload: true });

_.forEach(db, (v, _k) => v.setAutocompactionInterval(1000 * 60));
