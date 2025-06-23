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

// (showModalMessage, showConfirmModal, setupSettingsDropdown, apiRequest functions remain the same...)
// ... Paste your existing showModalMessage, showConfirmModal, setupSettingsDropdown, and apiRequest functions here ...
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
      if (!settingsButton.contains(event.target) && !settingsDropdown.contains(event.target)) {
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
function apiRequest(_x2, _x3) {
  return _apiRequest.apply(this, arguments);
}
function _apiRequest() {
  _apiRequest = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee9(method, path) {
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
      errorData,
      _args9 = arguments,
      _t9;
    return _regenerator().w(function (_context9) {
      while (1) switch (_context9.n) {
        case 0:
          body = _args9.length > 2 && _args9[2] !== undefined ? _args9[2] : null;
          isFormData = _args9.length > 3 && _args9[3] !== undefined ? _args9[3] : false;
          onProgress = _args9.length > 4 && _args9[4] !== undefined ? _args9[4] : null;
          expectBlobResponse = _args9.length > 5 && _args9[5] !== undefined ? _args9[5] : false;
          token = localStorage.getItem('authToken');
          endpoint = "".concat(API_BASE_URL).concat(path);
          if (!isFormData) {
            _context9.n = 1;
            break;
          }
          return _context9.a(2, new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.open(method, endpoint);
            if (token) {
              xhr.setRequestHeader('Authorization', "Bearer ".concat(token));
            }
            if (onProgress && xhr.upload) {
              xhr.upload.addEventListener('progress', onProgress);
            }
            xhr.onload = function () {
              if (xhr.status >= 200 && xhr.status < 300) {
                if (xhr.status === 204 || xhr.status === 200 && xhr.responseText.length === 0) {
                  resolve({});
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
                localStorage.removeItem('authToken');
                localStorage.removeItem('userRole');
                showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
                reject(new Error('Authentication token missing or invalid.'));
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
              reject(new Error('Network error or request failed. Please check your internet connection.'));
            };
            xhr.send(body);
          }));
        case 1:
          options = {
            method: method,
            headers: {}
          };
          if (token) {
            options.headers['Authorization'] = "Bearer ".concat(token);
          }
          if (body && (method === 'POST' || method === 'PUT')) {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(body);
          }
          _context9.n = 2;
          return fetch(endpoint, options);
        case 2:
          response = _context9.v;
          if (!(response.status === 401 || response.status === 403)) {
            _context9.n = 3;
            break;
          }
          localStorage.removeItem('authToken');
          localStorage.removeItem('userRole');
          showModalMessage('Authentication token missing or invalid. Please refresh and log in.', true);
          throw new Error('Authentication token missing or invalid.');
        case 3:
          if (response.ok) {
            _context9.n = 8;
            break;
          }
          errorMsg = "HTTP error! Status: ".concat(response.status);
          _context9.p = 4;
          _context9.n = 5;
          return response.text();
        case 5:
          errorText = _context9.v;
          if (errorText) {
            try {
              errorData = JSON.parse(errorText);
              errorMsg = errorData.error || errorText;
            } catch (parseError) {
              errorMsg = errorText;
            }
          }
          _context9.n = 7;
          break;
        case 6:
          _context9.p = 6;
          _t9 = _context9.v;
          console.error("Could not read error response body", _t9);
        case 7:
          throw new Error(errorMsg);
        case 8:
          if (!expectBlobResponse) {
            _context9.n = 9;
            break;
          }
          return _context9.a(2, response.blob());
        case 9:
          if (!(response.status === 204 || response.status === 200 && response.headers.get("content-length") === "0")) {
            _context9.n = 10;
            break;
          }
          return _context9.a(2, null);
        case 10:
          return _context9.a(2, response.json());
        case 11:
          return _context9.a(2);
      }
    }, _callee9, null, [[4, 6]]);
  }));
  return _apiRequest.apply(this, arguments);
}
function handleLoginPage() {/* ... same as before ... */}
function handleRegisterPage() {/* ... same as before ... */}
function handleSuiteHubPage() {/* ... same as before ... */}
function handleAccountPage() {/* ... same as before ... */}
function handleAdminPage() {/* ... same as before ... */}
function handleDashboardPage() {/* ... same as before ... */}

/**
 * =================================================================
 * UPDATED: handleChecklistsPage
 * =================================================================
 * Handles logic for checklists.html page, including the new
 * "attach document" feature.
 */
function handleChecklistsPage() {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
    return;
  }
  var checklistSection = document.getElementById('checklists-section');
  var checklistListDiv = document.getElementById("checklist-list");
  var newChecklistForm = document.getElementById("new-checklist-form");
  var structureTypeSelect = document.getElementById("structure-type-select");
  var timeGroupCountContainer = document.getElementById("time-group-count-container");
  var timeGroupCountInput = document.getElementById("time-group-count");
  var timeGroupCountLabel = document.getElementById("time-group-count-label");
  var tasksInputArea = document.getElementById("tasks-input-area");

  // --- NEW: Elements for the Attach Document Modal ---
  var attachDocumentModalOverlay = document.getElementById("attach-document-modal-overlay");
  var attachDocumentListDiv = document.getElementById("attach-document-list");
  var attachDocumentCancelBtn = document.getElementById("attach-document-cancel-btn");
  var currentTaskElementForAttachment = null; // Variable to store which task we're attaching to

  var taskCounter = 0;

  /**
   * --- MODIFIED: This function now includes an "Attach File" button and a display area. ---
   * Adds a single task input field.
   * @param {HTMLElement} container - The container to add the input to.
   * @param {object} task - Optional object with task data { description, documentId, documentName }.
   */
  function addSingleTaskInput(container) {
    var task = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var div = document.createElement('div');
    div.className = 'form-group task-input-group';
    div.dataset.documentId = task.documentId || ''; // Store document ID here

    var uniqueInputId = "task-input-".concat(taskCounter++);
    div.innerHTML = "\n            <div class=\"task-input-container\">\n                <div class=\"form-group\" style=\"flex-grow: 1; margin-bottom: 0;\">\n                    <label for=\"".concat(uniqueInputId, "\">Task Description</label>\n                    <input type=\"text\" id=\"").concat(uniqueInputId, "\" class=\"task-description-input\" value=\"").concat(task.description || '', "\" placeholder=\"e.g., Complete HR paperwork\" required>\n                </div>\n                <div class=\"task-actions\" style=\"display: flex; align-items: flex-end; gap: 5px; margin-bottom: 0;\">\n                    <button type=\"button\" class=\"btn btn-secondary btn-sm attach-file-btn\">Attach</button>\n                    <button type=\"button\" class=\"btn btn-secondary btn-sm remove-task-btn\">Remove</button>\n                </div>\n            </div>\n            <div class=\"attached-document-info\" style=\"font-size: 0.8rem; color: var(--text-medium); margin-top: 5px; height: 1.2em;\">\n                ").concat(task.documentName ? "Attached: ".concat(task.documentName) : '', "\n            </div>\n        ");
    container.appendChild(div);
    div.querySelector('.remove-task-btn').addEventListener('click', function () {
      div.remove();
    });

    // --- NEW: Event listener for the "Attach" button ---
    div.querySelector('.attach-file-btn').addEventListener('click', function (e) {
      currentTaskElementForAttachment = e.target.closest('.task-input-group');
      openDocumentSelectorModal();
    });
  }

  // --- NEW: Function to open and populate the document selection modal ---
  function openDocumentSelectorModal() {
    return _openDocumentSelectorModal.apply(this, arguments);
  } // --- NEW: Event listeners for the new modal ---
  function _openDocumentSelectorModal() {
    _openDocumentSelectorModal = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4() {
      var documents, removeAttachmentBtn, _t4;
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
            attachDocumentListDiv.innerHTML = ''; // Clear loading message

            // --- NEW: Button to remove an existing attachment ---
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
            attachDocumentListDiv.insertAdjacentHTML('beforeend', '<p>No documents found. Please upload files in the "Documents" app first.</p>');
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
                  if (infoDiv) {
                    infoDiv.textContent = "Attached: ".concat(docButton.dataset.documentName);
                  }
                }
                attachDocumentModalOverlay.style.display = 'none';
              };
              attachDocumentListDiv.appendChild(docButton);
            });
            _context4.n = 6;
            break;
          case 5:
            _context4.p = 5;
            _t4 = _context4.v;
            attachDocumentListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error: ".concat(_t4.message, "</p>");
          case 6:
            return _context4.a(2);
        }
      }, _callee4, null, [[2, 5]]);
    }));
    return _openDocumentSelectorModal.apply(this, arguments);
  }
  if (attachDocumentCancelBtn) {
    attachDocumentCancelBtn.addEventListener('click', function () {
      attachDocumentModalOverlay.style.display = 'none';
    });
  }
  if (attachDocumentModalOverlay) {
    attachDocumentModalOverlay.addEventListener('click', function (e) {
      if (e.target === attachDocumentModalOverlay) {
        attachDocumentModalOverlay.style.display = 'none';
      }
    });
  }

  // Function to render task inputs (logic is the same, calls the modified addSingleTaskInput)
  function renderNewChecklistTaskInputs() {
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
        groupContainer.innerHTML = "\n                    <h4 style=\"color: var(--text-light); margin-top: 0;\">".concat(groupTitle, "</h4>\n                    <div class=\"tasks-in-group\" data-group-index=\"").concat(i, "\"></div>\n                    <button type=\"button\" class=\"btn btn-secondary add-task-to-group-btn\" style=\"margin-top: 10px;\" data-group-index=\"").concat(i, "\">Add Task to ").concat(groupTitle, " +</button>\n                ");
        tasksInputArea.appendChild(groupContainer);
        var tasksInGroupDiv = groupContainer.querySelector('.tasks-in-group');
        addSingleTaskInput(tasksInGroupDiv);
        groupContainer.querySelector('.add-task-to-group-btn').addEventListener('click', function (event) {
          var targetGroupDiv = tasksInputArea.querySelector(".tasks-in-group[data-group-index=\"".concat(event.target.dataset.groupIndex, "\"]"));
          if (targetGroupDiv) addSingleTaskInput(targetGroupDiv);
        });
      }
    }
  }

  // Event listeners for form structure (unchanged)
  if (structureTypeSelect) {
    structureTypeSelect.addEventListener('change', function () {
      var type = structureTypeSelect.value;
      timeGroupCountContainer.style.display = type === 'daily' || type === 'weekly' ? 'block' : 'none';
      timeGroupCountLabel.textContent = "Number of ".concat(type === 'daily' ? 'Days' : 'Weeks');
      renderNewChecklistTaskInputs();
    });
  }
  if (timeGroupCountInput) {
    timeGroupCountInput.addEventListener('input', renderNewChecklistTaskInputs);
  }
  renderNewChecklistTaskInputs();

  // Load existing checklists (logic unchanged)
  function loadChecklists() {
    return _loadChecklists.apply(this, arguments);
  } // Event delegation for delete (unchanged)
  function _loadChecklists() {
    _loadChecklists = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee5() {
      var checklists, _t5;
      return _regenerator().w(function (_context5) {
        while (1) switch (_context5.n) {
          case 0:
            if (checklistListDiv) {
              _context5.n = 1;
              break;
            }
            return _context5.a(2);
          case 1:
            checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">Loading task lists...</p>';
            _context5.p = 2;
            _context5.n = 3;
            return apiRequest("GET", "/checklists");
          case 3:
            checklists = _context5.v;
            checklistListDiv.innerHTML = '';
            if (checklists && checklists.length > 0) {
              checklists.forEach(function (checklist) {
                var checklistItem = document.createElement("div");
                checklistItem.className = "checklist-item";
                checklistItem.innerHTML = "\n                        <div class=\"checklist-item-title\">\n                            <span style=\"color: var(--primary-accent);\">".concat(checklist.position, "</span>\n                            <span>- ").concat(checklist.title, "</span>\n                            <span style=\"font-size: 0.8em; color: var(--text-medium);\">(").concat(checklist.structure_type, ")</span>\n                        </div>\n                        <div class=\"checklist-item-actions\">\n                            <button class=\"btn btn-secondary btn-sm view-checklist-btn\" data-checklist-id=\"").concat(checklist.checklist_id, "\">View/Edit</button>\n                            <button class=\"btn-delete\" data-type=\"checklist\" data-id=\"").concat(checklist.checklist_id, "\">\n                                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"16\" height=\"16\" fill=\"currentColor\" viewBox=\"0 0 16 16\"><path d=\"M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z\"/><path d=\"M14.5 3a1 10 0 0 1-1 1H13v9a2 10 0 0 1-2 2H5a2 10 0 0 1-2-2V4h-.5a1 10 0 0 1-1-1V2a1 10 0 0 1 1-1H6a1 10 0 0 1 1-1h2a1 10 0 0 1 1 1h3.5a1 10 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 10 0 0 0 1 1h6a1 10 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z\"/></svg>\n                            </button>\n                        </div>\n                    ");
                checklistListDiv.appendChild(checklistItem);
              });
            } else {
              checklistListDiv.innerHTML = '<p style="color: var(--text-medium);">No task lists created yet.</p>';
            }
            _context5.n = 5;
            break;
          case 4:
            _context5.p = 4;
            _t5 = _context5.v;
            console.error("Error loading checklists:", _t5);
            checklistListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error loading task lists: ".concat(_t5.message, "</p>");
          case 5:
            return _context5.a(2);
        }
      }, _callee5, null, [[2, 4]]);
    }));
    return _loadChecklists.apply(this, arguments);
  }
  if (checklistSection) {
    checklistSection.addEventListener('click', /*#__PURE__*/function () {
      var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(event) {
        var deleteButton, checklistId, confirmed, _t2;
        return _regenerator().w(function (_context2) {
          while (1) switch (_context2.n) {
            case 0:
              deleteButton = event.target.closest('.btn-delete[data-type="checklist"]');
              if (!deleteButton) {
                _context2.n = 5;
                break;
              }
              checklistId = deleteButton.dataset.id;
              _context2.n = 1;
              return showConfirmModal("Are you sure you want to delete this task list? This action cannot be undone.", "Delete");
            case 1:
              confirmed = _context2.v;
              if (!confirmed) {
                _context2.n = 5;
                break;
              }
              _context2.p = 2;
              _context2.n = 3;
              return apiRequest("DELETE", "/checklists/".concat(checklistId));
            case 3:
              showModalMessage("Task list deleted successfully!", false);
              loadChecklists();
              _context2.n = 5;
              break;
            case 4:
              _context2.p = 4;
              _t2 = _context2.v;
              showModalMessage("Failed to delete task list: ".concat(_t2.message), true);
            case 5:
              return _context2.a(2);
          }
        }, _callee2, null, [[2, 4]]);
      }));
      return function (_x4) {
        return _ref2.apply(this, arguments);
      };
    }());
  }

  // Form submission logic
  if (newChecklistForm) {
    newChecklistForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref3 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3(e) {
        var position, title, structure_type, group_count, tasks, _t3;
        return _regenerator().w(function (_context3) {
          while (1) switch (_context3.n) {
            case 0:
              e.preventDefault();
              position = document.getElementById("new-checklist-position").value.trim();
              title = document.getElementById("new-checklist-title").value.trim();
              structure_type = structureTypeSelect.value;
              group_count = structure_type === 'daily' || structure_type === 'weekly' ? parseInt(timeGroupCountInput.value, 10) : 0;
              tasks = []; // --- MODIFIED: This logic now collects the documentId and documentName ---
              if (structure_type === 'single_list') {
                document.querySelectorAll('#tasks-input-area .task-input-group').forEach(function (groupEl) {
                  var descriptionInput = groupEl.querySelector('.task-description-input');
                  if (descriptionInput && descriptionInput.value.trim()) {
                    tasks.push({
                      description: descriptionInput.value.trim(),
                      completed: false,
                      documentId: groupEl.dataset.documentId || null,
                      documentName: groupEl.querySelector('.attached-document-info').textContent.replace('Attached: ', '') || null
                    });
                  }
                });
              } else {
                document.querySelectorAll('#tasks-input-area .time-group-container').forEach(function (groupContainer, index) {
                  var groupTasks = [];
                  groupContainer.querySelectorAll('.task-input-group').forEach(function (groupEl) {
                    var descriptionInput = groupEl.querySelector('.task-description-input');
                    if (descriptionInput && descriptionInput.value.trim()) {
                      groupTasks.push({
                        description: descriptionInput.value.trim(),
                        completed: false,
                        documentId: groupEl.dataset.documentId || null,
                        documentName: groupEl.querySelector('.attached-document-info').textContent.replace('Attached: ', '') || null
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
                _context3.n = 1;
                break;
              }
              showModalMessage("Please provide a position, title, and at least one task.", true);
              return _context3.a(2);
            case 1:
              _context3.p = 1;
              _context3.n = 2;
              return apiRequest("POST", "/checklists", {
                position: position,
                title: title,
                structure_type: structure_type,
                group_count: group_count,
                tasks: tasks
              });
            case 2:
              showModalMessage("Task List \"".concat(title, "\" created successfully!"), false);
              newChecklistForm.reset();
              renderNewChecklistTaskInputs();
              loadChecklists();
              _context3.n = 4;
              break;
            case 3:
              _context3.p = 3;
              _t3 = _context3.v;
              showModalMessage(_t3.message, true);
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
  loadChecklists();
}

/**
 * =================================================================
 * UPDATED: handleNewHireViewPage
 * =================================================================
 * Handles logic for new-hire-view.html, now including logic to
 * display and handle download links for attached documents.
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
    if (completionCelebration) {
      completionCelebration.style.display = 'flex';
      setTimeout(function () {
        completionCelebration.style.display = 'none';
      }, 5000);
    }
  }

  // --- NEW: Helper to safely download a file with authentication ---
  function downloadFile(_x6, _x7) {
    return _downloadFile.apply(this, arguments);
  }
  function _downloadFile() {
    _downloadFile = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee6(documentId, fileName) {
      var blob, url, a, modalOverlay, _t6;
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
            window.URL.revokeObjectURL(url);
            a.remove();
            modalOverlay = document.getElementById("message-modal-overlay");
            if (modalOverlay) modalOverlay.style.display = 'none';
            _context6.n = 3;
            break;
          case 2:
            _context6.p = 2;
            _t6 = _context6.v;
            showModalMessage("Failed to download file: ".concat(_t6.message), true);
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
    _loadOnboardingTasks = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee8() {
      var urlParams, userIdForViewing, profile, targetUserId, tasksData, _tasksData$tasks$, allTasksCompleted, renderTask, _t8;
      return _regenerator().w(function (_context8) {
        while (1) switch (_context8.n) {
          case 0:
            if (taskListSection) {
              _context8.n = 1;
              break;
            }
            return _context8.a(2);
          case 1:
            taskListSection.innerHTML = '<p style="color: var(--text-medium);">Loading your tasks...</p>';
            _context8.p = 2;
            urlParams = new URLSearchParams(window.location.search);
            userIdForViewing = urlParams.get('userId');
            _context8.n = 3;
            return apiRequest("GET", "/profile");
          case 3:
            profile = _context8.v;
            targetUserId = userIdForViewing || profile.user_id;
            welcomeHeading.textContent = "Welcome, ".concat(profile.full_name, "!");
            if (userIdForViewing && userIdForViewing !== profile.user_id) {
              welcomeHeading.textContent = "Viewing Onboarding for User ID: ".concat(userIdForViewing);
            }
            _context8.n = 4;
            return apiRequest("GET", "/onboarding-tasks/".concat(targetUserId));
          case 4:
            tasksData = _context8.v;
            taskListSection.innerHTML = '';
            if (tasksData && tasksData.tasks) {
              allTasksCompleted = true; // --- MODIFIED: This function now renders a download button if there's an attachment ---
              renderTask = function renderTask(task) {
                if (!task.completed) allTasksCompleted = false;
                var attachmentHtml = task.documentId && task.documentName ? "<button class=\"btn btn-secondary btn-sm download-attachment-btn\" \n                                 data-doc-id=\"".concat(task.documentId, "\" \n                                 data-doc-name=\"").concat(task.documentName, "\" \n                                 style=\"margin-left: 15px;\">\n                            Download: ").concat(task.documentName, "\n                         </button>") : '';
                return "\n                        <div class=\"task-item ".concat(task.completed ? 'completed' : '', "\">\n                            <input type=\"checkbox\" id=\"task-").concat(task.id, "\" ").concat(task.completed ? 'checked' : '', " data-task-id=\"").concat(task.id, "\">\n                            <label for=\"task-").concat(task.id, "\">").concat(task.description, "</label>\n                            ").concat(attachmentHtml, "\n                        </div>\n                    ");
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
                  taskListSection.innerHTML += renderTask(task);
                });
              }
              taskListSection.querySelectorAll('input[type="checkbox"]').forEach(function (checkbox) {
                checkbox.addEventListener('change', /*#__PURE__*/function () {
                  var _ref4 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee7(event) {
                    var taskId, isCompleted, allDone, _t7;
                    return _regenerator().w(function (_context7) {
                      while (1) switch (_context7.n) {
                        case 0:
                          taskId = event.target.dataset.taskId;
                          isCompleted = event.target.checked;
                          _context7.p = 1;
                          _context7.n = 2;
                          return apiRequest("PUT", "/onboarding-tasks/".concat(taskId), {
                            completed: isCompleted
                          });
                        case 2:
                          event.target.closest('.task-item').classList.toggle('completed', isCompleted);
                          allDone = Array.from(taskListSection.querySelectorAll('input[type="checkbox"]')).every(function (cb) {
                            return cb.checked;
                          });
                          if (allDone) triggerFireworks();
                          _context7.n = 4;
                          break;
                        case 3:
                          _context7.p = 3;
                          _t7 = _context7.v;
                          showModalMessage("Failed to update task: ".concat(_t7.message), true);
                          event.target.checked = !isCompleted;
                        case 4:
                          return _context7.a(2);
                      }
                    }, _callee7, null, [[1, 3]]);
                  }));
                  return function (_x8) {
                    return _ref4.apply(this, arguments);
                  };
                }());
              });

              // --- NEW: Event listener for the new download buttons ---
              taskListSection.querySelectorAll('.download-attachment-btn').forEach(function (button) {
                button.addEventListener('click', function (e) {
                  e.preventDefault();
                  var docId = e.target.dataset.docId;
                  var docName = e.target.dataset.docName;
                  downloadFile(docId, docName);
                });
              });
              if (allTasksCompleted && tasksData.tasks.length > 0) {
                triggerFireworks();
              }
            } else {
              taskListSection.innerHTML = '<p style="color: var(--text-medium);">No onboarding tasks assigned or found.</p>';
            }
            _context8.n = 6;
            break;
          case 5:
            _context8.p = 5;
            _t8 = _context8.v;
            console.error("Error loading onboarding tasks:", _t8);
            taskListSection.innerHTML = "<p style=\"color: #e74c3c;\">Error loading tasks: ".concat(_t8.message, "</p>");
          case 6:
            return _context8.a(2);
        }
      }, _callee8, null, [[2, 5]]);
    }));
    return _loadOnboardingTasks.apply(this, arguments);
  }
  loadOnboardingTasks();
}

// ... other handler functions (handlePricingPage, handleHiringPage, etc.) remain the same ...
// ... Paste your existing handlePricingPage, handleHiringPage, etc. functions here ...
function handlePricingPage() {/* ... same as before ... */}
function handleHiringPage() {/* ... same as before ... */}
function handleDocumentsPage() {/* ... same as before ... */}
function handleSchedulingPage() {/* ... same as before ... */}

// Global DOMContentLoaded listener to call page-specific handlers
document.addEventListener("DOMContentLoaded", function () {
  setupSettingsDropdown();
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
    handleDashboardPage();
  } else if (path.includes("checklists.html")) {
    handleChecklistsPage();
  } else if (path.includes("new-hire-view.html")) {
    handleNewHireViewPage();
  } else if (path.includes("pricing.html")) {
    handlePricingPage();
  } else if (path.includes("documents.html")) {
    handleDocumentsPage();
  } else if (path.includes("hiring.html")) {
    handleHiringPage();
  } else if (path.includes("scheduling.html")) {
    if (typeof moment === 'undefined') {
      console.error("Moment.js is not loaded. Scheduling page functionality will be limited.");
      showModalMessage("Scheduling requires Moment.js library. Please ensure it's loaded in scheduling.html.", true);
    } else {
      handleSchedulingPage();
    }
  }
});
