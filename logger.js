const winston = require('winston');
require('winston-daily-rotate-file');
const { combine, timestamp, colorize, printf } = winston.format;
const os = require('os');

const log_format = combine(
  timestamp(),
  printf(info => `${info.timestamp} ${info.level}: ${info.message}`)
);

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: log_format,
  transports: [
    new winston.transports.DailyRotateFile({
      filename: os.homedir() + '/epgp-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    })
  ]
});

logger.stream = {
  write: function(message, _encoding) {
    // logger.debug(message);
  }
};

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: combine(colorize(), log_format) }));
}

module.exports.logger = Object.create(logger, { log: logger.info.bind(logger) });
module.exports.errorHandler = e => module.exports.logger.error(e.toString());
module.exports.warnHandler = e => module.exports.logger.warn(e.toString());
module.exports.infoHandler = e => module.exports.logger.info(e.toString());
