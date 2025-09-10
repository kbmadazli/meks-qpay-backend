const express = require('express');
const cors = require('cors');
const axios = require('axios');
const crypto = require('crypto');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 8080;

// Environment variables
const QPAY_MERCHANT_USER = process.env.QPAY_MERCHANT_USER; // kbmadazli@gmail.com
const QPAY_MERCHANT_PASSWORD = process.env.QPAY_MERCHANT_PASSWORD; // Your system user password
const QPAY_MERCHANT = process.env.QPAY_MERCHANT; // 378855
const QPAY_SECRET_KEY = process.env.QPAY_SECRET_KEY; // From QPay panel
const QPAY_API_URL = process.env.QPAY_API_URL || 'https://qpos-test.qpay.com.tr/qpay/api/v2';

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'https://www.marinekspertiz.com',
    'https://marinekspertiz.com',
    'http://localhost:3000', // For development
    'capacitor://localhost',
    'ionic://localhost'
  ]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Validate environment variables
if (!QPAY_MERCHANT_USER || !QPAY_MERCHANT_PASSWORD || !QPAY_MERCHANT) {
  console.error('⚠️  Missing required environment variables:');
  console.error('QPAY_MERCHANT_USER:', !!QPAY_MERCHANT_USER);
  console.error('QPAY_MERCHANT_PASSWORD:', !!QPAY_MERCHANT_PASSWORD);
  console.error('QPAY_MERCHANT:', !!QPAY_MERCHANT);
  console.error('⚠️  Server starting anyway for debugging...');
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Generate QPay session token
app.post('/qpay/session', async (req, res) => {
  try {
    const { amount, currency = 'TRY', orderNumber, customerEmail, returnUrl } = req.body;

    // Validate required fields
    if (!amount || !orderNumber || !customerEmail || !returnUrl) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['amount', 'orderNumber', 'customerEmail', 'returnUrl']
      });
    }

    console.log(`[QPay Session] Creating session for order: ${orderNumber}, amount: ${amount} ${currency}`);

    // Prepare session token request
    const sessionRequest = {
      ACTION: 'SESSIONTOKEN',
      SESSIONTYPE: 'PAYMENTSESSION',
      MERCHANTUSER: QPAY_MERCHANT_USER,
      MERCHANTPASSWORD: QPAY_MERCHANT_PASSWORD,
      MERCHANT: QPAY_MERCHANT,
      MERCHANTPAYMENTID: orderNumber,
      AMOUNT: amount,
      CURRENCY: currency,
      RETURNURL: returnUrl
    };

    // Make request to QPay API (QPay expects form-encoded data)
    const formData = new URLSearchParams();
    Object.keys(sessionRequest).forEach(key => {
      if (sessionRequest[key] !== undefined && sessionRequest[key] !== null) {
        formData.append(key, sessionRequest[key]);
      }
    });

    const response = await axios.post(QPAY_API_URL, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'User-Agent': 'MEKS-Marine-App/1.0'
      },
      timeout: 30000
    });

    console.log(`[QPay Session] QPay response status: ${response.status}`);

    if (response.data && response.data.SESSIONTOKEN) {
      console.log(`[QPay Session] Session token created successfully for order: ${orderNumber}`);
      
      // Return session token and payment URL
      res.json({
        success: true,
        sessionToken: response.data.SESSIONTOKEN,
        paymentUrl: `${QPAY_API_URL}/post/sale3d/${response.data.SESSIONTOKEN}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        orderNumber: orderNumber
      });
    } else {
      console.error(`[QPay Session] Session token creation failed:`, response.data);
      
      res.status(400).json({
        success: false,
        error: 'QPay session token creation failed',
        details: response.data
      });
    }

  } catch (error) {
    console.error('[QPay Session] Error:', error.message);
    
    if (error.response) {
      console.error('[QPay Session] QPay API Error Response:', error.response.data);
      res.status(error.response.status || 500).json({
        success: false,
        error: 'QPay API Error',
        details: error.response.data
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: error.message
      });
    }
  }
});

// Handle QPay return/callback
app.post('/qpay/return', async (req, res) => {
  try {
    console.log('[QPay Return] Received callback from QPay:', req.body);

    const {
      responseCode,
      responseMsg,
      orderNumber,
      transactionId,
      amount,
      currency,
      sdSha512,
      random,
      // Add other fields as needed
      authCode,
      rrn,
      batchNumber
    } = req.body;

    // Validate sdSha512 signature if secret key is available
    if (QPAY_SECRET_KEY && sdSha512) {
      // TODO: Implement signature validation
      // Format needs to be confirmed with QPay support
      console.log('[QPay Return] Signature validation needed - implement with QPay support guidance');
    }

    // Check if payment was successful
    const isSuccessful = responseCode === '00';

    if (isSuccessful) {
      console.log(`[QPay Return] Payment successful for order: ${orderNumber}, transaction: ${transactionId}`);
    } else {
      console.log(`[QPay Return] Payment failed for order: ${orderNumber}, reason: ${responseMsg}`);
    }

    // Return appropriate response to QPay
    res.status(200).send('OK');

    // TODO: Forward the result to your main application
    // This could be via webhook, database update, or direct API call
    // Example: await notifyMainApplication({ orderNumber, isSuccessful, transactionData: req.body });

  } catch (error) {
    console.error('[QPay Return] Error processing callback:', error);
    res.status(500).send('ERROR');
  }
});

// Query transaction status
app.get('/qpay/status/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;
    
    console.log(`[QPay Status] Querying status for order: ${orderNumber}`);

    const queryRequest = {
      ACTION: 'QUERYSTATUS',
      MERCHANTUSER: QPAY_MERCHANT_USER,
      MERCHANTPASSWORD: QPAY_MERCHANT_PASSWORD,
      MERCHANT: QPAY_MERCHANT,
      ORDERNUMBER: orderNumber
    };

    const formData = new URLSearchParams();
    Object.keys(queryRequest).forEach(key => {
      if (queryRequest[key] !== undefined && queryRequest[key] !== null) {
        formData.append(key, queryRequest[key]);
      }
    });

    const response = await axios.post(QPAY_API_URL, formData, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 30000
    });

    res.json({
      success: true,
      orderNumber: orderNumber,
      status: response.data
    });

  } catch (error) {
    console.error(`[QPay Status] Error querying status:`, error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to query transaction status',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 MEKS QPay Backend running on port ${PORT}`);
  console.log(`📡 QPay API URL: ${QPAY_API_URL}`);
  console.log(`🏪 Merchant: ${QPAY_MERCHANT}`);
  console.log(`👤 User: ${QPAY_MERCHANT_USER}`);
  console.log(`🔒 Secret Key: ${QPAY_SECRET_KEY ? 'Configured' : 'Not configured'}`);
});

module.exports = app;