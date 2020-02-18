const express = require('express');
const methodOverride = require('method-override');
const helmet = require('helmet');
const hbs = require('express-handlebars');
const { logger } = require('../logger');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const NedbStore = require('connect-nedb-session')(session);
const uuidv4 = require('uuid/v4');
const { props } = require('../props');
const app = (module.exports = express());
const { discordUrl } = require('../discord');
const logout = require('./logout');
const epgp = require('./epgp');
const { addguild, viewguild, deleteguild, uploadbackup } = require('./epgp_guild');
const oauth = require('./oauth');

app.use(helmet());
app.use(methodOverride('_method'));
app.engine(
  'hbs',
  hbs({
    extname: 'hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'layouts'),
    partialsDir: path.join(__dirname, 'partials')
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
    genid: uuidv4,
    saveUninitialized: true,
    cookie: {
      path: '/',
      httpOnly: true,
      maxAge: 365 * 24 * 3600 * 1000
    },
    store: new NedbStore({ filename: `${require('os').homedir()}/websessions.db` })
  })
);
app.use('/epgp*', (req, res, next) => {
  if (!req.session || !req.session.expires_at) {
    res.redirect(discordUrl(req.session.state));
  } else {
    next();
  }
});
app.use((req, res, next) => {
  req.session.state = req.session.state || uuidv4();
  if (req.session && req.session.expires_at) {
    res.locals.session = req.session;
  } else {
    res.locals.session = {};
    res.locals.discordUrl = discordUrl(req.session.state);
  }
  next();
});

// Static routes
app.get('/', (_req, res) => res.render('index'));
app.get('/about', (_req, res) => res.render('about'));
app.get('/gearpoints', (_req, res) => res.render('gearpoints'));
app.get('/effortpoints', (_req, res) => res.render('effortpoints'));

app.get('/logout', logout);
app.get('/epgp', epgp);
app.post('/epgp/:guildid', addguild);
app.get('/epgp/:guildid', viewguild);
app.delete('/epgp/:guildid', deleteguild);
app.post('/epgp/:guildid/upload', uploadbackup);
app.get('/oauth/redirect', oauth);

//  DO THIS LAST
app.use(require('./400'));
app.use(require('./500'));

app.listen(props.port, () => logger.info(`Server running at http://epgp.net:${props.port}/`));
