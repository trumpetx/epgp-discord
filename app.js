const { logger } = require('./logger');
const { props } = require('./props');

if (props.port) {
  require('./web/web');
} else {
  logger.error(`No port was provided, unable to start the web server: ${propsPath}`);
}
