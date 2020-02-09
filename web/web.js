const express = require('express');
const { logger, errorHandler } = require('../logger');
const morgan = require('morgan');
const path = require('path');
const session = require('express-session');
const NedbStore = require('connect-nedb-session')(session);
const uuidv4 = require('uuid/v4');
const SCOPE = 'identify email guilds';
const { props } = require('../props');
const app = (module.exports = express());
const axios = require('axios');

const REDIRECT_URI = `http://epgp.net:${props.port}/oauth/redirect`;
const DISCORD_BASE = 'https://discordapp.com/api';

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

app.get('/', (req, res) => {
  req.session.state = req.session.state || uuidv4();
  console.log(req.session);
  req.session.save(err => {
    if (err) console.log(err);
    const state = `state=${encodeURIComponent(req.session.state)}&`;
    res.render('login', {
      discordUrl: `${DISCORD_BASE}/oauth2/authorize?${state}client_id=${props.clientId}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPE)}`
    });
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) console.log(err);
    res.redirect('/');
  });
});

app.get('/epgp', (_req, res) => {
  res.render('epgp', {});
});

app.get('/oauth/redirect', (req, res) => {
  if (req.query.state !== req.session.state) {
    console.log(req.session);
    res.render('5xx');
    return;
  }
  axios
    .post(
      `${DISCORD_BASE}/oauth2/token`,
      {
        grant_type: 'authorization_code',
        code: req.query.code,
        redirect_uri: REDIRECT_URI,
        scope: SCOPE,
        state: req.session.state
      },
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          Authorization: `Basic ${Buffer.from(`${props.clientId}:${props.clientSecret}`).toString('base64')}`
        }
      }
    )
    .then(response => {
      console.log(response.data.access_token);
      req.session.access_token = response.data.access_token;
      res.render('epgp');
    })
    .catch(err => {
      logger.error(err.response.status + ': ' + err.response.statusText + '\n' + JSON.stringify(err.response.data));
    })
    .then(() => res.render('5xx'));
});

app.listen(props.port, () => logger.info(`Server running at http://epgp.net:${props.port}/`));
