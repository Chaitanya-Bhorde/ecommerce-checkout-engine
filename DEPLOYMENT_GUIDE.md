# E-Commerce Checkout Engine - Deployment Guide

## Prerequisites
- GitHub repository: https://github.com/Chaitanya-Bhorde/ecommerce-checkout-engine
- MongoDB database (MongoDB Atlas recommended)
- Razorpay account for payments
- Node.js hosting platform (Render, Vercel, Heroku, etc.)

---

## Step 1: Prepare Environment Variables

Create a `.env` file on your deployment platform with these variables:

```env
# Server
PORT=5000
NODE_ENV=production

# MongoDB
MONGODB_URI=your_mongodb_connection_string

# JWT
JWT_SECRET=your_jwt_secret_key_here

# Razorpay (Get from https://dashboard.razorpay.com)
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Frontend URL (for CORS)
CLIENT_URL=https://your-frontend-domain.com

# Session
SESSION_SECRET=your_session_secret_here
```

---

## Step 2: Deploy Backend (Server)

### Option A: Deploy on Render (Recommended)

1. **Create Render Account**
   - Go to https://render.com
   - Sign up / Login

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select repository: `ecommerce-checkout-engine`

3. **Configure Service**
   ```
   Name: ecommerce-backend
   Region: Choose closest to you
   Branch: main
   Root Directory: (leave empty)
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   ```

4. **Add Environment Variables**
   - Go to "Environment" tab
   - Add all variables from Step 1
   - Important: Set `NODE_ENV=production`

5. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment (5-10 minutes)
   - Note your backend URL: `https://your-app.onrender.com`

### Option B: Deploy on Heroku

1. **Install Heroku CLI**
   ```bash
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   ```

2. **Login and Deploy**
   ```bash
   heroku login
   heroku create ecommerce-backend
   git push heroku main
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI=your_mongodb_uri
   heroku config:set JWT_SECRET=your_jwt_secret
   heroku config:set RAZORPAY_KEY_ID=your_key_id
   heroku config:set RAZORPAY_KEY_SECRET=your_key_secret
   ```

### Option C: Deploy on Railway

1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select `ecommerce-checkout-engine`
5. Add environment variables
6. Deploy automatically

---

## Step 3: Deploy Frontend (Client)

### Option A: Deploy on Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   cd client
   vercel
   ```

3. **Or use Vercel Dashboard**
   - Go to https://vercel.com
   - Import GitHub repository
   - Select `ecommerce-checkout-engine`
   - Set Root Directory to `client`
   - Add environment variable:
     ```
     VITE_API_URL=https://your-backend-url.onrender.com/api
     ```
   - Deploy

### Option B: Deploy on Netlify

1. **Build the Client**
   ```bash
   cd client
   npm run build
   ```

2. **Deploy to Netlify**
   - Go to https://app.netlify.com/drop
   - Drag and drop the `client/dist` folder
   - Or connect GitHub repo

3. **Configure**
   - Set Root Directory: `client`
   - Build Command: `npm run build`
   - Publish Directory: `dist`
   - Add environment variable:
     ```
     VITE_API_URL=https://your-backend-url.onrender.com/api
     ```

### Option C: Deploy Frontend on Render

1. **Create New Static Site**
   - Connect GitHub repo
   - Root Directory: `client`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`

2. **Environment Variables**
   ```
   VITE_API_URL=https://your-backend-url.onrender.com/api
   ```

---

## Step 4: Configure MongoDB

### Using MongoDB Atlas (Recommended)

1. **Create Atlas Account**
   - Go to https://www.mongodb.com/atlas/database
   - Sign up for free tier

2. **Create Cluster**
   - Choose FREE tier (M0)
   - Select region closest to your deployment
   - Create cluster (takes 3-5 minutes)

3. **Setup Database Access**
   - Go to "Database Access"
   - Add database user
   - Username: `admin`
   - Password: Generate strong password
   - Grant readWrite access

4. **Setup Network Access**
   - Go to "Network Access"
   - Add IP Address: `0.0.0.0/0` (allows access from anywhere)
   - Or add specific IPs for better security

5. **Get Connection String**
   ```
   mongodb+srv://admin:password@cluster0.mongodb.net/ecommerce?retryWrites=true&w=majority
   ```

6. **Add to Environment Variables**
   ```
   MONGODB_URI=mongodb+srv://admin:password@cluster0.mongodb.net/ecommerce?retryWrites=true&w=majority
   ```

---

## Step 5: Configure Razorpay

1. **Create Razorpay Account**
   - Go to https://dashboard.razorpay.com
   - Sign up / Login

2. **Get API Keys**
   - Go to Settings → API Keys
   - Generate test/live keys
   - Copy Key ID and Key Secret

3. **Add to Environment Variables**
   ```
   RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
   RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
   ```

4. **Configure Webhooks** (Optional)
   - Go to Settings → Webhooks
   - Add webhook URL: `https://your-backend-url.onrender.com/api/payments/webhook`
   - Select events: `payment.captured`, `payment.failed`

---

## Step 6: Update CORS Configuration

In `src/app.js`, update CORS to allow your frontend domain:

```javascript
app.use(cors({
  origin: process.env.CLIENT_URL || 'https://your-frontend-domain.com',
  credentials: true
}));
```

---

## Step 7: Test Deployment

1. **Test Backend**
   ```bash
   curl https://your-backend-url.onrender.com/api/health
   ```
   Should return: `{"status":"ok"}`

2. **Test Frontend**
   - Visit your frontend URL
   - Try registering a new user
   - Try logging in
   - Test product browsing
   - Test adding to cart
   - Test checkout (use Razorpay test mode)

3. **Test Payment**
   - Use Razorpay test card: `4111 1111 1111 1111`
   - CVV: Any 3 digits
   - Expiry: Any future date

---

## Step 8: Domain Configuration (Optional)

### Custom Domain for Backend
1. Buy domain from GoDaddy, Namecheap, etc.
2. In Render/Heroku dashboard, add custom domain
3. Update DNS records as instructed

### Custom Domain for Frontend
1. In Vercel/Netlify dashboard, add custom domain
2. Update DNS records
3. SSL certificate will be auto-generated

---

## Step 9: Enable Auto-Deploy

### For Future Changes:

1. **Make changes locally**
2. **Commit and push**
   ```bash
   git add -A
   git commit -m "your changes"
   git push origin main
   ```

3. **Auto-deploy triggers**
   - Render/Heroku/Vercel will auto-detect push
   - Automatically rebuild and deploy
   - Takes 2-5 minutes

---

## Step 10: Monitoring & Maintenance

### Monitor Your App
- **Render**: Built-in logs and metrics
- **Heroku**: `heroku logs --tail`
- **Vercel**: Built-in analytics

### Database Backups
- MongoDB Atlas: Automatic backups
- Enable backup schedule in Atlas settings

### Update Dependencies
```bash
npm audit
npm update
git add -A
git commit -m "chore: update dependencies"
git push origin main
```

---

## Troubleshooting

### Issue: "Application Error"
- Check logs in deployment platform
- Verify environment variables are set
- Ensure MongoDB connection is working

### Issue: "CORS Error"
- Update CLIENT_URL in backend environment variables
- Check CORS configuration in `src/app.js`

### Issue: "Payment Not Working"
- Verify Razorpay keys are correct
- Check if using test mode vs live mode
- Ensure webhook URL is configured

### Issue: "Database Connection Failed"
- Check MongoDB URI is correct
- Verify network access in MongoDB Atlas
- Ensure database user has correct permissions

---

## Security Checklist

- ✅ `.env` file not committed to Git
- ✅ Strong JWT_SECRET (32+ characters)
- ✅ MongoDB credentials secured
- ✅ Razorpay keys in environment variables
- ✅ HTTPS enabled (automatic on most platforms)
- ✅ CORS configured properly
- ✅ Rate limiting enabled
- ✅ Helmet security headers enabled

---

## Cost Estimate

### Free Tier (Development/Testing)
- **Render**: Free web service (spins down after inactivity)
- **Vercel**: Free static hosting
- **MongoDB Atlas**: Free M0 cluster (512MB)
- **Total**: $0/month

### Production Tier (Small Business)
- **Render**: $7/month (always on)
- **Vercel**: $20/month (pro)
- **MongoDB Atlas**: $9/month (M2 cluster)
- **Total**: ~$36/month

### Recommended Production Setup
- **Backend**: Render ($7/month)
- **Frontend**: Vercel (free or $20/month)
- **Database**: MongoDB Atlas ($9/month)
- **Total**: $16-36/month

---

## Support

- GitHub Issues: https://github.com/Chaitanya-Bhorde/ecommerce-checkout-engine/issues
- Documentation: Check README.md
- Email: Your support email

---

## Quick Deploy Commands

```bash
# 1. Clone and setup
git clone https://github.com/Chaitanya-Bhorde/ecommerce-checkout-engine.git
cd ecommerce-checkout-engine

# 2. Install dependencies
npm install
cd client && npm install && cd ..

# 3. Setup environment
cp .env.example .env
# Edit .env with your values

# 4. Push changes
git add -A
git commit -m "deploy: initial deployment"
git push origin main

# 5. Deploy will happen automatically if connected to Render/Vercel
```

---

**Your application will be live at:**
- Frontend: `https://your-app.vercel.app`
- Backend: `https://your-app.onrender.com`

🎉 **Congratulations! Your e-commerce store is now live!**