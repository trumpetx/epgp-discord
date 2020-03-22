const request = require('request');
const { props } = require('./props');
const { logger } = require('./logger');

const REDIRECT_URI = `${props.hostname}${props.extPortString}/oauth/redirect`;
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

const oauth_base_options = form => {
  return {
    method: 'POST',
    url: `${DISCORD_BASE}/oauth2/token`,
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${props.clientId}:${props.clientSecret}`).toString('base64')}`
    },
    form
  };
};

const oauth_options = code =>
  oauth_base_options({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: REDIRECT_URI,
    scope: SCOPE
  });

const refresh_oauth_options = refresh_token =>
  oauth_base_options({
    grant_type: 'refresh_token',
    refresh_token,
    scope: SCOPE
  });

const discord_base = (callback, options) => {
  logger.info('Discord request: ' + options.url);
  request(options, (error, response, body) => {
    if (error) {
      logger.error(error);
      throw new Error(error);
    } else if (response.statusCode != 200) {
      logger.error('Bad Status on response: ' + response.statusCode + '\n\n' + body);
    } else {
      try {
        callback(JSON.parse(body));
      } catch (e) {
        logger.error(e.toString());
        throw e;
      }
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
module.exports.refreshOauth = (refreshToken, callback) => discord_base(callback, refresh_oauth_options(refreshToken));
module.exports.discordUrl = state =>
  `${DISCORD_BASE}/oauth2/authorize?state=${encodeURIComponent(state)}&client_id=${props.clientId}&redirect_uri=${encodeURIComponent(
    REDIRECT_URI
  )}&response_type=code&scope=${encodeURIComponent(SCOPE)}`;

// https://discordapp.com/developers/docs/topics/permissions
module.exports.ADMIN_PERMISSION = 8;
module.exports.MANAGE_GUILD = 20;
module.exports.botUrl = `${DISCORD_BASE}/oauth2/authorize?client_id=${props.clientId}&scope=bot&permissions=${props.botPermissions}`;
