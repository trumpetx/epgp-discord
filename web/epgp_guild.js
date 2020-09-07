const { db, bots } = require('../db');
const { botUrl } = require('../discord');
const request = require('request');
const { logger } = require('../logger');
const { chunk } = require('../bot/discord-util');
const { props } = require('../props');
const moment = require('moment');
const _ = require('lodash');
const GENERIC_ERROR = new Error('Invalid Guild ID');
const getGuild = req => req.session.guilds.find(g => g.id === req.params.guildid);
const isUserOfGuild = (guild, admin) => guild && (admin !== true || guild.admin === admin);
const isAdminOfGuild = guild => isUserOfGuild(guild, true);
const isAdmin = req => isUser(req, true);
const isUser = (req, admin) => isUserOfGuild(getGuild(req), admin);

module.exports.addguild = (req, res) => {
  const guild = getGuild(req);
  if (!isAdminOfGuild(guild)) throw GENERIC_ERROR;
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
  const epgpClassicParse = item && (''+item).match(/^item:(\d+):/);
  if (epgpClassicParse && epgpClassicParse.length > 1) {
    return epgpClassicParse[1];
  }
  return item;
}

module.exports.viewguild = (req, res) => {
  const guildid = req.params.guildid;
  db.findOne(generateSearch(guildid), (err, guild) => {
    if (err) throw new Error(err);
    if (!isUserOfGuild(guild)) throw GENERIC_ERROR;
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
    res.render('guild', { latestLoot, canCustomize, isAdmin: isAdmin(req), guild, index, current, customJson: JSON.stringify(customJson, null, 2) });
  });
};

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

function isCEPGP(memberArray) {
  return memberArray.length === 6;
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
    const wowheadDomain = guild.wowheadDomain || 'classic';
    const gpData = [];
    const epData = [];
    const prData = [];
    let prs = [];
    let maxEpgp = 100;
    let noLootList = false;
    const refundedList = {};
    let loot = [
      ...new Set(
        (guild.backups || [])
          .map(b => {
            const dt = _.toInteger(b.timestamp) * 1000;
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
                epData.push({ t: dt, y: arr[1] });
                gpData.push({ t: dt, y: arr[2] });
                prData.push({ t: dt, y: pr });
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
  const guildid = req.params.guildid;
  if (!isAdmin(req)) throw GENERIC_ERROR;
  db.findOne({ id: guildid }, (err, guild) => {
    if (err) logger.error(err);
    const index = req.query.index || (guild.backups || []).length - 1;
    const backup = index === -1 ? {} : guild.backups && guild.backups[index];
    delete backup.uploadedDate;
    delete backup.timestampDate;
    res.json(backup);
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
  const setValues = {};
  const setGuildValues = {};
  if (req.body.disableBot) {
    setValues.disabled = req.body.disableBot === 'true';
  }
  if (req.body.disableBot) {
    setValues.disabled = req.body.disableBot === 'true';
  }
  if (req.body.webhook) {
    const webhook = req.body.webhook.trim();
    if (webhook === '' || webhook.startsWith('https://discordapp.com/api/webhooks')) {
      setValues.webhook = webhook;
    } else {
      logger.error('Bad webhook URL: ' + webhook);
      res.redirect('/bot/' + guildid);
      return;
    }
  }
  if (['classic', 'www'].indexOf(req.body.wowheadDomain) != -1) {
    setGuildValues.wowheadDomain = req.body.wowheadDomain;
  }
  if (req.body.latestLootCount) {
    setGuildValues.latestLootCount = _.toInteger(req.body.latestLootCount);
  }
  // HACK: rather than rely on having 2x checkboxes,
  // we're just using the knowledge of whether something else was submitted to know whether this was as well.
  if (Object.keys(setGuildValues).length > 0) {
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

/**

{"guild":"Magma Carta Club","region":"us","min_ep":0,"base_gp":1,"roster":[["Slyfrost-Pagle",18,100],
["Laathan-Pagle",240,1],["Laurentia-Pagle",217,45],["Artan-Pagle",240,1],["Ghend-Pagle",240,142],["T\u00FFgar-Pagle",138,117],["Linaera-Pagle",230,1],
["Crakel-Pagle",240,30],["Chronosduex-Pagle",232,90],["D\u00E5ggerz-Pagle",120,1],["Ellowynn-Pagle",240,1],["Miralei-Pagle",138,75],["Nickerdood-Pagle",230,1],
["Aravel-Pagle",240,169],["Zerofox-Pagle",128,1],["Situation-Pagle",240,190],["Sinceles-Pagle",125,1],["Ronaldstump-Pagle",240,31],["Chuckleboo-Pagle",240,85],
["Bruizzer-Pagle",230,118],["Caedens-Pagle",240,170],["Estrojenn-Pagle",18,1],["Clamara-Pagle",240,92],["Raidhealer-Pagle",222,119],["Kitiania-Pagle",240,1],
["Sindur-Pagle",10,100],["Emmalee-Pagle",240,64],["Doolil-Pagle",240,186],["Kleo-Pagle",240,53],["Exekute-Pagle",240,73],["Paramite-Pagle",240,80],
["Mustain\u00E9-Pagle",120,158],["Inyoface-Pagle",101,1],["Thehammerin-Pagle",240,1],["Cascade-Pagle",120,31],["Nassere-Pagle",160,1],["Dairyfresh-Pagle",240,226],
["Maxenjoy-Pagle",101,85],["Neakpky-Pagle",128,87],["Culotte-Pagle",222,25],["Allorraxx-Pagle",227,87],["Wasserb\u00E4r-Pagle",232,1],["Effinlazy-Pagle",240,75],
["Roxie-Pagle",230,186],["Bobsalterego-Pagle",101,1],["Maliki-Pagle",240,33],["Linoge-Pagle",222,74]],"decay_p":15,
"loot":[[1580520257,"Nassere-Pagle","item:18813::::::::60:::::::",910],[1580520480,"T\u00FFgar-Pagle","item:18423::::::::60:::::::",975],
[1580952522,"Mustain\u00E9-Pagle","item:16863::::::::60:::::::",750],[1580952543,"Ronaldstump-Pagle","item:16800::::::::60:::::::",750],
[1580952957,"Mustain\u00E9-Pagle","item:16867::::::::60:::::::",1000],[1580953003,"Linoge-Pagle","item:16822::::::::60:::::::",1000],
[1580953204,"Guild Bank","item:16858::::::::60:::::::",0],[1580953897,"Exekute-Pagle","item:16862::::::::60:::::::",0],
[1580953947,"Situation-Pagle","item:16812::::::::60:::::::",750],[1580953952,"Guild Bank","item:16802::::::::60:0::::::",0],[1580953963,"Guild Bank","item:16802::::::::60:::::::",0],
[1580954110,"Guild Bank","item:16861::::::::60:::::::",0],[1580954651,"Maliki-Pagle","item:16866::::::::60:::::::",1000],[1580954697,"Ghend-Pagle","item:16808::::::::60:::::::",1000],
[1580954771,"Bruizzer-Pagle","item:17105::::::::60:::::::",1847],[1580955531,"Paramite-Pagle","item:16807::::::::60:::::::",750],[1580955558,"Cascade-Pagle","item:16836::::::::60:::::::",750],
[1580955998,"Raidhealer-Pagle","item:16811::::::::60:::::::",750],[1580956194,"Guild Bank","item:16799::::::::60:::::::",0],[1580957216,"Guild Bank","item:16799::::::::60:0::::::",0],
[1580957296,"Linoge-Pagle","item:16823::::::::60:::::::",750],[1580957884,"Nassere-Pagle","item:16865::::::::60:::::::",0],[1580957929,"Smidgen-Pagle","item:16798::::::::60:::::::",1000],
[1580958005,"Chronosduex-Pagle","item:17103::::::::60:::::::",2121],[1580958514,"Situation-Pagle","item:18646::::::::60:::::::",3732],[1580958604,"Laathan-Pagle","item:18811::::::::60:::::::",0],
[1580958668,"Laurentia-Pagle","item:18810::::::::60:::::::",1061],[1580960261,"Exekute-Pagle","item:19137::::::::60:::::::",1723],[1580960322,"Caedens-Pagle","item:18817::::::::60:::::::",2000],
[1580960365,"Maxenjoy-Pagle","item:16954::::::::60:::::::",2000],[1580960397,"Chuckleboo-Pagle","item:16930::::::::60:::::::",2000],[1580994623,"Mustain\u00E9-Pagle","item:16866::::::::60:::::::",1000],
[1580994648,"Maliki-Pagle","item:16866::::::::60:::::::",-1000],[1580996210,"Kleo-Pagle","item:16831::::::::60:::::::",750],[1580996240,"Kleo-Pagle","item:16831::::::::60:::::::",-750],
[1580996291,"Aravel-Pagle","item:16848::::::::60:::::::",750],[1580996380,"Culotte-Pagle","item:18821::::::::60:::::::",600],[1581124366,"Mustain\u00E9-Pagle","item:18423::::::::60:::::::",975],
[1581124503,"T\u00FFgar-Pagle","item:18705::::::::60:::::::",1000],[1581124540,"Maliki-Pagle","item:18205::::::::60:::::::",792],[1581124573,"Caedens-Pagle","item:16939::::::::60:::::::",2000],
[1581124614,"Dairyfresh-Pagle","item:16929::::::::60:::::::",2000],[1581381734,"Kitiania-Pagle","item:16798::::::::60:::::::",1000],[1581381739,"Kitiania-Pagle","item:16798::::::::60:::::::",-2000],
[1581384134,"Slyfrost-Pagle","item:16914::::::::60:::::::",2000],[1581384186,"Paramite-Pagle","item:18423::::::::60:::::::",975],[1581384216,"Dairyfresh-Pagle","item:17078::::::::60:::::::",849],
[1581557168,"Damia-Pagle","item:16863::::::::60:::::::",0],[1581557213,"Isvail-Pagle","item:16859::::::::60:::::::",750],[1581557602,"Isvail-Pagle","item:16855::::::::60:::::::",1000],
[1581557675,"Crakel-Pagle","item:17069::::::::60:::::::",616],[1581557731,"Guild Bank","item:18824::::::::60:::::::",0],[1581558307,"T\u00FFgar-Pagle","item:16849::::::::60:::::::",750],
[1581558422,"Miralee-Pagle","item:16812::::::::60:::::::",750],[1581558499,"Guild Bank","item:16817::::::::60:::::::",0],[1581559193,"Rumad-Pagle","item:16846::::::::60:::::::",1000],
[1581559234,"Neakpky-Pagle","item:16795::::::::60:::::::",1000],[1581559290,"Clamara-Pagle","item:17105::::::::60:::::::",1847],[1581559943,"Neakpky-Pagle","item:16797::::::::60:::::::",750],
[1581559974,"Guild Bank","item:16856::::::::60:::::::",0],[1581560963,"T\u00FFgar-Pagle","item:16852::::::::60:::::::",750],[1581561012,"Miralee-Pagle","item:16811::::::::60:::::::",750],
[1581561852,"Effinlazy-Pagle","item:16848::::::::60:::::::",750],[1581561898,"Thehammerin-Pagle","item:18861::::::::60:::::::",0],[1581562488,"Isvail-Pagle","item:16853::::::::60:::::::",1000],
[1581562514,"Raidhealer-Pagle","item:16815::::::::60:::::::",1000],[1581562545,"Stela-Pagle","item:19136::::::::60:::::::",1061],[1581563322,"Olysheet-Pagle","item:18646::::::::60:::::::",3732],
[1581563358,"Bruizzer-Pagle","item:19140::::::::60:::::::",792],[1581563397,"Dairyfresh-Pagle","item:18808::::::::60:::::::",990],[1581563414,"Guild Bank","item:16851::::::::60:::::::",0],
[1581564655,"Roxie-Pagle","item:19137::::::::60:::::::",1723],[1581564725,"Roxie-Pagle","item:16962::::::::60:::::::",2000],[1581564766,"Emmalee-Pagle","item:19138::::::::60:::::::",1287],
[1581564800,"Chronosduex-Pagle","item:16954::::::::60:::::::",2000],[1581565306,"Raidhealer-Pagle","item:16817::::::::60:::::::",750],[1581565416,"Effinlazy-Pagle","item:16851::::::::60:::::::",750],
[1581565448,"Allorraxx-Pagle","item:16851::::::::60:::::::",750],[1581566767,"Chronosduex-Pagle","item:16954::::::::60:::::::",-2000]],"timestamp":1582031872,"extras_p":100,"realm":"Pagle"}

 */
function validateSchema(json) {
  return _.isArray(json.roster) && ((json.guild && json.region && _.isArray(json.loot)) || (json.roster.length > 0 && isCEPGP(json.roster[0])));
}

module.exports.uploadbackup = (req, res) => {
  const guildid = req.params.guildid;
  if (!isAdmin(req)) throw GENERIC_ERROR;
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
          // TODO: remove dupe code from here and message.js
          const chunkHeader = moment(uploadBackup.timestampDate).format('YYYY-MM-DD HH:mm') + '```\nName                     EP          GP          PR\n';
          const chunkFooter = '```' + `[See full details](<${props.hostname}${props.extPortString}/epgp/${guildid}/>)`;
          const msg = [];
          const calcPr = entry => (_.toNumber(entry[1]) / _.toNumber(entry[2])).toFixed(2);
          uploadBackup.roster
            .map(arr => {
              if (isCEPGP(arr)) {
                return [arr[0], arr[3], arr[4]];
              } else {
                return arr;
              }
            })
            .sort((e1, e2) => calcPr(e2) - calcPr(e1))
            .forEach(entry => {
              let name = entry[0];
              const idx = name.lastIndexOf('-');
              if (idx !== -1) {
                name = name.substring(0, idx);
              }
              name = name.padEnd(25, ' ');
              const ep = ('' + entry[1]).padEnd(12, ' ');
              const gp = ('' + entry[2]).padEnd(12, ' ');
              const pr = calcPr(entry);
              if (pr > 0) {
                msg.push(`${name}${ep}${gp}${pr}`);
              }
            });
          chunk(
            msg,
            1900,
            content => {
              request(
                {
                  method: 'POST',
                  url: bot.webhook,
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
