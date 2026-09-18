# RECRUIT CRM — TOP 50 PROJECT INTERVIEW QUESTIONS

**Project:** E-Commerce Checkout Engine  
**Repo:** https://github.com/Chaitanya-Bhorde/ecommerce-checkout-engine  
**Target:** ~₹9 LPA SDE Role

---

## CODEBASE SUMMARY

**Stack:** Node.js + Express 5, MongoDB + Mongoose 9, React 18 + Vite, JWT, Razorpay

**Models:** User, Product, Cart, Order, Idempotency, Ledger, Notification, Category

**Architecture:** Routes → Middleware → Controllers → Models

**Note:** Idempotency implemented TWICE. Rate limiting commented out. Tests minimal.

---

## Q1 — Walk me through your project.

**Answer:** Full-stack e-commerce checkout engine. Customers browse, add to cart, checkout with Razorpay or COD. Admin dashboard for products, orders, customers, ledger.

Technically interesting: checkout needs atomic stock validation, decrement, order creation, payment. Uses MongoDB transactions. Idempotency keys prevent duplicate orders.

**Follow-up (what did you build?):** Entire thing — backend controllers, frontend React with Context API, Razorpay integration, AI chatbot (LangChain), Socket.io.

**Difficult (what would you change?):** Add service layer, integration tests, message queue for webhooks.

**Files:** src/app.js, src/controllers/orderController.js

**Production:** Service layer, tests, Bull/BullMQ queue.

---

## Q2 — Complete checkout flow?

**Answer:** Frontend (Checkout.jsx): user fills address, selects payment, clicks Place Order. Generates UUID v4 via Web Crypto API. POST /api/orders with key in header.

Backend: idempotencyMiddleware validates UUID. createOrder checks Idempotency collection — returns cached if exists. Otherwise: MongoDB transaction, validate cart, check stock, $inc decrement, create order, commit.

COD: status='confirmed', cart cleared. Razorpay: status='pending', /api/payments/create/:orderId, Razorpay widget, verify signature, status='confirmed'.

**Follow-up (refresh before payment?):** Order exists as 'pending'. User resumes from orders list. Cart NOT cleared for Razorpay.

**Difficult (two tabs?):** Different UUIDs = both create orders. Production: disable button + distributed lock.

**Files:** client/src/pages/Checkout.jsx, src/controllers/orderController.js (70-180)

**Production:** Button disable, cart-level lock, Redis lock.

---

## Q3 — Why MongoDB transactions?

**Answer:** Checkout needs atomic operations: validate stock, decrement inventory, create order. If stock decrements but order fails = inconsistent data.

Transactions wrap ops in session. Fail = abortTransaction() rolls back. Success = commitTransaction().

In createOrder: mongoose.startSession(), session.startTransaction(), all DB ops passed session.

**Follow-up (without transaction?):** Stock reduced but no order = lost inventory.

**Difficult (eliminates races?):** $inc = document-level atomic. But stock check + decrement separate. Both read stock=1, both decrement, stock=-1. Production: findOneAndUpdate({_id, stock:{$gte:quantity}}, {$inc:{stock:-quantity}}).

**Files:** src/controllers/orderController.js (78-81, 108-137)

**Production:** Conditional updates, optimistic versioning.

---

## Q4 — How does idempotency work?

**Answer:** Frontend generates UUID v4, sends in Idempotency-Key header. Two backend layers:

1. idempotencyMiddleware: validates UUID, intercepts res.json, stores response with 24h TTL.
2. createOrder: manual Idempotency.findOne check.

Idempotency model: TTL index on expiresAt (expireAfterSeconds: 0).

**Follow-up (why TWO?):** Design inconsistency. Middleware = generic. Manual = explicit. Should use one.

**Difficult (same key simultaneous?):** Both pass findOne, both create. upsert catches one (error 11000). Manual check unprotected. Production: unique index + distributed lock.

**Files:** src/middleware/idempotencyMiddleware.js, src/controllers/orderController.js (71-76)

**Production:** Single mechanism, Redis for speed.

---

## Q5 — Razorpay payment verification?

**Answer:** Razorpay sends order_id, payment_id, signature. Frontend → /api/payments/verify.

verifyPaymentSignature: HMAC-SHA256 of orderId|paymentId with RAZORPAY_KEY_SECRET, compares.

User can't fake: doesn't know KEY_SECRET. Modified data = signature mismatch.

**Follow-up (replay?):** Verification checks order='pending'. After: status='confirmed'. Replay fails.

**Difficult (server crashes after payment?):** Webhook catches it. /api/webhooks/razorpay. findOneAndUpdate with status $ne:'confirmed' = idempotent. Two confirmation paths.

**Files:** src/config/razorpay.js (42-49), src/controllers/paymentController.js (230-315)

**Production:** Reconciliation job, retry logic.

## Q6 — How does webhook handler work?

**Answer:** In webhookController.js: verify webhook signature with RAZORPAY_WEBHOOK_SECRET. Respond 200 IMMEDIATELY (Razorpay needs <2s, else retries 24h).

Use setImmediate for background processing: find order by razorpayOrderId, update status='confirmed', update Ledger to 'completed'. Wrapped in MongoDB transaction.

setImmediate (not setTimeout): executes after I/O callbacks, more predictable.

**Follow-up (background fails?):** Caught and logged. Already responded 200, no retry. Production: retry mechanism, message queue with DLQ.

**Difficult (duplicate webhook?):** findOneAndUpdate with status $ne:'confirmed'. If already confirmed, returns null, skips. Atomic at document level.

**Files:** src/controllers/webhookController.js (6-116)

**Production:** Bull/BullMQ queue, retry with backoff, reconciliation job.

---

## Q7 — Prevent overselling (two users, last item)?

**Answer:** createOrder: check product.stock >= quantity, then $inc decrement in transaction session.

$inc = atomic at document level. Two transactions: second waits for first via write locks.

BUT: stock check + decrement are separate. Both read stock=1, both sufficient, both decrement, stock=-1.

Fix: findOneAndUpdate({_id, stock:{$gte:quantity}}, {$inc:{stock:-quantity}}, {session}). Null = insufficient, abort.

**Follow-up (current handles it?):** Partially. $inc atomic but check+decrement not atomic. Production: conditional update.

**Difficult (1000 concurrent?):** Conditional update: only first succeeds, rest get null, abort. Users see 'insufficient stock'.

**Files:** src/controllers/orderController.js (94-140)

**Production:** Conditional updates, queue for high-demand, waitlist.

---

## Q8 — Why MongoDB? Trade-offs?

**Answer:** Flexible schema, JSON-native, Mongoose ODM, Atlas free tier. Product catalog fits document model.

Trade-off: not inherently transactional. Pre-4.0 no multi-doc transactions. Now needs replica set, performance overhead.

Denormalized: Order stores name/price at purchase time. Historical accuracy even if price changes.

**Follow-up (transaction problems?):** Needs replica set. Local dev = single-node replica set config. Transactions can abort on write conflicts. Need TransientTransactionError handling.

**Difficult (PostgreSQL?):** Normalize Order/OrderItems, SQL transactions with isolation levels, SELECT FOR UPDATE. JSONB for variable attributes. Stronger consistency, easier JOINs.

**Files:** src/config/db.js, src/models/

**Production:** PostgreSQL for transactional core, MongoDB for catalog.

---

## Q9 — Authentication? Why httpOnly cookies?

**Answer:** JWT in httpOnly cookie, sameSite:strict, secure in production. bcrypt 10 salt rounds.

httpOnly: JS can't read token. XSS attack = can't steal token. localStorage = any JS can access.

sameSite:strict: prevents CSRF (cookie not sent cross-origin).

**Follow-up (CSRF?):** sameSite:strict blocks cross-origin. Idempotency-Key header = custom header not auto-included = extra CSRF layer.

**Difficult (mobile/third-party?):** httpOnly bad for mobile. Support Bearer tokens in Authorization header. protect middleware checks both cookie and header.

**Files:** src/utils/generateToken.js, src/middleware/authMiddleware.js

**Production:** Refresh token rotation, token blacklisting, CSRF tokens.

---

## Q10 — Order cancellation? Stock handling?

**Answer:** cancelOrder: find order by ID + user (ownership). Check status pending/confirmed only.

Transaction: restore stock via $inc:{stock:quantity}, status='cancelled', statusHistory entry, save with session, commit.

**Follow-up (Razorpay paid?):** Current: no refund handling. Gap. Production: Razorpay refund API, Ledger refund entry, status='refunded'.

**Difficult (product deleted?):** findByIdAndUpdate returns null silently. Transaction commits. Stock lost. Production: check product exists first.

**Files:** src/controllers/orderController.js (374-425)

**Production:** Razorpay refund, handle deleted products, cancellation reasons.

## Q11 — Purpose of Ledger model?

**Answer:** Financial audit trail. Every payment/refund/payout recorded. Razorpay payment initiated = Ledger entry 'pending'. Verified = 'completed'.

References Order, User, amount, paymentMethod, Razorpay IDs. Admin views via /api/admin/ledger with filters.

**Follow-up (why not Order model?):** Order = commercial transaction. Ledger = financial transaction. Separate concerns. Partial payments, refunds, retries all tracked independently.

**Difficult (Ledger creation fails?):** In createPaymentOrder: try-catch, logs warning, continues. Comment: 'non-critical'. Gap: payment without ledger entry = financial discrepancy. Production: critical or reconciliation job.

**Files:** src/models/Ledger.js, src/controllers/paymentController.js (82-96)

**Production:** Make critical, reconciliation jobs, double-entry bookkeeping.

---

## Q12 — Frontend auth state management?

**Answer:** React Context API. AuthProvider wraps app. On mount: GET /auth/me (cookie auto-sent via withCredentials:true).

Provides user, loading, login, register, logout. Login: response sets cookie, update user state. Logout: POST /auth/logout clears cookie, user=null.

ProtectedRoute: checks user exists, else redirect. AdminRoute: checks role==='admin'.

**Follow-up (page refresh?):** useEffect runs again, calls /auth/me. Cookie persists (7-day expiry). loading=true during fetch.

**Difficult (JWT expires on page?):** Cookie sent, jwt.verify throws TokenExpiredError. errorHandler returns 401. No axios interceptor currently. Production: interceptor catches 401, redirects to login.

**Files:** client/src/contexts/AuthContext.jsx, client/src/services/api.js

**Production:** Axios interceptor, refresh token rotation, session timeout warnings.

---

## Q13 — Input validation?

**Answer:** express-validator. orderController: validateOrderCreation — address 5-200 chars, city 2-50, zip 3-10, phone isMobilePhone(), paymentMethod isIn ['razorpay','cod'].

authController: register — name 2-50, email isEmail+normalize, password min 6 + matches digit. Login — email + non-empty password.

Validation middleware before controller. validationResult(req) → 400 with errors.

**Follow-up (frontend vs backend?):** Frontend = UX, immediate feedback. Can be bypassed. Backend = actual security. Never rely solely on frontend.

**Difficult (NoSQL injection?):** Mongoose casts to schema types. Additional: express-validator escape/trim. $text search safe. Avoid $where or raw queries.

**Files:** src/controllers/orderController.js (10-54), src/controllers/authController.js (6-32)

**Production:** sanitizeBody() for all inputs, rate limit on validation failures.

---

## Q14 — idempotencyMiddleware role?

**Answer:** Applied to order route. Three things:
1. Validates Idempotency-Key header (present, 8-256 chars, UUID regex).
2. Overrides res.status/res.json to intercept response. Saves original via .bind(res).
3. On success (2xx/3xx): stores key, user, statusCode, body in Idempotency collection via findOneAndUpdate upsert:true. Duplicate key (11000) = returns cached.

**Follow-up (responseLocked?):** Prevents infinite recursion. Only first response captured. Subsequent calls pass through to original res.json.

**Difficult (DB write fails after response?):** Response sent, can't undo. Idempotency not stored = retry creates duplicate. Production: store BEFORE processing (reserve key) or use transaction.

**Files:** src/middleware/idempotencyMiddleware.js (6-78)

**Production:** Reserve key before processing, transaction for business logic + idempotency.

---

## Q15 — Order status state machine?

**Answer:** updateOrderStatus: validTransitions object maps status → allowed next statuses. pending → [confirmed, cancelled], confirmed → [processing, cancelled], shipped → [out_for_delivery, cancelled], etc.

Check if requested status in allowed transitions. If not: 400 'Cannot transition from X to Y'.

statusProgressMap: pending=0%, confirmed=25%, processing=50%, shipped=50%, out_for_delivery=75%, delivered=100%.

Every change recorded in statusHistory with status, timestamp, changedBy, note.

**Follow-up (why not any→any?):** Invalid transitions: delivered→pending, cancelled→shipped. State machine enforces business rules.

**Difficult (return/refund flow?):** Add 'returned' from delivered/received. delivered: ['received', 'refunded', 'returned']. Restore stock, Ledger refund entry, Razorpay refund API.

**Files:** src/controllers/orderController.js (280-372)

**Production:** Return/refund statuses, event-driven notifications, SLA tracking.

## Q16 — Cart price handling?

**Answer:** Cart stores price at addition time. addToCart reads product.price, stores in cart item.

Why: prices change. If only stored reference, checkout price might differ from addition price. Storing locks it in.

Virtuals: totalAmount (sum price*qty), totalItems (sum qty).

**Follow-up (price changes before checkout?):** Cart price = checkout price. User pays addition price. Production: revalidate at checkout, ask confirmation if changed.

**Difficult (product inactive after cart?):** createOrder checks product.isActive. Inactive = abort, error 'no longer available'. User removes item.

**Files:** src/models/Cart.js, src/controllers/cartController.js (21-82)

**Production:** Price change notification, cart expiry, max cart value.

---

## Q17 — Razorpay order creation?

**Answer:** createPaymentOrder: find pending order, call createRazorpayOrder in razorpay.js.

Amount × 100 (paise). payment_capture:1 (auto-capture). Receipt truncated to 40 chars.

Returns razorpayOrderId. Save to order, create Ledger 'pending'. Frontend opens Razorpay widget.

**Follow-up (API fails?):** Try-catch, extract error, throw 'Payment gateway error'. 500 to frontend. Order stays 'pending', user retries.

**Difficult (amount mismatch?):** Amount from server-side order total, not frontend. User can't manipulate. Razorpay order = our amount. Signature verification ensures match.

**Files:** src/config/razorpay.js (23-40), src/controllers/paymentController.js (6-120)

**Production:** Amount reconciliation, order expiry, webhook reconciliation.

---

## Q18 — COD vs Razorpay flow?

**Answer:** createOrder after commit: COD → status='confirmed', cart cleared. Razorpay → status='pending', cart retained.

COD: no payment confirmation needed. Trust pay-on-delivery. Razorpay: payment required before confirm.

**Follow-up (COD never paid?):** No tracking currently. Order moves through delivery regardless. Production: 'payment_pending' status, update on collection.

**Difficult (COD limits?):** Add validation: paymentMethod==='cod' && total>10000 → validation error. Business rule at API level.

**Files:** src/controllers/orderController.js (143-165)

**Production:** COD payment tracking, COD limits, fraud detection.

---

## Q19 — Security measures?

**Answer:** 1. JWT httpOnly sameSite:strict — XSS+CSRF protection. 2. bcrypt 10 rounds, password select:false. 3. CORS whitelist + credentials. 4. Helmet headers. 5. express-validator. 6. Rate limiting (commented, prod-only). 7. HMAC-SHA256 signature verification. 8. RBAC protect+admin.

**Follow-up (issues?):** Rate limiting disabled. No CSRF token. Reset token plain text. No HTTPS enforcement. 10mb JSON limit. No injection protection beyond Mongoose.

**Difficult (rate limiting?):** express-rate-limit: general 100/15min, auth 5/15min, payment 10/min. Redis store for distributed.

**Files:** src/app.js (34-92), src/middleware/authMiddleware.js

**Production:** Enable rate limit, CSRF tokens, hash reset tokens, HTTPS enforcement.

---

## Q20 — Admin RBAC?

**Answer:** Two middleware: protect (JWT verify, attach req.user) and admin (check role==='admin').

Routes: router.use(protect) then router.use(admin) for admin routes. Order routes: protect all, admin only specific.

User.role enum ['customer','admin'], default 'customer'.

**Follow-up (modify JWT role?):** Can't — signed with JWT_SECRET. Modified payload = invalid signature = jwt.verify fails = 401.

**Difficult (granular permissions?):** Permission-based: roles have permissions (orders:read, orders:write). Middleware checks permissions, not just role. Store in DB, cache in JWT.

**Files:** src/middleware/authMiddleware.js (1-32)

**Production:** Permission-based AC, audit logging, IP whitelisting, 2FA.

## Q21 — MongoDB connection? Failure handling?

**Answer:** db.js: read MONGODB_URI, mongoose.connect(). Missing URI = throw. Fail = log + process.exit(1). Fail-fast: no point running without DB.

**Follow-up (connection drops after start?):** Mongoose auto-reconnect. Queries during disconnect fail. Production: bufferCommands:false, retry logic.

**Difficult (connection pooling?):** Mongoose pool (default 5). Production: maxPoolSize 50-100 per instance. Monitor pool usage, scale horizontally.

**Files:** src/config/db.js (1-22)

**Production:** Pool config, read replicas, retry logic, monitoring.

---

## Q22 — Error handling?

**Answer:** Global errorHandler in errorHandler.js: CastError→400, duplicate key (11000)→400, ValidationError→400, JWT errors→401. Unknown→500 (+stack in dev).

AppError class with statusCode + isOperational. asyncHandler utility (Promise.resolve.catch(next)).

Gap: asyncHandler not used consistently. Many controllers use try-catch directly, return res.status(500). Some errors bypass global handler.

**Follow-up (operational vs programming?):** Operational = expected (input validation, DB issues). Programming = bugs. isOperational flag distinguishes.

**Difficult (centralized logging?):** Sentry/LogRocket integration. errorHandler sends error with context. Winston structured logging with request IDs.

**Files:** src/middleware/errorHandler.js, src/utils/AppError.js

**Production:** Consistent asyncHandler, Sentry, request ID tracking, alerts.

---

## Q23 — Product search and filtering?

**Answer:** getProducts: build filter from query params. Search: $text search (text index on name+description). Filter: category, price range, isActive, inStock. Sort: price_asc/desc, name, rating, newest.

Promise.all for query + count in parallel. Paginated with skip/limit.

**Follow-up (text index?):** Tokenizes, stems text. 'headphone' matches 'headphones'. Language-specific stemming + stop words.

**Difficult (limitations?):** No fuzzy matching, basic relevance, no synonyms. Production: Elasticsearch or Algolia for fuzzy, faceted, typo tolerance.

**Files:** src/controllers/productController.js (70-143), src/models/Product.js (64)

**Production:** Elasticsearch, faceted search, search analytics, autocomplete.

---

## Q24 — Notification system?

**Answer:** Two approaches: DB-stored (Notification model: userId, type, title, message, read) + real-time Socket.io (socketService.js).

Created at: order placed, status updated, user registered (admin). Frontend: NotificationContext + NotificationBell.

**Follow-up (user offline?):** Stored in DB regardless. Real-time = immediate delivery only. DB = source of truth.

**Difficult (scale Socket.io?):** Redis adapter for horizontal scaling. Rooms for broadcasting. Message queue. Consider Pusher/Ably.

**Files:** src/models/Notification.js, src/services/socketService.js

**Production:** Notification preferences, push notifications, batching, message queue.

---

## Q25 — Password reset flow?

**Answer:** passwordController: forgotPassword generates crypto.randomBytes(32).toString('hex'), stores with 1-hour expiry, sends via email (dev: returns in response).

resetPassword: find by token + expiry>now. Valid: update password (pre-save hook hashes), clear token+expiry, save.

**Follow-up (plain text token?):** DB compromise = attacker resets any password. Should hash token like password.

**Difficult (email enumeration?):** Generic message 'If account exists...'. But response time differs (timing attack). Production: consistent response times.

**Files:** src/controllers/passwordController.js (1-113)

**Production:** Hash token, rate limiting, CAPTCHA, usage tracking.

## Q26 — Order price consistency?

**Answer:** Order stores price at creation time (not just product reference). createOrder copies product.price into order item.

Order stores subtotal, tax (18%), shippingCost (free ≥500, else 40), total. All server-side calculated.

Price changes after order = order shows what user paid. Important for accounting.

**Follow-up (frontend manipulates price?):** Frontend doesn't send price. Backend calculates from cart stored prices. Modified request body = ignored.

**Difficult (price changes cart→checkout?):** Cart stores addition price, order uses those. User pays addition price. Production: revalidate, show changes, ask confirmation.

**Files:** src/models/Order.js (11-35), src/controllers/orderController.js (91-140)

**Production:** Price change detection, price lock timers, discount codes.

---

## Q27 — Concurrent order creation?

**Answer:** Multiple levels: 1. Idempotency (same key = one order). 2. MongoDB transactions (atomic ops). 3. Document-level locking (write locks). 4. $inc (atomic decrement).

Gap: stock check + decrement not atomic. Both read sufficient, both decrement, negative stock.

**Follow-up (fix?):** findOneAndUpdate({_id, stock:{$gte:quantity}}, {$inc:{stock:-quantity}}, {session}). Null = abort.

**Difficult (transaction write conflict?):** TransientTransactionError. Retry mechanism: catch, check label, retry up to 3× with exponential backoff.

**Files:** src/controllers/orderController.js (70-180)

**Production:** Conditional updates, retry logic, optimistic concurrency.

---

## Q28 — checkIdempotency vs idempotencyMiddleware?

**Answer:** Both prevent duplicates, work differently. Middleware: proactive, intercepts response, stores in Idempotency collection. checkIdempotency: reactive, checks before processing.

Redundant. Middleware used on order route. checkIdempotency exported but unused. Design inconsistency.

**Follow-up (which better?):** Middleware cleaner (separates concern). Limitation: only stores successes. For 'in-progress' state, need proactive reservation.

**Difficult (processing state?):** Insert 'processing' record first. Duplicate key = check existing status: 'processing'→409, 'completed'→cached. Update to 'completed' after.

**Files:** src/middleware/idempotencyMiddleware.js (6-78, 80-101)

**Production:** Consolidate, add processing state, monitoring.

---

## Q29 — Payment succeeds, order creation fails?

**Answer:** Current: order created BEFORE payment. Flow: create order → initiate Razorpay → verify → update. Order creation fails = payment never initiated.

Reverse (payment succeeds, order update fails): webhook catches it. findOneAndUpdate with status check = idempotent.

Gap: order never created (user closes tab after order creation but order deleted), payment succeeds = webhook finds no order. Financial discrepancy.

**Follow-up (handle discrepancy?):** Reconciliation job: fetch Razorpay payments, compare with orders. Flag unmatched. Store razorpayOrderId in Ledger for tracing.

**Difficult (saga pattern?):** Each step has compensating action. Create order → cancel. Initiate payment → refund. Verify → reverse status. Fail = execute compensations in reverse.

**Files:** src/controllers/paymentController.js (230-315), src/controllers/webhookController.js (6-116)

**Production:** Reconciliation job, saga pattern, payment intent before order.

---

## Q30 — Frontend Razorpay flow?

**Answer:** Checkout.jsx: user selects Razorpay, clicks Place Order. Create order on backend. Call /api/payments/create/:orderId → razorpayOrderId.

Load Razorpay SDK dynamically. Create instance with order ID, amount, currency, key ID. Handlers for payment.success/error.

Success: send verification data to /api/payments/verify. Success → redirect to confirmation.

**Follow-up (closes popup?):** Order stays 'pending'. User retries from orders list. Razorpay order valid ~15min.

**Difficult (payment succeeds, verification fails?):** Frontend shows error but payment captured. User retries = double payment. Production: 'verifying' state, retry API, 'payment pending' page, webhook confirmation.

**Files:** client/src/pages/Checkout.jsx (200-350)

**Production:** Status polling, retry logic, timeout handling.

## Q31 — Indexes defined? Why?

**Answer:** User: email (login), role (admin queries), resetPasswordToken+resetPasswordExpiry (sparse).

Product: text index (name+description for search), price (sort/filter), category (filter), compound (category+isActive, isActive+createdAt).

Order: user (queries), compound (user+createdAt, status+createdAt, createdAt).

Cart: user (unique = one cart per user).

Idempotency: key (unique), TTL (expiresAt), compound (key+user).

Ledger: order, user, razorpayPaymentId, status, createdAt.

**Follow-up (how to decide?):** Look at query patterns: find(), sort(),findOne(). Each index has write cost. Balance read vs write.

**Difficult (too many indexes?):** Disk + memory. Slower writes (update all indexes). Max 64 per collection. Production: explain(), $indexStats, remove unused.

**Files:** All models in src/models/

**Production:** explain(), $indexStats, partial indexes.

---

## Q32 — File uploads (product images)?

**Answer:** Multer for uploads. express.json limit 10mb for base64. Validation: accepts URLs + base64 data URLs (custom validator).

Storage: URLs (Unsplash in seed) or base64 strings in DB. Simple but not scalable.

**Follow-up (base64 issues?):** 33% larger. Increases document size, affects query perf. 16MB doc limit. Production: S3 + store URL only.

**Difficult (secure uploads?):** Validate magic bytes (not extensions), max size, malware scan, S3 storage, signed URLs, unique filenames, async processing queue.

**Files:** src/app.js (27), src/controllers/productController.js (33-43)

**Production:** S3/Cloudinary, image processing, virus scan, CDN.

---

## Q33 — User modifies order total in frontend?

**Answer:** Frontend doesn't send total. createOrder calculates from cart stored prices. Request body: shippingAddress, paymentMethod only.

Even if user adds 'total' field = ignored. Backend computes subtotal, tax (18%), shipping, total.

Razorpay amount = server-calculated. User can't manipulate.

**Follow-up (cart prices?):** Stored at addition from DB. User can't modify directly. Even if product price changes, cart updates on next fetch.

**Difficult (price changes cart→checkout?):** Cart price = checkout price. Production: revalidate, show changes, ask confirmation.

**Files:** src/controllers/orderController.js (91-140)

**Production:** Price change detection, price lock timers.

---

## Q34 — DB connection fails during transaction?

**Answer:** Error propagates → session.abortTransaction() + session.endSession(). Rolls back all changes.

createOrder: empty cart → abort. Inactive product → abort. Stock decrement fails → abort.

Gap: no TransientTransactionError or UnknownTransactionCommitResult handling. Production: retry transient errors.

**Follow-up (transient vs non-transient?):** Transient = temporary (network timeout, write conflict, primary election) → retry. Non-transient = permanent (validation, duplicate key) → no retry. Driver labels with hasErrorLabel('TransientTransactionError').

**Difficult (retry mechanism?):** Wrap in retry loop. TransientTransactionError → retry up to 3× with exponential backoff. UnknownTransactionCommitResult → check if committed, retry if not. Operations must be idempotent.

**Files:** src/controllers/orderController.js (78-81, 86-89, 98-103)

**Production:** Retry logic, idempotent ops, monitoring, transaction timeout.

---

## Q35 — Razorpay temporarily unavailable?

**Answer:** createPaymentOrder: Razorpay API call in try-catch. Fail = extract error, throw 'Payment gateway error'. 500 to frontend. Order stays 'pending', user retries.

Gap: no circuit breaker. If Razorpay down, every request attempts + fails. Production: circuit breaker stops requests after failure rate.

**Follow-up (circuit breaker?):** oposum library or state machine: CLOSED (normal), OPEN (reject immediately), HALF_OPEN (test one request). N failures → open. Timeout → half-open. Success → close, fail → reopen.

**Difficult (malformed response?):** Validate response structure (razorpayOrder.id exists + string). Malformed = log, return error, flag for investigation. Idempotency for retry without duplicate Razorpay orders.

**Files:** src/controllers/paymentController.js (62-74)

**Production:** Circuit breaker, response validation, fallback methods, monitoring.

## Q36 — Two users buy last item simultaneously?

**Answer:** MongoDB document-level locking + $inc. User A decrements → write lock. User B waits for commit.

Gap: stock check before decrement. Both read stock=1, both sufficient, both decrement, stock=-1.

Fix: findOneAndUpdate({_id, stock:{$gte:quantity}}, {$inc:{stock:-quantity}}, {session}). Null = insufficient, abort. Only one succeeds.

**Follow-up (MongoDB guarantees?):** Yes, single-document atomicity. findOneAndUpdate + conditional filter = atomic check+update. In multi-doc transaction, null = explicit abort needed.

**Difficult (1000 concurrent, 10 items?):** Conditional update: exactly 10 succeed, 990 get null + abort. Users see 'insufficient stock'. Correct behavior.

**Files:** src/controllers/orderController.js (94-140)

**Production:** Conditional updates, queue for high-demand, waitlist.

---

## Q37 — Session expires during checkout?

**Answer:** JWT expires → next API call fails 401. protect middleware catches expired token → 'Not authorized, token failed'.

Frontend: no axios interceptor currently. Each call fails individually. User sees error but may not understand need to login.

Production: interceptor catches 401, saves form data to sessionStorage, redirects to login, restores after login + retries.

**Follow-up (interceptor?):** Response interceptor in api.js. 401 → save cart+form to sessionStorage, redirect to /login?redirect=checkout. After login: restore data, retry.

**Difficult (cart changes while logged out?):** Cart in DB, not session. Same from different device. Out-of-stock items: order creation fails, user removes them.

**Files:** client/src/services/api.js, src/middleware/authMiddleware.js

**Production:** Interceptor, refresh token, session timeout warnings.

---

## Q38 — Server crashes during transaction?

**Answer:** MongoDB transactions = atomic. All commit or none. Crash during transaction = WAL (write-ahead logging) rolls back incomplete transactions on restart.

Journal records writes before applying. On restart: replay committed, discard uncommitted. Data consistency maintained.

User perspective: no response. Retry = idempotency key returns cached response (if stored).

**Follow-up (crash after commit, before response?):** Transaction committed, client no response. Retry with same key = cached response (if stored). Gap: idempotency stored AFTER response, so crash = not stored = retry creates duplicate.

**Difficult (fully reliable?):** Store idempotency BEFORE processing ('processing' record), update to 'completed' after. Retry finds 'processing' → wait or 'try again later'. Or include idempotency in same transaction.

**Files:** src/controllers/orderController.js (78-180)

**Production:** Store before processing, two-phase commit, client retry with backoff.

---

## Q39 — Cancel Razorpay-paid order?

**Answer:** cancelOrder: restore stock, status='cancelled'. Gap: no refund handling.

Complete solution: 1. Razorpay refund API via razorpayPaymentId. 2. Ledger entry type='refund'. 3. status='refunded'. 4. Notification to user. Refund takes 5-10 business days.

**Follow-up (partial refunds?):** Razorpay supports partial. Calculate amount (minus cancellation charges), partial refund API, Ledger entry, status='partially_refunded', track total refunded.

**Difficult (refund API fails?):** Retry with exponential backoff. Persistent failures = 'refund_pending' record + cron job retry. Alert support for manual intervention.

**Files:** src/controllers/orderController.js (374-425)

**Production:** Razorpay refund integration, partial refunds, retry mechanism.

---

## Q40 — User accesses admin endpoint?

**Answer:** protect + admin middleware. protect verifies JWT, attaches req.user. admin checks role==='admin'. Customer → 403 'Not authorized as admin'.

Role in signed JWT. Can't modify (invalid signature = jwt.verify fails = 401).

**Follow-up (stolen admin token?):** Thief has full access until expiry (7 days). Production: token blacklisting, shorter expiry + refresh tokens, IP validation, 2FA, audit logging.

**Difficult (audit logging?):** AuditLog model: who (admin ID), what (action), when (timestamp), where (IP), before/after state. Middleware after admin routes captures request+response.

**Files:** src/middleware/authMiddleware.js (25-31)

**Production:** Audit logging, admin notifications, IP whitelisting, session management.

## Q41 — Same idempotency key reused after 24 hours?

**Answer:** Idempotency TTL index on expiresAt (expireAfterSeconds: 0). MongoDB auto-deletes when expiresAt reached. Set to 24h from creation.

Same key after 24h = old record deleted = processed as new request. Intentional — user might legitimately reorder.

Subtle: expiresAt set on creation. Same key within 24h = upsert updates record. Middleware updates expiresAt on each upsert → TTL resets.

**Follow-up (different TTL behavior?):** Fixed TTL from first use: $setOnInsert for expiresAt (only on insert, not update).

**Difficult (idempotency for non-order ops?):** Same pattern for password changes, profile updates, payments. Key = unique per operation, not per user. Frontend generates new key per distinct operation.

**Files:** src/models/Idempotency.js (19-23), src/middleware/idempotencyMiddleware.js (51-62)

**Production:** $setOnInsert for fixed TTL, monitoring, different TTLs per operation.

---

## Q42 — Product goes out of stock before checkout?

**Answer:** Stock checked/decremented at checkout only, not cart addition. User adds item, by checkout it's out of stock.

createOrder: check stock >= quantity. Insufficient = abort, error. User removes item, proceeds with rest.

Deliberate: no reservation at cart addition. Avoids users holding inventory indefinitely. But poor UX if stock changes.

**Follow-up (stock reservation?):** Add reservedStock to Product, reservedAt to Cart item. Add to cart: increment reservedStock, set reservedAt. Remove/expiry: decrement. Available = stock - reservedStock. Cron job for expiry cleanup.

**Difficult (100 users, 10 in stock?):** Reservation: first 10 succeed, rest see 'out of stock'. No reservation: all 100 add, first 10 at checkout succeed. Reservation = better UX but complex (expiry, concurrent reservations, race condition).

**Files:** src/controllers/cartController.js (21-82), src/controllers/orderController.js (94-140)

**Production:** Reservation with expiry, waitlist, back-in-stock notifications.

---

## Q43 — Price changes after adding to cart?

**Answer:** Cart stores addition price. Order uses cart stored prices, not current product prices.

Price increase after cart = user pays old price. Price decrease = user pays old price (seller loses difference).

Design decision: lock at addition protects from increases, doesn't benefit from decreases.

**Follow-up (always charge current price?):** createOrder: fetch current prices, compare with cart prices. Changed = ask confirmation or auto-update + notification.

**Difficult (price decreases?):** Some sites auto-apply lower price. Checkout: fetch current, if decreased show 'price drop' + savings, use lower price, update cart.

**Files:** src/models/Cart.js (15-19), src/controllers/orderController.js (91-140)

**Production:** Price change detection, automatic price matching, price lock timers.

---

## Q44 — DB connection pool exhausted?

**Answer:** Default pool size 5. High load = all in use, new queries wait in queue. Timeout = connectTimeoutMS, socketTimeoutMS.

Production: configure maxPoolSize based on concurrent users. E-commerce: 50-100 per instance, monitor usage.

**Follow-up (monitor pool?):** Mongoose events: connected, disconnected, error. Driver events: connectionPoolCreated, connectionCheckedOut/In. Log to monitoring, alert at 80% utilization.

**Difficult (more connections than single instance?):** Read replicas for reads. Writes to primary. Multiple Mongoose connections (reads vs writes). Very high scale = sharding.

**Files:** src/config/db.js

**Production:** maxPoolSize config, read replicas, pool monitoring, retry logic.

---

## Q45 — Cart clearing fails after order?

**Answer:** Cart cleared AFTER transaction commit. COD: clear after commit. Razorpay: clear after payment verification.

Fail after order = confirmed order but items still in cart. Minor: user manual clear, or items there but stock reduced.

Production: retry mechanism, background job to clear confirmed orders' carts, check on cart page (if ordered, show message).

**Follow-up (clear before commit?):** Within transaction + abort = rollback (correct). Outside + commit = window where order exists, cart not cleared. Safest: clear within same transaction.

**Difficult (Razorpay cart clearing?):** Only after payment confirmed, not order creation. Clear at creation + payment fail = no cart, no order = re-add items. Correct: create (retain) → payment → clear. Fail = cart retained for retry.

**Files:** src/controllers/orderController.js (143-165)

**Production:** Clear in transaction, retry, cart validation, idempotent ops.

## Q46 — Cancel shipped order?

**Answer:** cancelOrder: checks status pending/confirmed only. Other statuses (processing, shipped, etc.) → 400 'Order in X status cannot be cancelled'.

validTransitions enforces: shipped can't cancel. User waits for delivery, then return.

Gap: no return flow. Production: 'return_requested' from 'delivered', return process + refund.

**Follow-up (return flow?):** Statuses: return_requested, return_approved, return_shipped, return_delivered, refunded. Flow: user requests → admin approves → user ships → admin confirms → Razorpay refund. Notifications + status history.

**Difficult (user refuses return?):** Mark 'return_rejected', back to 'delivered'. Claims shipped = dispute, manual intervention. Dispute resolution: evidence (photos, tracking), admin review.

**Files:** src/controllers/orderController.js (374-425)

**Production:** Return flow, reason tracking, return labels, dispute resolution.

---

## Q47 — Webhook signature verification fails?

**Answer:** handleRazorpayWebhook: check x-razorpay-signature exists (400 if not). Verify with verifyWebhookSignature (HMAC-SHA256 of raw body + RAZORPAY_WEBHOOK_SECRET). Fail = 400 'Invalid webhook signature'.

Reasons: not from Razorpay, secret misconfigured, body tampered. 400 (client error, not server fault).

**Follow-up (secret rotated?):** All webhooks fail until env var updated. Production: support multiple secrets (try new, fallback old), log failures, alerts, quick update process.

**Difficult (raw body available?):** In app.js, webhook route BEFORE express.json(), using express.raw({type:'application/json'}). Body = Buffer (raw bytes). If express.json() first = parsed JSON = different bytes = signature mismatch.

**Files:** src/controllers/webhookController.js (6-20), src/app.js (100)

**Production:** Multiple secrets, failure alerting, replay protection, monitoring.

---

## Q48 — Multi-vendor cart (if applicable)?

**Answer:** Current: single-vendor. Cart = user ref + items array. Each item references product.

Multi-vendor: 1. seller field on Product. 2. Group cart items by seller. 3. Separate orders per seller. 4. Separate payments or escrow. 5. Inventory per seller.

Checkout = multiple orders (one per seller), each with own payment, shipping, tracking.

**Follow-up (payment splitting?):** Razorpay marketplace or escrow. Customer pays once, split between sellers (minus commission). Held in escrow until delivery, then released. Complex Ledger for splits, commissions, payouts.

**Difficult (schema changes?):** Seller model (bank details). seller ref on Product, Order (or OrderItem). commission on Order. Payout model. Cart → Cart + CartSeller (group by seller).

**Files:** src/models/Cart.js, src/models/Order.js

**Production:** Multi-vendor support, payment splitting, seller dashboard, commission tracking.

---

## Q49 — Scale to 100,000 concurrent users?

**Answer:** Current: single Node.js + MongoDB Atlas. At 100K:
1. Single server bottleneck → horizontal scaling (load balancer + multiple instances).
2. DB connections: 10 instances × 50 = 500. Monitor + tune.
3. Transactions: overhead + lock contention. High-traffic products = conditional updates.
4. Stateless (JWT) = good. Socket.io needs Redis adapter.
5. Caching: Redis for sessions, catalog, idempotency.
6. CDN: static assets, images.
7. Message queue: webhooks, notifications.

**Follow-up (codebase changes?):** Redis, message queue, CDN, read replicas, connection pooling, rate limiting, monitoring, Docker, health checks.

**Difficult (flash sales?):** Queue system, pre-validate stock, Redis atomic DECR, waiting room, DB conditional updates, cache product details, separate inventory service.

**Files:** src/app.js, src/config/db.js

**Production:** Redis, Bull/BullMQ, CDN, read replicas, Docker, monitoring.

---

## Q50 — Testing done? What to add?

**Answer:** Current: basic tests in api.test.js (Jest + Supertest). Health check 200, protected routes 401, invalid route 404. Smoke tests only — verify structure, not business logic.

No integration tests for checkout, payment, stock, idempotency. Significant gap.

**Follow-up (what to add?):** 1. Unit: verifyPaymentSignature, generateToken, price calc. 2. Integration: add to cart → create order → verify payment → stock check. 3. Idempotency: duplicate requests = one order. 4. Concurrency: two users, last item. 5. Error: empty cart, inactive product, insufficient stock, invalid signature. 6. Webhook: fake Razorpay payloads.

**Difficult (test payment without Razorpay?):** jest.mock() for Razorpay API. Unit: mock createRazorpayOrder (fake ID), verifyPaymentSignature (true/false). Integration: test DB, mock external API. Webhook: construct fake payloads with valid signatures.

**Files:** src/__tests__/api.test.js (1-55)

**Production:** 80%+ coverage, CI/CD, load testing, contract testing.

---

# TOP 15 MUST KNOW

1. **Q2** — Complete checkout flow (most likely opening question)
2. **Q3** — MongoDB transactions (core technical decision)
3. **Q4** — Idempotency implementation (critical for payments)
4. **Q5** — Razorpay payment verification (security)
5. **Q7** — Overselling/concurrency (classic e-commerce problem)
6. **Q9** — Authentication with httpOnly cookies (security)
7. **Q19** — Security measures (breadth question)
8. **Q26** — Price consistency (data integrity)
9. **Q36** — Concurrent last-item purchase (race condition)
10. **Q29** — Payment succeeds but order fails (distributed systems)
11. **Q6** — Webhook handling (async processing)
12. **Q14** — Idempotency middleware internals (code-level)
13. **Q10** — Order cancellation (reverse flow)
14. **Q39** — Razorpay refund on cancellation (financial)
15. **Q50** — Testing strategy (gap identification)

---

# TOP 10 DEEPEST QUESTIONS

1. **Q3** — Transactions → race conditions → conditional updates → retry logic
2. **Q4** — Idempotency → concurrent same-key requests → processing state → distributed lock
3. **Q7** — Stock decrement → $inc atomicity → conditional update → 1000 concurrent requests
4. **Q36** — Last item → document locking → conditional update → flash sales
5. **Q29** — Payment/order mismatch → webhook fallback → reconciliation → saga pattern
6. **Q34** — Transaction failure → transient errors → retry mechanism → idempotent operations
7. **Q38** — Server crash → journal recovery → idempotency gap → two-phase commit
8. **Q49** — Scaling → horizontal scaling → Redis → message queue → flash sales
9. **Q14** — Middleware interception → response override → race condition → processing state
10. **Q5** — Signature verification → frontend tampering → webhook fallback → reconciliation

---

# TOP 10 TRAP QUESTIONS

1. **Q28** — "Why do you have TWO idempotency implementations?"
2. **Q7** — "Does your current implementation completely eliminate overselling?"
3. **Q19** — "What security issues still exist?"
4. **Q50** — "What tests do you have for the checkout flow?"
5. **Q39** — "How do you handle Razorpay refunds on cancellation?"
6. **Q34** — "Do you handle TransientTransactionError?"
7. **Q38** — "What if the server crashes after commit but before response?"
8. **Q42** — "Do you reserve stock when adding to cart?"
9. **Q11** — "What if Ledger creation fails?"
10. **Q22** — "Do you use asyncHandler consistently?"

---

# TOP 10 PRODUCTION SCENARIOS

1. Two users buy the last product simultaneously
2. User clicks "Place Order" twice
3. Payment succeeds but response is lost
4. Payment succeeds but order creation fails
5. Razorpay is temporarily unavailable
6. Database connection fails during checkout
7. Server crashes during transaction
8. User modifies price in frontend request
9. Malicious user accesses admin endpoint
10. Same idempotency key is reused after 24 hours

---

# 2-MINUTE PROJECT EXPLANATION

"This is a full-stack e-commerce checkout engine I built from scratch. On the customer side, users can browse products with search and filtering, add items to cart, and checkout with either Razorpay or Cash on Delivery. On the admin side, there's a dashboard for managing products, orders, customers, and a financial ledger.

The technically interesting part is the checkout flow. When a user places an order, we need to validate stock, decrement inventory, create the order, and handle payment — all atomically. I used MongoDB transactions for this. We also have idempotency keys to prevent duplicate orders if the user clicks twice or the network fails.

For payments, I integrated Razorpay with signature verification to prevent tampering, and webhooks as a fallback in case the payment verification fails. The order status follows a state machine — pending, confirmed, processing, shipped, delivered, cancelled — with allowed transitions enforced in code.

On the frontend, I used React with Context API for auth state. JWTs are stored in httpOnly cookies for security. I also added an AI chatbot using LangChain, real-time notifications with Socket.io, and a review system.

---

# PROJECT ARCHITECTURE CHEAT SHEET

```
FRONTEND (React 18 + Vite)
├── Context API (Auth state)
├── Axios (withCredentials: true for cookies)
├── React Router v6
└── Razorpay SDK (frontend)

BACKEND (Express 5 + Node.js)
├── MIDDLEWARE LAYER
│   ├── helmet → Security headers
│   ├── cors → Whitelist + credentials
│   ├── cookieParser → Extract JWT
│   ├── express.json() → Body parsing (10mb limit)
│   ├── httpLogger → Winston logging
│   ├── protect → JWT verification
│   ├── admin → Role check
│   ├── idempotencyMiddleware → Response caching
│   └── errorHandler → Global error catch
│
├── ROUTES (/api/*)
│   ├── /auth → register, login, logout, me
│   ├── /products → GET (public), POST/PUT/DELETE (admin)
│   ├── /cart → CRUD (protected)
│   ├── /orders → create (idempotent), get, cancel
│   ├── /payments → create, verify, ledger
│   ├── /admin → dashboard, orders, products, customers
│   └── /webhooks → razorpay (raw body)
│
├── CONTROLLERS
│   ├── authController, cartController, orderController
│   ├── paymentController, productController, webhookController
│   └── passwordController, admin (inline in routes)
│
└── MODELS (Mongoose)
    ├── User, Product, Cart, Order, Ledger, Idempotency
    └── Category, Notification, Review, Wishlist

DATABASE: MongoDB Atlas (Transactions, TTL Indexes, Text Indexes)
PAYMENT: Razorpay (Orders API, Signature Verification, Webhooks)
```

---

# MOST IMPORTANT FILES

| # | File | Why It Matters |
|---|------|----------------|
| 1 | `src/controllers/orderController.js` | Core checkout logic, transactions, stock, idempotency |
| 2 | `src/controllers/paymentController.js` | Razorpay integration, verification, ledger |
| 3 | `src/controllers/webhookController.js` | Async processing, webhook security, atomic updates |
| 4 | `src/middleware/idempotencyMiddleware.js` | Idempotency pattern, response interception |
| 5 | `src/config/razorpay.js` | Signature verification, order creation |
| 6 | `src/models/Order.js` | Schema design, indexes, status enum |
| 7 | `src/models/Idempotency.js` | TTL index, unique constraints |
| 8 | `src/middleware/authMiddleware.js` | JWT verification, RBAC |
| 9 | `src/app.js` | Middleware order, CORS, security setup |
| 10 | `client/src/pages/Checkout.jsx` | Frontend checkout flow, UUID generation |

---

# FINAL 1-PAGE REVISION

## Core Architecture
- **Stack**: Node.js + Express 5, MongoDB + Mongoose 9, React 18 + Vite, JWT, Razorpay
- **Pattern**: Routes → Middleware → Controllers → Models (no service layer)
- **Auth**: JWT in httpOnly cookie (sameSite: strict, 7-day expiry), bcrypt (10 rounds)
- **DB**: MongoDB Atlas with transactions (requires replica set)

## Checkout Flow (CRITICAL)
1. Frontend generates UUID v4 → sends in Idempotency-Key header
2. idempotencyMiddleware validates UUID → intercepts res.json for caching
3. createOrder checks Idempotency collection → returns cached if exists
4. Starts MongoDB session + transaction
5. Validates cart → checks product.isActive → checks stock >= quantity
6. $inc stock decrement with session (atomic per document)
7. Creates order (status: 'pending' for Razorpay, 'confirmed' for COD)
8. Commits transaction → stores idempotency response (24h TTL)
9. Razorpay: create order → verify signature → update status → clear cart
10. Webhook: immediate 200 → setImmediate background → atomic findOneAndUpdate

## Key Decisions
| Decision | Reason | Trade-off |
|----------|--------|-----------|
| MongoDB | Flexible schema, JSON-native, free tier | Transactions need replica set |
| httpOnly cookies | XSS protection | CSRF risk (mitigated by sameSite) |
| Dual idempotency | Middleware = generic, manual = explicit | Redundancy |
| Price in cart | Lock at addition | No benefit from price drops |
| Denormalized order | Historical accuracy | Data duplication |

## Known Gaps (Be Honest)
- No conditional stock update (race condition possible)
- No transaction retry logic
- No refund implementation for Razorpay cancellations
- Rate limiting commented out
- No integration tests for checkout/payment
- Password reset token stored in plain text
- Ledger creation failure = non-critical
- No service layer

## Key Metrics
- Idempotency TTL: 24 hours | JWT expiry: 7 days | Reset expiry: 1 hour
- GST: 18% | Free shipping: ₹500+ | Shipping: ₹40
- Razorpay amount: paise (×100)
- Statuses: pending → confirmed → processing → shipped → out_for_delivery → delivered

## Interview Tips
1. Mention the gap BEFORE interviewer finds it — shows self-awareness
2. Distinguish current vs production: "In my project I did X, but in production I'd add Y"
3. Reference actual files: "In orderController.js line 78..."
4. Don't claim what you don't have: no refund flow, no service layer, minimal tests
5. Emphasize the WHY — every decision has a reason and trade-off

---

**Good luck with your Recruit CRM Round 3 interview!**

If I had to improve it, I'd add a proper service layer, write integration tests for the checkout flow, and implement a message queue for reliable webhook processing."

---

# 60-SECOND PROJECT EXPLANATION

"I built a full-stack e-commerce checkout engine with Node.js, Express, MongoDB, and React. The key technical challenges I solved were: atomic order creation using MongoDB transactions, idempotency keys to prevent duplicate orders, Razorpay payment integration with signature verification, and a webhook-based fallback for payment confirmation. The admin side has order management, product CRUD, and a financial ledger. I also integrated an AI chatbot and real-time notifications."

---

# 30-SECOND PROJECT EXPLANATION

"A full-stack e-commerce checkout engine with Node.js, Express, MongoDB, and React. Key features: atomic order creation via MongoDB transactions, Razorpay payment integration with signature verification, idempotency keys to prevent duplicate orders, and an admin dashboard with financial ledger."