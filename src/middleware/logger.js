const morgan = require('morgan');
const winston = require('winston');
const path = require('path');

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = '';
    if (Object.keys(meta).length > 0) {
      metaStr = `\n${JSON.stringify(meta, null, 2)}`;
    }
    return `${timestamp} [${level.toUpperCase()}]: ${message}${metaStr}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'test') {
  logger.add(new winston.transports.Console({
    level: process.env.LOG_LEVEL || 'warn',
    format: winston.format.combine(
      winston.format.colorize(),
      logFormat
    ),
  }));
}

const httpLogger = morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', {
  skip: (req, res) => {
    if (process.env.HTTP_LOG === 'verbose') return false;
    if (process.env.NODE_ENV === 'test') return true;
    if (req.path === '/api/health') return true;
    if (process.env.NODE_ENV !== 'production') {
      return res.statusCode < 400;
    }
    return false;
  },
  stream: {
    write: (message) => {
      logger.info(message.trim());
    },
  },
});

const logInfo = (message, meta = {}) => {
  logger.info(message, meta);
};

const logError = (message, error = null) => {
  const meta = error ? { error: error.message, stack: error.stack } : {};
  logger.error(message, meta);
};

const logWarning = (message, meta = {}) => {
  logger.warn(message, meta);
};

const logDebug = (message, meta = {}) => {
  logger.debug(message, meta);
};

module.exports = {
  logger,
  httpLogger,
  logInfo,
  logError,
  logWarning,
  logDebug,
};