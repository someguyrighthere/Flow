"use strict";

function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { if (r) i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n;else { var o = function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); }; o("next", 0), o("throw", 1), o("return", 2); } }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
// app.js - Client-Side JavaScript for Flow Business Suite
var API_BASE_URL = 'https://flow-gz1r.onrender.com';
var stripe;
if (typeof Stripe !== 'undefined') {
  stripe = Stripe('pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td');
} else {
  console.warn("Stripe.js not loaded. Stripe functionalities will not work on this page.");
}
function showModalMessage(message) {
  var isError = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  var modalOverlay = document.getElementById("message-modal-overlay");
  var modalMessage = document.getElementById("modal-message-text");
  var modalCloseButton = document.getElementById("modal-close-button");
  if (modalOverlay && modalMessage && modalCloseButton) {
    modalMessage.textContent = message;
    modalMessage.style.color = isError ? "#ff8a80" : "var(--text-light)";
    modalOverlay.style.display = "flex";
    modalCloseButton.onclick = function () {
      modalOverlay.style.display = "none";
    };
    modalOverlay.onclick = function (event) {
      if (event.target === modalOverlay) modalOverlay.style.display = "none";
    };
  } else {
    console.error("Modal elements not found for showModalMessage:", message);
    isError ? console.error("ERROR: ".concat(message)) : console.log("MESSAGE: ".concat(message));
  }
}
function showConfirmModal(message) {
  var confirmButtonText = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "Confirm";
  return new Promise(function (resolve) {
    var confirmModalOverlay = document.getElementById("confirm-modal-overlay");
    var confirmModalMessage = document.getElementById("confirm-modal-message");
    var modalConfirmButton = document.getElementById("modal-confirm");
    var modalCancelButton = document.getElementById("modal-cancel");
    if (!confirmModalOverlay || !confirmModalMessage || !modalConfirmButton || !modalCancelButton) {
      console.error("Confirmation modal elements not found. Falling back to native confirm.");
      resolve(window.confirm(message));
      return;
    }
    confirmModalMessage.innerHTML = message;
    modalConfirmButton.textContent = confirmButtonText;
    confirmModalOverlay.style.display = "flex";
    var handleResponse = function handleResponse(value) {
      confirmModalOverlay.style.display = "none";
      modalConfirmButton.removeEventListener("click", onConfirm);
      modalCancelButton.removeEventListener("click", onCancel);
      resolve(value);
    };
    var onConfirm = function onConfirm() {
      return handleResponse(true);
    };
    var onCancel = function onCancel() {
      return handleResponse(false);
    };
    modalConfirmButton.addEventListener("click", onConfirm);
    modalCancelButton.addEventListener("click", onCancel);
    confirmModalOverlay.onclick = function (event) {
      if (event.target === confirmModalOverlay) onCancel();
    };
  });
}
function setupSettingsDropdown() {
  var settingsButton = document.getElementById("settings-button");
  var settingsDropdown = document.getElementById("settings-dropdown");
  var logoutButton = document.getElementById("logout-button");
  if (settingsButton && settingsDropdown) {
    settingsButton.addEventListener("click", function (event) {
      event.stopPropagation();
      settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";
    });
    document.addEventListener("click", function (event) {
      if (settingsButton && !settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
        settingsDropdown.style.display = "none";
      }
    });
  }
  if (logoutButton) {
    logoutButton.addEventListener("click", function () {
      localStorage.removeItem("authToken");
      localStorage.removeItem("userRole");
      window.location.href = "login.html";
    });
  }
}
function apiRequest(_x, _x2) {
  return _apiRequest.apply(this, arguments);
}
function _apiRequest() {
  _apiRequest = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5(method, path) {
    var body,
      isFormData,
      onProgress,
      expectBlobResponse,
      token,
      endpoint,
      handleAuthError,
      options,
      response,
      errorMsg,
      _args5 = arguments,
      _t5,
      _t6;
    return _regenerator().w(function (_context5) {
      while (1) switch (_context5.n) {
        case 0:
          body = _args5.length > 2 && _args5[2] !== undefined ? _args5[2] : null;
          isFormData = _args5.length > 3 && _args5[3] !== undefined ? _args5[3] : false;
          onProgress = _args5.length > 4 && _args5[4] !== undefined ? _args5[4] : null;
          expectBlobResponse = _args5.length > 5 && _args5[5] !== undefined ? _args5[5] : false;
          token = localStorage.getItem('authToken');
          endpoint = "".concat(API_BASE_URL).concat(path);
          handleAuthError = function handleAuthError(errorMessage) {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userRole');
            showModalMessage(errorMessage, true);
            setTimeout(function () {
              window.location.href = 'login.html?sessionExpired=true';
            }, 1500);
          };
          if (!isFormData) {
            _context5.n = 1;
            break;
          }
          return _context5.a(2, new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) xhr.setRequestHeader('Authorization', "Bearer ".concat(token));
            if (onProgress && xhr.upload) xhr.upload.addEventListener('progress', onProgress);
            xhr.onload = function () {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  resolve(JSON.parse(xhr.responseText || '{}'));
                } catch (e) {
                  resolve({});
                }
              } else if (xhr.status === 401 || xhr.status === 403) {
                handleAuthError('Your session has expired. Please log in again.');
                reject(new Error('Authentication failed.'));
              } else {
                try {
                  reject(new Error(JSON.parse(xhr.responseText).error || 'An unknown error occurred.'));
                } catch (e) {
                  reject(new Error("HTTP error ".concat(xhr.status, " - ").concat(xhr.statusText)));
                }
              }
            };
            xhr.onerror = function () {
              return reject(new Error('Network error.'));
            };
            xhr.send(body);
          }));
        case 1:
          options = {
            method: method,
            headers: {}
          };
          if (token) options.headers['Authorization'] = "Bearer ".concat(token);
          if (body && !isFormData) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
          }
          _context5.n = 2;
          return fetch(endpoint, options);
        case 2:
          response = _context5.v;
          if (!(response.status === 401 || response.status === 403)) {
            _context5.n = 3;
            break;
          }
          handleAuthError('Your session has expired. Please log in again.');
          throw new Error('Authentication failed.');
        case 3:
          if (response.ok) {
            _context5.n = 9;
            break;
          }
          errorMsg = "HTTP error! Status: ".concat(response.status);
          _context5.p = 4;
          _context5.n = 5;
          return response.json();
        case 5:
          _t5 = _context5.v.error;
          if (_t5) {
            _context5.n = 6;
            break;
          }
          _t5 = errorMsg;
        case 6:
          errorMsg = _t5;
          _context5.n = 8;
          break;
        case 7:
          _context5.p = 7;
          _t6 = _context5.v;
        case 8:
          throw new Error(errorMsg);
        case 9:
          if (!expectBlobResponse) {
            _context5.n = 10;
            break;
          }
          return _context5.a(2, response.blob());
        case 10:
          if (!(response.status === 204 || response.headers.get("content-length") === "0")) {
            _context5.n = 11;
            break;
          }
          return _context5.a(2, null);
        case 11:
          return _context5.a(2, response.json());
      }
    }, _callee5, null, [[4, 7]]);
  }));
  return _apiRequest.apply(this, arguments);
}
function handleLoginPage() {/* ... function content from previous turn ... */}
function handleRegisterPage() {/* ... function content from previous turn ... */}
function handleSuiteHubPage() {/* ... function content from previous turn ... */}
function handleAccountPage() {/* ... function content from previous turn ... */}
function handleAdminPage() {/* ... function content from previous turn ... */}
function handlePricingPage() {/* ... function content from previous turn ... */}
function handleHiringPage() {/* ... function content from previous turn ... */}
function handleSchedulingPage() {/* ... function content from previous turn ... */}
function handleDocumentsPage() {/* ... function content from previous turn ... */}
function handleNewHireViewPage() {/* ... function content from previous turn ... */}
function handleChecklistsPage() {/* ... function content from previous turn ... */}

/**
 * =================================================================
 * COMPLETE & FIXED: handleDashboardPage
 * This function handles all logic for the dashboard.html page.
 * =================================================================
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
    _loadPositions = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2() {
      var response, _t2;
      return _regenerator().w(function (_context2) {
        while (1) switch (_context2.n) {
          case 0:
            if (newHirePositionSelect) {
              _context2.n = 1;
              break;
            }
            return _context2.a(2);
          case 1:
            newHirePositionSelect.innerHTML = '<option value="">Loading positions...</option>';
            _context2.p = 2;
            _context2.n = 3;
            return apiRequest("GET", "/positions");
          case 3:
            response = _context2.v;
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
            _context2.n = 5;
            break;
          case 4:
            _context2.p = 4;
            _t2 = _context2.v;
            console.error("Error loading positions:", _t2);
            newHirePositionSelect.innerHTML = '<option value="">Error loading positions</option>';
            showModalMessage("Failed to load positions: ".concat(_t2.message), true);
          case 5:
            return _context2.a(2);
        }
      }, _callee2, null, [[2, 4]]);
    }));
    return _loadPositions.apply(this, arguments);
  }
  function loadOnboardingSessions() {
    return _loadOnboardingSessions.apply(this, arguments);
  }
  function _loadOnboardingSessions() {
    _loadOnboardingSessions = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4() {
      var sessions, _t4;
      return _regenerator().w(function (_context4) {
        while (1) switch (_context4.n) {
          case 0:
            if (sessionListDiv) {
              _context4.n = 1;
              break;
            }
            return _context4.a(2);
          case 1:
            sessionListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading active onboardings...</p>';
            _context4.p = 2;
            _context4.n = 3;
            return apiRequest("GET", "/onboarding-sessions");
          case 3:
            sessions = _context4.v;
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
                  var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(event) {
                    var sessionId, confirmed, _t3;
                    return _regenerator().w(function (_context3) {
                      while (1) switch (_context3.n) {
                        case 0:
                          sessionId = event.target.dataset.sessionId;
                          _context3.n = 1;
                          return showConfirmModal('Are you sure you want to archive this onboarding session?');
                        case 1:
                          confirmed = _context3.v;
                          if (!confirmed) {
                            _context3.n = 5;
                            break;
                          }
                          _context3.p = 2;
                          _context3.n = 3;
                          return apiRequest("PUT", "/onboarding-sessions/".concat(sessionId, "/archive"));
                        case 3:
                          showModalMessage('Onboarding session archived successfully!', false);
                          loadOnboardingSessions();
                          _context3.n = 5;
                          break;
                        case 4:
                          _context3.p = 4;
                          _t3 = _context3.v;
                          showModalMessage("Failed to archive session: ".concat(_t3.message), true);
                        case 5:
                          return _context3.a(2);
                      }
                    }, _callee3, null, [[2, 4]]);
                  }));
                  return function (_x4) {
                    return _ref2.apply(this, arguments);
                  };
                }());
              });
            } else {
              sessionListDiv.innerHTML = '<p style="color: var(--text-medium);">No active onboardings.</p>';
            }
            _context4.n = 5;
            break;
          case 4:
            _context4.p = 4;
            _t4 = _context4.v;
            console.error("Error loading onboarding sessions:", _t4);
            sessionListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error loading onboarding sessions: ".concat(_t4.message, "</p>");
          case 5:
            return _context4.a(2);
        }
      }, _callee4, null, [[2, 4]]);
    }));
    return _loadOnboardingSessions.apply(this, arguments);
  }
  if (onboardUserForm) {
    onboardUserForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(e) {
        var newHireName, newHireEmail, newHirePosition, newHireId, response, _t;
        return _regenerator().w(function (_context) {
          while (1) switch (_context.n) {
            case 0:
              e.preventDefault();
              newHireName = document.getElementById("new-hire-name").value.trim();
              newHireEmail = document.getElementById("new-hire-email").value.trim();
              newHirePosition = newHirePositionSelect ? newHirePositionSelect.value : "";
              newHireId = document.getElementById("new-hire-id").value.trim();
              if (!(!newHireName || !newHireEmail || !newHirePosition)) {
                _context.n = 1;
                break;
              }
              showModalMessage("Please fill all required fields: Full Name, Email, and Position.", true);
              return _context.a(2);
            case 1:
              if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newHireEmail)) {
                _context.n = 2;
                break;
              }
              showModalMessage("Please enter a valid email address.", true);
              return _context.a(2);
            case 2:
              _context.p = 2;
              _context.n = 3;
              return apiRequest("POST", "/onboard-employee", {
                full_name: newHireName,
                email: newHireEmail,
                position_id: newHirePosition,
                employee_id: newHireId || null
              });
            case 3:
              response = _context.v;
              showModalMessage("Onboarding invite sent to ".concat(newHireEmail, " for position ").concat(newHirePosition, "."), false);
              onboardUserForm.reset();
              if (onboardUserModal) onboardUserModal.style.display = "none";
              loadOnboardingSessions();
              _context.n = 5;
              break;
            case 4:
              _context.p = 4;
              _t = _context.v;
              showModalMessage(_t.message, true);
            case 5:
              return _context.a(2);
          }
        }, _callee, null, [[2, 4]]);
      }));
      return function (_x3) {
        return _ref.apply(this, arguments);
      };
    }());
  }
  loadPositions();
  loadOnboardingSessions();
}

// Global DOMContentLoaded listener
document.addEventListener("DOMContentLoaded", function () {
  setupSettingsDropdown();
  var path = window.location.pathname;
  if (path.includes("login.html")) handleLoginPage();else if (path.includes("register.html")) handleRegisterPage();else if (path.includes("suite-hub.html")) handleSuiteHubPage();else if (path.includes("account.html")) handleAccountPage();else if (path.includes("admin.html")) handleAdminPage();else if (path.includes("dashboard.html")) handleDashboardPage();else if (path.includes("checklists.html")) handleChecklistsPage();else if (path.includes("new-hire-view.html")) handleNewHireViewPage();else if (path.includes("pricing.html")) handlePricingPage();else if (path.includes("documents.html")) handleDocumentsPage();else if (path.includes("hiring.html")) handleHiringPage();else if (path.includes("scheduling.html")) {
    if (typeof moment !== 'undefined') handleSchedulingPage();else console.error("Moment.js is not loaded.");
  }
});
