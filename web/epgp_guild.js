const { db, bots } = require('../db');
const discord = require('../discord');
const botUrl = discord.botUrl;
const request = require('request');
const { logger } = require('../logger');
const { client } = require('../bot/botserver');
const { chunk } = require('../bot/discord-util');
const { props } = require('../props');
const moment = require('moment');
const _ = require('lodash');
const { isCEPGP, rosterToTabList } = require('../util');
const GENERIC_ERROR = new Error('Invalid Guild ID');
const getGuild = req => req.session.guilds.find(g => g.id === req.params.guildid);
const isUserOfGuild = (guild, admin) => guild && (admin !== true || guild.admin === admin);
const isAdminOfGuild = guild => isUserOfGuild(guild, true);
const isAdmin = req => isUser(req, true);
const isUser = (req, admin) => isUserOfGuild(getGuild(req), admin);

module.exports.addguild = (req, res) => {
  const guild = getGuild(req);
  if (!isAdminOfGuild(guild)) throw GENERIC_ERROR;

  // Set default EPGP Manager role
  guild.epgpManager = 'EPGP Manager';

  db.insert(guild, (err, doc) => {
    if (err) throw new Error(err);
    res.redirect('/epgp/' + doc.id);
  });
};

function generateSearch(guildid) {
  if (/^\d+$/.test(guildid)) {
    return { id: guildid };
  } else {
    return { name: { $regex: new RegExp('^' + guildid.split('-').join('.') + '$', 'i') } };
  }
}

function itemParse(item) {
  const epgpClassicParse = item && ('' + item).match(/^item:(\d+):/);
  if (epgpClassicParse && epgpClassicParse.length > 1) {
    return epgpClassicParse[1];
  }
  return item;
}

module.exports.viewguild = (req, res) => {
  const guild = client.guilds.cache.get(req.params.guildid);
  const raidteam = req.params.raidteam;

  if (!guild) {
    logger.info('EP/GP BOT not installed in guild: ' + req.params.guildid);
    req.session.epgpManager = false;
    viewGuildCallback(req, res);
    return;
  }

  db.findOne({ id: req.params.guildid }, (err, guildDB) => {
    if (err) logger.error(err);

    guild.members
      .fetch(req.session.discord_user.id, false)
      .then(member => {
        const epgpManager = member.roles.cache.find(r => r.name === guildDB.epgpManager);
        req.session.epgpManager = Boolean(epgpManager);
        logger.info('EP/GP User: ' + member.user.username + ' has EPGP Manager role: ' + guildDB.epgpManager + '=' + req.session.epgpManager);
        viewGuildCallback(req, res);
      })
      .catch(err => {
        logger.error('EP/GP cannot fetch member: ' + req.session.discord_user.id);
        logger.error(err);
        req.session.epgpManager = false;
        viewGuildCallback(req, res);
      });
  });
};

function viewGuildCallback(req, res) {
  const guildid = req.params.guildid;
  db.findOne(generateSearch(guildid), (err, guild) => {
    if (err) logger.error(err);
    if (!isUserOfGuild(guild)) {
      res.redirect('/epgp');
      return;
    }
    const index = req.query.index || (guild.backups || []).length - 1;
    const current = guild.backups && guild.backups[index];
    let customJson = {};
    let latestLoot;
    const canCustomize = current && current.roster && current.roster.length > 0 && !isCEPGP(current.roster[0]);
    if (current) {
      customJson = _.keyBy(
        current.roster.map(entry => guildAliasMap(guild, entry)),
        'name'
      );
      _.forEach(customJson, (v, _k) => {
        v.name = undefined;
      });
      current.roster = current.roster.map(entry => guildMemberMap(guild, entry)).sort((a, b) => (a.displayName || '').localeCompare(b.displayName));
      const latestLootCount = Math.max(0, _.isUndefined(guild.latestLootCount) ? 10 : guild.latestLootCount);
      if (current.loot && current.loot.length > 0 && latestLootCount > 0) {
        latestLoot = current.loot
          .sort((o1, o2) => o2[0] - o1[0])
          .filter(o => o[1] !== 'Guild Bank')
          .slice(0, latestLootCount)
          .map(itemRow => {
            return { name: itemRow[1], displayName: displayName(guild, itemRow[1]), class: displayClass(guild, itemRow[1]), item: itemParse(itemRow[2]) };
          });
      }
    }
    canUpload(req, canUpload =>
      res.render('guild', {
        latestLoot,
        canCustomize,
        canUpload,
        isAdmin: isAdmin(req),
        guild,
        index,
        current,
        customJson: JSON.stringify(customJson, null, 2)
      })
    );
  });
}

function guildAliasMap(guild, member) {
  if (isCEPGP(member)) {
    return {
      name: member[0],
      displayName: member[0],
      class: member[1],
      note: member[2]
    };
  }
  return {
    name: member[0],
    displayName: displayName(guild, member[0]),
    class: displayClass(guild, member[0]),
    note: displayNote(guild, member[0])
  };
}

function guildMemberMap(guild, member) {
  if (isCEPGP(member)) {
    return _.merge(guildAliasMap(guild, member), {
      ep: member[3],
      gp: member[4],
      pr: member[5]
    });
  }
  return _.merge(guildAliasMap(guild, member), {
    ep: member[1],
    gp: member[2],
    pr: member[2] === 0 ? NaN : _.round(member[1] / member[2], 2)
  });
}

function getAlias(guild, member) {
  return (guild.aliases && guild.aliases[member] && guild.aliases[member]) || {};
}

function displayName(guild, member) {
  const alias = getAlias(guild, member).alias;
  if (alias) {
    return alias;
  }
  const idx = member.lastIndexOf('-');
  if (idx !== -1) {
    return member.substring(0, idx);
  }
  return member;
}

function displayClass(guild, member) {
  return getAlias(guild, member).class || '';
}

function displayNote(guild, member) {
  return getAlias(guild, member).note || '';
}

function median(values) {
  values.sort(function(a, b) {
    return a - b;
  });

  var half = Math.floor(values.length / 2);

  if (values.length % 2) return values[half];
  else return (values[half - 1] + values[half]) / 2.0;
}

// Squish loot times to every 15 minutes to filter out duplicates
// Loot lists from separate clients seem to be not perfect on timestamps
function squishTimestamp(timestamp) {
  let unixTimestamp = _.toInteger(timestamp);
  return unixTimestamp - (unixTimestamp % 900);
}

module.exports.viewloot = (req, res) => {
  const guildid = req.params.guildid;
  const member = req.params.member;
  if (!isUser(req)) throw GENERIC_ERROR;
  db.findOne({ id: guildid }, (err, guild) => {
    if (err) throw new Error(err);
    const alias = ((guild.aliases || {})[member] || {}).alias;
    const wowheadDomain = guild.wowheadDomain || 'tbc';
    const days = req.query.days || guild.lootDays || 180;
    const gpData = [];
    const epData = [];
    const prData = [];
    let prs = [];
    let maxEpgp = 100;
    let noLootList = false;
    const dateFrom = days == -1 ? 0 : Date.now() - 1000 * 60 * 60 * 24 * days;
    let loot = [
      ...new Set(
        (guild.backups || [])
          .filter(b => {
            b.dt = _.toInteger(b.timestamp) * 1000;
            return b.dt > dateFrom;
          })
          .map(b => {
            b.roster
              .filter(arr => arr[0] === member)
              .map(arr => {
                if (isCEPGP(arr)) {
                  noLootList = true;
                  return [arr[0], arr[3], arr[4]];
                } else {
                  return arr;
                }
              })
              .forEach(arr => {
                maxEpgp = Math.max(maxEpgp, arr[1], arr[2]);
                const pr = _.toInteger((arr[1] / arr[2]) * 100) / 100;
                prs.push(pr);
                epData.push({ t: b.dt, y: arr[1] });
                gpData.push({ t: b.dt, y: arr[2] });
                prData.push({ t: b.dt, y: pr });
              });
            return b.loot || [];
          })
          .reduce((arr, v) => arr.concat(v), [])
          .filter(arr => member === arr[1] || (alias !== undefined && arr[1].startsWith(alias)))
          .map(arr => {
            let timestamp = arr[0];
            if (guild.enableDuplicateFilter) {
              timestamp = squishTimestamp(timestamp);
            }
            return timestamp + '~~~' + arr[2] + '~~~' + arr[3];
          })
      )
    ]
      .map(str => str.split('~~~'))
      .map(arr => {
        return {
          date: new Date(_.toInteger(arr[0]) * 1000),
          item: itemParse(arr[1]),
          gp: _.toInteger(arr[2])
        };
      })
      .sort((o1, o2) => o1.date - o2.date);
    if (guild.enableRefundFilter) {
      let last = undefined;
      const trueNegative = [];
      const refunded = loot.reverse().filter(item => {
        if (item.gp < 0) {
          logger.debug('Marking item ' + item.item + '/' + item.gp + ' as a refunded item. ');
          return true;
        }
        return false;
      });
      loot = loot.filter(item => {
        if (refunded.length > 0) {
          const next = refunded[0];
          if (next.gp === -item.gp && next.item === item.item) {
            logger.debug('Filtering out refunded item ' + item.item + ' and a GP value of ' + item.gp);
            refunded.shift();
            last = undefined;
            return false;
          }
          if (next.gp === item.gp && next.item === item.item) {
            if (last) {
              trueNegative.push(last);
            }
            last = next;
            logger.debug('Filtering out refunded item ' + item.item + ' and a GP value of ' + item.gp);
            return false;
          }
        }
        return true;
      });
      if (last) {
        trueNegative.push(last);
        logger.debug('Unaccounted for refunded item ' + last.item + ' and a GP value of ' + last.gp);
      }
      if (trueNegative.length > 0) {
        logger.debug('Some negative priced items were not refunds, adding back in: ' + trueNegative.map(item => item.item + '/' + item.gp).join(', '));
        loot = loot.concat(trueNegative).sort((o1, o2) => o1.date - o2.date);
      }
    }
    res.render('loot', {
      avgPr: median(prs),
      maxEpgp,
      prData,
      gpData,
      epData,
      guild,
      loot,
      noLootList,
      member,
      displayName: displayName(guild, member),
      wowheadDomain
    });
  });
};

module.exports.viewexport = (req, res) => {
  canUpload(req, canUpload => {
    if (!canUpload) {
      res.json({});
    } else {
      const guildid = req.params.guildid;
      db.findOne({ id: guildid }, (err, guild) => {
        if (err) {
          logger.error(err);
          res.json({});
        } else {
          const index = req.query.index || (guild.backups || []).length - 1;
          const backup = (index === -1 ? {} : guild.backups && guild.backups[index]) || {};
          delete backup.uploadedDate;
          delete backup.timestampDate;
          res.json(backup);
        }
      });
    }
  });
};

module.exports.viewbot = (req, res) => {
  const guildid = req.params.guildid;
  if (!isUser(req)) throw GENERIC_ERROR;
  const model = { isAdmin: isAdmin(req), botUrl };
  db.findOne({ id: guildid }, (err, guild) => {
    if (err) logger.error(err);
    model.guild = guild;
    bots.findOne({ id: guildid }, (err, bot) => {
      if (err) logger.error(err);
      model.bot = bot;
      res.render('bot', model);
    });
  });
};

module.exports.config = (req, res) => {
  const guildid = req.params.guildid;
  if (!isAdmin(req)) throw GENERIC_ERROR;
  const isGeneralForm = req.body.isGeneral === 'true';
  const setValues = {};
  const setGuildValues = {};
  if (req.body.disableBot) {
    setValues.disabled = req.body.disableBot === 'true';
  }
  if (req.body.disableBot) {
    setValues.disabled = req.body.disableBot === 'true';
  }
  if (req.body.lootDays) {
    const lootDays = _.toInteger(req.body.lootDays);
    if (lootDays > 0) {
      setGuildValues.lootDays = lootDays;
    } else if (lootDays == 0) {
      setGuildValues.lootDays = undefined;
    } else {
      setGuildValues.lootDays = -1;
    }
  }
  if (req.body.discordUploadPermission) {
    const permissions = Array.isArray(req.body.discordUploadPermission) ? req.body.discordUploadPermission : [req.body.discordUploadPermission];
    let mask = 0;
    _.forEach(permissions, perm => (mask |= discord[perm]));
    setGuildValues.discordUploadPermission = mask;
  } else if (isGeneralForm) {
    setGuildValues.discordUploadPermission = 0x00;
  }
  if (req.body.webhook) {
    const webhook = req.body.webhook.trim();
    if (webhook === '' || webhook.startsWith('https://discordapp.com/api/webhooks') || webhook.startsWith('https://discord.com/api/webhooks')) {
      setGuildValues.webhook = webhook;
    } else {
      logger.error('Bad webhook URL: ' + webhook);
      res.redirect('/bot/' + guildid);
      return;
    }
  }
  if (['classic', 'www', 'tbc'].indexOf(req.body.wowheadDomain) != -1) {
    setGuildValues.wowheadDomain = req.body.wowheadDomain;
  }
  if (req.body.latestLootCount) {
    setGuildValues.latestLootCount = _.toInteger(req.body.latestLootCount);
  }
  if (req.body.discordColumnSpacing) {
    const spacing = _.toInteger(req.body.discordColumnSpacing);
    setGuildValues.discordColumnSpacing = Math.min(Math.max(spacing, 2), 10);
  }
  if (isGeneralForm) {
    setGuildValues.enableRefundFilter = req.body.enableRefundFilter === 'true';
    setGuildValues.enableDuplicateFilter = req.body.enableDuplicateFilter === 'true';
  }
  logger.debug('Updating configuration: ' + JSON.stringify(_.merge(setValues, setGuildValues)));
  bots.update({ id: guildid }, { $set: setValues }, {}, (err, _updatedCount) => {
    if (err) logger.error(err);
    db.update({ id: guildid }, { $set: setGuildValues }, {}, (err2, _updatedCount2) => {
      if (err2) logger.error(err2);
      res.redirect('/bot/' + guildid);
    });
  });
};

module.exports.deleteguild = (req, res) => {
  const guildid = req.params.guildid;
  if (!isAdmin(req)) throw GENERIC_ERROR;
  db.remove({ id: guildid }, (err, _numRemoved) => {
    if (err) throw new Error(err);
    res.redirect('/epgp');
  });
};

function validateSchema(json) {
  return _.isArray(json.roster) && ((json.guild && json.region && _.isArray(json.loot)) || (json.roster.length > 0 && isCEPGP(json.roster[0])));
}

function canUpload(req, callback) {
  if (isAdmin(req)) {
    callback(true);
  } else {
    const g = getGuild(req);
    if (!g) {
      callback(false);
    } else {
      const guildid = req.params.guildid;
      db.findOne({ id: guildid }, (err, guild) => {
        if (err) {
          logger.error(err);
          callback(false);
        }
        const discordUploadPermission = guild.discordUploadPermission || 0x00;
        callback((discordUploadPermission & g.permissions) !== 0 || req.session.epgpManager);
      });
    }
  }
}

module.exports.uploadbackup = (req, res) => {
  const guildid = req.params.guildid;
  canUpload(req, canUpload => {
    if (!canUpload) throw GENERIC_ERROR;
    const uploadBackup = JSON.parse(req.body.uploadBackup);
    if (!validateSchema(uploadBackup)) {
      res.redirect('/epgp/' + guildid + '?message=' + encodeURIComponent('Invalid Backup JSON'));
    } else {
      uploadBackup.uploadedDate = new Date();
      // Unix timestamp to .js timestamp
      uploadBackup.timestampDate = new Date(uploadBackup.timestamp * 1000);
      db.update({ id: guildid }, { $push: { backups: uploadBackup } }, {}, err => {
        if (err) throw new Error(err);
        logger.debug('Backup uploaded');
        db.findOne({ id: guildid }, (err, guild) => {
          if (err) {
            logger.error(err);
            return;
          }
          if (guild && guild.webhook && guild.webhook.startsWith('http')) {
            const formattedList = rosterToTabList(uploadBackup.roster, guild.discordColumnSpacing);
            const chunkFooter = formattedList.chunkFooter + `[See full details](<${props.hostname}${props.extPortString}/epgp/${guildid}/>)`;
            const chunkHeader = moment(uploadBackup.timestampDate).format('YYYY-MM-DD HH:mm') + formattedList.chunkHeader;
            const msg = formattedList.roster;
            chunk(
              msg,
              1900,
              content => {
                request(
                  {
                    method: 'POST',
                    url: guild.webhook,
                    headers: {
                      'Content-Type': 'application/json',
                      Accept: 'application/json'
                    },
                    body: JSON.stringify({ content })
                  },
                  (error, response, body) => {
                    if (error) {
                      logger.error(error);
                    } else if (response.statusCode !== 200 && response.statusCode !== 204) {
                      logger.error('Bad Status on webhook response: ' + response.statusCode + '\n\n' + body);
                    }
                  }
                );
              },
              chunkHeader,
              chunkFooter
            );
          }
          res.redirect('/epgp/' + guildid);
        });
      });
    }
  });
};

function validateImportSchema(json) {
  return Object.keys(json).length > 0 && Object.keys(json).every(k => k.indexOf('-') !== -1);
}

function validateClass(clazz) {
  clazz = (clazz || '').trim();
  return clazz.match(/^(Druid|Hunter|Mage|Paladin|Priest|Rogue|Shaman|Warlock|Warrior)$/) ? clazz : undefined;
}

module.exports.addAlias = (req, res) => {
  const guildid = req.params.guildid;
  if (!isAdmin(req)) throw GENERIC_ERROR;
  db.findOne({ id: guildid }, (err, guild) => {
    if (err) logger.error(err);
    if (req.body.advancedImport) {
      const advancedImport = JSON.parse(req.body.advancedImport);
      Object.keys(advancedImport).forEach(k => {
        advancedImport[k] = _.pick(advancedImport[k], ['displayName', 'class', 'note']);
        advancedImport[k].class = validateClass(advancedImport[k].class);
        advancedImport[k].alias = advancedImport[k].displayName;
        advancedImport[k].displayName = undefined;
      });
      if (!validateImportSchema(advancedImport)) {
        logger.warn('Invalid JSON Schema -- skipping alias update');
        console.log(advancedImport);
        res.redirect('/epgp/' + guildid);
        return;
      } else {
        guild.aliases = advancedImport;
      }
    } else if (
      req.body.characterName &&
      req.body.characterName.indexOf('-') !== -1 &&
      (req.body.characterAlias || req.body.characterNote || req.body.characterClass)
    ) {
      const alias = (req.body.characterAlias || '').trim();
      const note = (req.body.characterNote || '').trim();
      guild.aliases = guild.aliases || {};
      guild.aliases[req.body.characterName] = {
        alias: alias === '' ? req.body.characterName.substring(0, req.body.characterName.lastIndexOf('-')) : alias,
        class: validateClass(req.body.characterClass),
        note: note === '' ? undefined : note
      };
    } else {
      logger.warn('Invalid form submission -- skipping alias update');
      console.log(req.body);
      res.redirect('/epgp/' + guildid);
      return;
    }
    db.update({ id: guildid }, guild, {}, err => {
      if (err) throw new Error(err);
      res.redirect('/epgp/' + guildid);
    });
  });
};
