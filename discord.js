const request = require('request');
const { props } = require('./props');
const { logger } = require('./logger');
let redirectPort = ':' + (props.extPort || props.port || 8080);
if (redirectPort === ':80') {
  redirectPort = '';
}
const REDIRECT_URI = `${props.hostname}${redirectPort}/oauth/redirect`;
const DISCORD_BASE = 'https://discordapp.com/api';
const SCOPE = 'identify email guilds';

const discord_options = (token, url, method) => {
  return {
    method: method || 'GET',
    url: `${DISCORD_BASE}${url}`,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  };
};

const oauth_options = code => {
  return {
    method: 'POST',
    url: `${DISCORD_BASE}/oauth2/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${props.clientId}:${props.clientSecret}`).toString('base64')}`
    },
    form: {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: REDIRECT_URI,
      scope: SCOPE
    }
  };
};

const discord_base = (callback, options) => {
  logger.info('Discord request: ' + options.url);
  request(options, (error, _response, body) => {
    if (error) {
      throw new Error(error);
    } else {
      callback(JSON.parse(body));
    }
  });
};

const discord = (token, url, callback) => discord_base(callback, discord_options(token, url));

/*
{ id: '206111742625972224',
  username: 'TrumpetX',
  avatar: null,
  discriminator: '9894',
  email: 'david@greene.ninja',
  verified: true,
  locale: 'en-US',
  mfa_enabled: true,
  flags: 0 }
*/
module.exports.me = (token, callback) => discord(token, '/users/@me', callback);
/*
[  { id: '615756929431502848',
    name: 'Magma Carta Club',
    icon: 'f89d7f5bb0df112f66050af50f0dc885',
    owner: false,
    permissions: 2147483647,
    features: [] }
  ...
  ]
*/
module.exports.guilds = (token, callback) => discord(token, '/users/@me/guilds', callback);
module.exports.oauth = (code, callback) => discord_base(callback, oauth_options(code));
module.exports.discordUrl = state =>
  `${DISCORD_BASE}/oauth2/authorize?state=${encodeURIComponent(state)}&client_id=${props.clientId}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&scope=${encodeURIComponent(SCOPE)}`;
