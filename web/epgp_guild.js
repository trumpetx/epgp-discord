const { db, bots } = require('../db');
const { botUrl } = require('../discord');
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

module.exports.viewguild = (req, res) => {
  const guildid = req.params.guildid;
  if (!isUser(req)) throw GENERIC_ERROR;
  db.findOne({ id: guildid }, (err, guild) => {
    if (err) throw new Error(err);
    const index = req.query.index || (guild.backups || []).length - 1;
    res.render('guild', { guild, index, current: guild.backups && guild.backups[index] });
  });
};

module.exports.viewbot = (req, res) => {
  const guildid = req.params.guildid;
  if (!isUser(req)) throw GENERIC_ERROR;
  const model = isAdmin(req) ? { botUrl } : {};
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

module.exports.editbot = (req, res) => {
  const guildid = req.params.guildid;
  if (!isAdmin(req)) throw GENERIC_ERROR;
  console.log(req.body);
  const disableBot = req.body.disableBot === 'true';
  bots.update({ id: guildid }, { $set: { disabled: disableBot } }, {}, (err, _updatedCount) => {
    err && logger.error(err);
    res.redirect('/bot/' + guildid);
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
 
{"guild":"Magma Carta Club","region":"us","min_ep":0,"base_gp":1,"roster":[["Slyfrost-Pagle",18,100],["Laathan-Pagle",240,1],["Laurentia-Pagle",217,45],["Artan-Pagle",240,1],["Ghend-Pagle",240,142],["T\u00FFgar-Pagle",138,117],["Linaera-Pagle",230,1],["Crakel-Pagle",240,30],["Chronosduex-Pagle",232,90],["D\u00E5ggerz-Pagle",120,1],["Ellowynn-Pagle",240,1],["Miralei-Pagle",138,75],["Nickerdood-Pagle",230,1],["Aravel-Pagle",240,169],["Zerofox-Pagle",128,1],["Situation-Pagle",240,190],["Sinceles-Pagle",125,1],["Ronaldstump-Pagle",240,31],["Chuckleboo-Pagle",240,85],["Bruizzer-Pagle",230,118],["Caedens-Pagle",240,170],["Estrojenn-Pagle",18,1],["Clamara-Pagle",240,92],["Raidhealer-Pagle",222,119],["Kitiania-Pagle",240,1],["Sindur-Pagle",10,100],["Emmalee-Pagle",240,64],["Doolil-Pagle",240,186],["Kleo-Pagle",240,53],["Exekute-Pagle",240,73],["Paramite-Pagle",240,80],["Mustain\u00E9-Pagle",120,158],["Inyoface-Pagle",101,1],["Thehammerin-Pagle",240,1],["Cascade-Pagle",120,31],["Nassere-Pagle",160,1],["Dairyfresh-Pagle",240,226],["Maxenjoy-Pagle",101,85],["Neakpky-Pagle",128,87],["Culotte-Pagle",222,25],["Allorraxx-Pagle",227,87],["Wasserb\u00E4r-Pagle",232,1],["Effinlazy-Pagle",240,75],["Roxie-Pagle",230,186],["Bobsalterego-Pagle",101,1],["Maliki-Pagle",240,33],["Linoge-Pagle",222,74]],"decay_p":15,"loot":[[1580520257,"Nassere-Pagle","item:18813::::::::60:::::::",910],[1580520480,"T\u00FFgar-Pagle","item:18423::::::::60:::::::",975],[1580952522,"Mustain\u00E9-Pagle","item:16863::::::::60:::::::",750],[1580952543,"Ronaldstump-Pagle","item:16800::::::::60:::::::",750],[1580952957,"Mustain\u00E9-Pagle","item:16867::::::::60:::::::",1000],[1580953003,"Linoge-Pagle","item:16822::::::::60:::::::",1000],[1580953204,"Guild Bank","item:16858::::::::60:::::::",0],[1580953897,"Exekute-Pagle","item:16862::::::::60:::::::",0],[1580953947,"Situation-Pagle","item:16812::::::::60:::::::",750],[1580953952,"Guild Bank","item:16802::::::::60:0::::::",0],[1580953963,"Guild Bank","item:16802::::::::60:::::::",0],[1580954110,"Guild Bank","item:16861::::::::60:::::::",0],[1580954651,"Maliki-Pagle","item:16866::::::::60:::::::",1000],[1580954697,"Ghend-Pagle","item:16808::::::::60:::::::",1000],[1580954771,"Bruizzer-Pagle","item:17105::::::::60:::::::",1847],[1580955531,"Paramite-Pagle","item:16807::::::::60:::::::",750],[1580955558,"Cascade-Pagle","item:16836::::::::60:::::::",750],[1580955998,"Raidhealer-Pagle","item:16811::::::::60:::::::",750],[1580956194,"Guild Bank","item:16799::::::::60:::::::",0],[1580957216,"Guild Bank","item:16799::::::::60:0::::::",0],[1580957296,"Linoge-Pagle","item:16823::::::::60:::::::",750],[1580957884,"Nassere-Pagle","item:16865::::::::60:::::::",0],[1580957929,"Smidgen-Pagle","item:16798::::::::60:::::::",1000],[1580958005,"Chronosduex-Pagle","item:17103::::::::60:::::::",2121],[1580958514,"Situation-Pagle","item:18646::::::::60:::::::",3732],[1580958604,"Laathan-Pagle","item:18811::::::::60:::::::",0],[1580958668,"Laurentia-Pagle","item:18810::::::::60:::::::",1061],[1580960261,"Exekute-Pagle","item:19137::::::::60:::::::",1723],[1580960322,"Caedens-Pagle","item:18817::::::::60:::::::",2000],[1580960365,"Maxenjoy-Pagle","item:16954::::::::60:::::::",2000],[1580960397,"Chuckleboo-Pagle","item:16930::::::::60:::::::",2000],[1580994623,"Mustain\u00E9-Pagle","item:16866::::::::60:::::::",1000],[1580994648,"Maliki-Pagle","item:16866::::::::60:::::::",-1000],[1580996210,"Kleo-Pagle","item:16831::::::::60:::::::",750],[1580996240,"Kleo-Pagle","item:16831::::::::60:::::::",-750],[1580996291,"Aravel-Pagle","item:16848::::::::60:::::::",750],[1580996380,"Culotte-Pagle","item:18821::::::::60:::::::",600],[1581124366,"Mustain\u00E9-Pagle","item:18423::::::::60:::::::",975],[1581124503,"T\u00FFgar-Pagle","item:18705::::::::60:::::::",1000],[1581124540,"Maliki-Pagle","item:18205::::::::60:::::::",792],[1581124573,"Caedens-Pagle","item:16939::::::::60:::::::",2000],[1581124614,"Dairyfresh-Pagle","item:16929::::::::60:::::::",2000],[1581381734,"Kitiania-Pagle","item:16798::::::::60:::::::",1000],[1581381739,"Kitiania-Pagle","item:16798::::::::60:::::::",-2000],[1581384134,"Slyfrost-Pagle","item:16914::::::::60:::::::",2000],[1581384186,"Paramite-Pagle","item:18423::::::::60:::::::",975],[1581384216,"Dairyfresh-Pagle","item:17078::::::::60:::::::",849],[1581557168,"Damia-Pagle","item:16863::::::::60:::::::",0],[1581557213,"Isvail-Pagle","item:16859::::::::60:::::::",750],[1581557602,"Isvail-Pagle","item:16855::::::::60:::::::",1000],[1581557675,"Crakel-Pagle","item:17069::::::::60:::::::",616],[1581557731,"Guild Bank","item:18824::::::::60:::::::",0],[1581558307,"T\u00FFgar-Pagle","item:16849::::::::60:::::::",750],[1581558422,"Miralee-Pagle","item:16812::::::::60:::::::",750],[1581558499,"Guild Bank","item:16817::::::::60:::::::",0],[1581559193,"Rumad-Pagle","item:16846::::::::60:::::::",1000],[1581559234,"Neakpky-Pagle","item:16795::::::::60:::::::",1000],[1581559290,"Clamara-Pagle","item:17105::::::::60:::::::",1847],[1581559943,"Neakpky-Pagle","item:16797::::::::60:::::::",750],[1581559974,"Guild Bank","item:16856::::::::60:::::::",0],[1581560963,"T\u00FFgar-Pagle","item:16852::::::::60:::::::",750],[1581561012,"Miralee-Pagle","item:16811::::::::60:::::::",750],[1581561852,"Effinlazy-Pagle","item:16848::::::::60:::::::",750],[1581561898,"Thehammerin-Pagle","item:18861::::::::60:::::::",0],[1581562488,"Isvail-Pagle","item:16853::::::::60:::::::",1000],[1581562514,"Raidhealer-Pagle","item:16815::::::::60:::::::",1000],[1581562545,"Stela-Pagle","item:19136::::::::60:::::::",1061],[1581563322,"Olysheet-Pagle","item:18646::::::::60:::::::",3732],[1581563358,"Bruizzer-Pagle","item:19140::::::::60:::::::",792],[1581563397,"Dairyfresh-Pagle","item:18808::::::::60:::::::",990],[1581563414,"Guild Bank","item:16851::::::::60:::::::",0],[1581564655,"Roxie-Pagle","item:19137::::::::60:::::::",1723],[1581564725,"Roxie-Pagle","item:16962::::::::60:::::::",2000],[1581564766,"Emmalee-Pagle","item:19138::::::::60:::::::",1287],[1581564800,"Chronosduex-Pagle","item:16954::::::::60:::::::",2000],[1581565306,"Raidhealer-Pagle","item:16817::::::::60:::::::",750],[1581565416,"Effinlazy-Pagle","item:16851::::::::60:::::::",750],[1581565448,"Allorraxx-Pagle","item:16851::::::::60:::::::",750],[1581566767,"Chronosduex-Pagle","item:16954::::::::60:::::::",-2000]],"timestamp":1582031872,"extras_p":100,"realm":"Pagle"}
 
 */
module.exports.uploadbackup = (req, res) => {
  const guildid = req.params.guildid;
  if (!isAdmin(req)) throw GENERIC_ERROR;
  const uploadBackup = JSON.parse(req.body.uploadBackup);
  uploadBackup.uploadedDate = new Date();
  // Unix timestamp to .js timestamp
  uploadBackup.timestampDate = new Date(uploadBackup.timestamp * 1000);
  db.update({ id: guildid }, { $push: { backups: uploadBackup } }, {}, err => {
    if (err) throw new Error(err);
    res.redirect('/epgp/' + guildid);
  });
};
