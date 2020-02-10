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
const request = require('request');
const _ = require('lodash');

const REDIRECT_URI = `http://epgp.net:${props.port}/oauth/redirect`;
const DISCORD_BASE = 'https://discordapp.com/api';
const SCOPE = 'identify email guilds';

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
  res.locals.session = req.session.expires_at ? req.session : {};
  next();
});

app.get('/', (req, res) => {
  req.session.state = req.session.state || uuidv4();
  res.render('login', {
    discordUrl: `${DISCORD_BASE}/oauth2/authorize?state=${encodeURIComponent(req.session.state)}&client_id=${props.clientId}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&response_type=code&scope=${encodeURIComponent(SCOPE)}`
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) throw new Error(err);
    res.redirect('/');
  });
});

app.get('/epgp', (req, res) => {
  res.render('epgp');
});

app.get('/oauth/redirect', (req, res) => {
  if (req.query.state !== req.session.state) {
    throw new Error('Invalid state');
  }
  const options = {
    method: 'POST',
    url: `${DISCORD_BASE}/oauth2/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${props.clientId}:${props.clientSecret}`).toString('base64')}`
    },
    form: {
      grant_type: 'authorization_code',
      code: req.query.code,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE
    }
  };

  request(options, (error, _response, body) => {
    if (error) {
      throw new Error(error);
    } else {
      body = JSON.parse(body);
      req.session.refresh_token = body.refresh_token;
      req.session.access_token = body.access_token;
      req.session.expires_at = new Date(_.toInteger(body.expires_in) + new Date().getTime());
      res.redirect('/epgp');
    }
  });
});

//
//  DO THIS BLOCK LAST
//

app.use((req, res, _next) => {
  res.status(404);
  res.format({
    html: () => {
      res.render('404', { url: req.url });
    },
    json: () => {
      res.json({ error: 'Not found' });
    },
    default: () => {
      res.type('txt').send('Not found');
    }
  });
});
app.use((err, _req, res, _next) => {
  res.status(err.status || 500);
  console.error(err.stack);
  res.render('500');
});

app.listen(props.port, () => logger.info(`Server running at http://epgp.net:${props.port}/`));
