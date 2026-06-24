const crypto = require('crypto');
const Idempotency = require('../models/Idempotency');

const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

const idempotencyMiddleware = (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json({
      message: 'Idempotency-Key header is required for this request',
    });
  }

  if (typeof idempotencyKey !== 'string' || idempotencyKey.length < 8 || idempotencyKey.length > 256) {
    return res.status(400).json({
      message: 'Idempotency-Key must be a string between 8 and 256 characters',
    });
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(idempotencyKey)) {
    return res.status(400).json({
      message: 'Idempotency-Key must be a valid UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)',
    });
  }

  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);
  let statusCode = 200;
  let responseBody = null;
  let responseLocked = false;

  res.status = function (code) {
    if (!responseLocked) {
      statusCode = code;
    }
    return res;
  };

  res.json = async function (body) {
    if (responseLocked) {
      return originalJson.call(res, body);
    }

    responseBody = body;
    responseLocked = true;

    if (statusCode >= 200 && statusCode < 400) {
      try {
        const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL);

        await Idempotency.findOneAndUpdate(
          { key: idempotencyKey, user: req.user._id },
          {
            key: idempotencyKey,
            user: req.user._id,
            response: { statusCode, body },
            expiresAt,
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        if (error.code === 11000) {
          const existing = await Idempotency.findOne({ key: idempotencyKey, user: req.user._id });
          if (existing) {
            statusCode = existing.response.statusCode;
            responseBody = existing.response.body;
          }
        }
      }
    }

    return originalJson.call(res, responseBody);
  };

  next();
};

const checkIdempotency = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return next();
  }

  try {
    const existing = await Idempotency.findOne({
      key: idempotencyKey,
      user: req.user._id,
    });

    if (existing) {
      return res.status(existing.response.statusCode).json(existing.response.body);
    }

    next();
  } catch (error) {
    next();
  }
};

const generateIdempotencyKey = () => {
  return crypto.randomUUID();
};

module.exports = { idempotencyMiddleware, checkIdempotency, generateIdempotencyKey };