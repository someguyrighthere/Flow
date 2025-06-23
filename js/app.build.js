"use strict";

function _regenerator() { /*! regenerator-runtime -- Copyright (c) 2014-present, Facebook, Inc. -- license (MIT): https://github.com/babel/babel/blob/main/packages/babel-helpers/LICENSE */ var e, t, r = "function" == typeof Symbol ? Symbol : {}, n = r.iterator || "@@iterator", o = r.toStringTag || "@@toStringTag"; function i(r, n, o, i) { var c = n && n.prototype instanceof Generator ? n : Generator, u = Object.create(c.prototype); return _regeneratorDefine2(u, "_invoke", function (r, n, o) { var i, c, u, f = 0, p = o || [], y = !1, G = { p: 0, n: 0, v: e, a: d, f: d.bind(e, 4), d: function d(t, r) { return i = t, c = 0, u = e, G.n = r, a; } }; function d(r, n) { for (c = r, u = n, t = 0; !y && f && !o && t < p.length; t++) { var o, i = p[t], d = G.p, l = i[2]; r > 3 ? (o = l === n) && (u = i[(c = i[4]) ? 5 : (c = 3, 3)], i[4] = i[5] = e) : i[0] <= d && ((o = r < 2 && d < i[1]) ? (c = 0, G.v = n, G.n = i[1]) : d < l && (o = r < 3 || i[0] > n || n > l) && (i[4] = r, i[5] = n, G.n = l, c = 0)); } if (o || r > 1) return a; throw y = !0, n; } return function (o, p, l) { if (f > 1) throw TypeError("Generator is already running"); for (y && 1 === p && d(p, l), c = p, u = l; (t = c < 2 ? e : u) || !y;) { i || (c ? c < 3 ? (c > 1 && (G.n = -1), d(c, u)) : G.n = u : G.v = u); try { if (f = 2, i) { if (c || (o = "next"), t = i[o]) { if (!(t = t.call(i, u))) throw TypeError("iterator result is not an object"); if (!t.done) return t; u = t.value, c < 2 && (c = 0); } else 1 === c && (t = i["return"]) && t.call(i), c < 2 && (u = TypeError("The iterator does not provide a '" + o + "' method"), c = 1); i = e; } else if ((t = (y = G.n < 0) ? u : r.call(n, G)) !== a) break; } catch (t) { i = e, c = 1, u = t; } finally { f = 1; } } return { value: t, done: y }; }; }(r, o, i), !0), u; } var a = {}; function Generator() {} function GeneratorFunction() {} function GeneratorFunctionPrototype() {} t = Object.getPrototypeOf; var c = [][n] ? t(t([][n]())) : (_regeneratorDefine2(t = {}, n, function () { return this; }), t), u = GeneratorFunctionPrototype.prototype = Generator.prototype = Object.create(c); function f(e) { return Object.setPrototypeOf ? Object.setPrototypeOf(e, GeneratorFunctionPrototype) : (e.__proto__ = GeneratorFunctionPrototype, _regeneratorDefine2(e, o, "GeneratorFunction")), e.prototype = Object.create(u), e; } return GeneratorFunction.prototype = GeneratorFunctionPrototype, _regeneratorDefine2(u, "constructor", GeneratorFunctionPrototype), _regeneratorDefine2(GeneratorFunctionPrototype, "constructor", GeneratorFunction), GeneratorFunction.displayName = "GeneratorFunction", _regeneratorDefine2(GeneratorFunctionPrototype, o, "GeneratorFunction"), _regeneratorDefine2(u), _regeneratorDefine2(u, o, "Generator"), _regeneratorDefine2(u, n, function () { return this; }), _regeneratorDefine2(u, "toString", function () { return "[object Generator]"; }), (_regenerator = function _regenerator() { return { w: i, m: f }; })(); }
function _regeneratorDefine2(e, r, n, t) { var i = Object.defineProperty; try { i({}, "", {}); } catch (e) { i = 0; } _regeneratorDefine2 = function _regeneratorDefine(e, r, n, t) { if (r) i ? i(e, r, { value: n, enumerable: !t, configurable: !t, writable: !t }) : e[r] = n;else { var o = function o(r, n) { _regeneratorDefine2(e, r, function (e) { return this._invoke(r, n, e); }); }; o("next", 0), o("throw", 1), o("return", 2); } }, _regeneratorDefine2(e, r, n, t); }
function asyncGeneratorStep(n, t, e, r, o, a, c) { try { var i = n[a](c), u = i.value; } catch (n) { return void e(n); } i.done ? t(u) : Promise.resolve(u).then(r, o); }
function _asyncToGenerator(n) { return function () { var t = this, e = arguments; return new Promise(function (r, o) { var a = n.apply(t, e); function _next(n) { asyncGeneratorStep(a, r, o, _next, _throw, "next", n); } function _throw(n) { asyncGeneratorStep(a, r, o, _next, _throw, "throw", n); } _next(void 0); }); }; }
// app.js - Client-Side JavaScript for Flow Business Suite
// This file handles all client-side logic, form submissions, and API requests.
var API_BASE_URL = 'https://flow-gz1r.onrender.com';
var stripe;
if (typeof Stripe !== 'undefined') {
  stripe = Stripe('pk_live_51Ra4RJG06NHrwsY9lqejmXiGn8DAGzwlrqTuarPZzIb3p1yIPchUaPGAXuKe7yJD73UCvQ3ydKzoclwRi0DiIrbP00xbXj54td');
} else {
  console.warn("Stripe.js not loaded. Stripe functionalities will not work on this page.");
}

/**
 * Displays a custom modal message to the user.
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
      resolve(window.confirm(message));
      return;
    }
    confirmModalMessage.innerHTML = message;
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
              event.stopPropagation();
              settingsDropdown.style.display = settingsDropdown.style.display === "block" ? "none" : "block";
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

/**
 * Handles API requests to the backend.
 */
function apiRequest(_x2, _x3) {
  return _apiRequest.apply(this, arguments);
} // Page-specific handlers
function _apiRequest() {
  _apiRequest = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8(method, path) {
    var body,
      isFormData,
      onProgress,
      expectBlobResponse,
      token,
      endpoint,
      options,
      response,
      errorMsg,
      errorText,
      _args8 = arguments,
      _t5;
    return _regenerator().w(function (_context8) {
      while (1) switch (_context8.n) {
        case 0:
          body = _args8.length > 2 && _args8[2] !== undefined ? _args8[2] : null;
          isFormData = _args8.length > 3 && _args8[3] !== undefined ? _args8[3] : false;
          onProgress = _args8.length > 4 && _args8[4] !== undefined ? _args8[4] : null;
          expectBlobResponse = _args8.length > 5 && _args8[5] !== undefined ? _args8[5] : false;
          token = localStorage.getItem('authToken');
          endpoint = "".concat(API_BASE_URL).concat(path);
          if (!isFormData) {
            _context8.n = 1;
            break;
          }
          return _context8.a(2, new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) xhr.setRequestHeader('Authorization', "Bearer ".concat(token));
            if (onProgress && xhr.upload) xhr.upload.addEventListener('progress', onProgress);
            xhr.onload = function () {
              if (xhr.status >= 200 && xhr.status < 300) {
                if (xhr.status === 204 || xhr.status === 200 && xhr.responseText.length === 0) {
                  resolve({});
                } else {
                  try {
                    resolve(JSON.parse(xhr.responseText));
                  } catch (e) {
                    console.warn("API response was not JSON:", xhr.responseText);
                    resolve({
                      message: "Operation successful",
                      rawResponse: xhr.responseText
                    });
                  }
                }
              } else if (xhr.status === 401 || xhr.status === 403) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('userRole');
                showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
                reject(new Error('Authentication failed.'));
              } else {
                try {
                  var errorData = JSON.parse(xhr.responseText);
                  reject(new Error(errorData.error || "HTTP error! Status: ".concat(xhr.status)));
                } catch (e) {
                  reject(new Error("HTTP error! Status: ".concat(xhr.status, " - ").concat(xhr.statusText || 'Unknown Error')));
                }
              }
            };
            xhr.onerror = function () {
              return reject(new Error('Network error. Please check your connection.'));
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
          _context8.n = 2;
          return fetch(endpoint, options);
        case 2:
          response = _context8.v;
          if (!(response.status === 401 || response.status === 403)) {
            _context8.n = 3;
            break;
          }
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
          throw new Error('Authentication failed.');
        case 3:
          if (response.ok) {
            _context8.n = 8;
            break;
          }
          errorMsg = "HTTP error! Status: ".concat(response.status);
          _context8.p = 4;
          _context8.n = 5;
          return response.text();
        case 5:
          errorText = _context8.v;
          if (errorText) errorMsg = JSON.parse(errorText).error || errorText;
          _context8.n = 7;
          break;
        case 6:
          _context8.p = 6;
          _t5 = _context8.v;
        case 7:
          throw new Error(errorMsg);
        case 8:
          if (!expectBlobResponse) {
            _context8.n = 9;
            break;
          }
          return _context8.a(2, response.blob());
        case 9:
          if (!(response.status === 204 || response.headers.get("content-length") === "0")) {
            _context8.n = 10;
            break;
          }
          return _context8.a(2, null);
        case 10:
          return _context8.a(2, response.json());
      }
    }, _callee8, null, [[4, 6]]);
  }));
  return _apiRequest.apply(this, arguments);
}
function handleLoginPage() {/* ... function content from your app.js ... */}
function handleRegisterPage() {/* ... function content from your app.js ... */}
function handleSuiteHubPage() {/* ... function content from your app.js ... */}
function handleAccountPage() {/* ... function content from your app.js ... */}
function handleAdminPage() {/* ... function content from your app.js ... */}
function handleDashboardPage() {/* ... function content from your app.js ... */}
function handlePricingPage() {/* ... function content from your app.js ... */}
function handleHiringPage() {/* ... function content from your app.js ... */}
function handleSchedulingPage() {/* ... function content from your app.js ... */}
function handleDocumentsPage() {/* ... function content from your app.js ... */}

/**
 * =================================================================
 * handleChecklistsPage
 * =================================================================
 */
function handleChecklistsPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var checklistSection = document.getElementById('checklists-section');
  var newChecklistForm = document.getElementById("new-checklist-form");
  var structureTypeSelect = document.getElementById("structure-type-select");
  var timeGroupCountContainer = document.getElementById("time-group-count-container");
  var timeGroupCountInput = document.getElementById("time-group-count");
  var timeGroupCountLabel = document.getElementById("time-group-count-label");
  var tasksInputArea = document.getElementById("tasks-input-area");
  var attachDocumentModalOverlay = document.getElementById("attach-document-modal-overlay");
  var attachDocumentListDiv = document.getElementById("attach-document-list");
  var attachDocumentCancelBtn = document.getElementById("attach-document-cancel-btn");
  var currentTaskElementForAttachment = null;
  var taskCounter = 0;
  function addSingleTaskInput(container) {
    var task = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var div = document.createElement('div');
    div.className = 'form-group task-input-group';
    div.dataset.documentId = task.documentId || '';
    var uniqueInputId = "task-input-".concat(taskCounter++);
    div.innerHTML = "\n            <div class=\"task-input-container\">\n                <div class=\"form-group\" style=\"flex-grow: 1; margin-bottom: 0;\">\n                    <label for=\"".concat(uniqueInputId, "\">Task Description</label>\n                    <input type=\"text\" id=\"").concat(uniqueInputId, "\" class=\"task-description-input\" value=\"").concat(task.description || '', "\" placeholder=\"e.g., Complete HR paperwork\" required>\n                </div>\n                <div class=\"task-actions\" style=\"display: flex; align-items: flex-end; gap: 5px; margin-bottom: 0;\">\n                    <button type=\"button\" class=\"btn btn-secondary btn-sm attach-file-btn\">Attach</button>\n                    <button type=\"button\" class=\"btn btn-secondary btn-sm remove-task-btn\">Remove</button>\n                </div>\n            </div>\n            <div class=\"attached-document-info\" style=\"font-size: 0.8rem; color: var(--text-medium); margin-top: 5px; height: 1.2em;\">\n                ").concat(task.documentName ? "Attached: ".concat(task.documentName) : '', "\n            </div>\n        ");
    container.appendChild(div);
    div.querySelector('.remove-task-btn').addEventListener('click', function () {
      return div.remove();
    });
    div.querySelector('.attach-file-btn').addEventListener('click', function (e) {
      currentTaskElementForAttachment = e.target.closest('.task-input-group');
      openDocumentSelectorModal();
    });
  }
  function openDocumentSelectorModal() {
    return _openDocumentSelectorModal.apply(this, arguments);
  }
  function _openDocumentSelectorModal() {
    _openDocumentSelectorModal = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4() {
      var documents, removeAttachmentBtn, _t2;
      return _regenerator().w(function (_context4) {
        while (1) switch (_context4.n) {
          case 0:
            if (!(!attachDocumentModalOverlay || !attachDocumentListDiv)) {
              _context4.n = 1;
              break;
            }
            return _context4.a(2);
          case 1:
            attachDocumentListDiv.innerHTML = '<p>Loading documents...</p>';
            attachDocumentModalOverlay.style.display = 'flex';
            _context4.p = 2;
            _context4.n = 3;
            return apiRequest('GET', '/documents');
          case 3:
            documents = _context4.v;
            attachDocumentListDiv.innerHTML = '';
            removeAttachmentBtn = document.createElement('button');
            removeAttachmentBtn.className = 'list-item';
            removeAttachmentBtn.style.cssText = 'width: 100%; cursor: pointer; color: #ff8a80; justify-content: center; margin-bottom: 10px;';
            removeAttachmentBtn.textContent = 'Remove Attachment From Task';
            removeAttachmentBtn.onclick = function () {
              if (currentTaskElementForAttachment) {
                currentTaskElementForAttachment.dataset.documentId = '';
                currentTaskElementForAttachment.querySelector('.attached-document-info').textContent = '';
              }
              attachDocumentModalOverlay.style.display = 'none';
            };
            attachDocumentListDiv.appendChild(removeAttachmentBtn);
            if (!(documents.length === 0)) {
              _context4.n = 4;
              break;
            }
            attachDocumentListDiv.insertAdjacentHTML('beforeend', '<p>No documents found. Upload in "Documents" app first.</p>');
            return _context4.a(2);
          case 4:
            documents.forEach(function (doc) {
              var docButton = document.createElement('button');
              docButton.className = 'list-item';
              docButton.style.width = '100%';
              docButton.style.cursor = 'pointer';
              docButton.textContent = "".concat(doc.title, " (").concat(doc.file_name, ")");
              docButton.dataset.documentId = doc.document_id;
              docButton.dataset.documentName = doc.file_name;
              docButton.onclick = function () {
                if (currentTaskElementForAttachment) {
                  currentTaskElementForAttachment.dataset.documentId = docButton.dataset.documentId;
                  var infoDiv = currentTaskElementForAttachment.querySelector('.attached-document-info');
                  if (infoDiv) infoDiv.textContent = "Attached: ".concat(docButton.dataset.documentName);
                }
                attachDocumentModalOverlay.style.display = 'none';
              };
              attachDocumentListDiv.appendChild(docButton);
            });
            _context4.n = 6;
            break;
          case 5:
            _context4.p = 5;
            _t2 = _context4.v;
            attachDocumentListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error: ".concat(_t2.message, "</p>");
          case 6:
            return _context4.a(2);
        }
      }, _callee4, null, [[2, 5]]);
    }));
    return _openDocumentSelectorModal.apply(this, arguments);
  }
  if (attachDocumentCancelBtn) attachDocumentCancelBtn.addEventListener('click', function () {
    return attachDocumentModalOverlay.style.display = 'none';
  });
  if (attachDocumentModalOverlay) attachDocumentModalOverlay.addEventListener('click', function (e) {
    if (e.target === attachDocumentModalOverlay) attachDocumentModalOverlay.style.display = 'none';
  });
  function renderNewChecklistTaskInputs() {/* ... logic as before ... */}
  if (structureTypeSelect) structureTypeSelect.addEventListener('change', function () {/* ... logic as before ... */});
  if (timeGroupCountInput) timeGroupCountInput.addEventListener('input', renderNewChecklistTaskInputs);
  renderNewChecklistTaskInputs();
  function loadChecklists() {
    return _loadChecklists.apply(this, arguments);
  }
  function _loadChecklists() {
    _loadChecklists = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5() {
      return _regenerator().w(function (_context5) {
        while (1) switch (_context5.n) {
          case 0:
            return _context5.a(2);
        }
      }, _callee5);
    }));
    return _loadChecklists.apply(this, arguments);
  }
  if (checklistSection) {
    checklistSection.addEventListener('click', /*#__PURE__*/function () {
      var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(event) {
        return _regenerator().w(function (_context2) {
          while (1) switch (_context2.n) {
            case 0:
              return _context2.a(2);
          }
        }, _callee2);
      }));
      return function (_x4) {
        return _ref2.apply(this, arguments);
      };
    }());
  }
  if (newChecklistForm) {
    newChecklistForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(e) {
        return _regenerator().w(function (_context3) {
          while (1) switch (_context3.n) {
            case 0:
              return _context3.a(2);
          }
        }, _callee3);
      }));
      return function (_x5) {
        return _ref3.apply(this, arguments);
      };
    }());
  }
  loadChecklists();
}

/**
 * =================================================================
 * UPDATED: handleNewHireViewPage
 * =================================================================
 */
function handleNewHireViewPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var welcomeHeading = document.getElementById("welcome-heading");
  var taskListSection = document.getElementById("task-list-section");
  var completionCelebration = document.getElementById("completion-celebration");
  function triggerFireworks() {/* (logic from previous turns) */}
  function downloadFile(_x6, _x7) {
    return _downloadFile.apply(this, arguments);
  }
  function _downloadFile() {
    _downloadFile = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(documentId, fileName) {
      var blob, url, a, modalOverlay, _t3;
      return _regenerator().w(function (_context6) {
        while (1) switch (_context6.n) {
          case 0:
            _context6.p = 0;
            showModalMessage("Preparing your download...", false);
            _context6.n = 1;
            return apiRequest("GET", "/documents/download/".concat(documentId), null, false, null, true);
          case 1:
            blob = _context6.v;
            url = window.URL.createObjectURL(blob);
            a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(a.href);
            a.remove();

            // --- FIX: Replaced optional chaining with a standard if check ---
            modalOverlay = document.getElementById("message-modal-overlay");
            if (modalOverlay) {
              modalOverlay.style.display = 'none';
            }
            _context6.n = 3;
            break;
          case 2:
            _context6.p = 2;
            _t3 = _context6.v;
            showModalMessage("Failed to download file: ".concat(_t3.message), true);
          case 3:
            return _context6.a(2);
        }
      }, _callee6, null, [[0, 2]]);
    }));
    return _downloadFile.apply(this, arguments);
  }
  function loadOnboardingTasks() {
    return _loadOnboardingTasks.apply(this, arguments);
  }
  function _loadOnboardingTasks() {
    _loadOnboardingTasks = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7() {
      var urlParams, userIdForViewing, profile, targetUserId, tasksData, _tasksData$tasks$, allTasksCompleted, renderTask, _t4;
      return _regenerator().w(function (_context7) {
        while (1) switch (_context7.n) {
          case 0:
            if (taskListSection) {
              _context7.n = 1;
              break;
            }
            return _context7.a(2);
          case 1:
            taskListSection.innerHTML = '<p>Loading tasks...</p>';
            _context7.p = 2;
            urlParams = new URLSearchParams(window.location.search);
            userIdForViewing = urlParams.get('userId');
            _context7.n = 3;
            return apiRequest("GET", "/profile");
          case 3:
            profile = _context7.v;
            targetUserId = userIdForViewing || profile.user_id;
            welcomeHeading.textContent = "Welcome, ".concat(profile.full_name, "!");
            if (userIdForViewing) welcomeHeading.textContent = "Viewing Onboarding for User ID: ".concat(userIdForViewing);
            _context7.n = 4;
            return apiRequest("GET", "/onboarding-tasks/".concat(targetUserId));
          case 4:
            tasksData = _context7.v;
            taskListSection.innerHTML = '';
            if (tasksData && tasksData.tasks) {
              allTasksCompleted = true;
              renderTask = function renderTask(task) {
                if (!task.completed) allTasksCompleted = false;
                var attachmentHtml = task.documentId && task.documentName ? "<button class=\"btn btn-secondary btn-sm download-attachment-btn\" data-doc-id=\"".concat(task.documentId, "\" data-doc-name=\"").concat(task.documentName, "\">Download: ").concat(task.documentName, "</button>") : '';
                return "<div class=\"task-item ".concat(task.completed ? 'completed' : '', "\">\n                                <input type=\"checkbox\" id=\"task-").concat(task.id, "\" ").concat(task.completed ? 'checked' : '', " data-task-id=\"").concat(task.id, "\">\n                                <label for=\"task-").concat(task.id, "\">").concat(task.description, "</label>\n                                ").concat(attachmentHtml, "\n                            </div>");
              };
              if ((_tasksData$tasks$ = tasksData.tasks[0]) !== null && _tasksData$tasks$ !== void 0 && _tasksData$tasks$.groupTitle) {
                tasksData.tasks.forEach(function (group) {
                  var groupDiv = document.createElement('div');
                  groupDiv.className = 'task-group';
                  groupDiv.innerHTML = "<details open><summary>".concat(group.groupTitle, "</summary></details>");
                  var details = groupDiv.querySelector('details');
                  group.tasks.forEach(function (task) {
                    return details.innerHTML += renderTask(task);
                  });
                  taskListSection.appendChild(groupDiv);
                });
              } else {
                tasksData.tasks.forEach(function (task) {
                  return taskListSection.innerHTML += renderTask(task);
                });
              }
              taskListSection.querySelectorAll('.download-attachment-btn').forEach(function (button) {
                button.addEventListener('click', function (e) {
                  e.preventDefault();
                  downloadFile(e.target.dataset.docId, e.target.dataset.docName);
                });
              });
            } else {
              taskListSection.innerHTML = '<p>No onboarding tasks assigned.</p>';
            }
            _context7.n = 6;
            break;
          case 5:
            _context7.p = 5;
            _t4 = _context7.v;
            taskListSection.innerHTML = "<p style=\"color:red;\">Error: ".concat(_t4.message, "</p>");
          case 6:
            return _context7.a(2);
        }
      }, _callee7, null, [[2, 5]]);
    }));
    return _loadOnboardingTasks.apply(this, arguments);
  }
  loadOnboardingTasks();
}

// Global DOMContentLoaded listener
document.addEventListener("DOMContentLoaded", function () {
  setupSettingsDropdown();
  var path = window.location.pathname;
  if (path.includes("login.html")) handleLoginPage();else if (path.includes("register.html")) handleRegisterPage();else if (path.includes("suite-hub.html")) handleSuiteHubPage();else if (path.includes("account.html")) handleAccountPage();else if (path.includes("admin.html")) handleAdminPage();else if (path.includes("dashboard.html")) handleDashboardPage();else if (path.includes("checklists.html")) handleChecklistsPage();else if (path.includes("new-hire-view.html")) handleNewHireViewPage();else if (path.includes("pricing.html")) handlePricingPage();else if (path.includes("documents.html")) handleDocumentsPage();else if (path.includes("hiring.html")) handleHiringPage();else if (path.includes("scheduling.html")) {
    if (typeof moment !== 'undefined') {
      handleSchedulingPage();
    } else {
      console.error("Moment.js is not loaded.");
    }
  }
});
