const express = require('express');
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
app.use((req, res, next) => {
  // console.debug(req.session);
  res.locals.session = req.session && req.session.expires_at ? req.session : {};
  next();
});

app.get('/', (req, res) => {
  req.session.state = req.session.state || uuidv4();
  res.render('login', {
    discordUrl: discordUrl(req.session.state)
  });
});

app.get('/logout', require('./logout'));

app.get('/epgp', require('./epgp'));

app.get('/oauth/redirect', require('./oauth'));

//  DO THIS LAST
app.use(require('./400'));
app.use(require('./500'));

app.listen(props.port, () => logger.info(`Server running at http://epgp.net:${props.port}/`));
