const crypto = require('crypto');
const Idempotency = require('../models/Idempotency');

const TTL_HOURS = parseInt(process.env.IDEMPOTENCY_TTL_HOURS || '24', 10);
// How long a duplicate request waits for an in-flight twin to finish, so it can
// replay the identical response instead of failing with a conflict.
const WAIT_MS = parseInt(process.env.IDEMPOTENCY_WAIT_MS || '10000', 10);
const POLL_MS = 50;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getExpiry = () => new Date(Date.now() + TTL_HOURS * 60 * 60 * 1000);

const delay = (ms) =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    // Never keep the event loop (or Jest) alive because of a poll timer.
    if (typeof timer.unref === 'function') timer.unref();
  });

const hashRequest = (req) =>
  crypto
    .createHash('sha256')
    .update(`${req.method}|${req.originalUrl}|${JSON.stringify(req.body ?? {})}`)
    .digest('hex');

/**
 * Idempotency middleware (mounted after `protect`, so req.user exists).
 *
 * Behaviour:
 *  - Missing/invalid Idempotency-Key header         -> 400
 *  - First request with a key                       -> claim is created atomically
 *    (status "processing") and the controller executes. The exact HTTP status
 *    code and body are preserved. On 2xx the response is persisted with status
 *    "completed"; on 4xx/5xx the claim is released so the client may safely
 *    retry with the same key.
 *  - Replay with same key + same payload            -> stored status code and
 *    body are returned verbatim; no new order is created.
 *  - Same key + DIFFERENT payload                   -> 409 Conflict
 *  - Same key from a DIFFERENT user                 -> 409 Conflict (never
 *    replays or leaks the first user's stored response)
 *  - Concurrent duplicate (key currently in flight) -> waits (bounded) for the
 *    twin request to finish and replays its response, so N parallel retries
 *    settle exactly once.
 */
const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey || typeof idempotencyKey !== 'string' || !UUID_REGEX.test(idempotencyKey)) {
    return res.status(400).json({
      message:
        'Idempotency-Key header is required and must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000)',
    });
  }

  const requestHash = hashRequest(req);
  const claimFilter = { key: idempotencyKey };
  const deadline = Date.now() + WAIT_MS;

  try {
    for (;;) {
      // Atomic claim. findOneAndUpdate with upsert and new:false returns the
      // PRE-EXISTING document, or null when THIS request created the claim.
      let prior = null;
      try {
        prior = await Idempotency.findOneAndUpdate(
          claimFilter,
          {
            $setOnInsert: {
              key: idempotencyKey,
              user: req.user._id,
              requestHash,
              status: 'processing',
              claimedAt: new Date(),
              expiresAt: getExpiry(),
            },
          },
          { upsert: true }
        );
      } catch (claimError) {
        // Lost a unique-index race against a concurrent duplicate: inspect the
        // winner's record instead.
        prior = await Idempotency.findOne(claimFilter);
      }

      if (prior) {
        // A key is bound to the client that created it. Another user reusing it
        // must not receive (or re-use) the stored response.
        if (String(prior.user) !== String(req.user._id)) {
          return res.status(409).json({
            message: 'This Idempotency-Key has already been used',
          });
        }
        if (prior.requestHash !== requestHash) {
          return res.status(409).json({
            message: 'This Idempotency-Key was already used with a different request payload',
          });
        }
        if (prior.status === 'completed' && prior.response) {
          return res.status(prior.response.statusCode).json(prior.response.body);
        }

        // The twin request is still in flight: wait briefly for its outcome and
        // replay it. If it never finishes, fall back to a conflict.
        if (Date.now() >= deadline) {
          return res.status(409).json({
            message: 'A request with this Idempotency-Key is currently in progress',
          });
        }
        await delay(POLL_MS);
        continue;
      }

      // This request owns the claim. Wrap res.json to persist/release the claim.
      // res.statusCode is already final by the time controllers call .json(),
      // because res.status() only sets the field â€” so no res.status override and
      // no risk of double-response bugs.
      const originalJson = res.json.bind(res);

      res.json = async function (body) {
        const statusCode = res.statusCode || 200;
        const isSuccess = statusCode >= 200 && statusCode < 300;

        try {
          if (isSuccess) {
            await Idempotency.updateOne(claimFilter, {
              $set: {
                status: 'completed',
                response: { statusCode, body },
                expiresAt: getExpiry(),
              },
            });
          } else {
            // Release the claim so the client can retry with the same key.
            await Idempotency.deleteOne(claimFilter);
          }
        } catch (persistError) {
          console.error('Idempotency: failed to persist response:', persistError.message);
        }

        return originalJson(body);
      };

      return next();
    }
  } catch (middlewareError) {
    console.error('Idempotency middleware error:', middlewareError.message);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Internal server error' });
    }
  }
};

module.exports = { idempotencyMiddleware };
