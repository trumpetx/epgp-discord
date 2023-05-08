const { logger } = require('./logger');
const { props } = require('./props');
const { botServer } = require('./bot/botserver');

// if (props.clientId && props.token) {
//   botServer(props.token);
// } else {
//   logger.error(`No clientId and token set, unable to start bot server: ${propsPath}`);
// }

if (props.port) {
  require('./web/web');
} else {
  logger.error(`No port was provided, unable to start the web server: ${propsPath}`);
}
