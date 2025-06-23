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
      _t3,
      _t4;
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
          _t3 = _context5.v.error;
          if (_t3) {
            _context5.n = 6;
            break;
          }
          _t3 = errorMsg;
        case 6:
          errorMsg = _t3;
          _context5.n = 8;
          break;
        case 7:
          _context5.p = 7;
          _t4 = _context5.v;
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
function handleDashboardPage() {/* ... function content from previous turn ... */}
function handlePricingPage() {/* ... function content from previous turn ... */}
function handleHiringPage() {/* ... function content from previous turn ... */}
function handleSchedulingPage() {/* ... function content from previous turn ... */}
function handleDocumentsPage() {/* ... function content from previous turn ... */}
function handleNewHireViewPage() {/* ... function content from previous turn ... */}

/**
 * =================================================================
 * COMPLETE & FIXED: handleChecklistsPage
 * =================================================================
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
  var attachDocumentModalOverlay = document.getElementById("attach-document-modal-overlay");
  var attachDocumentListDiv = document.getElementById("attach-document-list");
  var attachDocumentCancelBtn = document.getElementById("attach-document-cancel-btn");
  var currentTaskElementForAttachment = null;
  var taskCounter = 0;

  /**
   * --- NEW: Helper function to generate the attachment chip UI ---
   */
  function renderAttachmentChip(task) {
    if (!task || !task.documentName) return '';
    return "\n            <div class=\"attachment-chip\" data-doc-id=\"".concat(task.documentId, "\" style=\"display: inline-flex; align-items: center; gap: 6px; background-color: rgba(255, 255, 255, 0.1); border: 1px solid var(--border-color); padding: 4px 8px; border-radius: 12px; font-size: 0.85rem; margin-top: 5px;\">\n                <svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" fill=\"currentColor\" viewBox=\"0 0 16 16\" style=\"flex-shrink: 0;\"><path d=\"M14 4.5V14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2h5.5L14 4.5zm-3 0A1.5 1.5 0 0 1 9.5 3V1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V4.5h-2z\"/></svg>\n                <span style=\"white-space: nowrap; overflow: hidden; text-overflow: ellipsis;\">").concat(task.documentName, "</span>\n                <button type=\"button\" class=\"remove-attachment-chip-btn\" title=\"Remove Attachment\" style=\"background: none; border: none; color: var(--text-medium); cursor: pointer; font-size: 1.2rem; line-height: 1; padding: 0 0 0 4px;\">&times;</button>\n            </div>\n        ");
  }

  /**
   * --- MODIFIED: This function now uses the helper to render the attachment chip ---
   */
  function addSingleTaskInput(container) {
    var task = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    var div = document.createElement('div');
    div.className = 'form-group task-input-group';
    div.dataset.documentId = task.documentId || '';
    div.dataset.documentName = task.documentName || ''; // Store name as well

    var uniqueInputId = "task-input-".concat(taskCounter++);
    div.innerHTML = "\n            <div class=\"task-input-container\">\n                <div class=\"form-group\" style=\"flex-grow: 1; margin-bottom: 0;\">\n                    <label for=\"".concat(uniqueInputId, "\">Task Description</label>\n                    <input type=\"text\" id=\"").concat(uniqueInputId, "\" class=\"task-description-input\" value=\"").concat(task.description || '', "\" placeholder=\"e.g., Complete HR paperwork\" required>\n                </div>\n                <div class=\"task-actions\" style=\"display: flex; align-items: flex-end; gap: 5px; margin-bottom: 0;\">\n                    <button type=\"button\" class=\"btn btn-secondary btn-sm attach-file-btn\">Attach</button>\n                    <button type=\"button\" class=\"btn btn-secondary btn-sm remove-task-btn\">Remove</button>\n                </div>\n            </div>\n            <div class=\"attached-document-info\" style=\"margin-top: 5px; height: auto; min-height: 1.2em;\">\n                ").concat(renderAttachmentChip(task), "\n            </div>\n        ");
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
    _openDocumentSelectorModal = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee3() {
      var documents, _t2;
      return _regenerator().w(function (_context3) {
        while (1) switch (_context3.n) {
          case 0:
            if (!(!attachDocumentModalOverlay || !attachDocumentListDiv)) {
              _context3.n = 1;
              break;
            }
            return _context3.a(2);
          case 1:
            attachDocumentListDiv.innerHTML = '<p>Loading documents...</p>';
            attachDocumentModalOverlay.style.display = 'flex';
            _context3.p = 2;
            _context3.n = 3;
            return apiRequest('GET', '/documents');
          case 3:
            documents = _context3.v;
            attachDocumentListDiv.innerHTML = '';
            if (!(documents.length === 0)) {
              _context3.n = 4;
              break;
            }
            attachDocumentListDiv.insertAdjacentHTML('beforeend', '<p>No documents found. Upload in "Documents" app first.</p>');
            return _context3.a(2);
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
                  var docId = docButton.dataset.documentId;
                  var docName = docButton.dataset.documentName;
                  currentTaskElementForAttachment.dataset.documentId = docId;
                  currentTaskElementForAttachment.dataset.documentName = docName;
                  var infoDiv = currentTaskElementForAttachment.querySelector('.attached-document-info');
                  if (infoDiv) {
                    infoDiv.innerHTML = renderAttachmentChip({
                      documentId: docId,
                      documentName: docName
                    });
                  }
                }
                attachDocumentModalOverlay.style.display = 'none';
              };
              attachDocumentListDiv.appendChild(docButton);
            });
            _context3.n = 6;
            break;
          case 5:
            _context3.p = 5;
            _t2 = _context3.v;
            attachDocumentListDiv.innerHTML = "<p style=\"color: #e74c3c;\">Error: ".concat(_t2.message, "</p>");
          case 6:
            return _context3.a(2);
        }
      }, _callee3, null, [[2, 5]]);
    }));
    return _openDocumentSelectorModal.apply(this, arguments);
  }
  if (attachDocumentCancelBtn) attachDocumentCancelBtn.addEventListener('click', function () {
    return attachDocumentModalOverlay.style.display = 'none';
  });
  if (attachDocumentModalOverlay) attachDocumentModalOverlay.addEventListener('click', function (e) {
    if (e.target === attachDocumentModalOverlay) attachDocumentModalOverlay.style.display = 'none';
  });

  // --- NEW: Event listener for removing an attachment chip directly ---
  tasksInputArea.addEventListener('click', function (e) {
    if (e.target.classList.contains('remove-attachment-chip-btn')) {
      var taskGroup = e.target.closest('.task-input-group');
      var infoDiv = taskGroup.querySelector('.attached-document-info');
      taskGroup.dataset.documentId = '';
      taskGroup.dataset.documentName = '';
      infoDiv.innerHTML = '';
    }
  });
  function renderNewChecklistTaskInputs() {
    if (!tasksInputArea || !structureTypeSelect || !timeGroupCountInput) return;
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
  function loadChecklists() {
    return _loadChecklists.apply(this, arguments);
  }
  function _loadChecklists() {
    _loadChecklists = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee4() {
      return _regenerator().w(function (_context4) {
        while (1) switch (_context4.n) {
          case 0:
            return _context4.a(2);
        }
      }, _callee4);
    }));
    return _loadChecklists.apply(this, arguments);
  }
  if (checklistSection) {
    checklistSection.addEventListener('click', /*#__PURE__*/function () {
      var _ref = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee(event) {
        return _regenerator().w(function (_context) {
          while (1) switch (_context.n) {
            case 0:
              return _context.a(2);
          }
        }, _callee);
      }));
      return function (_x3) {
        return _ref.apply(this, arguments);
      };
    }());
  }
  if (newChecklistForm) {
    newChecklistForm.addEventListener("submit", /*#__PURE__*/function () {
      var _ref2 = _asyncToGenerator(/*#__PURE__*/_regenerator().m(function _callee2(e) {
        var position, title, structure_type, group_count, tasks, _t;
        return _regenerator().w(function (_context2) {
          while (1) switch (_context2.n) {
            case 0:
              e.preventDefault();
              position = document.getElementById("new-checklist-position").value.trim();
              title = document.getElementById("new-checklist-title").value.trim();
              structure_type = structureTypeSelect.value;
              group_count = structure_type !== 'single_list' ? parseInt(timeGroupCountInput.value, 10) : 0;
              tasks = [];
              if (structure_type === 'single_list') {
                document.querySelectorAll('#tasks-input-area .task-input-group').forEach(function (groupEl) {
                  var descriptionInput = groupEl.querySelector('.task-description-input');
                  if (descriptionInput && descriptionInput.value.trim()) {
                    tasks.push({
                      description: descriptionInput.value.trim(),
                      completed: false,
                      documentId: groupEl.dataset.documentId || null,
                      documentName: groupEl.dataset.documentName || null
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
                        documentName: groupEl.dataset.documentName || null
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
                _context2.n = 1;
                break;
              }
              showModalMessage("Please provide a position, title, and at least one task.", true);
              return _context2.a(2);
            case 1:
              _context2.p = 1;
              _context2.n = 2;
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
              _context2.n = 4;
              break;
            case 3:
              _context2.p = 3;
              _t = _context2.v;
              showModalMessage(_t.message, true);
            case 4:
              return _context2.a(2);
          }
        }, _callee2, null, [[1, 3]]);
      }));
      return function (_x4) {
        return _ref2.apply(this, arguments);
      };
    }());
  }
  loadChecklists();
}

// Global DOMContentLoaded listener
document.addEventListener("DOMContentLoaded", function () {
  setupSettingsDropdown();
  var path = window.location.pathname;
  if (path.includes("login.html")) handleLoginPage();else if (path.includes("register.html")) handleRegisterPage();else if (path.includes("suite-hub.html")) handleSuiteHubPage();else if (path.includes("account.html")) handleAccountPage();else if (path.includes("admin.html")) handleAdminPage();else if (path.includes("dashboard.html")) handleDashboardPage();else if (path.includes("checklists.html")) handleChecklistsPage();else if (path.includes("new-hire-view.html")) handleNewHireViewPage();else if (path.includes("pricing.html")) handlePricingPage();else if (path.includes("documents.html")) handleDocumentsPage();else if (path.includes("hiring.html")) handleHiringPage();else if (path.includes("scheduling.html")) {
    if (typeof moment !== 'undefined') handleSchedulingPage();else console.error("Moment.js is not loaded.");
  }
});
