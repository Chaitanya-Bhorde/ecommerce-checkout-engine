const Razorpay = require('razorpay');
const crypto = require('crypto');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const createRazorpayOrder = async (amount, currency = 'INR', receipt = '') => {
  const options = {
    amount: Math.round(amount * 100),
    currency,
    receipt: receipt || `receipt_${Date.now()}`,
    payment_capture: 1,
  };

  const order = await razorpay.orders.create(options);
  return order;
};

const verifyPaymentSignature = (orderId, paymentId, signature) => {
  const body = orderId + '|' + paymentId;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
};

const verifyWebhookSignature = (body, signature, secret) => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
};

module.exports = { razorpay, createRazorpayOrder, verifyPaymentSignature, verifyWebhookSignature };