const { logger } = require('./logger');
const { props } = require('./props');

if (props.clientId && props.token) {
  require('./bot/botserver')(props.clientId, props.token, props.botPermissions);
} else {
  logger.error(`No clientId and token set, unable to start bot server: ${propsPath}`);
}

if (props.port) {
  require('./web/web');
} else {
  logger.error(`No port was provided, unable to start the web server: ${propsPath}`);
}
