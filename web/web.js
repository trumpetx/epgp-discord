const express = require('express');
const methodOverride = require('method-override');
const helmet = require('helmet');
const hbs = require('express-handlebars');
const { logger } = require('../logger');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const NedbStore = require('connect-nedb-session')(session);
const uuid = require('uuid');
const { props } = require('../props');
const app = (module.exports = express());
const logout = require('./logout');
const epgp = require('./epgp');
const { addguild, viewguild, deleteguild, uploadbackup, viewbot, config, viewloot, addAlias, viewexport } = require('./epgp_guild');
const { loginFilter, sessionPopulateFilter, refreshTokenFilter } = require('./filters');
const oauth = require('./oauth');
const moment = require('moment');
const _ = require('lodash');
const discord = require('../discord');

// app.use(helmet.contentSecurityPolicy());
app.use(helmet.crossOriginEmbedderPolicy());
app.use(helmet.crossOriginOpenerPolicy());
app.use(helmet.crossOriginResourcePolicy());
app.use(helmet.dnsPrefetchControl());
app.use(helmet.expectCt());
app.use(helmet.frameguard());
app.use(helmet.hidePoweredBy());
app.use(helmet.hsts());
app.use(helmet.ieNoOpen());
app.use(helmet.noSniff());
app.use(helmet.originAgentCluster());
app.use(helmet.permittedCrossDomainPolicies());
app.use(helmet.referrerPolicy());
app.use(helmet.xssFilter());
app.use(methodOverride('_method'));
app.use(express.json());
app.use(express.urlencoded());
app.engine(
  'hbs',
  hbs.engine({
    extname: 'hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'layouts'),
    partialsDir: path.join(__dirname, 'partials'),
    helpers: {
      wowhead: (item, wowheadDomain) => {
        wowheadDomain = wowheadDomain || 'classic';
        item = _.toInteger(item);
        return (
          `<a href="https://${wowheadDomain}.wowhead.com/item=${item}" target="_new" data-wowhead="item=${item}"` +
          (wowheadDomain === 'www' ? '' : `&domain=${wowheadDomain}'">${item}</a>`)
        );
      },
      eq: (o1, o2) => o1 == o2,
      hasPerm: (mask, perm) => {
        perm = discord[perm];
        mask = mask || 0x00;
        return (mask & perm) === perm;
      },
      neq: (o1, o2) => o1 != o2,
      eqDefault: (o1, o2, def) => (o1 || def) == o2,
      dtFormat: (dt, format) => moment(dt).format(format),
      timestamp: date => date.getTime(),
      reverse: function(context) {
        var options = arguments[arguments.length - 1];
        var ret = '';

        if (context && context.length > 0) {
          for (var i = context.length - 1; i >= 0; i--) {
            const x = context[i];
            if (typeof x === 'object') {
              x.index = i;
            }
            ret += options.fn(x);
          }
        } else {
          ret = options.inverse(this);
        }

        return ret;
      }
    }
  })
);
app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(morgan('combined', { stream: logger.stream }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(
  session({
    secret: props.sessionSecret,
    resave: true,
    genid: uuid.v4,
    saveUninitialized: true,
    cookie: {
      path: '/',
      httpOnly: true,
      maxAge: 365 * 24 * 3600 * 1000
    },
    store: new NedbStore({ filename: `${require('os').homedir()}/websessions.db` })
  })
);

app.use(refreshTokenFilter);
['/epgp*', '/bot*'].forEach(path => app.use(path, loginFilter));
app.use(sessionPopulateFilter);

// Static routes
app.get('/', (_req, res) => res.render('index'));
app.get('/setup', (_req, res) => res.render('setup'));
app.get('/about', (_req, res) => res.render('about'));

app.get('/logout', logout);
app.get('/epgp', epgp);
app.get('/bot/:guildid', viewbot);
app.post('/config/:guildid', config);
app.post('/epgp/:guildid', addguild);
app.get('/epgp/:guildid', viewguild);
//app.get('/epgp/:guildid/:raidteam', viewguild);
app.get('/epgp/:guildid/export', viewexport);
app.get('/epgp/:guildid/loot/:member', viewloot);
app.delete('/epgp/:guildid', deleteguild);
app.post('/epgp/:guildid/upload', uploadbackup);
app.post('/epgp/:guildid/alias', addAlias);
app.get('/oauth/redirect', oauth);

//  DO THIS LAST
app.use(require('./400'));
app.use(require('./500'));

app.listen(props.port, () => logger.info(`Server running at ${props.hostname}${props.extPortString}/`));
