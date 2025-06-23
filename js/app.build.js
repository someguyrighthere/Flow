"use strict";

function _typeof(o) { "@babel/helpers - typeof"; return _typeof = "function" == typeof Symbol && "symbol" == typeof Symbol.iterator ? function (o) { return typeof o; } : function (o) { return o && "function" == typeof Symbol && o.constructor === Symbol && o !== Symbol.prototype ? "symbol" : typeof o; }, _typeof(o); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
function ownKeys(e, r) { var t = Object.keys(e); if (Object.getOwnPropertySymbols) { var o = Object.getOwnPropertySymbols(e); r && (o = o.filter(function (r) { return Object.getOwnPropertyDescriptor(e, r).enumerable; })), t.push.apply(t, o); } return t; }
function _objectSpread(e) { for (var r = 1; r < arguments.length; r++) { var t = null != arguments[r] ? arguments[r] : {}; r % 2 ? ownKeys(Object(t), !0).forEach(function (r) { _defineProperty(e, r, t[r]); }) : Object.getOwnPropertyDescriptors ? Object.defineProperties(e, Object.getOwnPropertyDescriptors(t)) : ownKeys(Object(t)).forEach(function (r) { Object.defineProperty(e, r, Object.getOwnPropertyDescriptor(t, r)); }); } return e; }
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == _typeof(i) ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != _typeof(t) || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != _typeof(i)) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { if (r) i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n;else { var o = function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); }; o("next", 0), o("throw", 1), o("return", 2); } }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
// --- Imports ---
var express = require('express');
var _require = require('pg'),
  Pool = _require.Pool;
var bcrypt = require('bcryptjs');
var jwt = require('jsonwebtoken');
var cors = require('cors');
var path = require('path');
var csv = require('csv-parser'); // Not used in provided routes, but kept.
var _require2 = require('stream'),
  Readable = _require2.Readable; // Not used in provided routes, but kept.
var rateLimit = require('express-rate-limit');
var morgan = require('morgan');
var multer = require('multer'); // ADD THIS LINE: Import multer
var fs = require('fs'); // ADD THIS LINE: Import file system module for local storage ops

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  try {
    require('fs').accessSync(path.join(__dirname, '.env'));
    dotenv.config(); // Use dotenv.config() here
  } catch (e) {
    console.warn("Warning: .env file not found or accessible locally. Relying on system environment variables.");
  }
}

// Ensure essential environment variables are set
var PORT = process.env.PORT || 3000; // Default to 3000 if PORT is not set
var JWT_SECRET = process.env.JWT_SECRET; // This was missing in the original code
var STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY; // Stripe key
var STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET; // Stripe webhook secret
// Retrieve Stripe Price IDs from environment variables
var STRIPE_PRICE_ID_PRO = process.env.STRIPE_PRICE_ID_PRO;
var STRIPE_PRICE_ID_ENT = process.env.STRIPE_PRICE_ID_ENT;

// Define employee limits for each plan (adjust these values as per your actual tiers)
var PLAN_EMPLOYEE_LIMITS = {
  'free': 5,
  // Free plan: up to 5 employees
  'pro': 100,
  // Pro plan: up to 100 employees
  'enterprise': null // Enterprise plan: null or Infinity for unlimited
};

// Validate JWT_SECRET
if (!JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET is not defined. Please set it in your environment variables or .env file.');
  process.exit(1); // Exit the process if essential variable is missing
}

// Stripe instance (only if key is available)
var stripeInstance;
if (STRIPE_SECRET_KEY) {
  stripeInstance = require('stripe')(STRIPE_SECRET_KEY);
} else {
  console.warn("Warning: STRIPE_SECRET_KEY is not defined. Stripe related functionalities might not work.");
}
var app = express();

// NEW: Trust proxy for Express when behind a load balancer (like Render)
// This is crucial for rate-limiting middleware to correctly identify client IPs.
app.set('trust proxy', 1); // Trust the first proxy (Render's load balancer)

// --- General Middleware ---
app.use(morgan('dev')); // Request logger - placed early

// Stripe Webhook Endpoint (This MUST be before express.json() to get raw body)
app.post('/stripe-webhook', express.raw({
  type: 'application/json'
}), /*#__PURE__*/function () {
  var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(req, res) {
    var sig, event, client, session, userId, planId, subscriptionUpdated, subscriptionDeleted, invoiceSucceeded, invoiceFailed, _t, _t2, _t3;
    return _regenerator().w(function (_context) {
      while (1) switch (_context.n) {
        case 0:
          sig = req.headers['stripe-signature'];
          _context.p = 1;
          // Use Stripe's method to construct the event from the raw body and signature
          // req.rawBody is provided by express.raw() middleware
          event = stripeInstance.webhooks.constructEvent(req.rawBody, sig, STRIPE_WEBHOOK_SECRET);
          _context.n = 3;
          break;
        case 2:
          _context.p = 2;
          _t = _context.v;
          console.error("Webhook Error: ".concat(_t.message));
          return _context.a(2, res.status(400).send("Webhook Error: ".concat(_t.message)));
        case 3:
          _context.n = 4;
          return pool.connect();
        case 4:
          client = _context.v;
          _context.p = 5;
          _context.n = 6;
          return client.query('BEGIN');
        case 6:
          _t2 = event.type;
          _context.n = _t2 === 'checkout.session.completed' ? 7 : _t2 === 'customer.subscription.updated' ? 10 : _t2 === 'customer.subscription.deleted' ? 13 : _t2 === 'invoice.payment_succeeded' ? 16 : _t2 === 'invoice.payment_failed' ? 19 : 22;
          break;
        case 7:
          session = event.data.object;
          console.log("Checkout Session Completed: ".concat(session.id));
          userId = session.metadata.userId;
          planId = session.metadata.planId;
          if (!(session.payment_status === 'paid' && userId && planId)) {
            _context.n = 9;
            break;
          }
          _context.n = 8;
          return client.query('UPDATE Users SET stripe_customer_id = $1, stripe_subscription_id = $2, subscription_status = $3, plan_id = $4 WHERE user_id = $5', [session.customer, session.subscription, 'active', planId, userId]);
        case 8:
          console.log("User ".concat(userId, " subscription updated to ").concat(planId, " (active)."));
        case 9:
          return _context.a(3, 23);
        case 10:
          subscriptionUpdated = event.data.object;
          console.log("Subscription Updated: ".concat(subscriptionUpdated.id));
          if (!(subscriptionUpdated.customer && subscriptionUpdated.status && subscriptionUpdated.plan && subscriptionUpdated.plan.id)) {
            _context.n = 12;
            break;
          }
          _context.n = 11;
          return client.query('UPDATE Users SET subscription_status = $1, plan_id = $2 WHERE stripe_customer_id = $3', [subscriptionUpdated.status, subscriptionUpdated.plan.id, subscriptionUpdated.customer]);
        case 11:
          console.log("Subscription for customer ".concat(subscriptionUpdated.customer, " status updated to ").concat(subscriptionUpdated.status, " and plan to ").concat(subscriptionUpdated.plan.id, "."));
        case 12:
          return _context.a(3, 23);
        case 13:
          subscriptionDeleted = event.data.object;
          console.log("Subscription Deleted: ".concat(subscriptionDeleted.id));
          if (!subscriptionDeleted.customer) {
            _context.n = 15;
            break;
          }
          _context.n = 14;
          return client.query('UPDATE Users SET subscription_status = $1, plan_id = $2, stripe_subscription_id = NULL WHERE stripe_customer_id = $3', ['cancelled', 'free', subscriptionDeleted.customer]);
        case 14:
          console.log("Subscription for customer ".concat(subscriptionDeleted.customer, " marked as cancelled and reverted to free."));
        case 15:
          return _context.a(3, 23);
        case 16:
          invoiceSucceeded = event.data.object;
          console.log("Invoice Payment Succeeded: ".concat(invoiceSucceeded.id));
          if (!(invoiceSucceeded.subscription && invoiceSucceeded.customer)) {
            _context.n = 18;
            break;
          }
          _context.n = 17;
          return client.query('UPDATE Users SET subscription_status = $1 WHERE stripe_subscription_id = $2 AND stripe_customer_id = $3', ['active', invoiceSucceeded.subscription, invoiceSucceeded.customer]);
        case 17:
          console.log("Subscription ".concat(invoiceSucceeded.subscription, " status set to active."));
        case 18:
          return _context.a(3, 23);
        case 19:
          invoiceFailed = event.data.object;
          console.log("Invoice Payment Failed: ".concat(invoiceFailed.id));
          // Corrected from invoiceNFailed.id to invoiceFailed.id
          if (!(invoiceFailed.subscription && invoiceFailed.customer)) {
            _context.n = 21;
            break;
          }
          _context.n = 20;
          return client.query('UPDATE Users SET subscription_status = $1 WHERE stripe_subscription_id = $2 AND stripe_customer_id = $3', ['past_due', invoiceFailed.subscription, invoiceFailed.customer]);
        case 20:
          console.log("Subscription ".concat(invoiceFailed.subscription, " status set to past_due."));
        case 21:
          return _context.a(3, 23);
        case 22:
          console.log("Unhandled event type ".concat(event.type));
        case 23:
          _context.n = 24;
          return client.query('COMMIT');
        case 24:
          // Commit transaction
          // Return a 200 response to acknowledge receipt of the event
          res.status(200).json({
            received: true
          });
          _context.n = 27;
          break;
        case 25:
          _context.p = 25;
          _t3 = _context.v;
          _context.n = 26;
          return client.query('ROLLBACK');
        case 26:
          // Rollback on error
          console.error("Database update error during webhook processing:", _t3.message);
          res.status(500).json({
            error: 'Webhook processing failed.'
          });
        case 27:
          _context.p = 27;
          client.release(); // Release client back to pool
          return _context.f(27);
        case 28:
          return _context.a(2);
      }
    }, _callee, null, [[5, 25, 27, 28], [1, 2]]);
  }));
  return function (_x, _x2) {
    return _ref.apply(this, arguments);
  };
}());
app.use(express.json()); // JSON body parser should be early - now after webhook

// CORS Middleware
app.use(cors({
  origin: function origin(_origin, callback) {
    // Allow multiple origins by splitting a comma-separated string from env
    var allowedOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(function (o) {
      return o.trim();
    }) : ['http://localhost:8000', 'http://127.0.0.1:8000', 'null'];

    // console.log(`CORS Check: Incoming Origin -> ${origin}`); // Commented out for production
    // console.log(`CORS Check: Allowed Origins -> ${allowedOrigins.join(', ')}`); // Commented out for production

    if (!_origin || allowedOrigins.includes(_origin)) {
      // Use .includes for array check
      callback(null, true);
    } else {
      var msg = "CORS Error: Origin ".concat(_origin, " not allowed. Allowed: ").concat(allowedOrigins.join(', '));
      console.error(msg);
      callback(new Error(msg), false);
    }
  },
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
  optionsSuccessStatus: 204
}));

// --- Database Setup (PostgreSQL) ---
// IMPORTANT: This part MUST be global and initialized before any route that uses 'pool' or 'query'/'runCommand'
var pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});
pool.on('connect', function () {
  return console.log('Connected to PostgreSQL database');
});
pool.on('error', function (err) {
  return console.error('PostgreSQL database error:', err.message, err.stack);
});

// --- Helper function for database queries (for consistency) ---
function query(_x3, _x4) {
  return _query.apply(this, arguments);
} // Modified runCommand to return rowCount or potentially the ID if a RETURNING clause is used
function _query() {
  _query = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee35(text, params) {
    var client, res;
    return _regenerator().w(function (_context35) {
      while (1) switch (_context35.n) {
        case 0:
          _context35.n = 1;
          return pool.connect();
        case 1:
          client = _context35.v;
          _context35.p = 2;
          _context35.n = 3;
          return client.query(text, params);
        case 3:
          res = _context35.v;
          return _context35.a(2, res.rows);
        case 4:
          _context35.p = 4;
          client.release();
          return _context35.f(4);
        case 5:
          return _context35.a(2);
      }
    }, _callee35, null, [[2,, 4, 5]]);
  }));
  return _query.apply(this, arguments);
}
function runCommand(_x5, _x6) {
  return _runCommand.apply(this, arguments);
} // --- Authentication Middleware ---
function _runCommand() {
  _runCommand = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee36(text, params) {
    var client, res;
    return _regenerator().w(function (_context36) {
      while (1) switch (_context36.n) {
        case 0:
          _context36.n = 1;
          return pool.connect();
        case 1:
          client = _context36.v;
          _context36.p = 2;
          _context36.n = 3;
          return client.query(text, params);
        case 3:
          res = _context36.v;
          return _context36.a(2, res.rows.length > 0 ? res.rows[0] : res.rowCount);
        case 4:
          _context36.p = 4;
          client.release();
          return _context36.f(4);
        case 5:
          return _context36.a(2);
      }
    }, _callee36, null, [[2,, 4, 5]]);
  }));
  return _runCommand.apply(this, arguments);
}
function authenticateToken(req, res, next) {
  var authHeader = req.headers['authorization'];
  var token = authHeader && authHeader.split(' ')[1];
  if (token == null) {
    return res.status(401).json({
      error: 'Unauthorized: No token provided.'
    });
  }
  jwt.verify(token, JWT_SECRET, function (err, user) {
    if (err) {
      console.error("JWT Verification Error:", err.message);
      // Specifically check for token expiration
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          error: 'Forbidden: Token has expired.'
        });
      }
      return res.status(403).json({
        error: 'Forbidden: Invalid token.'
      });
    }
    req.user = user;
    next();
  });
}
var isValidEmail = function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

// --- API Routes (Define ALL API routes FIRST) ---
// These routes must come BEFORE any static file serving middleware
// to ensure API requests are handled by your backend logic.

var authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  // 15 minutes
  max: 10,
  // Max 10 requests per 15 minutes per IP
  message: 'Too many login/registration attempts from this IP, please try again after 15 minutes',
  standardHeaders: true,
  // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false // Disable the `X-RateLimit-*` headers
});

// Applying authLimiter directly as middleware
app.post('/register', authLimiter, /*#__PURE__*/function () {
  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(req, res, next) {
    var _req$body, company_name, full_name, email, password, password_hash, client, companyResult, newCompanyId, userResult, newUserId, _t4, _t5;
    return _regenerator().w(function (_context2) {
      while (1) switch (_context2.n) {
        case 0:
          _req$body = req.body, company_name = _req$body.company_name, full_name = _req$body.full_name, email = _req$body.email, password = _req$body.password;
          if (!(!company_name || !full_name || !email || !password || password.length < 6 || !isValidEmail(email))) {
            _context2.n = 1;
            break;
          }
          return _context2.a(2, res.status(400).json({
            error: "Invalid registration data provided. Please ensure all fields are filled, password is at least 6 characters, and email is valid."
          }));
        case 1:
          _context2.p = 1;
          _context2.n = 2;
          return bcrypt.hash(password, 10);
        case 2:
          password_hash = _context2.v;
          _context2.n = 3;
          return pool.connect();
        case 3:
          client = _context2.v;
          _context2.p = 4;
          _context2.n = 5;
          return client.query('BEGIN');
        case 5:
          _context2.n = 6;
          return client.query('INSERT INTO Companies (company_name) VALUES ($1) RETURNING company_id', [company_name]);
        case 6:
          companyResult = _context2.v;
          newCompanyId = companyResult.rows[0].company_id;
          _context2.n = 7;
          return client.query("INSERT INTO Users (company_id, full_name, email, password_hash, role, subscription_status, plan_id) VALUES ($1, $2, $3, $4, 'super_admin', 'active', 'free') RETURNING user_id", [newCompanyId, full_name, email, password_hash]);
        case 7:
          userResult = _context2.v;
          newUserId = userResult.rows[0].user_id;
          _context2.n = 8;
          return client.query('COMMIT');
        case 8:
          // Commit transaction
          res.status(201).json({
            message: "Company and user registered successfully!",
            userId: newUserId
          });
          _context2.n = 13;
          break;
        case 9:
          _context2.p = 9;
          _t4 = _context2.v;
          _context2.n = 10;
          return client.query('ROLLBACK');
        case 10:
          // Rollback on error
          console.error("Database error during registration:", _t4);
          // NEW: More specific error messages for duplicate unique constraints
          if (!(_t4.code === '23505')) {
            _context2.n = 12;
            break;
          }
          if (!(_t4.constraint === 'users_email_key')) {
            _context2.n = 11;
            break;
          }
          return _context2.a(2, res.status(409).json({
            error: 'Email already registered. Please use a different email address.'
          }));
        case 11:
          if (!(_t4.constraint === 'companies_company_name_key')) {
            _context2.n = 12;
            break;
          }
          return _context2.a(2, res.status(409).json({
            error: 'Company name already registered. Please choose a different company name.'
          }));
        case 12:
          next(_t4); // Pass to general error handler
        case 13:
          _context2.p = 13;
          client.release();
          return _context2.f(13);
        case 14:
          _context2.n = 16;
          break;
        case 15:
          _context2.p = 15;
          _t5 = _context2.v;
          console.error("Registration error:", _t5);
          next(_t5); // Pass to general error handler
        case 16:
          return _context2.a(2);
      }
    }, _callee2, null, [[4, 9, 13, 14], [1, 15]]);
  }));
  return function (_x7, _x8, _x9) {
    return _ref2.apply(this, arguments);
  };
}());
app.post('/login', authLimiter, /*#__PURE__*/function () {
  var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(req, res, next) {
    var _req$body2, email, password, userResult, user, isMatch, payload, token, _t6;
    return _regenerator().w(function (_context3) {
      while (1) switch (_context3.n) {
        case 0:
          _req$body2 = req.body, email = _req$body2.email, password = _req$body2.password;
          if (!(!email || !password)) {
            _context3.n = 1;
            break;
          }
          return _context3.a(2, res.status(400).json({
            error: "Email and password are required."
          }));
        case 1:
          _context3.p = 1;
          _context3.n = 2;
          return query("SELECT * FROM Users WHERE email = $1", [email]);
        case 2:
          userResult = _context3.v;
          user = userResult[0];
          if (user) {
            _context3.n = 3;
            break;
          }
          return _context3.a(2, res.status(401).json({
            error: "Invalid credentials."
          }));
        case 3:
          _context3.n = 4;
          return bcrypt.compare(password, user.password_hash);
        case 4:
          isMatch = _context3.v;
          if (isMatch) {
            _context3.n = 5;
            break;
          }
          return _context3.a(2, res.status(401).json({
            error: "Invalid credentials."
          }));
        case 5:
          payload = {
            userId: user.user_id,
            email: user.email,
            role: user.role,
            fullName: user.full_name,
            companyId: user.company_id,
            locationId: user.location_id,
            // Can be null for super_admin
            subscriptionStatus: user.subscription_status,
            planId: user.plan_id
          };
          token = jwt.sign(payload, JWT_SECRET, {
            expiresIn: '1h'
          }); // Token expires in 1 hour
          res.status(200).json({
            message: "Login successful!",
            token: token,
            role: user.role
          });
          _context3.n = 7;
          break;
        case 6:
          _context3.p = 6;
          _t6 = _context3.v;
          console.error("Login API error:", _t6);
          next(_t6);
        case 7:
          return _context3.a(2);
      }
    }, _callee3, null, [[1, 6]]);
  }));
  return function (_x0, _x1, _x10) {
    return _ref3.apply(this, arguments);
  };
}());
app.post('/create-checkout-session', authenticateToken, /*#__PURE__*/function () {
  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(req, res, next) {
    var planId, _req$user, userId, email, companyId, priceId, session, _t7, _t8;
    return _regenerator().w(function (_context4) {
      while (1) switch (_context4.n) {
        case 0:
          planId = req.body.planId;
          _req$user = req.user, userId = _req$user.userId, email = _req$user.email, companyId = _req$user.companyId; // Get user info from authenticated token
          if (stripeInstance) {
            _context4.n = 1;
            break;
          }
          console.error("Stripe not initialized. STRIPE_SECRET_KEY might be missing.");
          return _context4.a(2, res.status(500).json({
            error: "Payment processing is unavailable."
          }));
        case 1:
          _t7 = planId;
          _context4.n = _t7 === 'pro' ? 2 : _t7 === 'enterprise' ? 3 : 4;
          break;
        case 2:
          priceId = process.env.STRIPE_PRICE_ID_PRO; // Get from environment variable
          return _context4.a(3, 5);
        case 3:
          priceId = process.env.STRIPE_PRICE_ID_ENT; // Get from environment variable
          return _context4.a(3, 5);
        case 4:
          return _context4.a(2, res.status(400).json({
            error: "Invalid plan selected."
          }));
        case 5:
          if (priceId) {
            _context4.n = 6;
            break;
          }
          console.error("Stripe Price ID for plan '".concat(planId, "' is not configured."));
          return _context4.a(2, res.status(500).json({
            error: "Payment processing: Price ID for ".concat(planId, " plan missing.")
          }));
        case 6:
          _context4.p = 6;
          _context4.n = 7;
          return stripeInstance.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
              price: priceId,
              quantity: 1
            }],
            mode: 'subscription',
            // Use 'subscription' mode for recurring payments
            success_url: "".concat(process.env.CORS_ORIGIN, "/suite-hub.html?payment=success&session_id={CHECKOUT_SESSION_ID}"),
            cancel_url: "".concat(process.env.CORS_ORIGIN, "/suite-hub.html?payment=cancelled"),
            metadata: {
              userId: userId,
              planId: planId,
              companyId: companyId,
              userEmail: email // Useful for reconciliation in Stripe
            },
            customer_email: email // Pre-fill customer email
          });
        case 7:
          session = _context4.v;
          res.status(200).json({
            sessionId: session.id
          });
          _context4.n = 10;
          break;
        case 8:
          _context4.p = 8;
          _t8 = _context4.v;
          console.error("Error creating Stripe Checkout session:", _t8);
          // Distinguish between Stripe-specific errors and general errors for better client feedback
          if (!(_t8.type === 'StripeCardError' || _t8.type === 'StripeInvalidRequestError')) {
            _context4.n = 9;
            break;
          }
          return _context4.a(2, res.status(400).json({
            error: _t8.message
          }));
        case 9:
          next(_t8); // Pass other errors to general error handler
        case 10:
          return _context4.a(2);
      }
    }, _callee4, null, [[6, 8]]);
  }));
  return function (_x11, _x12, _x13) {
    return _ref4.apply(this, arguments);
  };
}());
app.post('/invite-admin', authenticateToken, /*#__PURE__*/function () {
  var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(req, res, next) {
    var _req$body3, full_name, email, password, location_id, _req$user2, companyId, role, locationCheck, password_hash, result, _t9;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.n) {
        case 0:
          _req$body3 = req.body, full_name = _req$body3.full_name, email = _req$body3.email, password = _req$body3.password, location_id = _req$body3.location_id;
          _req$user2 = req.user, companyId = _req$user2.companyId, role = _req$user2.role; // Authorization check
          if (!(role !== 'super_admin')) {
            _context5.n = 1;
            break;
          }
          return _context5.a(2, res.status(403).json({
            error: 'Access Dismissed: Only super admins can invite other admins.'
          }));
        case 1:
          if (!(!full_name || !email || !password || password.length < 6 || !isValidEmail(email) || typeof location_id !== 'number' || location_id <= 0)) {
            _context5.n = 2;
            break;
          }
          return _context5.a(2, res.status(400).json({
            error: "Invalid admin invitation data provided. Full name, valid email, password (min 6 chars), and a valid location ID are required."
          }));
        case 2:
          _context5.p = 2;
          _context5.n = 3;
          return query('SELECT location_id FROM Locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
        case 3:
          locationCheck = _context5.v;
          if (!(locationCheck.length === 0)) {
            _context5.n = 4;
            break;
          }
          return _context5.a(2, res.status(400).json({
            error: 'Selected location does not exist or does not belong to your company.'
          }));
        case 4:
          _context5.n = 5;
          return bcrypt.hash(password, 10);
        case 5:
          password_hash = _context5.v;
          _context5.n = 6;
          return runCommand("INSERT INTO Users (company_id, location_id, full_name, email, password_hash, role, subscription_status, plan_id) VALUES ($1, $2, $3, $4, $5, 'location_admin', 'active', 'free') RETURNING user_id", [companyId, location_id, full_name, email, password_hash]);
        case 6:
          result = _context5.v;
          res.status(201).json({
            message: "Location admin invited successfully!",
            userId: result.user_id
          });
          _context5.n = 9;
          break;
        case 7:
          _context5.p = 7;
          _t9 = _context5.v;
          console.error("Invite admin error:", _t9);
          if (!(_t9.message && _t9.message.includes('duplicate key value violates unique constraint "users_email_key"'))) {
            _context5.n = 8;
            break;
          }
          return _context5.a(2, res.status(409).json({
            error: 'Email already registered.'
          }));
        case 8:
          next(_t9);
        case 9:
          return _context5.a(2);
      }
    }, _callee5, null, [[2, 7]]);
  }));
  return function (_x14, _x15, _x16) {
    return _ref5.apply(this, arguments);
  };
}());
app.post('/invite-employee', authenticateToken, /*#__PURE__*/function () {
  var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(req, res, next) {
    var _req$body4, full_name, email, password, position, employee_id, location_id, _req$user3, companyId, role, currentUserLocationId, currentPlanId, isLocationIdValid, maxEmployeesForPlan, employeeCountResult, currentEmployeeCount, locationCheck, password_hash, result, _t0, _t1;
    return _regenerator().w(function (_context6) {
      while (1) switch (_context6.n) {
        case 0:
          _req$body4 = req.body, full_name = _req$body4.full_name, email = _req$body4.email, password = _req$body4.password, position = _req$body4.position, employee_id = _req$body4.employee_id, location_id = _req$body4.location_id;
          _req$user3 = req.user, companyId = _req$user3.companyId, role = _req$user3.role, currentUserLocationId = _req$user3.locationId, currentPlanId = _req$user3.planId; // Get planId from authenticated user
          // Authorization check
          if (['super_admin', 'location_admin'].includes(role)) {
            _context6.n = 1;
            break;
          }
          return _context6.a(2, res.status(403).json({
            error: 'Access Dismissed: Only admins can invite employees.'
          }));
        case 1:
          // Input validation
          isLocationIdValid = location_id === null || typeof location_id === 'number' && !isNaN(location_id) && location_id >= 0; // location_id can be 0 or greater
          if (!(!full_name || !email || !password || password.length < 6 || !isValidEmail(email) || !isLocationIdValid)) {
            _context6.n = 2;
            break;
          }
          return _context6.a(2, res.status(400).json({
            error: "Invalid employee invitation data provided. Full name, valid email, password (min 6 chars), and a valid location are required."
          }));
        case 2:
          if (!(position !== undefined && typeof position !== 'string')) {
            _context6.n = 3;
            break;
          }
          return _context6.a(2, res.status(400).json({
            error: 'Position must be a string if provided.'
          }));
        case 3:
          if (!(employee_id !== undefined && employee_id !== null && typeof employee_id !== 'string' && typeof employee_id !== 'number')) {
            _context6.n = 4;
            break;
          }
          return _context6.a(2, res.status(400).json({
            error: 'Employee ID must be a string, number, or null if provided.'
          }));
        case 4:
          if (!(role === 'location_admin')) {
            _context6.n = 7;
            break;
          }
          if (!(currentUserLocationId !== null)) {
            _context6.n = 6;
            break;
          }
          if (!(location_id !== currentUserLocationId && location_id !== null)) {
            _context6.n = 5;
            break;
          }
          return _context6.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin can only invite employees to their assigned location or unassigned roles.'
          }));
        case 5:
          _context6.n = 7;
          break;
        case 6:
          return _context6.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin not assigned to a location cannot invite employees to any location.'
          }));
        case 7:
          // --- NEW: Employee Limit Enforcement Logic ---
          maxEmployeesForPlan = PLAN_EMPLOYEE_LIMITS[currentPlanId];
          if (!(maxEmployeesForPlan !== null)) {
            _context6.n = 12;
            break;
          }
          _context6.p = 8;
          _context6.n = 9;
          return query("SELECT COUNT(*) FROM Users WHERE company_id = $1 AND role IN ('employee', 'location_admin')", [companyId]);
        case 9:
          employeeCountResult = _context6.v;
          currentEmployeeCount = parseInt(employeeCountResult[0].count, 10);
          if (!(currentEmployeeCount >= maxEmployeesForPlan)) {
            _context6.n = 10;
            break;
          }
          return _context6.a(2, res.status(403).json({
            error: "Subscription limit reached: Your current plan allows up to ".concat(maxEmployeesForPlan, " employees. Please upgrade your plan.")
          }));
        case 10:
          _context6.n = 12;
          break;
        case 11:
          _context6.p = 11;
          _t0 = _context6.v;
          console.error("Database error checking employee count:", _t0);
          next(_t0); // Pass DB error to general error handler
          return _context6.a(2);
        case 12:
          _context6.p = 12;
          if (!(location_id !== null && location_id > 0)) {
            _context6.n = 14;
            break;
          }
          _context6.n = 13;
          return query('SELECT location_id FROM Locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
        case 13:
          locationCheck = _context6.v;
          if (!(locationCheck.length === 0)) {
            _context6.n = 14;
            break;
          }
          return _context6.a(2, res.status(400).json({
            error: 'Selected location does not exist or does not belong to your company.'
          }));
        case 14:
          _context6.n = 15;
          return bcrypt.hash(password, 10);
        case 15:
          password_hash = _context6.v;
          _context6.n = 16;
          return runCommand("INSERT INTO Users (company_id, location_id, full_name, email, password_hash, role, subscription_status, plan_id, position, employee_id) VALUES ($1, $2, $3, $4, $5, 'employee', 'active', 'free', $6, $7) RETURNING user_id", [companyId, location_id, full_name, email, password_hash, position, employee_id]);
        case 16:
          result = _context6.v;
          // The runCommand now returns an object with user_id if successful
          res.status(201).json({
            message: "Employee invited successfully!",
            userId: result.user_id
          });
          _context6.n = 19;
          break;
        case 17:
          _context6.p = 17;
          _t1 = _context6.v;
          // The outer catch block for the above try
          console.error("Invite employee error:", _t1);
          if (!(_t1.message && _t1.message.includes('duplicate key value violates unique constraint "users_email_key"'))) {
            _context6.n = 18;
            break;
          }
          return _context6.a(2, res.status(409).json({
            error: 'Email already registered.'
          }));
        case 18:
          next(_t1);
        case 19:
          return _context6.a(2);
      }
    }, _callee6, null, [[12, 17], [8, 11]]);
  }));
  return function (_x17, _x18, _x19) {
    return _ref6.apply(this, arguments);
  };
}()); // Corrected: This was the missing closing curly brace for the route handler itself

// --- Multer Configuration for File Uploads ---
var UPLOADS_DIR = path.join(__dirname, 'uploads'); // Files will be stored in a subfolder 'uploads'
// Create the uploads directory if it doesn't exist
// const fs = require('fs'); // fs is already imported at the top now
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, {
    recursive: true
  });
}
var storage = multer.diskStorage({
  destination: function destination(req, file, cb) {
    cb(null, UPLOADS_DIR); // Store files in the 'uploads' directory
  },
  filename: function filename(req, file, cb) {
    // Use a unique name to prevent collisions, e.g., timestamp-originalfilename
    var uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Configure Multer to accept single file uploads with the field name 'document_file'
// NEW: Increased limits to multer for file size to 1GB
var upload = multer({
  storage: storage,
  limits: {
    fileSize: 1 * 1024 * 1024 * 1024
  } // 1 GB limit (1 * 1024 * 1024 * 1024 bytes)
});

// --- Document Management API Routes ---
app.post('/documents/upload', authenticateToken, upload.single('document_file'), /*#__PURE__*/function () {
  var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(req, res, next) {
    var _req$body5, title, description, _req$user4, userId, companyId, role, file, result, _t10;
    return _regenerator().w(function (_context7) {
      while (1) switch (_context7.n) {
        case 0:
          _req$body5 = req.body, title = _req$body5.title, description = _req$body5.description;
          _req$user4 = req.user, userId = _req$user4.userId, companyId = _req$user4.companyId, role = _req$user4.role;
          file = req.file; // This comes from multer
          // Authorization: Only super_admin and location_admin can upload documents
          if (['super_admin', 'location_admin'].includes(role)) {
            _context7.n = 1;
            break;
          }
          return _context7.a(2, res.status(403).json({
            error: 'Access Dismissed: Only admins can upload documents.'
          }));
        case 1:
          if (!(!title || typeof title !== 'string' || title.trim() === '')) {
            _context7.n = 2;
            break;
          }
          return _context7.a(2, res.status(400).json({
            error: "Document title is required and must be a non-empty string."
          }));
        case 2:
          if (file) {
            _context7.n = 3;
            break;
          }
          return _context7.a(2, res.status(400).json({
            error: "No file provided for upload."
          }));
        case 3:
          _context7.p = 3;
          _context7.n = 4;
          return runCommand(// Removed mime_type from the INSERT statement temporarily for debugging database schema
          "INSERT INTO Documents (company_id, title, description, file_path, file_name, uploaded_by_user_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING document_id, file_path", [companyId, title, description, file.path, file.originalname, userId] // Removed file.mimetype
          );
        case 4:
          result = _context7.v;
          res.status(201).json({
            message: 'Document uploaded successfully!',
            documentId: result.document_id,
            filePath: result.file_path
          });
          _context7.n = 6;
          break;
        case 5:
          _context7.p = 5;
          _t10 = _context7.v;
          console.error("Database error during document upload:", _t10);
          // Clean up uploaded file if DB insert fails
          if (file && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path); // Delete the file
          }
          next(_t10);
        case 6:
          return _context7.a(2);
      }
    }, _callee7, null, [[3, 5]]);
  }));
  return function (_x20, _x21, _x22) {
    return _ref7.apply(this, arguments);
  };
}());
app.get('/documents', authenticateToken, /*#__PURE__*/function () {
  var _ref8 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8(req, res, next) {
    var _req$user5, companyId, role, sql, params, documents, _t11;
    return _regenerator().w(function (_context8) {
      while (1) switch (_context8.n) {
        case 0:
          _req$user5 = req.user, companyId = _req$user5.companyId, role = _req$user5.role; // Authorization: Any user within the company should be able to view documents for now
          // If specific roles should be restricted, add checks here.
          // Removed mime_type from SELECT statement temporarily for debugging database schema
          sql = "SELECT document_id, title, description, file_name, upload_date, file_path,\n                      uploaded_by_user_id -- Select the ID directly from Documents table\n               FROM Documents\n               WHERE company_id = $1";
          params = [companyId];
          _context8.p = 1;
          _context8.n = 2;
          return query(sql, params);
        case 2:
          documents = _context8.v;
          res.json(documents);
          _context8.n = 4;
          break;
        case 3:
          _context8.p = 3;
          _t11 = _context8.v;
          // This log message was identified as potentially causing a SyntaxError in previous logs
          // Ensuring it correctly handles the error object.
          console.error("Database error fetching documents: ".concat(_t11.message || JSON.stringify(_t11))); // Improved error logging
          next(_t11); // Pass to general error handler
        case 4:
          return _context8.a(2);
      }
    }, _callee8, null, [[1, 3]]);
  }));
  return function (_x23, _x24, _x25) {
    return _ref8.apply(this, arguments);
  };
}());

// Route to serve files for download
app.get('/documents/download/:document_id', authenticateToken, /*#__PURE__*/function () {
  var _ref9 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee9(req, res, next) {
    var document_id, _req$user6, companyId, role, docResult, document, filePath, fileName, _t12;
    return _regenerator().w(function (_context9) {
      while (1) switch (_context9.n) {
        case 0:
          document_id = req.params.document_id;
          _req$user6 = req.user, companyId = _req$user6.companyId, role = _req$user6.role; // Input validation
          if (!(!document_id || isNaN(parseInt(document_id)))) {
            _context9.n = 1;
            break;
          }
          return _context9.a(2, res.status(400).json({
            error: 'Invalid document ID provided.'
          }));
        case 1:
          _context9.p = 1;
          _context9.n = 2;
          return query(
          // Removed mime_type from SELECT statement temporarily
          'SELECT file_path, file_name, company_id FROM Documents WHERE document_id = $1', [document_id]);
        case 2:
          docResult = _context9.v;
          document = docResult[0];
          if (document) {
            _context9.n = 3;
            break;
          }
          return _context9.a(2, res.status(404).json({
            error: 'Document not found.'
          }));
        case 3:
          if (!(document.company_id !== companyId)) {
            _context9.n = 4;
            break;
          }
          return _context9.a(2, res.status(403).json({
            error: 'Access Dismissed: You are not authorized to download this document.'
          }));
        case 4:
          filePath = document.file_path;
          fileName = document.file_name; // const mimeType = document.mime_type; // No longer retrieving from DB for now
          // Check if file exists on disk
          if (fs.existsSync(filePath)) {
            _context9.n = 5;
            break;
          }
          console.error("Attempted to download non-existent file: ".concat(filePath));
          return _context9.a(2, res.status(404).json({
            error: 'File not found on server storage.'
          }));
        case 5:
          // For download, we need the mime_type. Since we're bypassing the DB for it,
          // we'll have to infer it or default to a generic type.
          // A more robust solution would be to use a library to infer mime type from file extension
          // or ensure the DB column exists.
          res.setHeader('Content-Type', 'application/octet-stream'); // Default to generic type
          res.setHeader('Content-Disposition', "attachment; filename=\"".concat(fileName, "\""));
          res.sendFile(filePath); // Send the file from local storage
          _context9.n = 7;
          break;
        case 6:
          _context9.p = 6;
          _t12 = _context9.v;
          console.error("Error serving document for download:", _t12);
          next(_t12);
        case 7:
          return _context9.a(2);
      }
    }, _callee9, null, [[1, 6]]);
  }));
  return function (_x26, _x27, _x28) {
    return _ref9.apply(this, arguments);
  };
}());
app["delete"]('/documents/:id', authenticateToken, /*#__PURE__*/function () {
  var _ref0 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee0(req, res, next) {
    var id, _req$user7, companyId, role, client, docResult, document, dbDeleteResult, _t13;
    return _regenerator().w(function (_context0) {
      while (1) switch (_context0.n) {
        case 0:
          id = req.params.id;
          _req$user7 = req.user, companyId = _req$user7.companyId, role = _req$user7.role; // Authorization: Only super_admin and location_admin can delete documents
          if (['super_admin', 'location_admin'].includes(role)) {
            _context0.n = 1;
            break;
          }
          return _context0.a(2, res.status(403).json({
            error: 'Access Dismissed: Only admins can delete documents.'
          }));
        case 1:
          if (!(!id || isNaN(parseInt(id)))) {
            _context0.n = 2;
            break;
          }
          return _context0.a(2, res.status(400).json({
            error: 'Invalid document ID provided.'
          }));
        case 2:
          _context0.n = 3;
          return pool.connect();
        case 3:
          client = _context0.v;
          _context0.p = 4;
          _context0.n = 5;
          return client.query('BEGIN');
        case 5:
          _context0.n = 6;
          return client.query('SELECT file_path, company_id FROM Documents WHERE document_id = $1', [id]);
        case 6:
          docResult = _context0.v;
          document = docResult.rows[0];
          if (document) {
            _context0.n = 8;
            break;
          }
          _context0.n = 7;
          return client.query('ROLLBACK');
        case 7:
          return _context0.a(2, res.status(404).json({
            error: 'Document not found.'
          }));
        case 8:
          if (!(document.company_id !== companyId)) {
            _context0.n = 10;
            break;
          }
          _context0.n = 9;
          return client.query('ROLLBACK');
        case 9:
          return _context0.a(2, res.status(403).json({
            error: 'Access Dismissed: You are not authorized to delete this document.'
          }));
        case 10:
          _context0.n = 11;
          return client.query('DELETE FROM Documents WHERE document_id = $1 AND company_id = $2', [id, companyId]);
        case 11:
          dbDeleteResult = _context0.v;
          if (!(dbDeleteResult.rowCount === 0)) {
            _context0.n = 13;
            break;
          }
          _context0.n = 12;
          return client.query('ROLLBACK');
        case 12:
          return _context0.a(2, res.status(404).json({
            error: 'Document not found or not authorized to delete.'
          }));
        case 13:
          // Delete physical file after successful DB deletion
          if (fs.existsSync(document.file_path)) {
            fs.unlinkSync(document.file_path);
            console.log("Successfully deleted physical file: ".concat(document.file_path));
          } else {
            console.warn("Attempted to delete non-existent physical file: ".concat(document.file_path));
          }
          _context0.n = 14;
          return client.query('COMMIT');
        case 14:
          res.status(204).send(); // No content for successful deletion
          _context0.n = 17;
          break;
        case 15:
          _context0.p = 15;
          _t13 = _context0.v;
          _context0.n = 16;
          return client.query('ROLLBACK');
        case 16:
          console.error("Database error deleting document:", _t13);
          next(_t13);
        case 17:
          _context0.p = 17;
          client.release();
          return _context0.f(17);
        case 18:
          return _context0.a(2);
      }
    }, _callee0, null, [[4, 15, 17, 18]]);
  }));
  return function (_x29, _x30, _x31) {
    return _ref0.apply(this, arguments);
  };
}());
app.get('/profile', authenticateToken, /*#__PURE__*/function () {
  var _ref1 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee1(req, res, next) {
    var userResult, user, _t14;
    return _regenerator().w(function (_context1) {
      while (1) switch (_context1.n) {
        case 0:
          _context1.p = 0;
          _context1.n = 1;
          return query('SELECT user_id, company_id, location_id, full_name, email, role, subscription_status, plan_id FROM Users WHERE user_id = $1', [req.user.userId]);
        case 1:
          userResult = _context1.v;
          user = userResult[0];
          if (user) {
            _context1.n = 2;
            break;
          }
          return _context1.a(2, res.status(404).json({
            error: 'User not found.'
          }));
        case 2:
          res.status(200).json(user);
          _context1.n = 4;
          break;
        case 3:
          _context1.p = 3;
          _t14 = _context1.v;
          console.error("Error fetching profile info:", _t14);
          next(_t14);
        case 4:
          return _context1.a(2);
      }
    }, _callee1, null, [[0, 3]]);
  }));
  return function (_x32, _x33, _x34) {
    return _ref1.apply(this, arguments);
  };
}());
app.put('/profile', authenticateToken, /*#__PURE__*/function () {
  var _ref10 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee10(req, res, next) {
    var _req$body6, fullName, email, currentPassword, newPassword, userId, userResult, user, updateSql, updateParams, clauses, paramIndex, existingUser, isMatch, newPasswordHash, updatedUserResult, updatedUser, newPayload, newToken, _t15;
    return _regenerator().w(function (_context10) {
      while (1) switch (_context10.n) {
        case 0:
          _req$body6 = req.body, fullName = _req$body6.fullName, email = _req$body6.email, currentPassword = _req$body6.currentPassword, newPassword = _req$body6.newPassword;
          userId = req.user.userId; // Input validation
          if (!(fullName === undefined && email === undefined && (!currentPassword || !newPassword))) {
            _context10.n = 1;
            break;
          }
          return _context10.a(2, res.status(400).json({
            error: 'No data provided for update.'
          }));
        case 1:
          if (!(fullName !== undefined && (typeof fullName !== 'string' || fullName.trim() === ''))) {
            _context10.n = 2;
            break;
          }
          return _context10.a(2, res.status(400).json({
            error: "Full name must be a non-empty string if provided."
          }));
        case 2:
          if (!(email !== undefined && !isValidEmail(email))) {
            _context10.n = 3;
            break;
          }
          return _context10.a(2, res.status(400).json({
            error: "A valid email address must be provided if changing email."
          }));
        case 3:
          if (!(newPassword !== undefined && (typeof newPassword !== 'string' || newPassword.length < 6))) {
            _context10.n = 4;
            break;
          }
          return _context10.a(2, res.status(400).json({
            error: "New password must be at least 6 characters long if changing password."
          }));
        case 4:
          if (!(currentPassword && !newPassword || !currentPassword && newPassword)) {
            _context10.n = 5;
            break;
          }
          return _context10.a(2, res.status(400).json({
            error: 'Both current password and new password are required to change password.'
          }));
        case 5:
          _context10.p = 5;
          _context10.n = 6;
          return query("SELECT * FROM Users WHERE user_id = $1", [userId]);
        case 6:
          userResult = _context10.v;
          user = userResult[0];
          if (user) {
            _context10.n = 7;
            break;
          }
          return _context10.a(2, res.status(404).json({
            error: "User not found."
          }));
        case 7:
          updateSql = 'UPDATE Users SET ';
          updateParams = [];
          clauses = [];
          paramIndex = 1;
          if (fullName !== undefined && fullName !== user.full_name) {
            clauses.push("full_name = $".concat(paramIndex++));
            updateParams.push(fullName);
          }
          if (!(email !== undefined && email !== user.email)) {
            _context10.n = 10;
            break;
          }
          _context10.n = 8;
          return query("SELECT user_id FROM Users WHERE email = $1 AND user_id != $2", [email, userId]);
        case 8:
          existingUser = _context10.v;
          if (!(existingUser.length > 0)) {
            _context10.n = 9;
            break;
          }
          return _context10.a(2, res.status(409).json({
            error: 'Email already in use by another account.'
          }));
        case 9:
          clauses.push("email = $".concat(paramIndex++));
          updateParams.push(email);
        case 10:
          if (!(currentPassword && newPassword)) {
            _context10.n = 14;
            break;
          }
          _context10.n = 11;
          return bcrypt.compare(currentPassword, user.password_hash);
        case 11:
          isMatch = _context10.v;
          if (isMatch) {
            _context10.n = 12;
            break;
          }
          return _context10.a(2, res.status(401).json({
            error: "Current password incorrect."
          }));
        case 12:
          _context10.n = 13;
          return bcrypt.hash(newPassword, 10);
        case 13:
          newPasswordHash = _context10.v;
          clauses.push("password_hash = $".concat(paramIndex++));
          updateParams.push(newPasswordHash);
        case 14:
          if (!(clauses.length === 0)) {
            _context10.n = 15;
            break;
          }
          return _context10.a(2, res.status(200).json({
            message: 'No changes detected. Profile remains the same.'
          }));
        case 15:
          updateSql += clauses.join(', ') + " WHERE user_id = $".concat(paramIndex);
          updateParams.push(userId);
          _context10.n = 16;
          return runCommand(updateSql, updateParams);
        case 16:
          _context10.n = 17;
          return query("SELECT user_id, company_id, location_id, full_name, email, role, subscription_status, plan_id FROM Users WHERE user_id = $1", [userId]);
        case 17:
          updatedUserResult = _context10.v;
          updatedUser = updatedUserResult[0];
          newPayload = {
            userId: updatedUser.user_id,
            email: updatedUser.email,
            role: updatedUser.role,
            fullName: updatedUser.full_name,
            companyId: updatedUser.company_id,
            locationId: updatedUser.location_id,
            subscriptionStatus: updatedUser.subscription_status,
            planId: updatedUser.plan_id
          };
          newToken = jwt.sign(newPayload, JWT_SECRET, {
            expiresIn: '1h'
          });
          res.status(200).json({
            message: 'Profile updated successfully!',
            token: newToken
          });
          _context10.n = 19;
          break;
        case 18:
          _context10.p = 18;
          _t15 = _context10.v;
          console.error("Error updating profile:", _t15);
          next(_t15);
        case 19:
          return _context10.a(2);
      }
    }, _callee10, null, [[5, 18]]);
  }));
  return function (_x35, _x36, _x37) {
    return _ref10.apply(this, arguments);
  };
}());
app.get('/locations', authenticateToken, /*#__PURE__*/function () {
  var _ref11 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee11(req, res, next) {
    var _req$user8, companyId, role, sql, params, locations, _t16;
    return _regenerator().w(function (_context11) {
      while (1) switch (_context11.n) {
        case 0:
          _req$user8 = req.user, companyId = _req$user8.companyId, role = _req$user8.role;
          sql = 'SELECT location_id, location_name, location_address FROM Locations WHERE company_id = $1';
          params = [companyId]; // Authorization check
          if (['super_admin', 'location_admin', 'employee'].includes(role)) {
            _context11.n = 1;
            break;
          }
          return _context11.a(2, res.status(403).json({
            error: 'Access Dismissed: Insufficient permissions to view locations.'
          }));
        case 1:
          _context11.p = 1;
          _context11.n = 2;
          return query(sql, params);
        case 2:
          locations = _context11.v;
          res.json(locations);
          _context11.n = 4;
          break;
        case 3:
          _context11.p = 3;
          _t16 = _context11.v;
          console.error("Database error fetching locations:", _t16);
          next(_t16);
        case 4:
          return _context11.a(2);
      }
    }, _callee11, null, [[1, 3]]);
  }));
  return function (_x38, _x39, _x40) {
    return _ref11.apply(this, arguments);
  };
}());
app.post('/locations', authenticateToken, /*#__PURE__*/function () {
  var _ref12 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee12(req, res, next) {
    var _req$body7, location_name, location_address, _req$user9, companyId, role, result, _t17;
    return _regenerator().w(function (_context12) {
      while (1) switch (_context12.n) {
        case 0:
          _req$body7 = req.body, location_name = _req$body7.location_name, location_address = _req$body7.location_address;
          _req$user9 = req.user, companyId = _req$user9.companyId, role = _req$user9.role; // Authorization check
          if (!(role !== 'super_admin')) {
            _context12.n = 1;
            break;
          }
          return _context12.a(2, res.status(403).json({
            error: 'Access Dismissed: Only super admins can create locations.'
          }));
        case 1:
          if (!(!location_name || typeof location_name !== 'string' || location_name.trim() === '' || !location_address || typeof location_address !== 'string' || location_address.trim() === '')) {
            _context12.n = 2;
            break;
          }
          return _context12.a(2, res.status(400).json({
            error: "Location name and address are required and must be non-empty strings."
          }));
        case 2:
          _context12.p = 2;
          _context12.n = 3;
          return query('INSERT INTO Locations (company_id, location_name, location_address) VALUES ($1, $2, $3) RETURNING location_id', [companyId, location_name, location_address]);
        case 3:
          result = _context12.v;
          res.status(201).json({
            message: 'Location created!',
            locationId: result[0].location_id
          });
          _context12.n = 5;
          break;
        case 4:
          _context12.p = 4;
          _t17 = _context12.v;
          console.error("Database error creating location:", _t17);
          next(_t17);
        case 5:
          return _context12.a(2);
      }
    }, _callee12, null, [[2, 4]]);
  }));
  return function (_x41, _x42, _x43) {
    return _ref12.apply(this, arguments);
  };
}());
app["delete"]('/locations/:id', authenticateToken, /*#__PURE__*/function () {
  var _ref13 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee13(req, res, next) {
    var id, _req$user0, companyId, role, result, _t18;
    return _regenerator().w(function (_context13) {
      while (1) switch (_context13.n) {
        case 0:
          id = req.params.id;
          _req$user0 = req.user, companyId = _req$user0.companyId, role = _req$user0.role; // Authorization check
          if (!(role !== 'super_admin')) {
            _context13.n = 1;
            break;
          }
          return _context13.a(2, res.status(403).json({
            error: 'Access Dismissed: Only super admins can delete locations.'
          }));
        case 1:
          if (!(!id || isNaN(parseInt(id)))) {
            _context13.n = 2;
            break;
          }
          return _context13.a(2, res.status(400).json({
            error: 'Invalid location ID provided.'
          }));
        case 2:
          _context13.p = 2;
          _context13.n = 3;
          return runCommand('DELETE FROM Locations WHERE location_id = $1 AND company_id = $2', [id, companyId]);
        case 3:
          result = _context13.v;
          if (!(result === 0)) {
            _context13.n = 4;
            break;
          }
          return _context13.a(2, res.status(404).json({
            error: 'Location not found or not authorized to delete.'
          }));
        case 4:
          res.status(204).send(); // 204 No Content for successful deletion
          _context13.n = 6;
          break;
        case 5:
          _context13.p = 5;
          _t18 = _context13.v;
          console.error("Database error deleting location:", _t18);
          next(_t18);
        case 6:
          return _context13.a(2);
      }
    }, _callee13, null, [[2, 5]]);
  }));
  return function (_x44, _x45, _x46) {
    return _ref13.apply(this, arguments);
  };
}());
app.get('/users', authenticateToken, /*#__PURE__*/function () {
  var _ref14 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee14(req, res, next) {
    var _req$user1, companyId, role, currentUserId, currentUserLocationId, _req$query, filterRole, filterLocationId, sql, params, paramIndex, allowedRoles, parsedLocationId, users, _t19;
    return _regenerator().w(function (_context14) {
      while (1) switch (_context14.n) {
        case 0:
          _req$user1 = req.user, companyId = _req$user1.companyId, role = _req$user1.role, currentUserId = _req$user1.userId, currentUserLocationId = _req$user1.locationId;
          _req$query = req.query, filterRole = _req$query.filterRole, filterLocationId = _req$query.filterLocationId;
          sql = "SELECT Users.user_id, Users.full_name, Users.email, Users.role, Locations.location_name\n                FROM Users\n                LEFT JOIN Locations ON Users.location_id = Locations.location_id\n                WHERE Users.company_id = $1";
          params = [companyId];
          paramIndex = 2; // Authorization and filtering based on user role
          if (!(role === 'location_admin')) {
            _context14.n = 3;
            break;
          }
          if (!(currentUserLocationId !== null)) {
            _context14.n = 1;
            break;
          }
          // Ensure location admin is assigned a location
          sql += " AND (Users.location_id = $".concat(paramIndex++, " OR Users.location_id IS NULL)");
          params.push(currentUserLocationId);
          _context14.n = 2;
          break;
        case 1:
          return _context14.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin not assigned to a location.'
          }));
        case 2:
          _context14.n = 5;
          break;
        case 3:
          if (!(role === 'employee')) {
            _context14.n = 4;
            break;
          }
          sql += " AND Users.user_id = $".concat(paramIndex++);
          params.push(currentUserId);
          _context14.n = 5;
          break;
        case 4:
          if (['super_admin'].includes(role)) {
            _context14.n = 5;
            break;
          }
          return _context14.a(2, res.status(403).json({
            error: 'Access Dismissed: Insufficient permissions to view users.'
          }));
        case 5:
          allowedRoles = ['super_admin', 'location_admin', 'employee']; // Roles that can be filtered by
          if (!filterRole) {
            _context14.n = 7;
            break;
          }
          if (!(!allowedRoles.includes(filterRole) || role === 'location_admin' && filterRole === 'super_admin')) {
            _context14.n = 6;
            break;
          }
          return _context14.a(2, res.status(400).json({
            error: 'Invalid filter role provided or insufficient permissions to filter by this role.'
          }));
        case 6:
          sql += " AND Users.role = $".concat(paramIndex++);
          params.push(filterRole);
        case 7:
          if (!filterLocationId) {
            _context14.n = 10;
            break;
          }
          if (!isNaN(parseInt(filterLocationId))) {
            _context14.n = 8;
            break;
          }
          return _context14.a(2, res.status(400).json({
            error: 'Invalid filter location ID provided.'
          }));
        case 8:
          parsedLocationId = parseInt(filterLocationId); // Super admin can filter by any location
          // Location admin can only filter by their assigned location (or null/unassigned)
          if (!(role === 'super_admin' || role === 'location_admin' && (parsedLocationId === currentUserLocationId || parsedLocationId === 0))) {
            _context14.n = 9;
            break;
          }
          sql += " AND Users.location_id = $".concat(paramIndex++);
          params.push(parsedLocationId);
          _context14.n = 10;
          break;
        case 9:
          return _context14.a(2, res.status(403).json({
            error: 'Access Dismissed: Insufficient permissions to filter by location.'
          }));
        case 10:
          _context14.p = 10;
          _context14.n = 11;
          return query(sql, params);
        case 11:
          users = _context14.v;
          res.json(users);
          _context14.n = 13;
          break;
        case 12:
          _context14.p = 12;
          _t19 = _context14.v;
          console.error("Database error fetching users:", _t19);
          next(_t19);
        case 13:
          return _context14.a(2);
      }
    }, _callee14, null, [[10, 12]]);
  }));
  return function (_x47, _x48, _x49) {
    return _ref14.apply(this, arguments);
  };
}());
app["delete"]('/users/:id', authenticateToken, /*#__PURE__*/function () {
  var _ref15 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee15(req, res, next) {
    var id, _req$user10, companyId, role, authenticatedUserId, userToDelete, result, _t20;
    return _regenerator().w(function (_context15) {
      while (1) switch (_context15.n) {
        case 0:
          id = req.params.id;
          _req$user10 = req.user, companyId = _req$user10.companyId, role = _req$user10.role, authenticatedUserId = _req$user10.userId; // Authorization check
          if (!(role !== 'super_admin')) {
            _context15.n = 1;
            break;
          }
          return _context15.a(2, res.status(403).json({
            error: 'Access Dismissed: Only super admins can delete users.'
          }));
        case 1:
          if (!(parseInt(id) === authenticatedUserId)) {
            _context15.n = 2;
            break;
          }
          return _context15.a(2, res.status(403).json({
            error: 'Cannot delete your own super admin account via this interface.'
          }));
        case 2:
          if (!(!id || isNaN(parseInt(id)))) {
            _context15.n = 3;
            break;
          }
          return _context15.a(2, res.status(400).json({
            error: 'Invalid user ID provided.'
          }));
        case 3:
          _context15.p = 3;
          _context15.n = 4;
          return query('SELECT role FROM Users WHERE user_id = $1 AND company_id = $2', [id, companyId]);
        case 4:
          userToDelete = _context15.v;
          if (!(userToDelete.length === 0)) {
            _context15.n = 5;
            break;
          }
          return _context15.a(2, res.status(404).json({
            error: 'User not found or not authorized to delete.'
          }));
        case 5:
          if (!(userToDelete[0].role === 'super_admin')) {
            _context15.n = 6;
            break;
          }
          return _context15.a(2, res.status(403).json({
            error: 'Cannot delete another super admin account.'
          }));
        case 6:
          _context15.n = 7;
          return runCommand('DELETE FROM Users WHERE user_id = $1 AND company_id = $2', [id, companyId]);
        case 7:
          result = _context15.v;
          if (!(result === 0)) {
            _context15.n = 8;
            break;
          }
          return _context15.a(2, res.status(404).json({
            error: 'User not found or not authorized to delete.'
          }));
        case 8:
          res.status(204).send();
          _context15.n = 10;
          break;
        case 9:
          _context15.p = 9;
          _t20 = _context15.v;
          console.error("Database error deleting user:", _t20);
          next(_t20);
        case 10:
          return _context15.a(2);
      }
    }, _callee15, null, [[3, 9]]);
  }));
  return function (_x50, _x51, _x52) {
    return _ref15.apply(this, arguments);
  };
}());

// NEW: Endpoint to get positions for the dashboard dropdown
app.get('/positions', authenticateToken, /*#__PURE__*/function () {
  var _ref16 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee16(req, res, next) {
    var companyId, result, positions, _t21;
    return _regenerator().w(function (_context16) {
      while (1) switch (_context16.n) {
        case 0:
          companyId = req.user.companyId;
          _context16.p = 1;
          _context16.n = 2;
          return query('SELECT DISTINCT position FROM Checklists WHERE company_id = $1 ORDER BY position ASC', [companyId]);
        case 2:
          result = _context16.v;
          // The frontend expects an object with an array of {id, name}.
          // We will map the database results to this format.
          positions = result.map(function (row) {
            return {
              id: row.position,
              // Using the position name as the ID
              name: row.position
            };
          });
          res.status(200).json({
            positions: positions
          });
          _context16.n = 4;
          break;
        case 3:
          _context16.p = 3;
          _t21 = _context16.v;
          console.error("Database error fetching positions:", _t21);
          next(_t21);
        case 4:
          return _context16.a(2);
      }
    }, _callee16, null, [[1, 3]]);
  }));
  return function (_x53, _x54, _x55) {
    return _ref16.apply(this, arguments);
  };
}());
app.post('/schedules', authenticateToken, /*#__PURE__*/function () {
  var _ref17 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee17(req, res, next) {
    var _req$body8, employee_id, location_id, start_time, end_time, notes, _req$user11, companyId, role, currentUserLocationId, employeeCheck, locationCheck, result, _t22;
    return _regenerator().w(function (_context17) {
      while (1) switch (_context17.n) {
        case 0:
          _req$body8 = req.body, employee_id = _req$body8.employee_id, location_id = _req$body8.location_id, start_time = _req$body8.start_time, end_time = _req$body8.end_time, notes = _req$body8.notes;
          _req$user11 = req.user, companyId = _req$user11.companyId, role = _req$user11.role, currentUserLocationId = _req$user11.locationId; // Authorization check
          if (['super_admin', 'location_admin'].includes(role)) {
            _context17.n = 1;
            break;
          }
          return _context17.a(2, res.status(403).json({
            error: 'Access Dismissed: Only admins can create schedules.'
          }));
        case 1:
          if (!(typeof employee_id !== 'number' || employee_id <= 0 || typeof location_id !== 'number' || location_id <= 0 || !start_time || !end_time || isNaN(new Date(start_time).getTime()) || isNaN(new Date(end_time).getTime()) || new Date(start_time) >= new Date(end_time))) {
            _context17.n = 2;
            break;
          }
          return _context17.a(2, res.status(400).json({
            error: 'Invalid schedule data provided. Ensure employee_id, location_id are valid numbers, and start_time is before end_time.'
          }));
        case 2:
          if (!(notes !== undefined && typeof notes !== 'string')) {
            _context17.n = 3;
            break;
          }
          return _context17.a(2, res.status(400).json({
            error: 'Notes must be a string if provided.'
          }));
        case 3:
          _context17.p = 3;
          _context17.n = 4;
          return query('SELECT user_id, location_id FROM Users WHERE user_id = $1 AND company_id = $2', [employee_id, companyId]);
        case 4:
          employeeCheck = _context17.v;
          if (!(employeeCheck.length === 0)) {
            _context17.n = 5;
            break;
          }
          return _context17.a(2, res.status(400).json({
            error: 'Employee not found in your company.'
          }));
        case 5:
          _context17.n = 6;
          return query('SELECT location_id FROM Locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
        case 6:
          locationCheck = _context17.v;
          if (!(locationCheck.length === 0)) {
            _context17.n = 7;
            break;
          }
          return _context17.a(2, res.status(400).json({
            error: 'Location not found in your company.'
          }));
        case 7:
          if (!(role === 'location_admin' && currentUserLocationId !== null)) {
            _context17.n = 9;
            break;
          }
          if (!(employeeCheck[0].location_id !== null && employeeCheck[0].location_id !== currentUserLocationId)) {
            _context17.n = 8;
            break;
          }
          return _context17.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin can only schedule employees within their assigned location or unassigned employees.'
          }));
        case 8:
          if (!(location_id !== currentUserLocationId)) {
            _context17.n = 9;
            break;
          }
          return _context17.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin can only create schedules for their assigned location.'
          }));
        case 9:
          _context17.n = 10;
          return runCommand('INSERT INTO Schedules (employee_id, location_id, start_time, end_time, notes) VALUES ($1, $2, $3, $4, $5) RETURNING schedule_id',
          // Return the new schedule ID
          [employee_id, location_id, start_time, end_time, notes]);
        case 10:
          result = _context17.v;
          res.status(201).json({
            message: 'Schedule created successfully!',
            scheduleId: result.schedule_id
          });
          _context17.n = 12;
          break;
        case 11:
          _context17.p = 11;
          _t22 = _context17.v;
          console.error("Database error creating schedule:", _t22);
          next(_t22);
        case 12:
          return _context17.a(2);
      }
    }, _callee17, null, [[3, 11]]);
  }));
  return function (_x56, _x57, _x58) {
    return _ref17.apply(this, arguments);
  };
}());
app.get('/schedules', authenticateToken, /*#__PURE__*/function () {
  var _ref18 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee18(req, res, next) {
    var _req$query2, employee_id, location_id, start_date, end_date, _req$user12, companyId, role, currentUserId, currentUserLocationId, sql, params, paramIndex, schedules, _t23;
    return _regenerator().w(function (_context18) {
      while (1) switch (_context18.n) {
        case 0:
          _req$query2 = req.query, employee_id = _req$query2.employee_id, location_id = _req$query2.location_id, start_date = _req$query2.start_date, end_date = _req$query2.end_date;
          _req$user12 = req.user, companyId = _req$user12.companyId, role = _req$user12.role, currentUserId = _req$user12.userId, currentUserLocationId = _req$user12.locationId;
          sql = "SELECT Schedules.*, Users.full_name AS employee_name, Users.email AS employee_email, Locations.location_name\n                FROM Schedules\n                JOIN Users ON Schedules.employee_id = Users.user_id\n                JOIN Locations ON Schedules.location_id = Locations.location_id\n                WHERE Users.company_id = $1";
          params = [companyId];
          paramIndex = 2; // Authorization based on user role
          if (!(role === 'location_admin')) {
            _context18.n = 3;
            break;
          }
          if (!(currentUserLocationId !== null)) {
            _context18.n = 1;
            break;
          }
          sql += " AND Schedules.location_id = $".concat(paramIndex++);
          params.push(currentUserLocationId);
          _context18.n = 2;
          break;
        case 1:
          return _context18.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin not assigned to a location.'
          }));
        case 2:
          _context18.n = 5;
          break;
        case 3:
          if (!(role === 'employee')) {
            _context18.n = 4;
            break;
          }
          sql += " AND Schedules.employee_id = $".concat(paramIndex++);
          params.push(currentUserId);
          _context18.n = 5;
          break;
        case 4:
          if (['super_admin'].includes(role)) {
            _context18.n = 5;
            break;
          }
          return _context18.a(2, res.status(403).json({
            error: 'Access Dismissed: Insufficient permissions to view schedules.'
          }));
        case 5:
          if (!employee_id) {
            _context18.n = 7;
            break;
          }
          if (!isNaN(parseInt(employee_id))) {
            _context18.n = 6;
            break;
          }
          return _context18.a(2, res.status(400).json({
            error: 'Invalid employee ID filter provided.'
          }));
        case 6:
          sql += " AND Schedules.employee_id = $".concat(paramIndex++);
          params.push(parseInt(employee_id));
        case 7:
          if (!location_id) {
            _context18.n = 9;
            break;
          }
          if (!isNaN(parseInt(location_id))) {
            _context18.n = 8;
            break;
          }
          return _context18.a(2, res.status(400).json({
            error: 'Invalid location ID filter provided.'
          }));
        case 8:
          sql += " AND Schedules.location_id = $".concat(paramIndex++);
          params.push(parseInt(location_id));
        case 9:
          if (!start_date) {
            _context18.n = 11;
            break;
          }
          if (!isNaN(new Date(start_date).getTime())) {
            _context18.n = 10;
            break;
          }
          return _context18.a(2, res.status(400).json({
            error: 'Invalid start date format.'
          }));
        case 10:
          sql += " AND Schedules.start_time >= $".concat(paramIndex++);
          params.push(start_date);
        case 11:
          if (!end_date) {
            _context18.n = 13;
            break;
          }
          if (!isNaN(new Date(end_date).getTime())) {
            _context18.n = 12;
            break;
          }
          return _context18.a(2, res.status(400).json({
            error: 'Invalid end date format.'
          }));
        case 12:
          sql += " AND Schedules.end_time <= $".concat(paramIndex++);
          params.push(end_date);
        case 13:
          _context18.p = 13;
          _context18.n = 14;
          return query(sql, params);
        case 14:
          schedules = _context18.v;
          res.json(schedules);
          _context18.n = 16;
          break;
        case 15:
          _context18.p = 15;
          _t23 = _context18.v;
          console.error("Database error fetching schedules:", _t23);
          next(_t23);
        case 16:
          return _context18.a(2);
      }
    }, _callee18, null, [[13, 15]]);
  }));
  return function (_x59, _x60, _x61) {
    return _ref18.apply(this, arguments);
  };
}());
app["delete"]('/schedules/:id', authenticateToken, /*#__PURE__*/function () {
  var _ref19 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee19(req, res, next) {
    var id, _req$user13, companyId, role, currentUserId, currentUserLocationId, sql, params, paramIndex, result, _t24;
    return _regenerator().w(function (_context19) {
      while (1) switch (_context19.n) {
        case 0:
          id = req.params.id;
          _req$user13 = req.user, companyId = _req$user13.companyId, role = _req$user13.role, currentUserId = _req$user13.userId, currentUserLocationId = _req$user13.locationId; // Authorization check
          if (!(role === 'employee')) {
            _context19.n = 1;
            break;
          }
          return _context19.a(2, res.status(403).json({
            error: 'Access Dismissed: Employees cannot delete schedules.'
          }));
        case 1:
          if (!(!id || isNaN(parseInt(id)))) {
            _context19.n = 2;
            break;
          }
          return _context19.a(2, res.status(400).json({
            error: 'Invalid schedule ID provided.'
          }));
        case 2:
          sql = "DELETE FROM Schedules WHERE schedule_id = $1";
          params = [id];
          paramIndex = 2; // Additional WHERE clauses based on role for secure deletion
          if (!(role === 'location_admin')) {
            _context19.n = 4;
            break;
          }
          if (!(currentUserLocationId === null)) {
            _context19.n = 3;
            break;
          }
          return _context19.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin not assigned to a location.'
          }));
        case 3:
          // Location admin can only delete schedules for employees associated with their location
          sql += " AND employee_id IN (SELECT user_id FROM Users WHERE location_id = $".concat(paramIndex++, " AND company_id = $").concat(paramIndex++, ")");
          params.push(currentUserLocationId, companyId);
          _context19.n = 6;
          break;
        case 4:
          if (!(role === 'super_admin')) {
            _context19.n = 5;
            break;
          }
          // Super admin can delete any schedule within their company
          sql += " AND employee_id IN (SELECT user_id FROM Users WHERE company_id = $".concat(paramIndex++, ")");
          params.push(companyId);
          _context19.n = 6;
          break;
        case 5:
          return _context19.a(2, res.status(403).json({
            error: 'Access Dismissed: Insufficient permissions to delete schedules.'
          }));
        case 6:
          _context19.p = 6;
          _context19.n = 7;
          return runCommand(sql, params);
        case 7:
          result = _context19.v;
          if (!(result === 0)) {
            _context19.n = 8;
            break;
          }
          return _context19.a(2, res.status(404).json({
            error: 'Schedule not found or not authorized to delete.'
          }));
        case 8:
          res.status(204).send();
          _context19.n = 10;
          break;
        case 9:
          _context19.p = 9;
          _t24 = _context19.v;
          console.error("Database error deleting schedule:", _t24);
          next(_t24);
        case 10:
          return _context19.a(2);
      }
    }, _callee19, null, [[6, 9]]);
  }));
  return function (_x62, _x63, _x64) {
    return _ref19.apply(this, arguments);
  };
}());

// --- Onboarding Endpoints ---

// This endpoint is called from the "Onboard New Employee" modal on the dashboard.
// It creates a new user with the 'employee' role.
app.post('/onboard-employee', authenticateToken, /*#__PURE__*/function () {
  var _ref20 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee20(req, res, next) {
    var _req$body9, full_name, email, position_id, employee_id, _req$user14, companyId, role, position, tempPassword, password_hash, checklist, newUser, _t25;
    return _regenerator().w(function (_context20) {
      while (1) switch (_context20.n) {
        case 0:
          _req$body9 = req.body, full_name = _req$body9.full_name, email = _req$body9.email, position_id = _req$body9.position_id, employee_id = _req$body9.employee_id;
          _req$user14 = req.user, companyId = _req$user14.companyId, role = _req$user14.role; // Authorization check
          if (['super_admin', 'location_admin'].includes(role)) {
            _context20.n = 1;
            break;
          }
          return _context20.a(2, res.status(403).json({
            error: 'Access Dismissed: Only admins can onboard new employees.'
          }));
        case 1:
          // Use the position_id from the request, which is the position name (e.g., "Sales")
          position = position_id; // Basic validation
          if (!(!full_name || !email || !position)) {
            _context20.n = 2;
            break;
          }
          return _context20.a(2, res.status(400).json({
            error: 'Full name, email, and a valid position are required.'
          }));
        case 2:
          _context20.p = 2;
          // A simple, insecure temporary password. In a real-world scenario, you would
          // generate a more secure random password or use a token-based invitation system.
          tempPassword = 'password123';
          _context20.n = 3;
          return bcrypt.hash(tempPassword, 10);
        case 3:
          password_hash = _context20.v;
          _context20.n = 4;
          return query('SELECT 1 FROM Checklists WHERE position = $1 AND company_id = $2', [position, companyId]);
        case 4:
          checklist = _context20.v;
          if (!(checklist.length === 0)) {
            _context20.n = 5;
            break;
          }
          return _context20.a(2, res.status(400).json({
            error: "No task list found for position: '".concat(position, "'. Please create one first.")
          }));
        case 5:
          _context20.n = 6;
          return runCommand("INSERT INTO Users (company_id, full_name, email, password_hash, role, position, employee_id, subscription_status, plan_id) \n             VALUES ($1, $2, $3, $4, 'employee', $5, $6, 'active', 'free') RETURNING user_id", [companyId, full_name, email, password_hash, position, employee_id]);
        case 6:
          newUser = _context20.v;
          res.status(201).json({
            message: "Employee onboarded successfully! Their temporary password is: ".concat(tempPassword),
            userId: newUser.user_id
          });
          _context20.n = 9;
          break;
        case 7:
          _context20.p = 7;
          _t25 = _context20.v;
          if (!(_t25.code === '23505')) {
            _context20.n = 8;
            break;
          }
          return _context20.a(2, res.status(409).json({
            error: 'An employee with this email address already exists.'
          }));
        case 8:
          console.error("Onboard employee error:", _t25);
          next(_t25);
        case 9:
          return _context20.a(2);
      }
    }, _callee20, null, [[2, 7]]);
  }));
  return function (_x65, _x66, _x67) {
    return _ref20.apply(this, arguments);
  };
}());

// This endpoint gets the list of active onboarding sessions for the main dashboard view.
app.get('/onboarding-sessions', authenticateToken, /*#__PURE__*/function () {
  var _ref21 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee22(req, res, next) {
    var companyId, employees, sessions, _t26;
    return _regenerator().w(function (_context22) {
      while (1) switch (_context22.n) {
        case 0:
          companyId = req.user.companyId;
          _context22.p = 1;
          _context22.n = 2;
          return query("\n            SELECT user_id, full_name, email, position \n            FROM Users \n            WHERE role = 'employee' AND company_id = $1\n        ", [companyId]);
        case 2:
          employees = _context22.v;
          if (!(employees.length === 0)) {
            _context22.n = 3;
            break;
          }
          return _context22.a(2, res.json([]));
        case 3:
          _context22.n = 4;
          return Promise.all(employees.map(/*#__PURE__*/function () {
            var _ref22 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee21(employee) {
              var _checklist$tasks$;
              var checklistResult, checklist, totalTasks, completedResult, completedTasks;
              return _regenerator().w(function (_context21) {
                while (1) switch (_context21.n) {
                  case 0:
                    _context21.n = 1;
                    return query('SELECT checklist_id, tasks FROM Checklists WHERE position = $1 AND company_id = $2 LIMIT 1', [employee.position, companyId]);
                  case 1:
                    checklistResult = _context21.v;
                    if (!(checklistResult.length === 0)) {
                      _context21.n = 2;
                      break;
                    }
                    return _context21.a(2, null);
                  case 2:
                    checklist = checklistResult[0]; // Calculate total tasks from the JSONB structure
                    totalTasks = 0;
                    if ((_checklist$tasks$ = checklist.tasks[0]) !== null && _checklist$tasks$ !== void 0 && _checklist$tasks$.groupTitle) {
                      // It's a grouped list
                      totalTasks = checklist.tasks.reduce(function (sum, group) {
                        return sum + group.tasks.length;
                      }, 0);
                    } else {
                      // It's a single list
                      totalTasks = checklist.tasks.length;
                    }

                    // Count completed tasks from the UserTasks table
                    _context21.n = 3;
                    return query('SELECT COUNT(*) FROM UserTasks WHERE user_id = $1 AND checklist_id = $2', [employee.user_id, checklist.checklist_id]);
                  case 3:
                    completedResult = _context21.v;
                    completedTasks = parseInt(completedResult[0].count, 10); // Filter out completed sessions
                    if (!(totalTasks > 0 && completedTasks >= totalTasks)) {
                      _context21.n = 4;
                      break;
                    }
                    return _context21.a(2, null);
                  case 4:
                    return _context21.a(2, _objectSpread(_objectSpread({}, employee), {}, {
                      totalTasks: totalTasks,
                      completedTasks: completedTasks
                    }));
                }
              }, _callee21);
            }));
            return function (_x71) {
              return _ref22.apply(this, arguments);
            };
          }()));
        case 4:
          sessions = _context22.v;
          // Filter out the null values for employees with no checklist or who are complete
          res.json(sessions.filter(function (session) {
            return session !== null;
          }));
          _context22.n = 6;
          break;
        case 5:
          _context22.p = 5;
          _t26 = _context22.v;
          console.error("Error loading onboarding sessions:", _t26);
          next(_t26);
        case 6:
          return _context22.a(2);
      }
    }, _callee22, null, [[1, 5]]);
  }));
  return function (_x68, _x69, _x70) {
    return _ref21.apply(this, arguments);
  };
}());

// This endpoint gets the specific task list for a new hire when they view their onboarding page.
app.get('/onboarding-tasks/:userId', authenticateToken, /*#__PURE__*/function () {
  var _ref23 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee23(req, res, next) {
    var _checklist$tasks$2, userId, user, position, checklistResult, checklist, completedTasksResult, completedTaskDescriptions, mapTasks, tasksWithStatus, _t27;
    return _regenerator().w(function (_context23) {
      while (1) switch (_context23.n) {
        case 0:
          _context23.p = 0;
          userId = req.params.userId;
          _context23.n = 1;
          return query('SELECT * FROM Users WHERE user_id = $1', [userId]);
        case 1:
          user = _context23.v;
          if (!(user.length === 0)) {
            _context23.n = 2;
            break;
          }
          return _context23.a(2, res.status(404).json({
            error: 'User not found'
          }));
        case 2:
          position = user[0].position;
          _context23.n = 3;
          return query('SELECT * FROM Checklists WHERE position = $1 AND company_id = $2 LIMIT 1', [user[0].company_id, user[0].company_id]);
        case 3:
          checklistResult = _context23.v;
          if (!(checklistResult.length === 0)) {
            _context23.n = 4;
            break;
          }
          return _context23.a(2, res.status(404).json({
            error: "No checklist found for position: ".concat(position)
          }));
        case 4:
          checklist = checklistResult[0];
          _context23.n = 5;
          return query('SELECT task_description FROM UserTasks WHERE user_id = $1 AND checklist_id = $2', [userId, checklist.checklist_id]);
        case 5:
          completedTasksResult = _context23.v;
          completedTaskDescriptions = new Set(completedTasksResult.map(function (t) {
            return t.task_description;
          })); // Map tasks and add completion status and a unique ID for the frontend
          mapTasks = function mapTasks(task, groupIndex, taskIndex) {
            var isCompleted = completedTaskDescriptions.has(task.description);
            // Generate a stable, unique ID for the frontend to use
            var taskId = "".concat(checklist.checklist_id, "-").concat(groupIndex, "-").concat(taskIndex);
            return _objectSpread(_objectSpread({}, task), {}, {
              completed: isCompleted,
              id: taskId
            });
          };
          if ((_checklist$tasks$2 = checklist.tasks[0]) !== null && _checklist$tasks$2 !== void 0 && _checklist$tasks$2.groupTitle) {
            // Grouped structure
            tasksWithStatus = checklist.tasks.map(function (group, groupIndex) {
              return _objectSpread(_objectSpread({}, group), {}, {
                tasks: group.tasks.map(function (task, taskIndex) {
                  return mapTasks(task, groupIndex, taskIndex);
                })
              });
            });
          } else {
            // Single list structure
            tasksWithStatus = checklist.tasks.map(function (task, taskIndex) {
              return mapTasks(task, -1, taskIndex);
            });
          }
          res.json({
            checklist: checklist,
            tasks: tasksWithStatus
          });
          _context23.n = 7;
          break;
        case 6:
          _context23.p = 6;
          _t27 = _context23.v;
          console.error("Error fetching user onboarding tasks:", _t27);
          next(_t27);
        case 7:
          return _context23.a(2);
      }
    }, _callee23, null, [[0, 6]]);
  }));
  return function (_x72, _x73, _x74) {
    return _ref23.apply(this, arguments);
  };
}());

// This endpoint is called when a new hire checks or unchecks a task.
app.put('/onboarding-tasks/:taskId', authenticateToken, /*#__PURE__*/function () {
  var _ref24 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee24(req, res, next) {
    var taskId, completed, userId, _taskId$split$map, _taskId$split$map2, checklistId, groupIndex, taskIndex, checklistResult, checklistTasks, taskDescription, _checklistTasks$taskI, _checklistTasks$group, _t28;
    return _regenerator().w(function (_context24) {
      while (1) switch (_context24.n) {
        case 0:
          taskId = req.params.taskId;
          completed = req.body.completed;
          userId = req.user.userId;
          _context24.p = 1;
          // Deconstruct the task ID generated by the GET endpoint
          _taskId$split$map = taskId.split('-').map(Number), _taskId$split$map2 = _slicedToArray(_taskId$split$map, 3), checklistId = _taskId$split$map2[0], groupIndex = _taskId$split$map2[1], taskIndex = _taskId$split$map2[2]; // Fetch the checklist to get the task description from the JSON
          _context24.n = 2;
          return query('SELECT tasks FROM Checklists WHERE checklist_id = $1', [checklistId]);
        case 2:
          checklistResult = _context24.v;
          if (!(checklistResult.length === 0)) {
            _context24.n = 3;
            break;
          }
          return _context24.a(2, res.status(404).json({
            error: 'Checklist not found.'
          }));
        case 3:
          checklistTasks = checklistResult[0].tasks;
          if (groupIndex === -1) {
            // Single list
            taskDescription = (_checklistTasks$taskI = checklistTasks[taskIndex]) === null || _checklistTasks$taskI === void 0 ? void 0 : _checklistTasks$taskI.description;
          } else {
            // Grouped list
            taskDescription = (_checklistTasks$group = checklistTasks[groupIndex]) === null || _checklistTasks$group === void 0 || (_checklistTasks$group = _checklistTasks$group.tasks[taskIndex]) === null || _checklistTasks$group === void 0 ? void 0 : _checklistTasks$group.description;
          }
          if (taskDescription) {
            _context24.n = 4;
            break;
          }
          return _context24.a(2, res.status(404).json({
            error: 'Task not found within checklist.'
          }));
        case 4:
          if (!completed) {
            _context24.n = 6;
            break;
          }
          _context24.n = 5;
          return runCommand("\n                INSERT INTO UserTasks (user_id, checklist_id, task_description, completed_at)\n                VALUES ($1, $2, $3, NOW())\n                ON CONFLICT (user_id, checklist_id, task_description) DO NOTHING\n            ", [userId, checklistId, taskDescription]);
        case 5:
          _context24.n = 7;
          break;
        case 6:
          _context24.n = 7;
          return runCommand('DELETE FROM UserTasks WHERE user_id = $1 AND checklist_id = $2 AND task_description = $3', [userId, checklistId, taskDescription]);
        case 7:
          res.status(200).json({
            message: 'Task status updated.'
          });
          _context24.n = 9;
          break;
        case 8:
          _context24.p = 8;
          _t28 = _context24.v;
          console.error("Error updating task status:", _t28);
          next(_t28);
        case 9:
          return _context24.a(2);
      }
    }, _callee24, null, [[1, 8]]);
  }));
  return function (_x75, _x76, _x77) {
    return _ref24.apply(this, arguments);
  };
}());

// --- NEW: Checklist CRUD Endpoints ---

// GET all checklists for the company
app.get('/checklists', authenticateToken, /*#__PURE__*/function () {
  var _ref25 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee25(req, res, next) {
    var companyId, checklists, _t29;
    return _regenerator().w(function (_context25) {
      while (1) switch (_context25.n) {
        case 0:
          companyId = req.user.companyId;
          _context25.p = 1;
          _context25.n = 2;
          return query('SELECT * FROM Checklists WHERE company_id = $1 ORDER BY position, title', [companyId]);
        case 2:
          checklists = _context25.v;
          res.status(200).json(checklists);
          _context25.n = 4;
          break;
        case 3:
          _context25.p = 3;
          _t29 = _context25.v;
          console.error("Error fetching checklists:", _t29);
          next(_t29);
        case 4:
          return _context25.a(2);
      }
    }, _callee25, null, [[1, 3]]);
  }));
  return function (_x78, _x79, _x80) {
    return _ref25.apply(this, arguments);
  };
}());

// GET a single checklist by its ID
app.get('/checklists/:id', authenticateToken, /*#__PURE__*/function () {
  var _ref26 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee26(req, res, next) {
    var id, companyId, result, _t30;
    return _regenerator().w(function (_context26) {
      while (1) switch (_context26.n) {
        case 0:
          id = req.params.id;
          companyId = req.user.companyId;
          _context26.p = 1;
          _context26.n = 2;
          return query('SELECT * FROM Checklists WHERE checklist_id = $1 AND company_id = $2', [id, companyId]);
        case 2:
          result = _context26.v;
          if (!(result.length === 0)) {
            _context26.n = 3;
            break;
          }
          return _context26.a(2, res.status(404).json({
            error: 'Checklist not found or you do not have permission to view it.'
          }));
        case 3:
          res.status(200).json(result[0]);
          _context26.n = 5;
          break;
        case 4:
          _context26.p = 4;
          _t30 = _context26.v;
          console.error("Error fetching checklist with id ".concat(id, ":"), _t30);
          next(_t30);
        case 5:
          return _context26.a(2);
      }
    }, _callee26, null, [[1, 4]]);
  }));
  return function (_x81, _x82, _x83) {
    return _ref26.apply(this, arguments);
  };
}());

// POST a new checklist
app.post('/checklists', authenticateToken, /*#__PURE__*/function () {
  var _ref27 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee27(req, res, next) {
    var _req$body0, position, title, structure_type, group_count, tasks, _req$user15, companyId, role, result, _t31;
    return _regenerator().w(function (_context27) {
      while (1) switch (_context27.n) {
        case 0:
          _req$body0 = req.body, position = _req$body0.position, title = _req$body0.title, structure_type = _req$body0.structure_type, group_count = _req$body0.group_count, tasks = _req$body0.tasks;
          _req$user15 = req.user, companyId = _req$user15.companyId, role = _req$user15.role;
          if (['super_admin', 'location_admin'].includes(role)) {
            _context27.n = 1;
            break;
          }
          return _context27.a(2, res.status(403).json({
            error: 'Access Dismissed: You are not authorized to create task lists.'
          }));
        case 1:
          if (!(!position || !title || !structure_type || !tasks || tasks.length === 0)) {
            _context27.n = 2;
            break;
          }
          return _context27.a(2, res.status(400).json({
            error: 'Missing required fields for checklist creation.'
          }));
        case 2:
          _context27.p = 2;
          _context27.n = 3;
          return runCommand("INSERT INTO Checklists (company_id, position, title, structure_type, group_count, tasks)\n             VALUES ($1, $2, $3, $4, $5, $6) RETURNING checklist_id", [companyId, position, title, structure_type, group_count || 0, JSON.stringify(tasks)]);
        case 3:
          result = _context27.v;
          res.status(201).json({
            message: 'Checklist created successfully!',
            checklistId: result.checklist_id
          });
          _context27.n = 6;
          break;
        case 4:
          _context27.p = 4;
          _t31 = _context27.v;
          if (!(_t31.code === '23505' && _t31.constraint === 'checklists_company_id_position_key')) {
            _context27.n = 5;
            break;
          }
          return _context27.a(2, res.status(409).json({
            error: 'A task list for this position already exists. Please use a different position name.'
          }));
        case 5:
          console.error("Error creating checklist:", _t31);
          next(_t31);
        case 6:
          return _context27.a(2);
      }
    }, _callee27, null, [[2, 4]]);
  }));
  return function (_x84, _x85, _x86) {
    return _ref27.apply(this, arguments);
  };
}());

// PUT (update) an existing checklist
app.put('/checklists/:id', authenticateToken, /*#__PURE__*/function () {
  var _ref28 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee28(req, res, next) {
    var id, _req$body1, position, title, structure_type, group_count, tasks, _req$user16, companyId, role, result, _t32;
    return _regenerator().w(function (_context28) {
      while (1) switch (_context28.n) {
        case 0:
          id = req.params.id;
          _req$body1 = req.body, position = _req$body1.position, title = _req$body1.title, structure_type = _req$body1.structure_type, group_count = _req$body1.group_count, tasks = _req$body1.tasks;
          _req$user16 = req.user, companyId = _req$user16.companyId, role = _req$user16.role;
          if (['super_admin', 'location_admin'].includes(role)) {
            _context28.n = 1;
            break;
          }
          return _context28.a(2, res.status(403).json({
            error: 'Access Dismissed: You are not authorized to update task lists.'
          }));
        case 1:
          if (!(!position || !title || !structure_type || !tasks || tasks.length === 0)) {
            _context28.n = 2;
            break;
          }
          return _context28.a(2, res.status(400).json({
            error: 'Missing required fields for checklist update.'
          }));
        case 2:
          _context28.p = 2;
          _context28.n = 3;
          return runCommand("UPDATE Checklists SET position = $1, title = $2, structure_type = $3, group_count = $4, tasks = $5\n             WHERE checklist_id = $6 AND company_id = $7", [position, title, structure_type, group_count || 0, JSON.stringify(tasks), id, companyId]);
        case 3:
          result = _context28.v;
          if (!(result === 0)) {
            _context28.n = 4;
            break;
          }
          return _context28.a(2, res.status(404).json({
            error: 'Checklist not found or you do not have permission to update it.'
          }));
        case 4:
          res.status(200).json({
            message: 'Checklist updated successfully!'
          });
          _context28.n = 6;
          break;
        case 5:
          _context28.p = 5;
          _t32 = _context28.v;
          console.error("Error updating checklist with id ".concat(id, ":"), _t32);
          next(_t32);
        case 6:
          return _context28.a(2);
      }
    }, _callee28, null, [[2, 5]]);
  }));
  return function (_x87, _x88, _x89) {
    return _ref28.apply(this, arguments);
  };
}());

// DELETE a checklist
app["delete"]('/checklists/:id', authenticateToken, /*#__PURE__*/function () {
  var _ref29 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee29(req, res, next) {
    var id, _req$user17, companyId, role, result, _t33;
    return _regenerator().w(function (_context29) {
      while (1) switch (_context29.n) {
        case 0:
          id = req.params.id;
          _req$user17 = req.user, companyId = _req$user17.companyId, role = _req$user17.role;
          if (['super_admin', 'location_admin'].includes(role)) {
            _context29.n = 1;
            break;
          }
          return _context29.a(2, res.status(403).json({
            error: 'Access Dismissed: You are not authorized to delete task lists.'
          }));
        case 1:
          _context29.p = 1;
          _context29.n = 2;
          return runCommand('DELETE FROM Checklists WHERE checklist_id = $1 AND company_id = $2', [id, companyId]);
        case 2:
          result = _context29.v;
          if (!(result === 0)) {
            _context29.n = 3;
            break;
          }
          return _context29.a(2, res.status(404).json({
            error: 'Checklist not found or you do not have permission to delete it.'
          }));
        case 3:
          res.status(204).send();
          _context29.n = 5;
          break;
        case 4:
          _context29.p = 4;
          _t33 = _context29.v;
          console.error("Error deleting checklist with id ".concat(id, ":"), _t33);
          next(_t33);
        case 5:
          return _context29.a(2);
      }
    }, _callee29, null, [[1, 4]]);
  }));
  return function (_x90, _x91, _x92) {
    return _ref29.apply(this, arguments);
  };
}());

// --- End of NEW Checklist Endpoints ---

app.post('/job-postings', authenticateToken, /*#__PURE__*/function () {
  var _ref30 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee30(req, res, next) {
    var _req$body10, title, description, requirements, location_id, _req$user18, companyId, role, currentUserLocationId, created_date, locationCheck, result, _t34;
    return _regenerator().w(function (_context30) {
      while (1) switch (_context30.n) {
        case 0:
          _req$body10 = req.body, title = _req$body10.title, description = _req$body10.description, requirements = _req$body10.requirements, location_id = _req$body10.location_id;
          _req$user18 = req.user, companyId = _req$user18.companyId, role = _req$user18.role, currentUserLocationId = _req$user18.locationId;
          created_date = new Date().toISOString(); // Authorization check
          if (['super_admin', 'location_admin'].includes(role)) {
            _context30.n = 1;
            break;
          }
          return _context30.a(2, res.status(403).json({
            error: 'Access Dismissed: Only admins can create job postings.'
          }));
        case 1:
          if (!(!title || typeof title !== 'string' || title.trim() === '')) {
            _context30.n = 2;
            break;
          }
          return _context30.a(2, res.status(400).json({
            error: "Job title is required and must be a non-empty string."
          }));
        case 2:
          if (!(description !== undefined && (typeof description !== 'string' || description.trim() === ''))) {
            _context30.n = 3;
            break;
          }
          return _context30.a(2, res.status(400).json({
            error: 'Description must be a non-empty string if provided.'
          }));
        case 3:
          if (!(requirements !== undefined && typeof requirements !== 'string')) {
            _context30.n = 4;
            break;
          }
          return _context30.a(2, res.status(400).json({
            error: 'Requirements must be a string if provided.'
          }));
        case 4:
          if (!(location_id !== undefined && typeof location_id !== 'number' && location_id !== null)) {
            _context30.n = 5;
            break;
          }
          return _context30.a(2, res.status(400).json({
            error: 'Location ID must be a number or null if provided.'
          }));
        case 5:
          if (!(location_id !== null && location_id <= 0)) {
            _context30.n = 6;
            break;
          }
          return _context30.a(2, res.status(400).json({
            error: 'Location ID must be a positive number or null.'
          }));
        case 6:
          if (!(role === 'location_admin' && currentUserLocationId !== null)) {
            _context30.n = 7;
            break;
          }
          if (!(location_id !== currentUserLocationId && location_id !== null)) {
            _context30.n = 7;
            break;
          }
          return _context30.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin can only post jobs for their assigned location or unassigned (null).'
          }));
        case 7:
          _context30.p = 7;
          if (!(location_id !== null)) {
            _context30.n = 9;
            break;
          }
          _context30.n = 8;
          return query('SELECT location_id FROM Locations WHERE location_id = $1 AND company_id = $2', [location_id, companyId]);
        case 8:
          locationCheck = _context30.v;
          if (!(locationCheck.length === 0)) {
            _context30.n = 9;
            break;
          }
          return _context30.a(2, res.status(400).json({
            error: 'Selected location does not exist or does not belong to your company.'
          }));
        case 9:
          _context30.n = 10;
          return runCommand("INSERT INTO JobPostings (company_id, location_id, title, description, requirements, status, created_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING job_posting_id", [companyId, location_id, title, description, requirements, 'Open', created_date]);
        case 10:
          result = _context30.v;
          res.status(201).json({
            message: 'Job posting created successfully!',
            jobPostingId: result[0].job_posting_id
          });
          _context30.n = 12;
          break;
        case 11:
          _context30.p = 11;
          _t34 = _context30.v;
          console.error("Database error creating job posting:", _t34);
          next(_t34);
        case 12:
          return _context30.a(2);
      }
    }, _callee30, null, [[7, 11]]);
  }));
  return function (_x93, _x94, _x95) {
    return _ref30.apply(this, arguments);
  };
}());
app.get('/job-postings', authenticateToken, /*#__PURE__*/function () {
  var _ref31 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee31(req, res, next) {
    var _req$query3, status, location_id, _req$user19, companyId, role, currentUserLocationId, sql, params, paramIndex, allowedStatuses, parsedLocationId, postings, _t35;
    return _regenerator().w(function (_context31) {
      while (1) switch (_context31.n) {
        case 0:
          _req$query3 = req.query, status = _req$query3.status, location_id = _req$query3.location_id;
          _req$user19 = req.user, companyId = _req$user19.companyId, role = _req$user19.role, currentUserLocationId = _req$user19.locationId;
          sql = 'SELECT * FROM JobPostings WHERE company_id = $1';
          params = [companyId];
          paramIndex = 2; // Authorization and filtering based on user role
          if (!(role === 'location_admin')) {
            _context31.n = 3;
            break;
          }
          if (!(currentUserLocationId !== null)) {
            _context31.n = 1;
            break;
          }
          sql += " AND (location_id = $".concat(paramIndex++, " OR location_id IS NULL)"); // Location admins see their location's jobs and unassigned jobs
          params.push(currentUserLocationId);
          _context31.n = 2;
          break;
        case 1:
          return _context31.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin not assigned to a location.'
          }));
        case 2:
          _context31.n = 4;
          break;
        case 3:
          if (!(role === 'employee')) {
            _context31.n = 4;
            break;
          }
          return _context31.a(2, res.status(403).json({
            error: 'Access Dismissed: Insufficient permissions to view job postings.'
          }));
        case 4:
          // Super admin already has access via companyId filter
          allowedStatuses = ['Open', 'Closed', 'Filled'];
          if (!status) {
            _context31.n = 6;
            break;
          }
          if (allowedStatuses.includes(status)) {
            _context31.n = 5;
            break;
          }
          return _context31.a(2, res.status(400).json({
            error: 'Invalid job posting status filter provided.'
          }));
        case 5:
          sql += " AND status = $".concat(paramIndex++);
          params.push(status);
        case 6:
          if (!location_id) {
            _context31.n = 9;
            break;
          }
          if (!isNaN(parseInt(location_id))) {
            _context31.n = 7;
            break;
          }
          return _context31.a(2, res.status(400).json({
            error: 'Invalid location ID filter provided.'
          }));
        case 7:
          parsedLocationId = parseInt(location_id); // Super admin can filter by any location
          // Location admin can only filter by their assigned location or null (unassigned)
          if (!(role === 'super_admin' || role === 'location_admin' && (parsedLocationId === currentUserLocationId || parsedLocationId === 0))) {
            _context31.n = 8;
            break;
          }
          sql += " AND location_id = $".concat(paramIndex++);
          params.push(parsedLocationId);
          _context31.n = 9;
          break;
        case 8:
          return _context31.a(2, res.status(403).json({
            error: 'Access Dismissed: Insufficient permissions to filter by location.'
          }));
        case 9:
          _context31.p = 9;
          _context31.n = 10;
          return query(sql, params);
        case 10:
          postings = _context31.v;
          res.json(postings);
          _context31.n = 12;
          break;
        case 11:
          _context31.p = 11;
          _t35 = _context31.v;
          console.error("Database error fetching job postings:", _t35);
          next(_t35);
        case 12:
          return _context31.a(2);
      }
    }, _callee31, null, [[9, 11]]);
  }));
  return function (_x96, _x97, _x98) {
    return _ref31.apply(this, arguments);
  };
}());
app.put('/job-postings/:id', authenticateToken, /*#__PURE__*/function () {
  var _ref32 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee32(req, res, next) {
    var id, _req$body11, title, description, requirements, status, location_id, _req$user20, companyId, role, currentUserLocationId, allowedStatuses, updateSql, updateParams, clauses, paramIndex, result, _t36;
    return _regenerator().w(function (_context32) {
      while (1) switch (_context32.n) {
        case 0:
          id = req.params.id;
          _req$body11 = req.body, title = _req$body11.title, description = _req$body11.description, requirements = _req$body11.requirements, status = _req$body11.status, location_id = _req$body11.location_id;
          _req$user20 = req.user, companyId = _req$user20.companyId, role = _req$user20.role, currentUserLocationId = _req$user20.locationId; // Authorization check
          if (['super_admin', 'location_admin'].includes(role)) {
            _context32.n = 1;
            break;
          }
          return _context32.a(2, res.status(403).json({
            error: 'Access Dismissed: Only admins can update job postings.'
          }));
        case 1:
          if (!(!id || isNaN(parseInt(id)))) {
            _context32.n = 2;
            break;
          }
          return _context32.a(2, res.status(400).json({
            error: 'Invalid job posting ID provided.'
          }));
        case 2:
          if (!(title !== undefined && (typeof title !== 'string' || title.trim() === ''))) {
            _context32.n = 3;
            break;
          }
          return _context32.a(2, res.status(400).json({
            error: "Job title is required and must be a non-empty string if provided."
          }));
        case 3:
          if (!(description !== undefined && (typeof description !== 'string' || description.trim() === ''))) {
            _context32.n = 4;
            break;
          }
          return _context32.a(2, res.status(400).json({
            error: 'Description must be a non-empty string if provided.'
          }));
        case 4:
          if (!(requirements !== undefined && typeof requirements !== 'string')) {
            _context32.n = 5;
            break;
          }
          return _context32.a(2, res.status(400).json({
            error: 'Requirements must be a string if provided.'
          }));
        case 5:
          allowedStatuses = ['Open', 'Closed', 'Filled'];
          if (!(status !== undefined && !allowedStatuses.includes(status))) {
            _context32.n = 6;
            break;
          }
          return _context32.a(2, res.status(400).json({
            error: 'Invalid status provided.'
          }));
        case 6:
          if (!(location_id !== undefined && typeof location_id !== 'number' && location_id !== null)) {
            _context32.n = 7;
            break;
          }
          return _context32.a(2, res.status(400).json({
            error: 'Location ID must be a number or null if provided.'
          }));
        case 7:
          if (!(location_id !== null && location_id <= 0)) {
            _context32.n = 8;
            break;
          }
          return _context32.a(2, res.status(400).json({
            error: 'Location ID must be a positive number or null.'
          }));
        case 8:
          updateSql = 'UPDATE JobPostings SET ';
          updateParams = [];
          clauses = [];
          paramIndex = 1; // Dynamically build update clauses
          if (title !== undefined) {
            clauses.push("title = $".concat(paramIndex++));
            updateParams.push(title);
          }
          if (description !== undefined) {
            clauses.push("description = $".concat(paramIndex++));
            updateParams.push(description);
          }
          if (requirements !== undefined) {
            clauses.push("requirements = $".concat(paramIndex++));
            updateParams.push(requirements);
          }
          if (status !== undefined) {
            clauses.push("status = $".concat(paramIndex++));
            updateParams.push(status);
          }
          if (!(location_id !== undefined)) {
            _context32.n = 10;
            break;
          }
          if (!(role === 'super_admin' || role === 'location_admin' && (location_id === currentUserLocationId || location_id === null))) {
            _context32.n = 9;
            break;
          }
          clauses.push("location_id = $".concat(paramIndex++));
          updateParams.push(location_id);
          _context32.n = 10;
          break;
        case 9:
          if (!(role === 'location_admin')) {
            _context32.n = 10;
            break;
          }
          return _context32.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin cannot change job posting location to another location.'
          }));
        case 10:
          if (!(clauses.length === 0)) {
            _context32.n = 11;
            break;
          }
          return _context32.a(2, res.status(400).json({
            error: 'No fields provided for update.'
          }));
        case 11:
          updateSql += clauses.join(', ') + " WHERE job_posting_id = $".concat(paramIndex++, " AND company_id = $").concat(paramIndex++);
          updateParams.push(parseInt(id), companyId);

          // Ensure location admin can only update jobs within their assigned location or unassigned jobs
          if (!(role === 'location_admin' && currentUserLocationId !== null)) {
            _context32.n = 12;
            break;
          }
          updateSql += " AND (location_id = $".concat(paramIndex++, " OR location_id IS NULL)");
          updateParams.push(currentUserLocationId);
          _context32.n = 13;
          break;
        case 12:
          if (!(role === 'location_admin' && currentUserLocationId === null)) {
            _context32.n = 13;
            break;
          }
          return _context32.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin not assigned to a location.'
          }));
        case 13:
          _context32.p = 13;
          _context32.n = 14;
          return runCommand(updateSql, updateParams);
        case 14:
          result = _context32.v;
          if (!(result === 0)) {
            _context32.n = 15;
            break;
          }
          return _context32.a(2, res.status(404).json({
            error: 'Job posting not found or not authorized to update.'
          }));
        case 15:
          res.status(200).json({
            message: 'Job posting updated successfully!'
          });
          _context32.n = 17;
          break;
        case 16:
          _context32.p = 16;
          _t36 = _context32.v;
          console.error("Database error updating job posting:", _t36);
          next(_t36);
        case 17:
          return _context32.a(2);
      }
    }, _callee32, null, [[13, 16]]);
  }));
  return function (_x99, _x100, _x101) {
    return _ref32.apply(this, arguments);
  };
}());
app["delete"]('/job-postings/:id', authenticateToken, /*#__PURE__*/function () {
  var _ref33 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee33(req, res, next) {
    var id, _req$user21, companyId, role, currentUserLocationId, sql, params, paramIndex, result, _t37;
    return _regenerator().w(function (_context33) {
      while (1) switch (_context33.n) {
        case 0:
          id = req.params.id;
          _req$user21 = req.user, companyId = _req$user21.companyId, role = _req$user21.role, currentUserLocationId = _req$user21.locationId; // Authorization check
          if (['super_admin', 'location_admin'].includes(role)) {
            _context33.n = 1;
            break;
          }
          return _context33.a(2, res.status(403).json({
            error: 'Access Dismissed: Only admins can delete job postings.'
          }));
        case 1:
          if (!(!id || isNaN(parseInt(id)))) {
            _context33.n = 2;
            break;
          }
          return _context33.a(2, res.status(400).json({
            error: 'Invalid job posting ID provided.'
          }));
        case 2:
          sql = 'DELETE FROM JobPostings WHERE job_posting_id = $1 AND company_id = $2';
          params = [id, companyId];
          paramIndex = 3; // Location admin specific restriction for deletion
          if (!(role === 'location_admin' && currentUserLocationId !== null)) {
            _context33.n = 3;
            break;
          }
          sql += " AND (location_id = $".concat(paramIndex++, " OR location_id IS NULL)"); // Can delete jobs at their location or unassigned
          params.push(currentUserLocationId);
          _context33.n = 4;
          break;
        case 3:
          if (!(role === 'location_admin' && currentUserLocationId === null)) {
            _context33.n = 4;
            break;
          }
          return _context33.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin not assigned to a location.'
          }));
        case 4:
          _context33.p = 4;
          _context33.n = 5;
          return runCommand(sql, params);
        case 5:
          result = _context33.v;
          if (!(result === 0)) {
            _context33.n = 6;
            break;
          }
          return _context33.a(2, res.status(404).json({
            error: 'Job posting not found or not authorized to delete.'
          }));
        case 6:
          res.status(204).send();
          _context33.n = 8;
          break;
        case 7:
          _context33.p = 7;
          _t37 = _context33.v;
          console.error("Database error deleting job posting:", _t37);
          next(_t37);
        case 8:
          return _context33.a(2);
      }
    }, _callee33, null, [[4, 7]]);
  }));
  return function (_x102, _x103, _x104) {
    return _ref33.apply(this, arguments);
  };
}());
app.post('/applicants', authenticateToken, /*#__PURE__*/function () {
  var _ref34 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee34(req, res, next) {
    var _req$body12, job_posting_id, full_name, email, notes, location_id, phone_number, _req$user22, companyId, role, currentUserLocationId, application_date, jobPostingCheck, actualLocationId, result, _t38;
    return _regenerator().w(function (_context34) {
      while (1) switch (_context34.n) {
        case 0:
          _req$body12 = req.body, job_posting_id = _req$body12.job_posting_id, full_name = _req$body12.full_name, email = _req$body12.email, notes = _req$body12.notes, location_id = _req$body12.location_id, phone_number = _req$body12.phone_number;
          _req$user22 = req.user, companyId = _req$user22.companyId, role = _req$user22.role, currentUserLocationId = _req$user22.locationId;
          application_date = new Date().toISOString(); // Authorization check
          if (['super_admin', 'location_admin'].includes(role)) {
            _context34.n = 1;
            break;
          }
          return _context34.a(2, res.status(403).json({
            error: 'Access Dismissed: Only admins can add applicants.'
          }));
        case 1:
          if (!(typeof job_posting_id !== 'number' || job_posting_id <= 0 || !full_name || typeof full_name !== 'string' || full_name.trim() === '' || !email || !isValidEmail(email) || !phone_number || typeof phone_number !== 'string' || phone_number.trim() === '')) {
            _context34.n = 2;
            break;
          }
          return _context34.a(2, res.status(400).json({
            error: 'Invalid applicant data provided. Job Posting ID, full name, valid email, and phone number are required.'
          }));
        case 2:
          if (!(notes !== undefined && typeof notes !== 'string')) {
            _context34.n = 3;
            break;
          }
          return _context34.a(2, res.status(400).json({
            error: 'Notes must be a string if provided.'
          }));
        case 3:
          if (!(location_id !== undefined && typeof location_id !== 'number' && location_id !== null)) {
            _context34.n = 4;
            break;
          }
          return _context34.a(2, res.status(400).json({
            error: 'Location ID must be a number or null if provided.'
          }));
        case 4:
          if (!(location_id !== null && location_id <= 0)) {
            _context34.n = 5;
            break;
          }
          return _context34.a(2, res.status(400).json({
            error: 'Location ID must be a positive number or null.'
          }));
        case 5:
          _context34.p = 5;
          _context34.n = 6;
          return query('SELECT job_posting_id, location_id FROM JobPostings WHERE job_posting_id = $1 AND company_id = $2', [job_posting_id, companyId]);
        case 6:
          jobPostingCheck = _context34.v;
          if (!(jobPostingCheck.length === 0)) {
            _context34.n = 7;
            break;
          }
          return _context34.a(2, res.status(400).json({
            error: 'Job Posting not found or does not belong to your company.'
          }));
        case 7:
          // Determine the actual location_id for the applicant.
          // If location_id is provided in the body, use it. Otherwise, use the job posting's location.
          // If job posting's location is null, the applicant's location will also be null.
          actualLocationId = location_id === undefined ? jobPostingCheck[0].location_id : location_id; // Location admin specific check
          if (!(role === 'location_admin' && currentUserLocationId !== null)) {
            _context34.n = 8;
            break;
          }
          if (!(actualLocationId !== currentUserLocationId && actualLocationId !== null)) {
            _context34.n = 8;
            break;
          }
          return _context34.a(2, res.status(403).json({
            error: 'Access Dismissed: Location admin cannot add applicants to jobs outside their assigned location.'
          }));
        case 8:
          _context34.n = 9;
          return runCommand("INSERT INTO Applicants (company_id, location_id, job_posting_id, full_name, email, phone_number, notes, application_date, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING applicant_id",
          // Added status with default and returning ID
          [companyId, actualLocationId, job_posting_id, full_name, email, phone_number, notes, application_date, 'Applied'] // Default status 'Applied'
          );
        case 9:
          result = _context34.v;
          res.status(201).json({
            message: 'Applicant added successfully!',
            applicantId: result.applicant_id
          });
          _context34.n = 11;
          break;
        case 10:
          _context34.p = 10;
          _t38 = _context34.v;
          console.error("Database error creating applicant:", _t38);
          next(_t38);
        case 11:
          return _context34.a(2);
      }
    }, _callee34, null, [[5, 10]]);
  }));
  return function (_x105, _x106, _x107) {
    return _ref34.apply(this, arguments);
  };
}());

// --- Static Files and SPA Fallback (Moved to the very end) ---
// Define Public Directory Path - this assumes server.js is in the root of the repository
var PUBLIC_DIR = path.join(__dirname, '/');
// Serve static files (CSS, JS, images, etc.) from the public directory
app.use(express["static"](PUBLIC_DIR));

// Explicitly serve HTML files for direct requests (e.g., typing URL into browser)
// It's generally better to have a single entry point (index.html) for SPAs
// and let client-side routing handle the rest. However, if direct access to these
// files is needed, this is how.
app.get('/', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});
app.get('/login.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'login.html'));
});
app.get('/register.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'register.html'));
});
app.get('/pricing.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'pricing.html'));
});
app.get('/suite-hub.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'suite-hub.html'));
});
app.get('/dashboard.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'dashboard.html'));
});
app.get('/checklists.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'checklists.html'));
});
app.get('/new-hire-view.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'new-hire-view.html'));
});
app.get('/hiring.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'hiring.html'));
});
app.get('/scheduling.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'scheduling.html'));
});
app.get('/sales-analytics.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'sales-analytics.html'));
});
app.get('/documents.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'documents.html'));
});
app.get('/account.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'account.html'));
});
app.get('/admin.html', function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'admin.html'));
});

// SPA Fallback: For any other GET request not handled by an API route or explicit file route,
// serve index.html. This is crucial for client-side routing.
// This should be the very last route for GET requests.
app.get(/'*'/, function (req, res) {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// --- Error Handling Middleware (Always last) ---
app.use(function (err, req, res, next) {
  console.error("Unhandled Error: ".concat(err.stack));
  res.status(500).json({
    error: 'An unexpected server error occurred. Please try again later.',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined // Only expose message in dev
  });
});

// --- Server Start ---
if (require.main === module) {
  app.listen(PORT, function () {
    console.log("Server is running successfully on http://localhost:".concat(PORT));
  });
} else {
  module.exports = app;
}
