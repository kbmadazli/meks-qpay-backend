# MEKS QPay Backend

Static IP backend for QPay Direct POST 3D integration.

## Features

- QPay session token generation
- Payment callback handling  
- Transaction status queries
- Static IP support for QPay whitelist

## Environment Variables

```
QPAY_MERCHANT_USER=your_email@domain.com
QPAY_MERCHANT_PASSWORD=your_password
QPAY_MERCHANT=your_merchant_code
QPAY_SECRET_KEY=your_secret_key
QPAY_API_URL=https://qpos-test.qpay.com.tr/qpay/api/v2
```

## Deployment

Deploy to Railway with static IP add-on enabled.

## API Endpoints

- `POST /qpay/session` - Generate session token
- `POST /qpay/return` - Handle payment callback
- `GET /qpay/status/:orderNumber` - Query transaction status
- `GET /health` - Health check