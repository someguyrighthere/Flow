"use strict";

function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { if (r) i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n;else { var o = function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); }; o("next", 0), o("throw", 1), o("return", 2); } }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
// app.js - Client-Side JavaScript for Flow Business Suite
// This file handles all client-side logic, form submissions, and API requests.

// IMPORTANT: Set this to your deployed backend API URL.
// Your frontend is deployed at https://flow-gz1r.onrender.com/
// Assuming your backend API is accessible at the same root with '/api' suffix (as per server.js routes configuration).
var API_BASE_URL = 'https://flow-gz1r.onrender.com';

// Initialize Stripe.js with your public key
// This key should be retrieved from your backend or securely stored in your client-side config.
// The Stripe object is defined by the Stripe.js script loaded in pricing.html.
var stripe; // Declare as 'let' because it will be initialized conditionally

// Add a check to ensure Stripe is defined before initializing
if (typeof Stripe !== 'undefined') {
  stripe = Stripe('pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td');
} else {
  // This warning will appear on pages where Stripe is not expected/needed
  console.warn("Stripe.js not loaded. Stripe functionalities will not work on this page.");
}

/**
 * Displays a custom modal message to the user.
 * Ensure your HTML includes elements with ids: 'message-modal-overlay', 'modal-message-text', 'modal-close-button'
 * @param {string} message - The message to display.
 * @param {boolean} isError - True if it's an error message, false otherwise.
 */
function showModalMessage(message) {
  var isError = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  var modalOverlay = document.getElementById("message-modal-overlay");
  var modalMessage = document.getElementById("modal-message-text");
  var modalCloseButton = document.getElementById("modal-close-button");
  if (modalOverlay && modalMessage && modalCloseButton) {
    modalMessage.textContent = message;
    modalMessage.style.color = isError ? "#ff8a80" : "var(--text-light)";
    modalOverlay.style.display = "flex";
    modalOverlay.style.zIndex = "1000";
    modalCloseButton.onclick = function () {
      modalOverlay.style.display = "none";
    };
    modalOverlay.onclick = function (event) {
      if (event.target === modalOverlay) {
        modalOverlay.style.display = "none";
      }
    };
  } else {
    console.error("Modal elements not found for showModalMessage. Message:", message);
    if (isError) {
      console.error("ERROR: ".concat(message));
    } else {
      console.log("MESSAGE: ".concat(message));
    }
  }
}

/**
 * Displays a confirmation modal to the user.
 * Ensure your HTML includes elements with ids: 'confirm-modal-overlay', 'confirm-modal-message', 'modal-confirm', 'modal-cancel'
 * @param {string} message - The confirmation message to display.
 * @param {string} confirmButtonText - Text for the confirm button.
 * @returns {Promise<boolean>} - Resolves to true if confirmed, false if cancelled.
 */
function showConfirmModal(message) {
  var confirmButtonText = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "Confirm";
  return new Promise(function (resolve) {
    var confirmModalOverlay = document.getElementById("confirm-modal-overlay");
    var confirmModalMessage = document.getElementById("confirm-modal-message");
    var modalConfirmButton = document.getElementById("modal-confirm");
    var modalCancelButton = document.getElementById("modal-cancel");
    if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
      console.error("Confirmation modal elements not found. Falling back to native confirm.");
      resolve(window.confirm(message)); // Fallback is generally not ideal in production for consistent UX
      return;
    }
    confirmModalMessage.innerHTML = message; // Use innerHTML to allow for bolding etc.
    modalConfirmButton.textContent = confirmButtonText;
    confirmModalOverlay.style.display = "flex";
    var _handleConfirm = function handleConfirm() {
      confirmModalOverlay.style.display = "none";
      modalConfirmButton.removeEventListener("click", _handleConfirm);
      modalCancelButton.removeEventListener("click", _handleCancel);
      resolve(true);
    };
    var _handleCancel = function handleCancel() {
      confirmModalOverlay.style.display = "none";
      modalConfirmButton.removeEventListener("click", _handleConfirm);
      modalCancelButton.removeEventListener("click", _handleCancel);
      resolve(false);
    };
    modalConfirmButton.addEventListener("click", _handleConfirm);
    modalCancelButton.addEventListener("click", _handleCancel);
    confirmModalOverlay.onclick = function (event) {
      if (event.target === confirmModalOverlay) {
        _handleCancel();
      }
    };
  });
}

/**
 * Sets up the functionality for the settings dropdown menu.
 * This includes showing/hiding the dropdown and handling logout.
 */
function setupSettingsDropdown() {
  var settingsButton = document.getElementById("settings-button");
  var settingsDropdown = document.getElementById("settings-dropdown");
  var logoutButton = document.getElementById("logout-button");
  var upgradePlanLink = document.getElementById("upgrade-plan-link");
  if (settingsButton && settingsDropdown) {
    settingsButton.addEventListener("click", /*#__PURE__*/function () {
      var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(event) {
        var profile, _t;
        return _regenerator().w(function (_context) {
          while (1) switch (_context.n) {
            case 0:
              event.stopPropagation(); // Prevent the document click from immediately closing it
              settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";

              // Conditional logic for "Upgrade Plan" visibility
              if (!(settingsDropdown.style.display === "block" && upgradePlanLink)) {
                _context.n = 6;
                break;
              }
              if (!localStorage.getItem("authToken")) {
                _context.n = 5;
                break;
              }
              _context.p = 1;
              _context.n = 2;
              return apiRequest("GET", "/profile");
            case 2:
              profile = _context.v;
              if (profile && profile.plan_id === 'free') {
                upgradePlanLink.style.display = 'block';
              } else {
                upgradePlanLink.style.display = 'none';
              }
              _context.n = 4;
              break;
            case 3:
              _context.p = 3;
              _t = _context.v;
              console.error("Error fetching profile for upgrade link:", _t);
              upgradePlanLink.style.display = 'none';
            case 4:
              _context.n = 6;
              break;
            case 5:
              upgradePlanLink.style.display = 'none';
            case 6:
              return _context.a(2);
          }
        }, _callee, null, [[1, 3]]);
      }));
      return function (_x) {
        return _ref.apply(this, arguments);
      };
    }());
    // Close dropdown if user clicks outside
    document.addEventListener("click", function (event) {
      if (!settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
        settingsDropdown.style.display = "none";
      }
    });
  }
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userRole"); // Clear user role too
      window.location.href = "login.html"; // Redirect to login page
    });
  }
}

/**
 * Handles API requests to the backend.
 * Includes authentication token in headers if available.
 * Supports file uploads with progress tracking for FormData.
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE).
 * @param {string} path - API endpoint path (e.g., '/login', '/profile').
 * @param {object} body - Request body data (for POST, PUT).
 * @param {boolean} isFormData - Set to true if sending FormData (e.g., file uploads).
 * @param {function} onProgress - Callback function for upload progress (takes event as argument). Only used if isFormData is true.
 * @param {boolean} expectBlobResponse - Set to true if the API is expected to return a file (Blob).
 * @returns {Promise<object|Blob|null>} - JSON response data, Blob, or null if 204.
 * @throws {Error} - If the API response is not OK.
 */
function apiRequest(_x2, _x3) {
  return _apiRequest.apply(this, arguments);
}
/**
 * Handles all client-side logic for the login.html page.
 */
function _apiRequest() {
  _apiRequest = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee31(method, path) {
    var body,
      isFormData,
      onProgress,
      expectBlobResponse,
      token,
      endpoint,
      options,
      response,
      errorData,
      _args31 = arguments,
      _t30;
    return _regenerator().w(function (_context31) {
      while (1) switch (_context31.n) {
        case 0:
          body = _args31.length > 2 && _args31[2] !== undefined ? _args31[2] : null;
          isFormData = _args31.length > 3 && _args31[3] !== undefined ? _args31[3] : false;
          onProgress = _args31.length > 4 && _args31[4] !== undefined ? _args31[4] : null;
          expectBlobResponse = _args31.length > 5 && _args31[5] !== undefined ? _args31[5] : false;
          token = localStorage.getItem('authToken');
          endpoint = "".concat(API_BASE_URL).concat(path); // For FormData, use XMLHttpRequest for progress tracking
          if (!isFormData) {
            _context31.n = 1;
            break;
          }
          return _context31.a(2, new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) {
              xhr.setRequestHeader('Authorization', "Bearer ".concat(token));
            }

            // Progress event for uploads
            if (onProgress && xhr.upload) {
              xhr.upload.addEventListener('progress', onProgress);
            }
            xhr.onload = function () {
              if (xhr.status >= 200 && xhr.status < 300) {
                if (xhr.status === 204 || xhr.status === 200 && xhr.responseText.length === 0) {
                  resolve({}); // Resolve with empty object for 204 or empty 200
                } else {
                  try {
                    var responseData = JSON.parse(xhr.responseText);
                    resolve(responseData);
                  } catch (e) {
                    console.warn("API response was not JSON, resolving with success status:", xhr.responseText);
                    resolve({
                      message: "Operation successful",
                      rawResponse: xhr.responseText
                    });
                  }
                }
              } else if (xhr.status === 401 || xhr.status === 403) {
                // Unauthorized or Forbidden - clear token and redirect to login
                localStorage.removeItem('authToken');
                localStorage.removeItem('userRole');
                // window.location.href = 'login.html?sessionExpired=true'; // Cannot redirect in sandbox
                showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
                reject(new Error('Authentication token missing or invalid.'));
              } else {
                // Handle non-2xx responses
                try {
                  var errorData = JSON.parse(xhr.responseText);
                  reject(new Error(errorData.error || "HTTP error! Status: ".concat(xhr.status)));
                } catch (e) {
                  reject(new Error("HTTP error! Status: ".concat(xhr.status, " - ").concat(xhr.statusText || 'Unknown Error')));
                }
              }
            };
            xhr.onerror = function () {
              reject(new Error('Network error or request failed. Please check your internet connection.'));
            };
            xhr.send(body);
          }));
        case 1:
          // Use Fetch API for standard JSON or Blob requests
          options = {
            method: method,
            headers: {} // Start with empty headers to add Content-Type conditionally
          };
          if (token) {
            options.headers['Authorization'] = "Bearer ".concat(token);
          }

          // Set Content-Type for JSON bodies on POST/PUT
          if (body && (method === 'POST' || method === 'PUT')) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
          }
          _context31.n = 2;
          return fetch(endpoint, options);
        case 2:
          response = _context31.v;
          if (!(response.status === 401 || response.status === 403)) {
            _context31.n = 3;
            break;
          }
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          // window.location.href = 'login.html?sessionExpired=true'; // Cannot redirect in sandbox
          showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
          throw new Error('Authentication token missing or invalid.');
        case 3:
          if (response.ok) {
            _context31.n = 7;
            break;
          }
          _context31.p = 4;
          _context31.n = 5;
          return response.json();
        case 5:
          errorData = _context31.v;
          throw new Error(errorData.error || "HTTP error! Status: ".concat(response.status));
        case 6:
          _context31.p = 6;
          _t30 = _context31.v;
          throw new Error("HTTP error! Status: ".concat(response.status, " - ").concat(response.statusText || 'Unknown Error'));
        case 7:
          if (!expectBlobResponse) {
            _context31.n = 8;
            break;
          }
          return _context31.a(2, response.blob());
        case 8:
          if (!(response.status === 204 || response.status === 200 && response.headers.get("content-length") === "0")) {
            _context31.n = 9;
            break;
          }
          return _context31.a(2, null);
        case 9:
          return _context31.a(2, response.json());
        case 10:
          return _context31.a(2);
      }
    }, _callee31, null, [[4, 6]]);
  }));
  return _apiRequest.apply(this, arguments);
}
function handleLoginPage() {
  var loginForm = document.getElementById("login-form");
  if (!loginForm) {
    return;
  }
  var urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('sessionExpired') && urlParams.get('sessionExpired') === 'true') {
    var errorMessageDiv = document.getElementById("error-message");
    if (errorMessageDiv) {
      errorMessageDiv.textContent = 'Your session has expired or is invalid. Please log in again.';
      errorMessageDiv.classList.add('visible');
      errorMessageDiv.setAttribute('aria-hidden', 'false');
    }
    urlParams["delete"]('sessionExpired');
    window.history.replaceState({}, document.title, window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : ''));
  }
  loginForm.addEventListener("submit", /*#__PURE__*/function () {
    var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(e) {
      var emailInput, passwordInput, email, password, errorMessage, emailRegex, data, _t2;
      return _regenerator().w(function (_context2) {
        while (1) switch (_context2.n) {
          case 0:
            e.preventDefault();
            emailInput = document.getElementById("email");
            passwordInput = document.getElementById("password");
            email = emailInput.value.trim();
            password = passwordInput.value;
            errorMessage = document.getElementById("error-message");
            if (errorMessage) {
              errorMessage.textContent = "";
              errorMessage.classList.remove("visible");
              errorMessage.setAttribute('aria-hidden', 'true');
            }
            if (!(!email || !password)) {
              _context2.n = 1;
              break;
            }
            if (errorMessage) {
              errorMessage.textContent = "Email and password are required.";
              errorMessage.classList.add("visible");
              errorMessage.setAttribute('aria-hidden', 'false');
            }
            return _context2.a(2);
          case 1:
            emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(email)) {
              _context2.n = 2;
              break;
            }
            if (errorMessage) {
              errorMessage.textContent = "Please enter a valid email address.";
              errorMessage.classList.add("visible");
              errorMessage.setAttribute('aria-hidden', 'false');
            }
            return _context2.a(2);
          case 2:
            if (!(password.length < 6)) {
              _context2.n = 3;
              break;
            }
            if (errorMessage) {
              errorMessage.textContent = "Password must be at least 6 characters long.";
              errorMessage.classList.add("visible");
              errorMessage.setAttribute('aria-hidden', 'false');
            }
            return _context2.a(2);
          case 3:
            _context2.p = 3;
            _context2.n = 4;
            return apiRequest("POST", "/login", {
              email: email,
              password: password
            });
          case 4:
            data = _context2.v;
            localStorage.setItem("authToken", data.token);
            localStorage.setItem("userRole", data.role);
            if (data.role === "super_admin" || data.role === "location_admin") {
              window.location.href = "suite-hub.html";
            } else {
              window.location.href = "new-hire-view.html";
            }
            _context2.n = 6;
            break;
          case 5:
            _context2.p = 5;
            _t2 = _context2.v;
            console.error("Login API error:", _t2);
            if (errorMessage) {
              errorMessage.textContent = "Login Failed: ".concat(_t2.message);
              errorMessage.classList.add("visible");
              errorMessage.setAttribute('aria-hidden', 'false');
            }
            showModalMessage("Login Failed: ".concat(_t2.message), true);
          case 6:
            return _context2.a(2);
        }
      }, _callee2, null, [[3, 5]]);
    }));
    return function (_x4) {
      return _ref2.apply(this, arguments);
    };
  }());
}

/**
 * Handles all client-side logic for the register.html page.
 */
function handleRegisterPage() {
  var registerForm = document.getElementById("register-form");
  if (!registerForm) {
    return;
  }
  registerForm.addEventListener("submit", /*#__PURE__*/function () {
    var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(e) {
      var companyNameInput, fullNameInput, emailInput, passwordInput, errorMessage, company_name, full_name, email, password, emailRegex, data, _t3;
      return _regenerator().w(function (_context3) {
        while (1) switch (_context3.n) {
          case 0:
            e.preventDefault();
            companyNameInput = document.getElementById("company-name");
            fullNameInput = document.getElementById("full-name");
            emailInput = document.getElementById("email");
            passwordInput = document.getElementById("password");
            errorMessage = document.getElementById("error-message");
            company_name = companyNameInput.value.trim();
            full_name = fullNameInput.value.trim();
            email = emailInput.value.trim();
            password = passwordInput.value;
            errorMessage.textContent = "";
            errorMessage.classList.remove("visible");
            errorMessage.setAttribute('aria-hidden', 'true');
            emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!(!company_name || !full_name || !email || !password || password.length < 6 || !emailRegex.test(email))) {
              _context3.n = 1;
              break;
            }
            errorMessage.textContent = "Please fill all fields correctly. Password must be at least 6 characters and email valid.";
            errorMessage.classList.add("visible");
            return _context3.a(2);
          case 1:
            _context3.p = 1;
            _context3.n = 2;
            return apiRequest("POST", "/register", {
              company_name: company_name,
              full_name: full_name,
              email: email,
              password: password
            });
          case 2:
            data = _context3.v;
            showModalMessage("Account created successfully! Please log in.", false);
            companyNameInput.value = "";
            fullNameInput.value = "";
            emailInput.value = "";
            passwordInput.value = "";
            setTimeout(function () {
              window.location.href = "login.html";
            }, 2000);
            _context3.n = 4;
            break;
          case 3:
            _context3.p = 3;
            _t3 = _context3.v;
            console.error("Registration API error:", _t3);
            if (errorMessage) {
              errorMessage.textContent = "Registration Failed: ".concat(_t3.message);
              errorMessage.classList.add("visible");
              errorMessage.setAttribute('aria-hidden', 'false');
            }
            showModalMessage("Registration Failed: ".concat(_t3.message), true);
          case 4:
            return _context3.a(2);
        }
      }, _callee3, null, [[1, 3]]);
    }));
    return function (_x5) {
      return _ref3.apply(this, arguments);
    };
  }());
}

/**
 * Handles logic for the suite-hub.html page, including payment status messages.
 */
function handleSuiteHubPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var urlParams = new URLSearchParams(window.location.search);
  var paymentStatus = urlParams.get("payment");
  var sessionId = urlParams.get("session_id");
  if (paymentStatus === "success") {
    showModalMessage("Payment successful! Your subscription has been updated.", false);
    history.replaceState({}, document.title, window.location.pathname);
  } else if (paymentStatus === "cancelled") {
    showModalMessage("Payment cancelled. You can try again or choose another plan.", true);
    history.replaceState({}, document.title, window.location.pathname);
  }
}

/**
 * Handles all client-side logic for the account.html page.
 */
function handleAccountPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var displayProfileName = document.getElementById("display-profile-name");
  var displayProfileEmail = document.getElementById("display-profile-email");
  var profileNameInput = document.getElementById("profile-name");
  var profileEmailInput = document.getElementById("profile-email");
  var updateProfileForm = document.getElementById("update-profile-form");
  var currentPasswordInput = document.getElementById("current-password");
  var newPasswordInput = document.getElementById("new-password");
  function loadProfileInfo() {
    return _loadProfileInfo.apply(this, arguments);
  }
  function _loadProfileInfo() {
    _loadProfileInfo = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5() {
      var profile, _t5;
      return _regenerator().w(function (_context5) {
        while (1) switch (_context5.n) {
          case 0:
            _context5.p = 0;
            _context5.n = 1;
            return apiRequest("GET", "/profile");
          case 1:
            profile = _context5.v;
            if (displayProfileName) displayProfileName.textContent = profile.fullName || "N/A";
            if (profileEmailInput) profileEmailInput.value = profile.email || "";
            _context5.n = 3;
            break;
          case 2:
            _context5.p = 2;
            _t5 = _context5.v;
            console.error("Error loading profile info:", _t5);
            showModalMessage("Failed to load profile: ".concat(_t5.message), true);
          case 3:
            return _context5.a(2);
        }
      }, _callee5, null, [[0, 2]]);
    }));
    return _loadProfileInfo.apply(this, arguments);
  }
  if (updateProfileForm) {
    updateProfileForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4(e) {
        var fullName, email, currentPassword, newPassword, updatePayload, result, _t4;
        return _regenerator().w(function (_context4) {
          while (1) switch (_context4.n) {
            case 0:
              e.preventDefault();
              fullName = profileNameInput ? profileNameInput.value : "";
              email = profileEmailInput ? profileEmailInput.value : "";
              currentPassword = currentPasswordInput ? currentPasswordInput.value : "";
              newPassword = newPasswordInput ? newPasswordInput.value : "";
              updatePayload = {
                fullName: fullName,
                email: email
              };
              if (currentPassword && newPassword) {
                updatePayload.currentPassword = currentPassword;
                updatePayload.newPassword = newPassword;
              }
              _context4.p = 1;
              _context4.n = 2;
              return apiRequest("PUT", "/profile", updatePayload);
            case 2:
              result = _context4.v;
              if (result && result.token) {
                localStorage.setItem("authToken", result.token);
              }
              showModalMessage(result.message || "Profile updated successfully!", false);
              if (currentPasswordInput) currentPasswordInput.value = "";
              if (newPasswordInput) newPasswordInput.value = "";
              loadProfileInfo();
              _context4.n = 4;
              break;
            case 3:
              _context4.p = 3;
              _t4 = _context4.v;
              console.error("Error updating profile:", _t4);
              showModalMessage("Failed to update profile: ".concat(_t4.message), true);
            case 4:
              return _context4.a(2);
          }
        }, _callee4, null, [[1, 3]]);
      }));
      return function (_x6) {
        return _ref4.apply(this, arguments);
      };
    }());
  }
  loadProfileInfo();
}

/**
 * Handles all client-side logic for the admin.html page.
 */
function handleAdminPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var locationListDiv = document.getElementById("location-list");
  var userListDiv = document.getElementById("user-list");
  var newLocationForm = document.getElementById("new-location-form");
  var inviteAdminForm = document.getElementById("invite-admin-form");
  var inviteEmployeeForm = document.getElementById("invite-employee-form");
  var adminLocationSelect = document.getElementById("admin-location-select");
  var employeeLocationSelect = document.getElementById("employee-location-select");
  function loadLocations() {
    return _loadLocations.apply(this, arguments);
  }
  function _loadLocations() {
    _loadLocations = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7() {
      var locations, locationOptionsHtml, _t7;
      return _regenerator().w(function (_context7) {
        while (1) switch (_context7.n) {
          case 0:
            if (locationListDiv) {
              _context7.n = 1;
              break;
            }
            return _context7.a(2);
          case 1:
            locationListDiv.innerHTML = "<p>Loading locations...</p>";
            _context7.p = 2;
            _context7.n = 3;
            return apiRequest("GET", "/locations");
          case 3:
            locations = _context7.v;
            locationListDiv.innerHTML = "";
            if (locations.length === 0) {
              locationListDiv.innerHTML = '<p style="color: var(--text-medium);">No locations created yet.</p>';
              if (adminLocationSelect) {
                adminLocationSelect.innerHTML = '<option value="">Select a location</option>';
                adminLocationSelect.disabled = true;
              }
              if (employeeLocationSelect) {
                employeeLocationSelect.innerHTML = '<option value="">Select a location</option>';
                employeeLocationSelect.disabled = true;
              }
            } else {
              if (adminLocationSelect) adminLocationSelect.disabled = false;
              if (employeeLocationSelect) employeeLocationSelect.disabled = false;
              locations.forEach(function (loc) {
                var locDiv = document.createElement("div");
                locDiv.className = "list-item";
                locDiv.innerHTML = "<span>".concat(loc.location_name, " - ").concat(loc.location_address, "</span>\n                                        <button class=\"btn-delete\" data-type=\"location\" data-id=\"").concat(loc.location_id, "\">\n                                            <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" viewBox=\"0 0 16 16\"><path d=\"M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z\"/><path d=\"M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z\"/></svg>\n                                        </button>");
                locDiv.addEventListener("click", function (e) {
                  if (!e.target.closest(".btn-delete")) {
                    showModalMessage("Location: ".concat(loc.location_name, " (ID: ").concat(loc.location_id, ") - Address: ").concat(loc.location_address), false);
                  }
                });
                locationListDiv.appendChild(locDiv);
              });
              locationOptionsHtml = locations.map(function (loc) {
                return "<option value=\"".concat(loc.location_id, "\">").concat(loc.location_name, "</option>");
              }).join('');
              if (adminLocationSelect) {
                adminLocationSelect.innerHTML = "<option value=\"\">Select a location</option>".concat(locationOptionsHtml);
              }
              if (employeeLocationSelect) {
                employeeLocationSelect.innerHTML = "<option value=\"\">Select a location</option>".concat(locationOptionsHtml);
              }
            }
            _context7.n = 5;
            break;
          case 4:
            _context7.p = 4;
            _t7 = _context7.v;
            console.error("Error loading locations:", _t7);
            showModalMessage("Failed to load locations: ".concat(_t7.message), true);
          case 5:
            return _context7.a(2);
        }
      }, _callee7, null, [[2, 4]]);
    }));
    return _loadLocations.apply(this, arguments);
  }
  function loadUsers() {
    return _loadUsers.apply(this, arguments);
  }
  function _loadUsers() {
    _loadUsers = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8() {
      var users, _t8;
      return _regenerator().w(function (_context8) {
        while (1) switch (_context8.n) {
          case 0:
            if (userListDiv) {
              _context8.n = 1;
              break;
            }
            return _context8.a(2);
          case 1:
            userListDiv.innerHTML = "<p>Loading users...</p>";
            _context8.p = 2;
            _context8.n = 3;
            return apiRequest("GET", "/users");
          case 3:
            users = _context8.v;
            userListDiv.innerHTML = "";
            if (users.length === 0) {
              userListDiv.innerHTML = '<p style="color: var(--text-medium);">No users invited yet.</p>';
            } else {
              users.forEach(function (user) {
                var userDiv = document.createElement("div");
                userDiv.className = "list-item";
                var userInfo = "".concat(user.full_name, " - Role: ").concat(user.role);
                if (user.location_name) {
                  userInfo += " @ ".concat(user.location_name);
                }
                userDiv.innerHTML = "<span>".concat(userInfo, "</span>\n                                         <button class=\"btn-delete\" data-type=\"user\" data-id=\"").concat(user.user_id, "\">\n                                             <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" viewBox=\"0 0 16 16\"><path d=\"M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z\"/><path d=\"M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z\"/></svg>\n                                         </button>");
                userListDiv.appendChild(userDiv);
              });
            }
            _context8.n = 5;
            break;
          case 4:
            _context8.p = 4;
            _t8 = _context8.v;
            console.error("Error loading users:", _t8);
            userListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error loading users: ".concat(_t8.message, "</p>");
          case 5:
            return _context8.a(2);
        }
      }, _callee8, null, [[2, 4]]);
    }));
    return _loadUsers.apply(this, arguments);
  }
  document.body.addEventListener("click", /*#__PURE__*/function () {
    var _ref5 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(e) {
      var targetButton, id, type, confirmationMessage, confirmed, _t6;
      return _regenerator().w(function (_context6) {
        while (1) switch (_context6.n) {
          case 0:
            targetButton = e.target.closest(".btn-delete");
            if (!targetButton) {
              _context6.n = 16;
              break;
            }
            id = targetButton.dataset.id;
            type = targetButton.dataset.type;
            confirmationMessage = "Are you sure you want to delete this ".concat(type, "? This action cannot be undone.");
            _context6.n = 1;
            return showConfirmModal(confirmationMessage, "Delete");
          case 1:
            confirmed = _context6.v;
            if (!confirmed) {
              _context6.n = 16;
              break;
            }
            _context6.p = 2;
            if (!(type === "location")) {
              _context6.n = 4;
              break;
            }
            _context6.n = 3;
            return apiRequest("DELETE", "/locations/".concat(id));
          case 3:
            showModalMessage("Location deleted successfully!", false);
            loadLocations();
            loadUsers();
            _context6.n = 14;
            break;
          case 4:
            if (!(type === "user")) {
              _context6.n = 6;
              break;
            }
            _context6.n = 5;
            return apiRequest("DELETE", "/users/".concat(id));
          case 5:
            showModalMessage("User deleted successfully!", false);
            loadUsers();
            _context6.n = 14;
            break;
          case 6:
            if (!(type === "document")) {
              _context6.n = 8;
              break;
            }
            _context6.n = 7;
            return apiRequest("DELETE", "/documents/".concat(id));
          case 7:
            showModalMessage("Document deleted successfully!", false);
            handleDocumentsPage();
            _context6.n = 14;
            break;
          case 8:
            if (!(type === "checklist")) {
              _context6.n = 10;
              break;
            }
            _context6.n = 9;
            return apiRequest("DELETE", "/checklists/".concat(id));
          case 9:
            showModalMessage("Task list deleted successfully!", false);
            handleChecklistsPage(); // Reload checklists if on checklists page
            _context6.n = 14;
            break;
          case 10:
            if (!(type === "job-posting")) {
              _context6.n = 12;
              break;
            }
            _context6.n = 11;
            return apiRequest("DELETE", "/job-postings/".concat(id));
          case 11:
            showModalMessage("Job posting deleted successfully!", false);
            handleHiringPage();
            _context6.n = 14;
            break;
          case 12:
            if (!(type === "schedule")) {
              _context6.n = 14;
              break;
            }
            _context6.n = 13;
            return apiRequest("DELETE", "/schedules/".concat(id));
          case 13:
            showModalMessage("Schedule deleted successfully!", false);
            handleSchedulingPage();
          case 14:
            _context6.n = 16;
            break;
          case 15:
            _context6.p = 15;
            _t6 = _context6.v;
            showModalMessage("Error deleting ".concat(type, ": ").concat(_t6.message), true);
          case 16:
            return _context6.a(2);
        }
      }, _callee6, null, [[2, 15]]);
    }));
    return function (_x7) {
      return _ref5.apply(this, arguments);
    };
  }());

  // Initial loads when the admin page loads
  loadLocations();
  loadUsers();
}

/**
 * Handles logic for the dashboard.html page (Onboarding Dashboard).
 */
function handleDashboardPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var onboardUserModal = document.getElementById("onboard-user-modal");
  var showOnboardModalBtn = document.getElementById("show-onboard-modal-btn");
  var modalCancelOnboardBtn = document.getElementById("modal-cancel-onboard");
  var onboardUserForm = document.getElementById("onboard-user-form");
  var newHirePositionSelect = document.getElementById("new-hire-position");
  var sessionListDiv = document.getElementById("session-list");
  if (showOnboardModalBtn) {
    showOnboardModalBtn.addEventListener("click", function () {
      if (onboardUserModal) {
        onboardUserModal.style.display = "flex";
      }
    });
  }
  if (modalCancelOnboardBtn) {
    modalCancelOnboardBtn.addEventListener("click", function () {
      if (onboardUserModal) {
        onboardUserModal.style.display = "none";
      }
    });
  }
  if (onboardUserModal) {
    onboardUserModal.addEventListener("click", function (event) {
      if (event.target === onboardUserModal) {
        onboardUserModal.style.display = "none";
      }
    });
  }
  function loadPositions() {
    return _loadPositions.apply(this, arguments);
  }
  function _loadPositions() {
    _loadPositions = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee0() {
      var response, _t0;
      return _regenerator().w(function (_context0) {
        while (1) switch (_context0.n) {
          case 0:
            if (newHirePositionSelect) {
              _context0.n = 1;
              break;
            }
            return _context0.a(2);
          case 1:
            newHirePositionSelect.innerHTML = '<option value="">Loading positions...</option>';
            _context0.p = 2;
            _context0.n = 3;
            return apiRequest("GET", "/positions");
          case 3:
            response = _context0.v;
            newHirePositionSelect.innerHTML = '<option value="">Select Position</option>';
            if (response && response.positions && response.positions.length > 0) {
              response.positions.forEach(function (pos) {
                var option = document.createElement("option");
                option.value = pos.id;
                option.textContent = pos.name;
                newHirePositionSelect.appendChild(option);
              });
            } else {
              newHirePositionSelect.innerHTML = '<option value="">No positions available</option>';
            }
            _context0.n = 5;
            break;
          case 4:
            _context0.p = 4;
            _t0 = _context0.v;
            console.error("Error loading positions:", _t0);
            newHirePositionSelect.innerHTML = '<option value="">Error loading positions</option>';
            showModalMessage("Failed to load positions: ".concat(_t0.message), true);
          case 5:
            return _context0.a(2);
        }
      }, _callee0, null, [[2, 4]]);
    }));
    return _loadPositions.apply(this, arguments);
  }
  function loadOnboardingSessions() {
    return _loadOnboardingSessions.apply(this, arguments);
  }
  function _loadOnboardingSessions() {
    _loadOnboardingSessions = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee10() {
      var sessions, _t10;
      return _regenerator().w(function (_context10) {
        while (1) switch (_context10.n) {
          case 0:
            if (sessionListDiv) {
              _context10.n = 1;
              break;
            }
            return _context10.a(2);
          case 1:
            sessionListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading active onboardings...</p>';
            _context10.p = 2;
            _context10.n = 3;
            return apiRequest("GET", "/onboarding-sessions");
          case 3:
            sessions = _context10.v;
            sessionListDiv.innerHTML = '';
            if (sessions && sessions.length > 0) {
              sessions.forEach(function (session) {
                var sessionItem = document.createElement("div");
                sessionItem.className = "onboarding-item";
                var completionStatus = session.completedTasks === session.totalTasks ? 'Completed' : "".concat(session.completedTasks, "/").concat(session.totalTasks, " Tasks Completed");
                var statusColor = session.completedTasks === session.totalTasks ? 'var(--primary-accent)' : 'var(--text-medium)';
                sessionItem.innerHTML = "\n                        <div class=\"onboarding-item-info\">\n                            <p style=\"color: var(--text-light); font-weight: 600;\">".concat(session.full_name, " (").concat(session.position || 'N/A', ")</p>\n                            <p style=\"color: var(--text-medium);\">Email: ").concat(session.email, "</p>\n                            <p style=\"color: ").concat(statusColor, ";\">Status: ").concat(completionStatus, "</p>\n                        </div>\n                        <div class=\"onboarding-item-actions\">\n                            <button class=\"btn btn-secondary btn-sm view-details-btn\" data-user-id=\"").concat(session.user_id, "\">View Progress</button>\n                            ").concat(session.completedTasks === session.totalTasks ? "<button class=\"btn btn-primary btn-sm archive-onboarding-btn\" data-session-id=\"".concat(session.session_id, "\">Archive</button>") : '', "\n                        </div>\n                    ");
                sessionListDiv.appendChild(sessionItem);
              });
              sessionListDiv.querySelectorAll('.view-details-btn').forEach(function (button) {
                button.addEventListener('click', function (event) {
                  var userId = event.target.dataset.userId;
                  window.location.href = "new-hire-view.html?userId=".concat(userId);
                });
              });
              sessionListDiv.querySelectorAll('.archive-onboarding-btn').forEach(function (button) {
                button.addEventListener('click', /*#__PURE__*/function () {
                  var _ref7 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee1(event) {
                    var sessionId, confirmed, _t1;
                    return _regenerator().w(function (_context1) {
                      while (1) switch (_context1.n) {
                        case 0:
                          sessionId = event.target.dataset.sessionId;
                          _context1.n = 1;
                          return showConfirmModal('Are you sure you want to archive this onboarding session?');
                        case 1:
                          confirmed = _context1.v;
                          if (!confirmed) {
                            _context1.n = 5;
                            break;
                          }
                          _context1.p = 2;
                          _context1.n = 3;
                          return apiRequest("PUT", "/onboarding-sessions/".concat(sessionId, "/archive"));
                        case 3:
                          showModalMessage('Onboarding session archived successfully!', false);
                          loadOnboardingSessions();
                          _context1.n = 5;
                          break;
                        case 4:
                          _context1.p = 4;
                          _t1 = _context1.v;
                          showModalMessage("Failed to archive session: ".concat(_t1.message), true);
                        case 5:
                          return _context1.a(2);
                      }
                    }, _callee1, null, [[2, 4]]);
                  }));
                  return function (_x9) {
                    return _ref7.apply(this, arguments);
                  };
                }());
              });
            } else {
              sessionListDiv.innerHTML = '<p style="color: var(--text-medium);">No active onboardings.</p>';
            }
            _context10.n = 5;
            break;
          case 4:
            _context10.p = 4;
            _t10 = _context10.v;
            console.error("Error loading onboarding sessions:", _t10);
            sessionListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error loading onboarding sessions: ".concat(_t10.message, "</p>");
          case 5:
            return _context10.a(2);
        }
      }, _callee10, null, [[2, 4]]);
    }));
    return _loadOnboardingSessions.apply(this, arguments);
  }
  if (onboardUserForm) {
    onboardUserForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref6 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee9(e) {
        var newHireName, newHireEmail, newHirePosition, newHireId, response, _t9;
        return _regenerator().w(function (_context9) {
          while (1) switch (_context9.n) {
            case 0:
              e.preventDefault();
              newHireName = document.getElementById("new-hire-name").value.trim();
              newHireEmail = document.getElementById("new-hire-email").value.trim();
              newHirePosition = newHirePositionSelect ? newHirePositionSelect.value : "";
              newHireId = document.getElementById("new-hire-id").value.trim();
              if (!(!newHireName || !newHireEmail || !newHirePosition)) {
                _context9.n = 1;
                break;
              }
              showModalMessage("Please fill all required fields: Full Name, Email, and Position.", true);
              return _context9.a(2);
            case 1:
              if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newHireEmail)) {
                _context9.n = 2;
                break;
              }
              showModalMessage("Please enter a valid email address.", true);
              return _context9.a(2);
            case 2:
              _context9.p = 2;
              _context9.n = 3;
              return apiRequest("POST", "/onboard-employee", {
                full_name: newHireName,
                email: newHireEmail,
                position_id: newHirePosition,
                employee_id: newHireId || null
              });
            case 3:
              response = _context9.v;
              showModalMessage("Onboarding invite sent to ".concat(newHireEmail, " for position ").concat(newHirePosition, "."), false);
              onboardUserForm.reset();
              if (onboardUserModal) onboardUserModal.style.display = "none";
              loadOnboardingSessions();
              _context9.n = 5;
              break;
            case 4:
              _context9.p = 4;
              _t9 = _context9.v;
              showModalMessage("Error onboarding employee: ".concat(_t9.message), true);
            case 5:
              return _context9.a(2);
          }
        }, _callee9, null, [[2, 4]]);
      }));
      return function (_x8) {
        return _ref6.apply(this, arguments);
      };
    }());
  }
  loadPositions();
  loadOnboardingSessions();
}

/**
 * Handles logic for checklists.html page.
 */
function handleChecklistsPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var checklistListDiv = document.getElementById("checklist-list");
  var newChecklistForm = document.getElementById("new-checklist-form");
  var structureTypeSelect = document.getElementById("structure-type-select");
  var timeGroupCountContainer = document.getElementById("time-group-count-container");
  var timeGroupCountInput = document.getElementById("time-group-count");
  var timeGroupCountLabel = document.getElementById("time-group-count-label");
  var tasksInputArea = document.getElementById("tasks-input-area");
  var taskCounter = 0;
  function addSingleTaskInput(container) {
    var taskId = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;
    var taskText = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : '';
    var div = document.createElement('div');
    div.className = 'form-group task-input-group';
    div.innerHTML = "\n            <label for=\"task-".concat(taskId || taskCounter, "\">Task Description</label>\n            <input type=\"text\" id=\"task-").concat(taskId || taskCounter, "\" class=\"task-description-input\" value=\"").concat(taskText, "\" placeholder=\"e.g., Complete HR paperwork\" required>\n            <button type=\"button\" class=\"btn btn-secondary remove-task-btn\" style=\"margin-top: 5px;\">Remove</button>\n        ");
    container.appendChild(div);
    div.querySelector('.remove-task-btn').addEventListener('click', function () {
      div.remove();
    });
    taskCounter++;
  }
  function renderTaskInputs() {
    tasksInputArea.innerHTML = '';
    var structureType = structureTypeSelect.value;
    var groupCount = parseInt(timeGroupCountInput.value, 10) || 1;
    if (structureType === 'single_list') {
      addSingleTaskInput(tasksInputArea);
      var addTaskBtn = document.createElement('button');
      addTaskBtn.type = 'button';
      addTaskBtn.className = 'btn btn-secondary';
      addTaskBtn.textContent = 'Add Another Task +';
      addTaskBtn.style.marginTop = '10px';
      addTaskBtn.addEventListener('click', function () {
        return addSingleTaskInput(tasksInputArea);
      });
      tasksInputArea.appendChild(addTaskBtn);
    } else {
      for (var i = 0; i < groupCount; i++) {
        var groupTitle = structureType === 'daily' ? "Day ".concat(i + 1) : "Week ".concat(i + 1);
        var groupContainer = document.createElement('div');
        groupContainer.className = 'card time-group-container';
        groupContainer.innerHTML = "\n                    <h4 style=\"color: var(--text-light); margin-top: 0;'>".concat(groupTitle, "</h4>\n                    <div class=\"tasks-in-group\" data-group-index=\"").concat(i, "\"></div>\n                    <button type=\"button\" class=\"btn btn-secondary add-task-to-group-btn\" style=\"margin-top: 10px;\" data-group-index=\"").concat(i, "\">Add Task to ").concat(groupTitle, " +</button>\n                ");
        tasksInputArea.appendChild(groupContainer);
        var tasksInGroupDiv = groupContainer.querySelector('.tasks-in-group');
        addSingleTaskInput(tasksInGroupDiv);
        groupContainer.querySelector('.add-task-to-group-btn').addEventListener('click', function (event) {
          var targetGroupIndex = event.target.dataset.groupIndex;
          var targetGroupDiv = tasksInputArea.querySelector(".tasks-in-group[data-group-index=\"".concat(targetGroupIndex, "\"]"));
          if (targetGroupDiv) {
            addSingleTaskInput(targetGroupDiv);
          }
        });
      }
    }
  }
  if (structureTypeSelect) {
    structureTypeSelect.addEventListener('change', function () {
      var type = structureTypeSelect.value;
      if (type === 'daily' || type === 'weekly') {
        timeGroupCountContainer.style.display = 'block';
        timeGroupCountLabel.textContent = "Number of ".concat(type === 'daily' ? 'Days' : 'Weeks');
      } else {
        timeGroupCountContainer.style.display = 'none';
      }
      renderTaskInputs();
    });
  }
  if (timeGroupCountInput) {
    timeGroupCountInput.addEventListener('input', renderTaskInputs);
  }
  renderTaskInputs();
  function loadChecklists() {
    return _loadChecklists.apply(this, arguments);
  }
  function _loadChecklists() {
    _loadChecklists = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee12() {
      var checklists, _t12;
      return _regenerator().w(function (_context12) {
        while (1) switch (_context12.n) {
          case 0:
            if (checklistListDiv) {
              _context12.n = 1;
              break;
            }
            return _context12.a(2);
          case 1:
            checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading task lists...</p>';
            _context12.p = 2;
            _context12.n = 3;
            return apiRequest("GET", "/checklists");
          case 3:
            checklists = _context12.v;
            checklistListDiv.innerHTML = '';
            if (checklists && checklists.length > 0) {
              checklists.forEach(function (checklist) {
                var checklistItem = document.createElement("div");
                checklistItem.className = "checklist-item";
                checklistItem.innerHTML = "\n                        <div class=\"checklist-item-title\">\n                            <span style=\"color: var(--primary-accent);\">".concat(checklist.position, "</span>\n                            <span>- ").concat(checklist.title, "</span>\n                            <span style=\"font-size: 0.8em; color: var(--text-medium);\">(").concat(checklist.structure_type, ")</span>\n                        </div>\n                        <div class=\"checklist-item-actions\">\n                            <button class=\"btn btn-secondary btn-sm view-checklist-btn\" data-checklist-id=\"").concat(checklist.id, "\">View/Edit</button>\n                            <button class=\"btn-delete\" data-type=\"checklist\" data-id=\"").concat(checklist.id, "\">\n                                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" viewBox=\"0 0 16 16\"><path d=\"M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z\"/><path d=\"M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z\"/></svg>\n                            </button>\n                        </div>\n                    ");
                // FIX: Append to the correct parent div
                checklistListDiv.appendChild(checklistItem);
              });
              checklistListDiv.querySelectorAll('.view-checklist-btn').forEach(function (button) {
                button.addEventListener('click', function (event) {
                  var checklistId = event.target.dataset.checklistId;
                  showModalMessage("Viewing/Editing Checklist ID: ".concat(checklistId, " (Functionality to be implemented)"), false);
                });
              });
            } else {
              checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">No task lists created yet.</p>';
            }
            _context12.n = 5;
            break;
          case 4:
            _context12.p = 4;
            _t12 = _context12.v;
            console.error("Error loading checklists:", _t12);
            checklistListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error loading task lists: ".concat(_t12.message, "</p>");
          case 5:
            return _context12.a(2);
        }
      }, _callee12, null, [[2, 4]]);
    }));
    return _loadChecklists.apply(this, arguments);
  }
  if (newChecklistForm) {
    newChecklistForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref8 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee11(e) {
        var position, title, structure_type, group_count, tasks, response, _t11;
        return _regenerator().w(function (_context11) {
          while (1) switch (_context11.n) {
            case 0:
              e.preventDefault();
              position = document.getElementById("new-checklist-position").value.trim();
              title = document.getElementById("new-checklist-title").value.trim();
              structure_type = structureTypeSelect.value;
              group_count = structure_type === 'daily' || structure_type === 'weekly' ? parseInt(timeGroupCountInput.value, 10) : 0;
              tasks = [];
              if (structure_type === 'single_list') {
                document.querySelectorAll('#tasks-input-area .task-description-input').forEach(function (input) {
                  if (input.value.trim()) {
                    tasks.push({
                      description: input.value.trim(),
                      completed: false
                    });
                  }
                });
              } else {
                document.querySelectorAll('#tasks-input-area .tasks-in-group').forEach(function (groupDiv, index) {
                  var groupTasks = [];
                  groupDiv.querySelectorAll('.task-description-input').forEach(function (input) {
                    if (input.value.trim()) {
                      groupTasks.push({
                        description: input.value.trim(),
                        completed: false
                      });
                    }
                  });
                  tasks.push({
                    groupTitle: structure_type === 'daily' ? "Day ".concat(index + 1) : "Week ".concat(index + 1),
                    tasks: groupTasks
                  });
                });
              }
              if (!(!position || !title || tasks.length === 0 || structure_type !== 'single_list' && tasks.every(function (group) {
                return group.tasks.length === 0;
              }))) {
                _context11.n = 1;
                break;
              }
              showModalMessage("Please provide a position, title, and at least one task for the checklist.", true);
              return _context11.a(2);
            case 1:
              _context11.p = 1;
              _context11.n = 2;
              return apiRequest("POST", "/checklists", {
                position: position,
                title: title,
                structure_type: structure_type,
                group_count: group_count,
                tasks: tasks
              });
            case 2:
              response = _context11.v;
              showModalMessage("Task List \"".concat(title, "\" created successfully!"), false);
              newChecklistForm.reset();
              renderTaskInputs();
              loadChecklists();
              _context11.n = 4;
              break;
            case 3:
              _context11.p = 3;
              _t11 = _context11.v;
              showModalMessage("Error creating task list: ".concat(_t11.message), true);
            case 4:
              return _context11.a(2);
          }
        }, _callee11, null, [[1, 3]]);
      }));
      return function (_x0) {
        return _ref8.apply(this, arguments);
      };
    }());
  }
  loadChecklists();
}

/**
 * Handles logic for new-hire-view.html (Employee Onboarding View).
 */
function handleNewHireViewPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var welcomeHeading = document.getElementById("welcome-heading");
  var taskListSection = document.getElementById("task-list-section");
  var logoutButton = document.getElementById("logout-button");
  var completionCelebration = document.getElementById("completion-celebration");
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userRole");
      window.location.href = "login.html";
    });
  }
  function triggerFireworks() {
    console.log("Triggering fireworks celebration!");
    if (completionCelebration) {
      completionCelebration.style.display = 'flex';
      setTimeout(function () {
        completionCelebration.style.display = 'none';
      }, 5000);
    }
  }
  function loadOnboardingTasks() {
    return _loadOnboardingTasks.apply(this, arguments);
  }
  function _loadOnboardingTasks() {
    _loadOnboardingTasks = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee14() {
      var profile, tasksData, checklist, allTasksCompleted, _t14;
      return _regenerator().w(function (_context14) {
        while (1) switch (_context14.n) {
          case 0:
            if (taskListSection) {
              _context14.n = 1;
              break;
            }
            return _context14.a(2);
          case 1:
            taskListSection.innerHTML = '<p style="color: var(--text-medium);">Loading your tasks...</p>';
            _context14.p = 2;
            _context14.n = 3;
            return apiRequest("GET", "/profile");
          case 3:
            profile = _context14.v;
            if (!(!profile || !profile.user_id)) {
              _context14.n = 4;
              break;
            }
            taskListSection.innerHTML = '<p style="color: #e74c3c;">Could not load user profile.</p>';
            return _context14.a(2);
          case 4:
            welcomeHeading.textContent = "Welcome, ".concat(profile.full_name, "!");
            _context14.n = 5;
            return apiRequest("GET", "/onboarding-tasks/".concat(profile.user_id));
          case 5:
            tasksData = _context14.v;
            taskListSection.innerHTML = '';
            if (tasksData && tasksData.checklist && tasksData.checklist.tasks) {
              checklist = tasksData.checklist;
              allTasksCompleted = true;
              if (checklist.structure_type === 'single_list') {
                tasksData.tasks.forEach(function (task) {
                  var taskItem = document.createElement("div");
                  taskItem.className = "task-item ".concat(task.completed ? 'completed' : '');
                  taskItem.innerHTML = "\n                            <input type=\"checkbox\" id=\"task-".concat(task.id, "\" ").concat(task.completed ? 'checked' : '', " data-task-id=\"").concat(task.id, "\" data-task-type=\"single\">\n                            <label for=\"task-").concat(task.id, "\">").concat(task.description, "</label>\n                        ");
                  taskListSection.appendChild(taskItem);
                  if (!task.completed) allTasksCompleted = false;
                });
              } else {
                tasksData.tasks.forEach(function (group, groupIndex) {
                  var taskGroupDetails = document.createElement('details');
                  taskGroupDetails.className = 'task-group';
                  taskGroupDetails.open = true;
                  var summary = document.createElement('summary');
                  summary.textContent = group.groupTitle;
                  taskGroupDetails.appendChild(summary);
                  group.tasks.forEach(function (task) {
                    var taskItem = document.createElement("div");
                    taskItem.className = "task-item ".concat(task.completed ? 'completed' : '');
                    taskItem.innerHTML = "\n                                <input type=\"checkbox\" id=\"task-".concat(task.id, "\" ").concat(task.completed ? 'checked' : '', " data-task-id=\"").concat(task.id, "\" data-task-type=\"grouped\" data-group-index=\"").concat(groupIndex, "\">\n                                <label for=\"task-").concat(task.id, "\">").concat(task.description, "</label>\n                            ");
                    taskGroupDetails.appendChild(taskItem);
                    if (!task.completed) allTasksCompleted = false;
                  });
                  taskListSection.appendChild(taskGroupDetails);
                });
              }
              taskListSection.querySelectorAll('input[type="checkbox"]').forEach(function (checkbox) {
                checkbox.addEventListener('change', /*#__PURE__*/function () {
                  var _ref9 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee13(event) {
                    var taskId, isCompleted, taskType, groupIndex, currentAllTasksCompleted, _t13;
                    return _regenerator().w(function (_context13) {
                      while (1) switch (_context13.n) {
                        case 0:
                          taskId = event.target.dataset.taskId;
                          isCompleted = event.target.checked;
                          taskType = event.target.dataset.taskType;
                          groupIndex = event.target.dataset.groupIndex;
                          _context13.p = 1;
                          _context13.n = 2;
                          return apiRequest("PUT", "/onboarding-tasks/".concat(taskId), {
                            completed: isCompleted,
                            type: taskType,
                            groupIndex: groupIndex
                          });
                        case 2:
                          event.target.closest('.task-item').classList.toggle('completed', isCompleted);
                          showModalMessage('Task status updated successfully!', false);
                          currentAllTasksCompleted = true;
                          taskListSection.querySelectorAll('.task-item').forEach(function (item) {
                            if (!item.classList.contains('completed')) {
                              currentAllTasksCompleted = false;
                            }
                          });
                          if (currentAllTasksCompleted) {
                            triggerFireworks();
                          }
                          _context13.n = 4;
                          break;
                        case 3:
                          _context13.p = 3;
                          _t13 = _context13.v;
                          showModalMessage("Failed to update task status: ".concat(_t13.message), true);
                          event.target.checked = !isCompleted;
                        case 4:
                          return _context13.a(2);
                      }
                    }, _callee13, null, [[1, 3]]);
                  }));
                  return function (_x1) {
                    return _ref9.apply(this, arguments);
                  };
                }());
              });
              if (allTasksCompleted) {
                triggerFireworks();
              }
            } else {
              taskListSection.innerHTML = '<p style="color: var(--text-medium);">No onboarding tasks assigned or found.</p>';
            }
            _context14.n = 7;
            break;
          case 6:
            _context14.p = 6;
            _t14 = _context14.v;
            console.error("Error loading onboarding tasks:", _t14);
            taskListSection.innerHTML = "<p style=\"color: #e74c3c;\">Error loading tasks: ".concat(_t14.message, "</p>");
          case 7:
            return _context14.a(2);
        }
      }, _callee14, null, [[2, 6]]);
    }));
    return _loadOnboardingTasks.apply(this, arguments);
  }
  loadOnboardingTasks();
}

/**
 * Handles logic for pricing.html page.
 */
function handlePricingPage() {
  var urlParams = new URLSearchParams(window.location.search);
  var showRegisterCheckout = urlParams.get("registerCheckout");
  var selectedPlanId = urlParams.get("plan");
  var registerCheckoutModalOverlay = document.getElementById("register-checkout-modal-overlay");
  var registerCheckoutModalTitle = document.getElementById("register-checkout-modal-title");
  var registerCheckoutForm = document.getElementById("register-checkout-form");
  var regCoNameInput = document.getElementById("reg-co-name");
  var regFullNameInput = document.getElementById("reg-full-name");
  var regEmailInput = document.getElementById("reg-email");
  var regPasswordInput = document.getElementById("reg-password");
  var regCheckoutCancelBtn = document.getElementById("reg-checkout-cancel-btn");
  var regCheckoutErrorMessage = document.getElementById("register-checkout-error-message");
  var currentSelectedPlan = null;
  function openRegisterCheckoutModal(planId) {
    if (registerCheckoutModalOverlay && registerCheckoutModalTitle && registerCheckoutForm) {
      currentSelectedPlan = planId;
      registerCheckoutModalTitle.textContent = "Sign Up & Subscribe to ".concat(planId.charAt(0).toUpperCase() + planId.slice(1), " Plan");
      registerCheckoutModalOverlay.style.display = 'flex';
      regCheckoutErrorMessage.textContent = '';
      regCheckoutErrorMessage.classList.remove('visible');
      regCheckoutErrorMessage.setAttribute('aria-hidden', 'true');
    }
  }
  if (showRegisterCheckout === 'true' && selectedPlanId) {
    openRegisterCheckoutModal(selectedPlanId);
    history.replaceState({}, document.title, window.location.pathname);
  }
  var freePlanBtn = document.getElementById("free-plan-btn");
  var proPlanBtn = document.getElementById("pro-plan-btn");
  var enterprisePlanBtn = document.getElementById("enterprise-plan-btn");
  if (freePlanBtn) {
    freePlanBtn.addEventListener("click", /*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee15() {
      var userRole, profile, confirmed, _t15;
      return _regenerator().w(function (_context15) {
        while (1) switch (_context15.n) {
          case 0:
            userRole = localStorage.getItem("userRole");
            if (!userRole) {
              _context15.n = 8;
              break;
            }
            _context15.n = 1;
            return apiRequest("GET", "/profile");
          case 1:
            profile = _context15.v;
            if (!(profile && profile.plan_id === 'free')) {
              _context15.n = 2;
              break;
            }
            showModalMessage("You are already on the Free plan.", false);
            _context15.n = 7;
            break;
          case 2:
            _context15.n = 3;
            return showConfirmModal("Are you sure you want to downgrade to the Free plan? Your current subscription will be cancelled.", "Downgrade");
          case 3:
            confirmed = _context15.v;
            if (!confirmed) {
              _context15.n = 7;
              break;
            }
            _context15.p = 4;
            _context15.n = 5;
            return apiRequest("POST", "/cancel-subscription");
          case 5:
            showModalMessage("Successfully downgraded to Free plan. Your subscription will be updated.", false);
            setTimeout(function () {
              window.location.href = 'suite-hub.html';
            }, 1500);
            _context15.n = 7;
            break;
          case 6:
            _context15.p = 6;
            _t15 = _context15.v;
            showModalMessage("Failed to downgrade: ".concat(_t15.message), true);
          case 7:
            _context15.n = 9;
            break;
          case 8:
            showModalMessage("The Free plan is available upon regular sign-up.", false);
            setTimeout(function () {
              window.location.href = 'register.html';
            }, 1500);
          case 9:
            return _context15.a(2);
        }
      }, _callee15, null, [[4, 6]]);
    })));
  }
  if (proPlanBtn) {
    proPlanBtn.addEventListener("click", function () {
      return handlePlanSelection("pro");
    });
  }
  if (enterprisePlanBtn) {
    enterprisePlanBtn.addEventListener("click", function () {
      return handlePlanSelection("enterprise");
    });
  }
  function handlePlanSelection(_x10) {
    return _handlePlanSelection.apply(this, arguments);
  }
  function _handlePlanSelection() {
    _handlePlanSelection = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee17(planId) {
      var token, session, _t17;
      return _regenerator().w(function (_context17) {
        while (1) switch (_context17.n) {
          case 0:
            token = localStorage.getItem("authToken");
            if (!token) {
              _context17.n = 5;
              break;
            }
            _context17.p = 1;
            _context17.n = 2;
            return apiRequest("POST", "/create-checkout-session", {
              planId: planId
            });
          case 2:
            session = _context17.v;
            if (stripe && session.sessionId) {
              showModalMessage("Account created! Redirecting to payment...", false);
              stripe.redirectToCheckout({
                sessionId: session.sessionId
              });
            } else {
              showModalMessage("Account created, but failed to initiate payment. Please log in and try upgrading your plan from My Account.", true);
            }
            _context17.n = 4;
            break;
          case 3:
            _context17.p = 3;
            _t17 = _context17.v;
            console.error("Error creating checkout session:", _t17);
            showModalMessage("Failed to proceed with payment: ".concat(_t17.message), true);
          case 4:
            _context17.n = 6;
            break;
          case 5:
            openRegisterCheckoutModal(planId);
          case 6:
            return _context17.a(2);
        }
      }, _callee17, null, [[1, 3]]);
    }));
    return _handlePlanSelection.apply(this, arguments);
  }
  if (regCheckoutCancelBtn) {
    regCheckoutCancelBtn.addEventListener("click", function () {
      if (registerCheckoutModalOverlay) {
        registerCheckoutModalOverlay.style.display = 'none';
        currentSelectedPlan = null;
      }
    });
  }
  if (regCheckoutModalOverlay) {
    regCheckoutModalOverlay.addEventListener("click", function (event) {
      if (event.target === regCheckoutModalOverlay) {
        registerCheckoutModalOverlay.style.display = "none";
        currentSelectedPlan = null;
      }
    });
  }
  if (registerCheckoutForm) {
    registerCheckoutForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref1 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee16(e) {
        var company_name, full_name, email, password, emailRegex, registrationData, loginData, session, _t16;
        return _regenerator().w(function (_context16) {
          while (1) switch (_context16.n) {
            case 0:
              e.preventDefault();
              company_name = regCoNameInput.value.trim();
              full_name = regFullNameInput.value.trim();
              email = regEmailInput.value.trim();
              password = regPasswordInput.value;
              regCheckoutErrorMessage.textContent = "";
              regCheckoutErrorMessage.classList.remove('visible');
              regCheckoutErrorMessage.setAttribute('aria-hidden', 'true');
              emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
              if (!(!company_name || !full_name || !email || !password || password.length < 6 || !emailRegex.test(email))) {
                _context16.n = 1;
                break;
              }
              regCheckoutErrorMessage.textContent = "Please fill all fields correctly. Password must be at least 6 characters and email valid.";
              regCheckoutErrorMessage.classList.add('visible');
              regCheckoutErrorMessage.setAttribute('aria-hidden', 'false');
              return _context16.a(2);
            case 1:
              _context16.p = 1;
              _context16.n = 2;
              return apiRequest("POST", "/register", {
                company_name: company_name,
                full_name: full_name,
                email: email,
                password: password
              });
            case 2:
              registrationData = _context16.v;
              _context16.n = 3;
              return apiRequest("POST", "/login", {
                email: email,
                password: password
              });
            case 3:
              loginData = _context16.v;
              localStorage.setItem("authToken", loginData.token);
              localStorage.setItem("userRole", loginData.role);
              _context16.n = 4;
              return apiRequest("POST", "/create-checkout-session", {
                planId: currentSelectedPlan
              });
            case 4:
              session = _context16.v;
              if (stripe && session.sessionId) {
                showModalMessage("Account created! Redirecting to payment...", false);
                stripe.redirectToCheckout({
                  sessionId: session.sessionId
                });
              } else {
                showModalMessage("Account created, but failed to initiate payment. Please log in and try upgrading your plan from My Account.", true);
                setTimeout(function () {
                  window.location.href = 'login.html';
                }, 2000);
              }
              _context16.n = 6;
              break;
            case 5:
              _context16.p = 5;
              _t16 = _context16.v;
              console.error("Register/Checkout error:", _t16);
              regCheckoutErrorMessage.textContent = "Sign Up Failed: ".concat(_t16.message);
              regCheckoutErrorMessage.classList.add('visible');
              regCheckoutErrorMessage.setAttribute('aria-hidden', 'false');
              showModalMessage("Sign Up Failed: ".concat(_t16.message), true);
            case 6:
              return _context16.a(2);
          }
        }, _callee16, null, [[1, 5]]);
      }));
      return function (_x11) {
        return _ref1.apply(this, arguments);
      };
    }());
  }
}

/**
 * Handles all client-side logic for the hiring.html page.
 */
function handleHiringPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var createJobPostingForm = document.getElementById("create-job-posting-form");
  var jobPostingListDiv = document.getElementById("job-posting-list");
  var applicantListDiv = document.getElementById("applicant-list");
  var jobPostingLocationSelect = document.getElementById("job-posting-location-select");
  var filterApplicantJobPostingSelect = document.getElementById("filter-applicant-job-posting-select");
  var filterApplicantStatusSelect = document.getElementById("filter-applicant-status");
  var filterApplicantLocationSelect = document.getElementById("filter-applicant-location-select");
  var applyApplicantFiltersBtn = document.getElementById("apply-applicant-filters-btn");
  var clearApplicantFiltersBtn = document.getElementById("clear-applicant-filters-btn");
  var shareLinkModalOverlay = document.getElementById("share-link-modal-overlay");
  var shareJobLinkInput = document.getElementById("share-job-link-input");
  var shareJobEmbedCodeInput = document.getElementById("share-job-embed-code-input");
  var copyLinkBtn = document.getElementById("copy-link-btn");
  var copyEmbedBtn = document.getElementById("copy-embed-btn");
  var shareLinkModalCloseButton = document.getElementById("share-link-modal-close-button");
  function loadJobPostingLocations() {
    return _loadJobPostingLocations.apply(this, arguments);
  }
  function _loadJobPostingLocations() {
    _loadJobPostingLocations = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee20() {
      var locations, _t19;
      return _regenerator().w(function (_context20) {
        while (1) switch (_context20.n) {
          case 0:
            if (jobPostingLocationSelect) {
              _context20.n = 1;
              break;
            }
            return _context20.a(2);
          case 1:
            jobPostingLocationSelect.innerHTML = '<option value="">Loading locations...</option>';
            _context20.p = 2;
            _context20.n = 3;
            return apiRequest("GET", "/locations");
          case 3:
            locations = _context20.v;
            jobPostingLocationSelect.innerHTML = '<option value="">Company Wide (All Locations)</option>'; // Default option
            if (locations && locations.length > 0) {
              locations.forEach(function (loc) {
                var option = document.createElement("option");
                option.value = loc.location_id;
                option.textContent = loc.location_name;
                jobPostingLocationSelect.appendChild(option);
              });
            } else {
              jobPostingLocationSelect.innerHTML = '<option value="">No locations available</option>';
            }
            filterApplicantLocationSelect.innerHTML = jobPostingLocationSelect.innerHTML; // Copy options to filter dropdown
            _context20.n = 5;
            break;
          case 4:
            _context20.p = 4;
            _t19 = _context20.v;
            console.error("Error loading job posting locations:", _t19);
            jobPostingLocationSelect.innerHTML = '<option value="">Error loading locations</option>';
            filterApplicantLocationSelect.innerHTML = '<option value="">Error loading locations</option>';
            showModalMessage("Failed to load locations for job postings: ".concat(_t19.message), true);
          case 5:
            return _context20.a(2);
        }
      }, _callee20, null, [[2, 4]]);
    }));
    return _loadJobPostingLocations.apply(this, arguments);
  }
  function loadJobPostings() {
    return _loadJobPostings.apply(this, arguments);
  }
  function _loadJobPostings() {
    _loadJobPostings = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee21() {
      var queryParams, jobPostings, _t20;
      return _regenerator().w(function (_context21) {
        while (1) switch (_context21.n) {
          case 0:
            if (jobPostingListDiv) {
              _context21.n = 1;
              break;
            }
            return _context21.a(2);
          case 1:
            jobPostingListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading job postings...</p>';
            _context21.p = 2;
            queryParams = new URLSearchParams();
            if (filterApplicantJobPostingSelect.value) {// This filter is for applicants, not job postings directly
              // Not filtering loadJobPostings directly by ID from applicant filter
            }
            // For now, only show 'Open' jobs on the main list unless otherwise specified
            queryParams.append('status', 'Open'); // Fetch only open jobs by default for this list
            _context21.n = 3;
            return apiRequest("GET", "/job-postings?".concat(queryParams.toString()));
          case 3:
            jobPostings = _context21.v;
            jobPostingListDiv.innerHTML = '';
            filterApplicantJobPostingSelect.innerHTML = '<option value="">All Job Postings</option>'; // Reset applicant filter

            if (jobPostings && jobPostings.length > 0) {
              jobPostings.forEach(function (job) {
                var jobItem = document.createElement("div");
                jobItem.className = "job-posting-item";
                jobItem.innerHTML = "\n                        <h4>".concat(job.title, "</h4>\n                        <p>Location: ").concat(job.location_id ? job.location_name : 'Company Wide', "</p>\n                        <p>Status: ").concat(job.status, "</p>\n                        <p>Posted: ").concat(new Date(job.created_date).toLocaleDateString(), "</p>\n                        <div class=\"actions\">\n                            <button class=\"btn btn-secondary btn-sm edit-job-btn\" data-job-id=\"").concat(job.job_posting_id, "\">Edit</button>\n                            <button class=\"btn btn-secondary btn-sm share-btn\" data-job-id=\"").concat(job.job_posting_id, "\" data-job-title=\"").concat(job.title, "\">Share</button>\n                            <button class=\"btn-delete\" data-type=\"job-posting\" data-id=\"").concat(job.job_posting_id, "\">\n                                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" viewBox=\"0 0 16 16\"><path d=\"M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z\"/><path d=\"M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z\"/></svg>\n                            </button>\n                        </div>\n                    ");
                jobPostingListDiv.appendChild(jobItem);

                // Populate job posting filter dropdown for applicants
                var option = document.createElement("option");
                option.value = job.job_posting_id;
                option.textContent = job.title;
                filterApplicantJobPostingSelect.appendChild(option);
              });
            } else {
              jobPostingListDiv.innerHTML = '<p style="color: var(--text-medium);">No job postings found.</p>';
            }
            _context21.n = 5;
            break;
          case 4:
            _context21.p = 4;
            _t20 = _context21.v;
            console.error("Error loading job postings:", _t20);
            jobPostingListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error loading job postings: ".concat(_t20.message, "</p>");
          case 5:
            return _context21.a(2);
        }
      }, _callee21, null, [[2, 4]]);
    }));
    return _loadJobPostings.apply(this, arguments);
  }
  function loadApplicants() {
    return _loadApplicants.apply(this, arguments);
  }
  function _loadApplicants() {
    _loadApplicants = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee22() {
      var filters,
        queryParams,
        applicants,
        _args22 = arguments,
        _t21;
      return _regenerator().w(function (_context22) {
        while (1) switch (_context22.n) {
          case 0:
            filters = _args22.length > 0 && _args22[0] !== undefined ? _args22[0] : {};
            if (applicantListDiv) {
              _context22.n = 1;
              break;
            }
            return _context22.a(2);
          case 1:
            applicantListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading applicants...</p>';
            _context22.p = 2;
            queryParams = new URLSearchParams();
            if (filters.job_posting_id) queryParams.append('job_posting_id', filters.job_posting_id);
            if (filters.status) queryParams.append('status', filters.status);
            if (filters.location_id) queryParams.append('location_id', filters.location_id);
            _context22.n = 3;
            return apiRequest("GET", "/applicants?".concat(queryParams.toString()));
          case 3:
            applicants = _context22.v;
            applicantListDiv.innerHTML = '';
            if (applicants && applicants.length > 0) {
              applicants.forEach(function (applicant) {
                var applicantItem = document.createElement("div");
                applicantItem.className = "applicant-item";
                applicantItem.innerHTML = "\n                        <h4>".concat(applicant.full_name, "</h4>\n                        <p>Job: ").concat(applicant.job_title || 'N/A', "</p>\n                        <p>Email: ").concat(applicant.email, "</p>\n                        <p>Phone: ").concat(applicant.phone_number || 'N/A', "</p>\n                        <p>Status: ").concat(applicant.status, "</p>\n                        <p>Applied: ").concat(new Date(applicant.application_date).toLocaleDateString(), "</p>\n                        <div class=\"actions\">\n                            <button class=\"btn btn-secondary btn-sm edit-applicant-btn\" data-applicant-id=\"").concat(applicant.applicant_id, "\">Update Status</button>\n                            <button class=\"btn-delete\" data-type=\"applicant\" data-id=\"").concat(applicant.applicant_id, "\">\n                                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" viewBox=\"0 0 16 16\"><path d=\"M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z\"/><path d=\"M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z\"/></svg>\n                            </button>\n                        </div>\n                    ");
                applicantListDiv.appendChild(applicantItem);
              });
            } else {
              applicantListDiv.innerHTML = '<p style="color: var(--text-medium);">No applicants found with current filters.</p>';
            }
            _context22.n = 5;
            break;
          case 4:
            _context22.p = 4;
            _t21 = _context22.v;
            console.error("Error loading applicants:", _t21);
            applicantListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error loading applicants: ".concat(_t21.message, "</p>");
          case 5:
            return _context22.a(2);
        }
      }, _callee22, null, [[2, 4]]);
    }));
    return _loadApplicants.apply(this, arguments);
  }
  if (createJobPostingForm) {
    createJobPostingForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref10 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee18(e) {
        var title, description, requirements, locationId, response, _t18;
        return _regenerator().w(function (_context18) {
          while (1) switch (_context18.n) {
            case 0:
              e.preventDefault();
              title = document.getElementById("job-title-input").value.trim();
              description = document.getElementById("job-description-input").value.trim();
              requirements = document.getElementById("job-requirements-input").value.trim();
              locationId = jobPostingLocationSelect.value ? parseInt(jobPostingLocationSelect.value, 10) : null;
              if (!(!title || !description)) {
                _context18.n = 1;
                break;
              }
              showModalMessage("Job Title and Description are required.", true);
              return _context18.a(2);
            case 1:
              _context18.p = 1;
              _context18.n = 2;
              return apiRequest("POST", "/job-postings", {
                title: title,
                description: description,
                requirements: requirements,
                location_id: locationId
              });
            case 2:
              response = _context18.v;
              showModalMessage("Job \"".concat(title, "\" posted successfully!"), false);
              createJobPostingForm.reset();
              loadJobPostings();
              _context18.n = 4;
              break;
            case 3:
              _context18.p = 3;
              _t18 = _context18.v;
              showModalMessage("Error posting job: ".concat(_t18.message), true);
            case 4:
              return _context18.a(2);
          }
        }, _callee18, null, [[1, 3]]);
      }));
      return function (_x12) {
        return _ref10.apply(this, arguments);
      };
    }());
  }
  if (applyApplicantFiltersBtn) {
    applyApplicantFiltersBtn.addEventListener("click", function () {
      var filters = {
        job_posting_id: filterApplicantJobPostingSelect.value || null,
        status: filterApplicantStatusSelect.value || null,
        location_id: filterApplicantLocationSelect.value ? parseInt(filterApplicantLocationSelect.value, 10) : null
      };
      loadApplicants(filters);
    });
  }
  if (clearApplicantFiltersBtn) {
    clearApplicantFiltersBtn.addEventListener("click", function () {
      filterApplicantJobPostingSelect.value = "";
      filterApplicantStatusSelect.value = "";
      filterApplicantLocationSelect.value = "";
      loadApplicants({}); // Load all applicants
    });
  }

  // Share Job Posting Modal Logic
  if (shareLinkModalCloseButton) {
    shareLinkModalCloseButton.addEventListener("click", function () {
      shareLinkModalOverlay.style.display = 'none';
    });
    shareLinkModalOverlay.addEventListener("click", function (event) {
      if (event.target === shareLinkModalOverlay) {
        shareLinkModalOverlay.style.display = 'none';
      }
    });
  }
  document.body.addEventListener("click", /*#__PURE__*/function () {
    var _ref11 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee19(e) {
      var shareButton, jobId, jobTitle, directLink, embedCode, copyLink, copyEmbed, editApplicantButton, applicantId;
      return _regenerator().w(function (_context19) {
        while (1) switch (_context19.n) {
          case 0:
            shareButton = e.target.closest(".share-btn");
            if (shareButton) {
              jobId = shareButton.dataset.jobId;
              jobTitle = shareButton.dataset.jobTitle; // Get job title for dynamic link text
              directLink = "".concat(API_BASE_URL, "/apply/").concat(jobId); // Example direct link
              embedCode = "<iframe src=\"".concat(API_BASE_URL, "/embed/job/").concat(jobId, "\" width=\"600\" height=\"400\" frameborder=\"0\" title=\"").concat(jobTitle, " Application\"></iframe>"); // Example embed code
              if (shareJobLinkInput) shareJobLinkInput.value = directLink;
              if (shareJobEmbedCodeInput) shareJobEmbedCodeInput.value = embedCode;
              if (shareLinkModalOverlay) shareLinkModalOverlay.style.display = 'flex';
            }
            copyLink = e.target.closest("#copy-link-btn");
            if (copyLink && shareJobLinkInput) {
              document.execCommand('copy'); // Fallback for navigator.clipboard.writeText
              navigator.clipboard.writeText(shareJobLinkInput.value).then(function () {
                showModalMessage("Link copied to clipboard!", false);
              })["catch"](function (err) {
                console.error('Failed to copy link: ', err);
                showModalMessage("Failed to copy link. Please copy manually.", true);
              });
            }
            copyEmbed = e.target.closest("#copy-embed-btn");
            if (copyEmbed && shareJobEmbedCodeInput) {
              document.execCommand('copy'); // Fallback
              navigator.clipboard.writeText(shareJobEmbedCodeInput.value).then(function () {
                showModalMessage("Embed code copied to clipboard!", false);
              })["catch"](function (err) {
                console.error('Failed to copy embed code: ', err);
                showModalMessage("Failed to copy embed code. Please copy manually.", true);
              });
            }
            editApplicantButton = e.target.closest(".edit-applicant-btn");
            if (editApplicantButton) {
              applicantId = editApplicantButton.dataset.applicantId;
              showModalMessage("Editing Applicant ID: ".concat(applicantId, " (Functionality to be implemented)"), false);
              // Here you'd typically open a modal or navigate to an edit page for the applicant
            }
          case 1:
            return _context19.a(2);
        }
      }, _callee19);
    }));
    return function (_x13) {
      return _ref11.apply(this, arguments);
    };
  }());

  // Initial loads
  loadJobPostingLocations();
  loadJobPostings();
  loadApplicants({}); // Load all applicants initially
}

/**
 * Handles all client-side logic for the scheduling.html page.
 */
function handleSchedulingPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var filterEmployeeSelect = document.getElementById("filter-employee-select");
  var filterLocationSelect = document.getElementById("filter-location-select");
  var filterStartDateInput = document.getElementById("filter-start-date");
  var filterEndDateInput = document.getElementById("filter-end-date");
  var applyFiltersBtn = document.getElementById("apply-filters-btn");
  var clearFiltersBtn = document.getElementById("clear-filters-btn");
  var createShiftForm = document.getElementById("create-shift-form");
  var employeeSelect = document.getElementById("employee-select");
  var locationSelect = document.getElementById("location-select");
  var startTimeInput = document.getElementById("start-time-input");
  var endTimeInput = document.getElementById("end-time-input");
  var notesInput = document.getElementById("notes-input");
  var prevWeekBtn = document.getElementById("prev-week-btn");
  var nextWeekBtn = document.getElementById("next-week-btn");
  var currentWeekDisplay = document.getElementById("current-week-display");
  var calendarGrid = document.getElementById("calendar-grid");
  var timeColumn = document.getElementById("time-column");
  var currentWeekStart = moment().startOf('isoWeek'); // Use moment.js for week manipulation

  function renderTimeColumn() {
    timeColumn.innerHTML = '';
    // Add an empty cell for the top-left corner (above time, left of days)
    var topLeftCorner = document.createElement('div');
    topLeftCorner.className = 'calendar-day-header'; // Re-use header style
    topLeftCorner.style.gridColumn = '1';
    topLeftCorner.style.gridRow = '1';
    topLeftCorner.textContent = ''; // Empty for spacing
    calendarGrid.prepend(topLeftCorner); // Add before any other content

    for (var i = 0; i < 24; i++) {
      var time = moment().hour(i).minute(0);
      var timeSlot = document.createElement('div');
      timeSlot.className = 'calendar-time-slot';
      timeSlot.textContent = time.format('h A');
      timeColumn.appendChild(timeSlot);
    }
  }
  function loadEmployeesForScheduling() {
    return _loadEmployeesForScheduling.apply(this, arguments);
  }
  function _loadEmployeesForScheduling() {
    _loadEmployeesForScheduling = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee24() {
      var employees, _t23;
      return _regenerator().w(function (_context24) {
        while (1) switch (_context24.n) {
          case 0:
            if (employeeSelect) {
              _context24.n = 1;
              break;
            }
            return _context24.a(2);
          case 1:
            employeeSelect.innerHTML = '<option value="">Loading employees...</option>';
            filterEmployeeSelect.innerHTML = '<option value="">All Employees</option>'; // Always have "All Employees" option
            _context24.p = 2;
            _context24.n = 3;
            return apiRequest("GET", "/users?filterRole=employee");
          case 3:
            employees = _context24.v;
            // Assuming an API to get employees
            if (employees && employees.length > 0) {
              employeeSelect.innerHTML = '<option value="">Select Employee</option>';
              employees.forEach(function (emp) {
                var option = document.createElement("option");
                option.value = emp.user_id;
                option.textContent = emp.full_name;
                employeeSelect.appendChild(option);
                // Add to filter dropdown as well
                filterEmployeeSelect.appendChild(option.cloneNode(true));
              });
            } else {
              employeeSelect.innerHTML = '<option value="">No employees available</option>';
              filterEmployeeSelect.innerHTML = '<option value="">No employees available</option>';
            }
            _context24.n = 5;
            break;
          case 4:
            _context24.p = 4;
            _t23 = _context24.v;
            console.error("Error loading employees for scheduling:", _t23);
            employeeSelect.innerHTML = '<option value="">Error loading employees</option>';
            filterEmployeeSelect.innerHTML = '<option value="">Error loading employees</option>';
            showModalMessage("Failed to load employees: ".concat(_t23.message), true);
          case 5:
            return _context24.a(2);
        }
      }, _callee24, null, [[2, 4]]);
    }));
    return _loadEmployeesForScheduling.apply(this, arguments);
  }
  function loadLocationsForScheduling() {
    return _loadLocationsForScheduling.apply(this, arguments);
  }
  function _loadLocationsForScheduling() {
    _loadLocationsForScheduling = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee25() {
      var locations, _t24;
      return _regenerator().w(function (_context25) {
        while (1) switch (_context25.n) {
          case 0:
            if (locationSelect) {
              _context25.n = 1;
              break;
            }
            return _context25.a(2);
          case 1:
            locationSelect.innerHTML = '<option value="">Loading locations...</option>';
            filterLocationSelect.innerHTML = '<option value="">All Locations</option>'; // Always have "All Locations" option
            _context25.p = 2;
            _context25.n = 3;
            return apiRequest("GET", "/locations");
          case 3:
            locations = _context25.v;
            if (locations && locations.length > 0) {
              locationSelect.innerHTML = '<option value="">Select Location</option>';
              locations.forEach(function (loc) {
                var option = document.createElement("option");
                option.value = loc.location_id;
                option.textContent = loc.location_name;
                locationSelect.appendChild(option);
                // Add to filter dropdown as well
                filterLocationSelect.appendChild(option.cloneNode(true));
              });
            } else {
              locationSelect.innerHTML = '<option value="">No locations available</option>';
              filterLocationSelect.innerHTML = '<option value="">No locations available</option>';
            }
            _context25.n = 5;
            break;
          case 4:
            _context25.p = 4;
            _t24 = _context25.v;
            console.error("Error loading locations for scheduling:", _t24);
            locationSelect.innerHTML = '<option value="">Error loading locations</option>';
            filterLocationSelect.innerHTML = '<option value="">Error loading locations</option>';
            showModalMessage("Failed to load locations: ".concat(_t24.message), true);
          case 5:
            return _context25.a(2);
        }
      }, _callee25, null, [[2, 4]]);
    }));
    return _loadLocationsForScheduling.apply(this, arguments);
  }
  function renderCalendar() {
    return _renderCalendar.apply(this, arguments);
  }
  function _renderCalendar() {
    _renderCalendar = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee27() {
      var existingDayElements, dates, i, startOfWeek, endOfWeek, filters, shifts, _t26;
      return _regenerator().w(function (_context27) {
        while (1) switch (_context27.n) {
          case 0:
            if (calendarGrid) {
              _context27.n = 1;
              break;
            }
            return _context27.a(2);
          case 1:
            // Clear existing day headers and cells (except the fixed time column)
            existingDayElements = calendarGrid.querySelectorAll('.calendar-day-header:not([style*="grid-column: 1"]), .calendar-day-cell');
            existingDayElements.forEach(function (el) {
              return el.remove();
            });
            currentWeekDisplay.textContent = "".concat(currentWeekStart.format('MMM DD'), " - ").concat(moment(currentWeekStart).endOf('isoWeek').format('MMM DD,YYYY'));
            dates = [];
            for (i = 0; i < 7; i++) {
              dates.push(moment(currentWeekStart).add(i, 'days'));
            }

            // Add Day Headers
            dates.forEach(function (date, index) {
              var dayHeader = document.createElement('div');
              dayHeader.className = 'calendar-day-header';
              dayHeader.style.gridColumn = "".concat(index + 2); // +2 because column 1 is for time
              dayHeader.style.gridRow = '1';
              dayHeader.innerHTML = "".concat(date.format('ddd'), "<br>").concat(date.format('MMM D'));
              calendarGrid.appendChild(dayHeader);
            });

            // Add Day Cells
            dates.forEach(function (date, index) {
              var dayCell = document.createElement('div');
              dayCell.className = 'calendar-day-cell';
              dayCell.style.gridColumn = "".concat(index + 2); // +2 because column 1 is for time
              dayCell.style.gridRow = "2 / span 24"; // Span 24 hours
              dayCell.dataset.date = date.format('YYYY-MM-DD'); // Store date for later use
              calendarGrid.appendChild(dayCell);
            });

            // Fetch and display shifts for the current week
            startOfWeek = currentWeekStart.startOf('isoWeek').format('YYYY-MM-DDTHH:mm:ssZ');
            endOfWeek = moment(currentWeekStart).endOf('isoWeek').format('YYYY-MM-DDTHH:mm:ssZ');
            filters = {
              start_date: startOfWeek,
              end_date: endOfWeek,
              employee_id: filterEmployeeSelect.value || null,
              location_id: filterLocationSelect.value || null
            };
            _context27.p = 2;
            _context27.n = 3;
            return apiRequest("GET", "/schedules?".concat(new URLSearchParams(filters).toString()));
          case 3:
            shifts = _context27.v;
            shifts.forEach(function (shift) {
              var shiftStart = moment(shift.start_time);
              var shiftEnd = moment(shift.end_time);
              var shiftDate = shiftStart.format('YYYY-MM-DD');
              var targetCell = calendarGrid.querySelector(".calendar-day-cell[data-date=\"".concat(shiftDate, "\"]"));
              if (targetCell) {
                var shiftDiv = document.createElement('div');
                shiftDiv.className = "calendar-shift ".concat(moment().isAfter(shiftEnd) ? 'overdue' : ''); // Add 'overdue' class if shift has passed

                // Calculate top and height for positioning
                var startHour = shiftStart.hour();
                var startMinute = shiftStart.minute();
                var endHour = shiftEnd.hour();
                var endMinute = shiftEnd.minute();
                var topPosition = startHour * 30 + startMinute / 60 * 30; // 30px per hour
                var durationHours = shiftEnd.diff(shiftStart, 'minutes') / 60;
                var height = durationHours * 30; // 30px per hour

                shiftDiv.style.top = "".concat(topPosition, "px");
                shiftDiv.style.height = "".concat(height, "px");
                shiftDiv.textContent = "".concat(shift.employee_name, " @ ").concat(shift.location_name, " (").concat(shiftStart.format('h:mm A'), " - ").concat(shiftEnd.format('h:mm A'), ")");
                shiftDiv.addEventListener('click', /*#__PURE__*/_asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee26() {
                  var confirmDelete, _t25;
                  return _regenerator().w(function (_context26) {
                    while (1) switch (_context26.n) {
                      case 0:
                        _context26.n = 1;
                        return showConfirmModal("\n                            <h4>Shift Details:</h4>\n                            <p><strong>Employee:</strong> ".concat(shift.employee_name, "</p>\n                            <p><strong>Location:</strong> ").concat(shift.location_name, "</p>\n                            <p><strong>Time:</strong> ").concat(shiftStart.format('MMM DD, h:mm A'), " - ").concat(shiftEnd.format('MMM DD, h:mm A'), "</p>\n                            <p><strong>Notes:</strong> ").concat(shift.notes || 'None', "</p>\n                            <p style=\"margin-top: 15px;\">Are you sure you want to delete this shift?</p>\n                        "), "Delete Shift");
                      case 1:
                        confirmDelete = _context26.v;
                        if (!confirmDelete) {
                          _context26.n = 5;
                          break;
                        }
                        _context26.p = 2;
                        _context26.n = 3;
                        return apiRequest("DELETE", "/schedules/".concat(shift.schedule_id));
                      case 3:
                        showModalMessage("Shift deleted successfully!", false);
                        renderCalendar(); // Re-render calendar
                        _context26.n = 5;
                        break;
                      case 4:
                        _context26.p = 4;
                        _t25 = _context26.v;
                        showModalMessage("Failed to delete shift: ".concat(_t25.message), true);
                      case 5:
                        return _context26.a(2);
                    }
                  }, _callee26, null, [[2, 4]]);
                })));
                targetCell.appendChild(shiftDiv);
              }
            });
            _context27.n = 5;
            break;
          case 4:
            _context27.p = 4;
            _t26 = _context27.v;
            console.error("Error loading schedules:", _t26);
            calendarGrid.querySelector('p').textContent = "Error loading schedules: ".concat(_t26.message);
          case 5:
            return _context27.a(2);
        }
      }, _callee27, null, [[2, 4]]);
    }));
    return _renderCalendar.apply(this, arguments);
  }
  if (prevWeekBtn) {
    prevWeekBtn.addEventListener("click", function () {
      currentWeekStart.subtract(1, 'isoWeek');
      renderCalendar();
    });
  }
  if (nextWeekBtn) {
    nextWeekBtn.addEventListener("click", function () {
      currentWeekStart.add(1, 'isoWeek');
      renderCalendar();
    });
  }
  if (createShiftForm) {
    createShiftForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref12 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee23(e) {
        var employeeId, locationId, startTime, endTime, notes, _t22;
        return _regenerator().w(function (_context23) {
          while (1) switch (_context23.n) {
            case 0:
              e.preventDefault();
              employeeId = employeeSelect.value ? parseInt(employeeSelect.value, 10) : null;
              locationId = locationSelect.value ? parseInt(locationSelect.value, 10) : null;
              startTime = startTimeInput.value;
              endTime = endTimeInput.value;
              notes = notesInput.value.trim();
              if (!(!employeeId || !locationId || !startTime || !endTime)) {
                _context23.n = 1;
                break;
              }
              showModalMessage("Please select an employee, location, and valid start/end times.", true);
              return _context23.a(2);
            case 1:
              if (!(new Date(startTime) >= new Date(endTime))) {
                _context23.n = 2;
                break;
              }
              showModalMessage("Start time must be before end time.", true);
              return _context23.a(2);
            case 2:
              _context23.p = 2;
              _context23.n = 3;
              return apiRequest("POST", "/schedules", {
                employee_id: employeeId,
                location_id: locationId,
                start_time: startTime,
                end_time: endTime,
                notes: notes || null
              });
            case 3:
              showModalMessage("Shift created successfully!", false);
              createShiftForm.reset();
              renderCalendar();
              _context23.n = 5;
              break;
            case 4:
              _context23.p = 4;
              _t22 = _context23.v;
              showModalMessage("Error creating shift: ".concat(_t22.message), true);
            case 5:
              return _context23.a(2);
          }
        }, _callee23, null, [[2, 4]]);
      }));
      return function (_x14) {
        return _ref12.apply(this, arguments);
      };
    }());
  }
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", function () {
      renderCalendar(); // Re-render calendar with new filters
    });
  }
  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", function () {
      filterEmployeeSelect.value = "";
      filterLocationSelect.value = "";
      filterStartDateInput.value = "";
      filterEndDateInput.value = "";
      renderCalendar(); // Re-render calendar with cleared filters
    });
  }

  // Initial load
  renderTimeColumn();
  loadEmployeesForScheduling();
  loadLocationsForScheduling();
  renderCalendar();
}

/**
 * Handles all client-side logic for the documents.html page.
 */
function handleDocumentsPage() {
  // In a real app, remove this mock and ensure user is logged in before calling this handler
  // The mock authentication below should be REMOVED for your live site.
  if (!localStorage.getItem("authToken")) {
    localStorage.setItem("authToken", "mock-auth-token"); // REMOVE FOR LIVE SITE
    localStorage.setItem("userRole", "super_admin"); // REMOVE FOR LIVE SITE
    // console.warn("Mock authentication applied for demo purposes. REMOVE FOR LIVE SITE.");
  }
  var uploadDocumentForm = document.getElementById("upload-document-form");
  var documentTitleInput = document.getElementById("document-title");
  var documentFileInput = document.getElementById("document-file");
  var documentDescriptionInput = document.getElementById("document-description");
  var documentListDiv = document.getElementById("document-list");
  var uploadProgressContainer = document.getElementById("upload-progress-container");
  var uploadProgressFill = document.getElementById("upload-progress-fill");
  var uploadProgressText = document.getElementById("upload-progress-text");

  /**
   * Shows the upload progress bar and updates its display.
   * @param {number} percentage - The upload progress percentage (0-100).
   * @param {string} text - Optional text to display, e.g., "Uploading..."
   */
  function showUploadProgress(percentage) {
    var text = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "".concat(percentage, "%");
    if (uploadProgressContainer && uploadProgressFill && uploadProgressText) {
      uploadProgressContainer.style.display = 'block';
      uploadProgressText.style.display = 'block';
      uploadProgressFill.style.width = "".concat(percentage, "%");
      uploadProgressText.textContent = text;
    }
  }

  /**
   * Hides the upload progress bar.
   */
  function hideUploadProgress() {
    if (uploadProgressContainer && uploadProgressText) {
      uploadProgressContainer.style.display = 'none';
      uploadProgressText.style.display = 'none';
      uploadProgressFill.style.width = '0%';
    }
  }

  /**
   * Fetches and displays the list of uploaded documents from the backend.
   */
  function loadDocuments() {
    return _loadDocuments.apply(this, arguments);
  } // Handle document upload form submission
  function _loadDocuments() {
    _loadDocuments = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee30() {
      var documents, _t29;
      return _regenerator().w(function (_context30) {
        while (1) switch (_context30.n) {
          case 0:
            if (documentListDiv) {
              _context30.n = 1;
              break;
            }
            return _context30.a(2);
          case 1:
            documentListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading documents...</p>';
            _context30.p = 2;
            _context30.n = 3;
            return apiRequest("GET", "/documents");
          case 3:
            documents = _context30.v;
            documentListDiv.innerHTML = '';
            if (documents.length === 0) {
              documentListDiv.innerHTML = '<p style="color: var(--text-medium);">No documents uploaded yet.</p>';
            } else {
              documents.forEach(function (doc) {
                var docItem = document.createElement("div");
                docItem.className = "document-item";
                var uploadDate = new Date(doc.upload_date).toLocaleDateString();
                docItem.innerHTML = "\n                        <h4>".concat(doc.title, "</h4>\n                        <p>File: ").concat(doc.file_name, "</p>\n                        <p>Description: ").concat(doc.description || 'N/A', "</p>\n                        <p>Uploaded: ").concat(uploadDate, "</p>\n                        <div class=\"actions\">\n                            <a href=\"").concat(API_BASE_URL, "/documents/download/").concat(doc.document_id, "\" class=\"btn btn-secondary btn-sm\" target=\"_blank\" download>Download</a>\n                            <button class=\"btn-delete\" data-type=\"document\" data-id=\"").concat(doc.document_id, "\">\n                                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" viewBox=\"0 0 16 16\"><path d=\"M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z\"/><path d=\"M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z\"/></svg>\n                            </button>\n                        </div>\n                    ");
                documentListDiv.appendChild(docItem);
              });
            }
            _context30.n = 5;
            break;
          case 4:
            _context30.p = 4;
            _t29 = _context30.v;
            console.error("Error loading documents:", _t29);
            documentListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error loading documents: ".concat(_t29.message, "</p>");
          case 5:
            return _context30.a(2);
        }
      }, _callee30, null, [[2, 4]]);
    }));
    return _loadDocuments.apply(this, arguments);
  }
  if (uploadDocumentForm) {
    uploadDocumentForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref14 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee28(e) {
        var title, file, description, formData, result, _t27;
        return _regenerator().w(function (_context28) {
          while (1) switch (_context28.n) {
            case 0:
              e.preventDefault();
              title = documentTitleInput.value.trim();
              file = documentFileInput.files[0];
              description = documentDescriptionInput.value.trim();
              if (!(!title || !file)) {
                _context28.n = 1;
                break;
              }
              showModalMessage("Please provide a document title and select a file.", true);
              return _context28.a(2);
            case 1:
              formData = new FormData();
              formData.append('title', title);
              formData.append('document_file', file);
              formData.append('description', description);
              _context28.p = 2;
              showUploadProgress(0, 'Starting upload...');
              _context28.n = 3;
              return apiRequest("POST", "/documents/upload", formData, true,
              // isFormData: true
              function (event) {
                if (event.lengthComputable) {
                  var percentComplete = Math.round(event.loaded * 100 / event.total);
                  showUploadProgress(percentComplete, "Uploading: ".concat(percentComplete, "%"));
                }
              });
            case 3:
              result = _context28.v;
              showModalMessage("Document uploaded successfully!", false);
              uploadDocumentForm.reset();
              hideUploadProgress();
              loadDocuments(); // Reload the list of documents from the backend
              _context28.n = 5;
              break;
            case 4:
              _context28.p = 4;
              _t27 = _context28.v;
              console.error("Document upload error:", _t27);
              showModalMessage("Failed to upload document: ".concat(_t27.message), true);
              hideUploadProgress();
            case 5:
              return _context28.a(2);
          }
        }, _callee28, null, [[2, 4]]);
      }));
      return function (_x15) {
        return _ref14.apply(this, arguments);
      };
    }());
  }

  // Event listener for delete buttons on documents page (using delegation)
  if (documentListDiv) {
    documentListDiv.addEventListener("click", /*#__PURE__*/function () {
      var _ref15 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee29(e) {
        var targetButton, idToDelete, confirmed, _t28;
        return _regenerator().w(function (_context29) {
          while (1) switch (_context29.n) {
            case 0:
              targetButton = e.target.closest(".btn-delete");
              if (!(targetButton && targetButton.dataset.type === "document")) {
                _context29.n = 5;
                break;
              }
              idToDelete = parseInt(targetButton.dataset.id, 10);
              _context29.n = 1;
              return showConfirmModal("Are you sure you want to delete this document? This action cannot be undone.", "Delete");
            case 1:
              confirmed = _context29.v;
              if (!confirmed) {
                _context29.n = 5;
                break;
              }
              _context29.p = 2;
              _context29.n = 3;
              return apiRequest("DELETE", "/documents/".concat(idToDelete));
            case 3:
              showModalMessage("Document deleted successfully!", false);
              loadDocuments(); // Reload the list of documents to reflect the change
              _context29.n = 5;
              break;
            case 4:
              _context29.p = 4;
              _t28 = _context29.v;
              showModalMessage("Error deleting document: ".concat(_t28.message), true);
            case 5:
              return _context29.a(2);
          }
        }, _callee29, null, [[2, 4]]);
      }));
      return function (_x16) {
        return _ref15.apply(this, arguments);
      };
    }());
  }

  // Initial load of documents when the page loads
  loadDocuments();
}

// Global DOMContentLoaded listener to call page-specific handlers
document.addEventListener("DOMContentLoaded", function () {
  // Call setupSettingsDropdown on all pages that use it
  setupSettingsDropdown();

  // Route calls to specific page handlers based on body ID or filename
  // Using window.location.pathname to determine the current page
  var path = window.location.pathname;
  if (path.includes("login.html")) {
    handleLoginPage();
  } else if (path.includes("register.html")) {
    handleRegisterPage();
  } else if (path.includes("suite-hub.html")) {
    handleSuiteHubPage();
  } else if (path.includes("account.html")) {
    handleAccountPage();
  } else if (path.includes("admin.html")) {
    handleAdminPage();
  } else if (path.includes("dashboard.html")) {
    // Onboarding Dashboard
    handleDashboardPage();
  } else if (path.includes("checklists.html")) {
    handleChecklistsPage(); // Call the checklists page handler directly
  } else if (path.includes("new-hire-view.html")) {
    // Employee's Onboarding View
    handleNewHireViewPage();
  } else if (path.includes("pricing.html")) {
    handlePricingPage();
  } else if (path.includes("documents.html")) {
    handleDocumentsPage();
  } else if (path.includes("hiring.html")) {
    handleHiringPage();
  } else if (path.includes("scheduling.html")) {
    // You'll need to load moment.js in scheduling.html for this to work
    // <script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js"></script>
    // Make sure it's loaded before app.min.js
    if (typeof moment === 'undefined') {
      console.error("Moment.js is not loaded. Scheduling page functionality will be limited.");
      showModalMessage("Scheduling requires Moment.js library. Please ensure it's loaded in scheduling.html.", true);
    } else {
      handleSchedulingPage();
    }
  }
  // Add more else if conditions for other pages as needed
});
