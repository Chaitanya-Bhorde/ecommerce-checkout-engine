/**
 * Jest global test environment.
 * Loaded via setupFiles BEFORE any module import, so secrets required at
 * module load time (razorpay config, JWT secret) are always defined.
 * Values here are throwaway test credentials only.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-only-secret-do-not-use-in-production-0123456789abcdef';
process.env.JWT_EXPIRE = '7d';
process.env.PORT = '0';
process.env.RAZORPAY_KEY_ID = 'rzp_test_1DP5mmOlF5G5ag';
process.env.RAZORPAY_KEY_SECRET = 'test-only-razorpay-secret-00000000';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test-only-webhook-secret-000000000';
process.env.OPENAI_API_KEY = '';
process.env.MONGODB_URI = ''; // each test file sets its own memory-server URI
process.env.RATE_LIMIT_ENABLED = 'false'; // rate limiting is config-verified, not exercised in CI
process.env.IDEMPOTENCY_TTL_HOURS = '24';