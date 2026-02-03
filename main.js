var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => RenniePlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian7 = require("obsidian");

// src/RennieView.ts
var import_obsidian = require("obsidian");
var RENNIE_VIEW_TYPE = "rennie-chat-view";
var RennieView = class extends import_obsidian.ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.messages = [];
    this.isLoading = false;
  }
  getViewType() {
    return RENNIE_VIEW_TYPE;
  }
  getDisplayText() {
    return "Ask Rennie Anything";
  }
  getIcon() {
    return "message-circle";
  }
  async onOpen() {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("rennie-chat-container");
    this.messagesEl = container.createDiv({ cls: "rennie-messages" });
    const inputContainer = container.createDiv({ cls: "rennie-input-container" });
    this.inputEl = inputContainer.createEl("textarea", {
      cls: "rennie-input",
      attr: { placeholder: "Ask Rennie anything...", rows: "2" }
    });
    const buttonRow = inputContainer.createDiv({ cls: "rennie-button-row" });
    const includeNoteToggle = buttonRow.createEl("label", { cls: "rennie-toggle" });
    const checkbox = includeNoteToggle.createEl("input", { type: "checkbox" });
    checkbox.checked = true;
    includeNoteToggle.appendText(" Include current note");
    const sendBtn = buttonRow.createEl("button", {
      cls: "rennie-send-btn",
      text: "Send"
    });
    sendBtn.addEventListener("click", () => this.sendMessage(checkbox.checked));
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.sendMessage(checkbox.checked);
      }
    });
    const welcomeEl = this.messagesEl.createDiv({ cls: "rennie-welcome" });
    welcomeEl.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="64" height="64" style="margin-bottom: 8px; opacity: 0.9;">
        <g>
          <animateTransform attributeName="transform" type="translate" values="0,0; 0,-1; 0,0" dur="4s" repeatCount="indefinite" calcMode="spline" keySplines="0.45 0 0.55 1; 0.45 0 0.55 1"/>
          <rect x="24" y="40" width="72" height="58" rx="8" fill="#E8846B"/>
          <polygon points="60,10 18,44 102,44" fill="#CC6B52"/>
          <rect x="80" y="16" width="8" height="20" rx="2" fill="#E8846B"/>
          <circle cx="46" cy="62" r="8" fill="#1A1A1A"/><circle cx="43" cy="59" r="3" fill="#FFF" opacity="0.85"/>
          <circle cx="74" cy="62" r="8" fill="#1A1A1A"/><circle cx="71" cy="59" r="3" fill="#FFF" opacity="0.85"/>
          <ellipse cx="36" cy="72" rx="6" ry="3.5" fill="#CC6B52" opacity="0.35"/>
          <ellipse cx="84" cy="72" rx="6" ry="3.5" fill="#CC6B52" opacity="0.35"/>
          <path d="M52 78 Q60 84 68 78" fill="none" stroke="#CC6B52" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="40" cy="100" rx="10" ry="6" fill="#E8846B"/>
          <ellipse cx="80" cy="100" rx="10" ry="6" fill="#E8846B"/>
        </g>
      </svg>
      <div class="rennie-welcome-text">Ask me anything</div>
      <div class="rennie-welcome-hint">I know your vault. Try \u2318+Enter to send.</div>
    `;
    this.addMessage({
      role: "assistant",
      content: "Hey! I'm Rennie \u2014 ask me anything, or ask me to create and edit notes.",
      timestamp: Date.now()
    });
  }
  async onClose() {
  }
  async sendMessage(includeCurrentNote) {
    const message = this.inputEl.value.trim();
    if (!message || this.isLoading)
      return;
    this.inputEl.value = "";
    this.isLoading = true;
    this.addMessage({
      role: "user",
      content: message,
      timestamp: Date.now()
    });
    let context = {};
    if (includeCurrentNote) {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile instanceof import_obsidian.TFile) {
        context.currentFile = activeFile.path;
        context.currentContent = await this.app.vault.read(activeFile);
      }
    }
    const loadingEl = this.messagesEl.createDiv({ cls: "rennie-message rennie-loading" });
    loadingEl.setText("Rennie is thinking...");
    try {
      const response = await this.plugin.api.chat(message, context);
      loadingEl.remove();
      this.addMessage({
        role: "assistant",
        content: response.text,
        timestamp: Date.now(),
        actions: response.actions
      });
      if (response.actions.length > 0) {
        await this.plugin.actionExecutor.execute(response.actions);
      }
    } catch (err) {
      loadingEl.remove();
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.addMessage({
        role: "error",
        content: errorMsg,
        timestamp: Date.now()
      });
    }
    this.isLoading = false;
  }
  addMessage(msg) {
    this.messages.push(msg);
    const messageEl = this.messagesEl.createDiv({
      cls: `rennie-message rennie-${msg.role}`
    });
    const contentEl = messageEl.createDiv({ cls: "rennie-message-content" });
    if (msg.role === "assistant") {
      import_obsidian.MarkdownRenderer.render(
        this.app,
        msg.content,
        contentEl,
        "",
        this.plugin
      );
    } else if (msg.role === "error") {
      const errorText = contentEl.createEl("code", { cls: "rennie-error-text" });
      errorText.setText(msg.content);
      const copyBtn = contentEl.createEl("button", {
        cls: "rennie-copy-btn",
        text: "Copy"
      });
      copyBtn.addEventListener("click", async () => {
        await navigator.clipboard.writeText(msg.content);
        copyBtn.setText("Copied!");
        setTimeout(() => copyBtn.setText("Copy"), 1500);
      });
    } else {
      contentEl.setText(msg.content);
    }
    if (msg.actions && msg.actions.length > 0 && this.plugin.settings.showActionsInChat) {
      const actionsEl = messageEl.createDiv({ cls: "rennie-actions" });
      actionsEl.setText(`\u{1F4C1} ${msg.actions.length} file action(s)`);
    }
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
};

// src/api.ts
var import_obsidian2 = require("obsidian");

// src/secureStorage.ts
var safeStorage = null;
var safeStorageAvailable = null;
function getSafeStorage() {
  var _a;
  if (safeStorageAvailable === false)
    return null;
  if (safeStorage)
    return safeStorage;
  try {
    const electron = require("electron");
    if ((_a = electron == null ? void 0 : electron.remote) == null ? void 0 : _a.safeStorage) {
      safeStorage = electron.remote.safeStorage;
    } else if (electron == null ? void 0 : electron.safeStorage) {
      safeStorage = electron.safeStorage;
    }
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      safeStorageAvailable = true;
      console.log("Rennie: safeStorage available");
      return safeStorage;
    }
  } catch (e) {
    console.log("Rennie: safeStorage not available", e);
  }
  safeStorageAvailable = false;
  return null;
}
function getEnvToken() {
  try {
    const token = process.env.OPENCLAW_TOKEN;
    return token || null;
  } catch (e) {
    return null;
  }
}
var SecureTokenStorage = class {
  constructor() {
    this.encryptedToken = null;
    this.plaintextToken = "";
  }
  /**
   * Get the current storage method being used
   */
  getActiveMethod() {
    if (getEnvToken())
      return "envVar";
    if (getSafeStorage())
      return "safeStorage";
    return "plaintext";
  }
  /**
   * Get human-readable status for display in settings
   */
  getStatusInfo() {
    const envToken = getEnvToken();
    if (envToken) {
      return {
        method: "envVar",
        description: "Using OPENCLAW_TOKEN environment variable",
        secure: true
      };
    }
    const storage = getSafeStorage();
    if (storage) {
      return {
        method: "safeStorage",
        description: "Encrypted with OS keychain (Keychain/DPAPI/libsecret)",
        secure: true
      };
    }
    return {
      method: "plaintext",
      description: "\u26A0\uFE0F Stored in plaintext - avoid syncing plugin folder",
      secure: false
    };
  }
  /**
   * Store a token securely
   */
  setToken(token) {
    if (getEnvToken()) {
      return { encrypted: null, plaintext: "" };
    }
    const storage = getSafeStorage();
    if (storage && token) {
      try {
        const encrypted = storage.encryptString(token);
        this.encryptedToken = encrypted.toString("base64");
        this.plaintextToken = "";
        return { encrypted: this.encryptedToken, plaintext: "" };
      } catch (e) {
        console.error("Rennie: Failed to encrypt token", e);
      }
    }
    this.encryptedToken = null;
    this.plaintextToken = token;
    return { encrypted: null, plaintext: token };
  }
  /**
   * Retrieve a token
   */
  getToken(encrypted, plaintext) {
    const envToken = getEnvToken();
    if (envToken) {
      return envToken;
    }
    if (encrypted) {
      const storage = getSafeStorage();
      if (storage) {
        try {
          const buffer = Buffer.from(encrypted, "base64");
          return storage.decryptString(buffer);
        } catch (e) {
          console.error("Rennie: Failed to decrypt token", e);
        }
      }
    }
    return plaintext || "";
  }
  /**
   * Check if safeStorage is available (for UI display)
   */
  isSafeStorageAvailable() {
    return getSafeStorage() !== null;
  }
  /**
   * Check if env var is set (for UI display)
   */
  isEnvVarSet() {
    return getEnvToken() !== null;
  }
};
var secureTokenStorage = new SecureTokenStorage();

// src/api.ts
var RennieAPI = class {
  constructor(settings) {
    this.settings = settings;
  }
  getToken() {
    return secureTokenStorage.getToken(
      this.settings.gatewayTokenEncrypted,
      this.settings.gatewayTokenPlaintext
    );
  }
  async chat(message, context) {
    var _a, _b, _c, _d;
    const systemParts = [
      "You are Rennie, the RentHero assistant in Obsidian.",
      "When asked to create or modify files, include a JSON action block.",
      'Format: ```json:rennie-actions\\n[{"action": "...", ...}]\\n```',
      "Supported actions: createFile, updateFile, appendToFile, deleteFile, renameFile, openFile"
    ];
    if (context == null ? void 0 : context.currentFile) {
      systemParts.push(`
User is viewing: ${context.currentFile}`);
      if (context.currentContent) {
        systemParts.push(`
File content:
${context.currentContent}`);
      }
    }
    const url = `${this.settings.gatewayUrl}/v1/chat/completions`;
    let response;
    try {
      response = await (0, import_obsidian2.requestUrl)({
        url,
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.getToken()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "clawdbot:main",
          messages: [
            { role: "system", content: systemParts.join("\n") },
            { role: "user", content: message }
          ]
        })
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`Request to ${url} failed: ${msg}`);
    }
    if (response.status >= 400) {
      const body = typeof response.text === "string" ? response.text : "";
      throw new Error(`HTTP ${response.status} from ${url}
${body}`.trim());
    }
    const data = response.json;
    const text = (_d = (_c = (_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) != null ? _d : "";
    const actions = this.parseActions(text);
    return {
      text: this.stripActionBlocks(text),
      actions
    };
  }
  parseActions(text) {
    const match = text.match(/```json:rennie-actions\n([\s\S]*?)```/);
    if (!match)
      return [];
    try {
      return JSON.parse(match[1]);
    } catch (e) {
      console.error("Failed to parse rennie-actions:", match[1]);
      return [];
    }
  }
  stripActionBlocks(text) {
    return text.replace(/```json:rennie-actions\n[\s\S]*?```\n?/g, "").trim();
  }
};

// src/actions.ts
var import_obsidian3 = require("obsidian");
var DESTRUCTIVE_ACTIONS = ["deleteFile", "updateFile", "renameFile"];
var ConfirmActionModal = class extends import_obsidian3.Modal {
  constructor(app, action, description) {
    super(app);
    this.action = action;
    this.description = description;
    this.result = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Confirm Action" });
    contentEl.createEl("p", { text: "Rennie wants to perform the following action:" });
    const detailsEl = contentEl.createDiv({ cls: "rennie-confirm-details" });
    detailsEl.createEl("strong", { text: this.getActionLabel() });
    detailsEl.createEl("p", { text: this.description });
    if (this.action.action === "deleteFile") {
      const warningEl = contentEl.createDiv({ cls: "rennie-confirm-warning" });
      warningEl.setText("\u26A0\uFE0F This action cannot be undone.");
    }
    const buttonContainer = contentEl.createDiv({ cls: "rennie-confirm-buttons" });
    const cancelBtn = buttonContainer.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener("click", () => {
      this.result = false;
      this.close();
    });
    const confirmBtn = buttonContainer.createEl("button", {
      text: "Confirm",
      cls: "mod-cta"
    });
    confirmBtn.addEventListener("click", () => {
      this.result = true;
      this.close();
    });
    confirmBtn.focus();
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (this.resolvePromise) {
      this.resolvePromise(this.result);
    }
  }
  getActionLabel() {
    switch (this.action.action) {
      case "deleteFile":
        return "\u{1F5D1}\uFE0F Delete File";
      case "updateFile":
        return "\u270F\uFE0F Update File";
      case "renameFile":
        return "\u{1F4DD} Rename File";
      default:
        return this.action.action;
    }
  }
  async waitForResult() {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }
};
var ActionExecutor = class {
  constructor(app, getSettings) {
    this.app = app;
    this.getSettings = getSettings;
  }
  async execute(actions) {
    let success = 0;
    let failed = 0;
    let skipped = 0;
    for (const action of actions) {
      try {
        if (DESTRUCTIVE_ACTIONS.includes(action.action)) {
          const description = this.getActionDescription(action);
          const modal = new ConfirmActionModal(this.app, action, description);
          const confirmed = await modal.waitForResult();
          if (!confirmed) {
            skipped++;
            await this.logAction(action, "skipped");
            new import_obsidian3.Notice(`Rennie: Skipped ${action.action}`);
            continue;
          }
        }
        await this.executeOne(action);
        await this.logAction(action, "success");
        success++;
      } catch (err) {
        console.error("Action failed:", action, err);
        await this.logAction(action, "failed", err instanceof Error ? err.message : String(err));
        failed++;
      }
    }
    if (success > 0) {
      new import_obsidian3.Notice(`Rennie: ${success} action(s) completed`);
    }
    if (failed > 0) {
      new import_obsidian3.Notice(`Rennie: ${failed} action(s) failed`);
    }
    return { success, failed, skipped };
  }
  async logAction(action, status, error) {
    const settings = this.getSettings();
    if (!settings.auditLogEnabled)
      return;
    const { vault } = this.app;
    const logPath = settings.auditLogPath;
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const statusEmoji = status === "success" ? "\u2705" : status === "failed" ? "\u274C" : "\u23ED\uFE0F";
    let entry = `
| ${timestamp} | ${statusEmoji} ${status} | \`${action.action}\` | `;
    switch (action.action) {
      case "createFile":
      case "deleteFile":
      case "openFile":
        entry += `\`${action.path}\` |`;
        break;
      case "updateFile":
      case "appendToFile":
        entry += `\`${action.path}\` |`;
        break;
      case "renameFile":
        entry += `\`${action.path}\` \u2192 \`${action.newPath}\` |`;
        break;
      default:
        entry += `${JSON.stringify(action)} |`;
    }
    if (error) {
      entry += ` ${error}`;
    }
    let logFile = vault.getAbstractFileByPath(logPath);
    if (!logFile) {
      const folderPath = logPath.substring(0, logPath.lastIndexOf("/"));
      if (folderPath) {
        const folder = vault.getAbstractFileByPath(folderPath);
        if (!folder) {
          await vault.createFolder(folderPath);
        }
      }
      const header = `# Rennie Audit Log

| Timestamp | Status | Action | Details |
|-----------|--------|--------|---------|`;
      await vault.create(logPath, header + entry);
    } else if (logFile instanceof import_obsidian3.TFile) {
      const content = await vault.read(logFile);
      await vault.modify(logFile, content + entry);
    }
  }
  getActionDescription(action) {
    switch (action.action) {
      case "deleteFile":
        return `Delete: ${action.path}`;
      case "updateFile":
        return `Replace contents of: ${action.path}`;
      case "renameFile":
        return `Rename: ${action.path} \u2192 ${action.newPath}`;
      default:
        return JSON.stringify(action);
    }
  }
  async executeOne(action) {
    const { vault } = this.app;
    switch (action.action) {
      case "createFile": {
        const exists = vault.getAbstractFileByPath(action.path);
        if (exists) {
          throw new Error(`File already exists: ${action.path}`);
        }
        const folderPath = action.path.substring(0, action.path.lastIndexOf("/"));
        if (folderPath) {
          const folder = vault.getAbstractFileByPath(folderPath);
          if (!folder) {
            await vault.createFolder(folderPath);
          }
        }
        await vault.create(action.path, action.content);
        break;
      }
      case "updateFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!(file instanceof import_obsidian3.TFile)) {
          throw new Error(`File not found: ${action.path}`);
        }
        await vault.modify(file, action.content);
        break;
      }
      case "appendToFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!(file instanceof import_obsidian3.TFile)) {
          throw new Error(`File not found: ${action.path}`);
        }
        const current = await vault.read(file);
        await vault.modify(file, current + "\n" + action.content);
        break;
      }
      case "deleteFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!file) {
          throw new Error(`File not found: ${action.path}`);
        }
        await vault.delete(file);
        break;
      }
      case "renameFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!file) {
          throw new Error(`File not found: ${action.path}`);
        }
        await vault.rename(file, action.newPath);
        break;
      }
      case "openFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!(file instanceof import_obsidian3.TFile)) {
          throw new Error(`File not found: ${action.path}`);
        }
        await this.app.workspace.getLeaf().openFile(file);
        break;
      }
      default:
        throw new Error(`Unknown action: ${action.action}`);
    }
  }
};

// src/settings.ts
var import_obsidian4 = require("obsidian");

// src/types.ts
var RENTHERO_SYNC_PATHS = [
  { remotePath: "docs", localPath: "RentHero/Docs", enabled: true },
  { remotePath: "repos", localPath: "RentHero/Repos", enabled: true },
  { remotePath: "decisions", localPath: "RentHero/Decisions", enabled: true },
  { remotePath: "projects", localPath: "RentHero/Projects", enabled: true },
  { remotePath: "notes", localPath: "RentHero/Notes", enabled: true },
  { remotePath: "trello", localPath: "RentHero/Trello", enabled: true },
  { remotePath: "templates", localPath: "RentHero/Templates", enabled: true },
  { remotePath: "inbox", localPath: "RentHero/Inbox", enabled: true }
];
var DEFAULT_SETTINGS = {
  gatewayUrl: "https://rennie.renthero.com/api",
  gatewayTokenEncrypted: null,
  gatewayTokenPlaintext: "",
  showActionsInChat: false,
  auditLogEnabled: false,
  auditLogPath: "RentHero/audit-log.md",
  // Sync defaults
  syncEnabled: true,
  syncServerUrl: "https://rennie.renthero.com",
  syncPaths: [...RENTHERO_SYNC_PATHS],
  syncInterval: 15,
  syncConflictBehavior: "ask"
};

// src/settings.ts
var RennieSettingTab = class extends import_obsidian4.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "Connection" });
    const token = secureTokenStorage.getToken(
      this.plugin.settings.gatewayTokenEncrypted,
      this.plugin.settings.gatewayTokenPlaintext
    );
    if (token) {
      const statusDiv = containerEl.createDiv({ cls: "rennie-connected" });
      statusDiv.innerHTML = `<div style="padding: 14px 16px; background: rgba(232,132,107,0.06); border-radius: 10px; border: 1px solid rgba(232,132,107,0.15); margin-bottom: 16px; display: flex; align-items: center; gap: 12px;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="36" height="36" style="flex-shrink:0;">
          <rect x="24" y="40" width="72" height="58" rx="8" fill="#E8846B"/>
          <polygon points="60,10 18,44 102,44" fill="#CC6B52"/>
          <circle cx="46" cy="62" r="8" fill="#1A1A1A"/><circle cx="43" cy="59" r="3" fill="#FFF" opacity="0.85"/>
          <circle cx="74" cy="62" r="8" fill="#1A1A1A"/><circle cx="71" cy="59" r="3" fill="#FFF" opacity="0.85"/>
          <path d="M52 78 Q60 84 68 78" fill="none" stroke="#CC6B52" stroke-width="2" stroke-linecap="round"/>
        </svg>
        <div>
          <span style="color: #E8846B; font-weight: 600; font-size: 14px;">Connected to Rennie</span>
          <p style="color: var(--text-muted); margin: 2px 0 0; font-size: 13px;">Chat and sync are ready.</p>
        </div>
      </div>`;
      new import_obsidian4.Setting(containerEl).setName("Logout").setDesc("Remove stored credentials").addButton(
        (btn) => btn.setButtonText("Logout").setWarning().onClick(async () => {
          this.plugin.settings.gatewayTokenEncrypted = null;
          this.plugin.settings.gatewayTokenPlaintext = "";
          await this.plugin.saveSettings();
          this.display();
        })
      );
    } else {
      const loginDiv = containerEl.createDiv({ cls: "rennie-login" });
      loginDiv.innerHTML = `<div style="padding: 24px; background: var(--background-secondary); border-radius: 14px; border: 1px solid var(--background-modifier-border); margin-bottom: 16px; text-align: center;">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="80" height="80" style="margin-bottom: 12px;">
          <rect x="24" y="40" width="72" height="58" rx="8" fill="#E8846B"/>
          <polygon points="60,10 18,44 102,44" fill="#CC6B52"/>
          <rect x="80" y="16" width="8" height="20" rx="2" fill="#E8846B"/>
          <circle cx="46" cy="62" r="8" fill="#1A1A1A"/><circle cx="43" cy="59" r="3" fill="#FFF" opacity="0.85"/>
          <circle cx="74" cy="62" r="8" fill="#1A1A1A"/><circle cx="71" cy="59" r="3" fill="#FFF" opacity="0.85"/>
          <ellipse cx="36" cy="72" rx="6" ry="3.5" fill="#CC6B52" opacity="0.35"/>
          <ellipse cx="84" cy="72" rx="6" ry="3.5" fill="#CC6B52" opacity="0.35"/>
          <path d="M52 78 Q60 84 68 78" fill="none" stroke="#CC6B52" stroke-width="2" stroke-linecap="round"/>
          <rect x="53" y="82" width="14" height="16" rx="7" fill="#CC6B52" opacity="0.4"/>
          <ellipse cx="40" cy="100" rx="10" ry="6" fill="#E8846B"/>
          <ellipse cx="80" cy="100" rx="10" ry="6" fill="#E8846B"/>
        </svg>
        <h3 style="margin: 0 0 4px; color: var(--text-normal); font-size: 18px;">Welcome to Rennie</h3>
        <p style="color: var(--text-muted); margin: 0 0 16px; font-size: 14px;">Sign in with your GitHub account to connect.</p>
      </div>`;
      new import_obsidian4.Setting(containerEl).setName("Login with GitHub").setDesc("Authenticates via your organization's GitHub account").addButton(
        (btn) => btn.setButtonText("\u{1F511} Login with GitHub").setCta().onClick(() => {
          const baseUrl = this.plugin.settings.gatewayUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
          window.open(`${baseUrl}/auth/login`);
        })
      );
    }
    containerEl.createEl("h2", { text: "Chat Settings" });
    new import_obsidian4.Setting(containerEl).setName("Gateway URL").setDesc("URL of your RentHero gateway. Do not include a trailing slash.").addText(
      (text) => text.setPlaceholder("http://127.0.0.1:18789").setValue(this.plugin.settings.gatewayUrl).onChange(async (value) => {
        this.plugin.settings.gatewayUrl = value.replace(/\/+$/, "");
        await this.plugin.saveSettings();
      })
    );
    const statusInfo = secureTokenStorage.getStatusInfo();
    const tokenSetting = new import_obsidian4.Setting(containerEl).setName("Gateway Token").setDesc("Authentication token for the RentHero gateway");
    const statusEl = containerEl.createDiv({ cls: "rennie-token-status" });
    const statusIcon = statusInfo.secure ? "\u{1F512}" : "\u26A0\uFE0F";
    statusEl.innerHTML = `<span class="rennie-status-${statusInfo.secure ? "secure" : "insecure"}">${statusIcon} ${statusInfo.description}</span>`;
    if (statusInfo.method === "envVar") {
      tokenSetting.addButton(
        (btn) => btn.setButtonText("Using Environment Variable").setDisabled(true)
      );
    } else {
      const currentToken = secureTokenStorage.getToken(
        this.plugin.settings.gatewayTokenEncrypted,
        this.plugin.settings.gatewayTokenPlaintext
      );
      tokenSetting.addText((text) => {
        text.setPlaceholder("Enter your token").setValue(currentToken).onChange(async (value) => {
          const { encrypted, plaintext } = secureTokenStorage.setToken(value);
          this.plugin.settings.gatewayTokenEncrypted = encrypted;
          this.plugin.settings.gatewayTokenPlaintext = plaintext;
          await this.plugin.saveSettings();
        });
        text.inputEl.type = "password";
      });
    }
    new import_obsidian4.Setting(containerEl).setName("Show actions in chat").setDesc("Display file action indicators in chat messages").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.showActionsInChat).onChange(async (value) => {
        this.plugin.settings.showActionsInChat = value;
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h3", { text: "Audit Log" });
    new import_obsidian4.Setting(containerEl).setName("Enable audit logging").setDesc("Log all file actions to a markdown file for review").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.auditLogEnabled).onChange(async (value) => {
        this.plugin.settings.auditLogEnabled = value;
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian4.Setting(containerEl).setName("Audit log path").setDesc("Path to the audit log file (relative to vault root)").addText(
      (text) => text.setPlaceholder("RentHero/audit-log.md").setValue(this.plugin.settings.auditLogPath).onChange(async (value) => {
        this.plugin.settings.auditLogPath = value || "RentHero/audit-log.md";
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h2", { text: "Sync Settings" });
    new import_obsidian4.Setting(containerEl).setName("Enable sync").setDesc("Sync files between your vault and the RentHero server").addToggle(
      (toggle) => toggle.setValue(this.plugin.settings.syncEnabled).onChange(async (value) => {
        this.plugin.settings.syncEnabled = value;
        await this.plugin.saveSettings();
        this.display();
      })
    );
    if (this.plugin.settings.syncEnabled) {
      new import_obsidian4.Setting(containerEl).setName("Sync server URL").setDesc("URL of the sync server (default port: 18790)").addText(
        (text) => text.setPlaceholder("http://127.0.0.1:18790").setValue(this.plugin.settings.syncServerUrl).onChange(async (value) => {
          this.plugin.settings.syncServerUrl = value.replace(/\/+$/, "");
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian4.Setting(containerEl).setName("Sync interval").setDesc("How often to sync automatically (0 = manual only)").addDropdown(
        (dropdown) => dropdown.addOption("0", "Manual only").addOption("5", "Every 5 minutes").addOption("15", "Every 15 minutes").addOption("30", "Every 30 minutes").addOption("60", "Every hour").setValue(String(this.plugin.settings.syncInterval)).onChange(async (value) => {
          this.plugin.settings.syncInterval = parseInt(value);
          await this.plugin.saveSettings();
        })
      );
      new import_obsidian4.Setting(containerEl).setName("Conflict behavior").setDesc("How to handle conflicts when a file is modified in both places").addDropdown(
        (dropdown) => dropdown.addOption("ask", "Ask each time").addOption("preferLocal", "Prefer local (Obsidian)").addOption("preferRemote", "Prefer remote (Gateway)").setValue(this.plugin.settings.syncConflictBehavior).onChange(async (value) => {
          this.plugin.settings.syncConflictBehavior = value;
          await this.plugin.saveSettings();
        })
      );
      containerEl.createEl("h4", { text: "Sync Folders" });
      containerEl.createEl("p", {
        text: "Managed by RentHero. Toggle folders on/off \u2014 structure is shared across the team.",
        cls: "setting-item-description"
      });
      this.ensureSyncPaths();
      const pathsContainer = containerEl.createDiv({ cls: "rennie-sync-paths" });
      this.plugin.settings.syncPaths.forEach((pathConfig, index) => {
        new import_obsidian4.Setting(pathsContainer).setName(pathConfig.localPath).setDesc(`\u2194 server: ${pathConfig.remotePath}/`).addToggle(
          (toggle) => toggle.setValue(pathConfig.enabled).onChange(async (value) => {
            this.plugin.settings.syncPaths[index].enabled = value;
            await this.plugin.saveSettings();
          })
        );
      });
      containerEl.createEl("h4", { text: "Sync Actions" });
      const syncActionsContainer = containerEl.createDiv({ cls: "rennie-sync-actions" });
      const testBtn2 = syncActionsContainer.createEl("button", { text: "Test Connection" });
      const syncNowBtn = syncActionsContainer.createEl("button", { text: "Sync Now", cls: "mod-cta" });
      const statusSpan = syncActionsContainer.createEl("span", { cls: "rennie-sync-status" });
      testBtn2.addEventListener("click", async () => {
        statusSpan.setText("Testing...");
        const result = await this.plugin.syncService.testConnection();
        if (result.ok) {
          statusSpan.setText("\u2713 Connected");
          statusSpan.addClass("rennie-test-success");
        } else {
          statusSpan.setText(`\u2717 ${result.error}`);
          statusSpan.addClass("rennie-test-error");
        }
      });
      syncNowBtn.addEventListener("click", async () => {
        statusSpan.setText("Syncing...");
        try {
          await this.plugin.runSync();
          statusSpan.setText("\u2713 Sync complete");
          statusSpan.addClass("rennie-test-success");
        } catch (err) {
          statusSpan.setText(`\u2717 ${err instanceof Error ? err.message : "Sync failed"}`);
          statusSpan.addClass("rennie-test-error");
        }
      });
    }
    containerEl.createEl("h3", { text: "Chat Connection Test" });
    const testContainer = containerEl.createDiv({ cls: "rennie-test-container" });
    const testBtn = testContainer.createEl("button", { text: "Test Chat Connection" });
    const testResult = testContainer.createEl("span", { cls: "rennie-test-result" });
    testBtn.addEventListener("click", async () => {
      testResult.setText("Testing...");
      testResult.removeClass("rennie-test-success", "rennie-test-error");
      try {
        const response = await this.plugin.api.chat("Say 'Connection successful!' in 5 words or less", {});
        testResult.setText(`\u2713 ${response.text}`);
        testResult.addClass("rennie-test-success");
      } catch (err) {
        testResult.setText(`\u2717 ${err instanceof Error ? err.message : "Failed"}`);
        testResult.addClass("rennie-test-error");
      }
    });
    containerEl.createEl("h3", { text: "Security Info" });
    const securityInfo = containerEl.createDiv({ cls: "rennie-security-info" });
    securityInfo.innerHTML = `
      <p><strong>Token Storage Methods (in priority order):</strong></p>
      <ol>
        <li><strong>Environment Variable</strong> \u2014 Set <code>OPENCLAW_TOKEN</code> to keep the token out of Obsidian entirely</li>
        <li><strong>OS Keychain</strong> \u2014 Uses Electron safeStorage (Keychain on macOS, DPAPI on Windows, libsecret on Linux)</li>
        <li><strong>Plaintext</strong> \u2014 Stored in plugin settings. Avoid syncing <code>.obsidian/plugins/obsidian-renthero-sync/</code></li>
      </ol>
    `;
  }
  // Ensures user's sync paths match the hardcoded RentHero structure
  // Preserves user's enabled/disabled toggles, adds new paths from updates
  ensureSyncPaths() {
    const existing = new Map(
      this.plugin.settings.syncPaths.map((p) => [p.remotePath, p])
    );
    let changed = false;
    const updated = [];
    for (const defaultPath of RENTHERO_SYNC_PATHS) {
      const userPath = existing.get(defaultPath.remotePath);
      if (userPath) {
        updated.push({
          ...defaultPath,
          enabled: userPath.enabled
        });
      } else {
        updated.push({ ...defaultPath });
        changed = true;
      }
    }
    if (changed || updated.length !== this.plugin.settings.syncPaths.length) {
      this.plugin.settings.syncPaths = updated;
      this.plugin.saveSettings();
    }
  }
};

// src/syncService.ts
var import_obsidian5 = require("obsidian");
var SyncService = class {
  // path -> hash
  constructor(app, getSettings) {
    this.app = app;
    this.getSettings = getSettings;
    this.syncInterval = null;
    this.isSyncing = false;
    this.lastSyncState = /* @__PURE__ */ new Map();
  }
  getToken() {
    const settings = this.getSettings();
    return secureTokenStorage.getToken(
      settings.gatewayTokenEncrypted,
      settings.gatewayTokenPlaintext
    );
  }
  async request(method, endpoint, body) {
    var _a;
    const settings = this.getSettings();
    const url = `${settings.syncServerUrl}${endpoint}`;
    const response = await (0, import_obsidian5.requestUrl)({
      url,
      method,
      headers: {
        Authorization: `Bearer ${this.getToken()}`,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : void 0
    });
    if (response.status >= 400) {
      const error = ((_a = response.json) == null ? void 0 : _a.error) || `HTTP ${response.status}`;
      throw new Error(error);
    }
    return response.json;
  }
  /**
   * List remote files
   */
  async listRemote(remotePath) {
    const response = await this.request(
      "GET",
      `/sync/list?path=${encodeURIComponent(remotePath)}`
    );
    return response.files;
  }
  /**
   * Read a remote file
   */
  async readRemote(remotePath) {
    return await this.request(
      "GET",
      `/sync/read?path=${encodeURIComponent(remotePath)}`
    );
  }
  /**
   * Write a remote file
   */
  async writeRemote(remotePath, content, expectedHash) {
    return await this.request(
      "POST",
      `/sync/write?path=${encodeURIComponent(remotePath)}`,
      { content, expectedHash }
    );
  }
  /**
   * Get local file hash
   */
  getContentHash(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    const hex = Math.abs(hash).toString(16).padStart(8, "0");
    return hex.repeat(4);
  }
  /**
   * List local files in a vault path
   */
  async listLocal(localPath) {
    const files = /* @__PURE__ */ new Map();
    const { vault } = this.app;
    const folder = vault.getAbstractFileByPath(localPath);
    if (!folder || !(folder instanceof import_obsidian5.TFolder)) {
      return files;
    }
    const processFolder = async (f, basePath) => {
      for (const child of f.children) {
        if (child instanceof import_obsidian5.TFile && child.extension === "md") {
          const relativePath = child.path.slice(localPath.length + 1);
          const content = await vault.read(child);
          const hash = this.getContentHash(content);
          files.set(relativePath, { file: child, hash });
        } else if (child instanceof import_obsidian5.TFolder) {
          await processFolder(child, basePath);
        }
      }
    };
    await processFolder(folder, localPath);
    return files;
  }
  /**
   * Sync a single path configuration
   */
  async syncPath(config, onConflict) {
    const { vault } = this.app;
    const stats = { pulled: 0, pushed: 0, conflicts: 0, errors: 0 };
    try {
      const localFolder = vault.getAbstractFileByPath(config.localPath);
      if (!localFolder) {
        await vault.createFolder(config.localPath);
      }
      const remoteFiles = await this.listRemote(config.remotePath);
      const localFiles = await this.listLocal(config.localPath);
      const remoteMap = /* @__PURE__ */ new Map();
      for (const rf of remoteFiles) {
        const relativePath = rf.path.slice(config.remotePath.length + 1);
        remoteMap.set(relativePath, rf);
      }
      for (const [relativePath, remoteFile] of remoteMap) {
        const localInfo = localFiles.get(relativePath);
        const localPath = `${config.localPath}/${relativePath}`;
        const fullRemotePath = `${config.remotePath}/${relativePath}`;
        try {
          if (!localInfo) {
            const content = await this.readRemote(fullRemotePath);
            await this.ensureParentFolder(localPath);
            await vault.create(localPath, content.content);
            this.lastSyncState.set(localPath, content.hash);
            stats.pulled++;
          } else if (localInfo.hash !== remoteFile.hash) {
            const lastKnownHash = this.lastSyncState.get(localPath);
            if (lastKnownHash && lastKnownHash !== localInfo.hash && lastKnownHash !== remoteFile.hash) {
              const remoteContent = await this.readRemote(fullRemotePath);
              const localContent = await vault.read(localInfo.file);
              const resolution = await onConflict({
                localPath,
                remotePath: fullRemotePath,
                localFile: {
                  path: localPath,
                  hash: localInfo.hash,
                  modified: new Date(localInfo.file.stat.mtime).toISOString(),
                  size: localInfo.file.stat.size,
                  content: localContent
                },
                remoteFile: {
                  path: fullRemotePath,
                  hash: remoteFile.hash,
                  modified: remoteFile.modified,
                  size: remoteFile.size,
                  content: remoteContent.content
                }
              });
              if (resolution === "local") {
                await this.writeRemote(fullRemotePath, localContent);
                this.lastSyncState.set(localPath, localInfo.hash);
                stats.pushed++;
              } else if (resolution === "remote") {
                await vault.modify(localInfo.file, remoteContent.content);
                this.lastSyncState.set(localPath, remoteFile.hash);
                stats.pulled++;
              } else {
                stats.conflicts++;
              }
            } else if (!lastKnownHash || lastKnownHash === localInfo.hash) {
              const content = await this.readRemote(fullRemotePath);
              await vault.modify(localInfo.file, content.content);
              this.lastSyncState.set(localPath, content.hash);
              stats.pulled++;
            } else {
              const localContent = await vault.read(localInfo.file);
              await this.writeRemote(fullRemotePath, localContent, remoteFile.hash);
              this.lastSyncState.set(localPath, localInfo.hash);
              stats.pushed++;
            }
          } else {
            this.lastSyncState.set(localPath, localInfo.hash);
          }
        } catch (err) {
          console.error(`Sync error for ${relativePath}:`, err);
          stats.errors++;
        }
      }
      for (const [relativePath, localInfo] of localFiles) {
        if (!remoteMap.has(relativePath)) {
          const localPath = `${config.localPath}/${relativePath}`;
          const fullRemotePath = `${config.remotePath}/${relativePath}`;
          try {
            const content = await vault.read(localInfo.file);
            await this.writeRemote(fullRemotePath, content);
            this.lastSyncState.set(localPath, localInfo.hash);
            stats.pushed++;
          } catch (err) {
            console.error(`Push error for ${relativePath}:`, err);
            stats.errors++;
          }
        }
      }
    } catch (err) {
      console.error(`Sync path error for ${config.remotePath}:`, err);
      stats.errors++;
    }
    return stats;
  }
  async ensureParentFolder(filePath) {
    const { vault } = this.app;
    const parts = filePath.split("/");
    parts.pop();
    let currentPath = "";
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const folder = vault.getAbstractFileByPath(currentPath);
      if (!folder) {
        await vault.createFolder(currentPath);
      }
    }
  }
  /**
   * Run a full sync
   */
  async sync(onConflict) {
    if (this.isSyncing) {
      throw new Error("Sync already in progress");
    }
    this.isSyncing = true;
    const totals = { pulled: 0, pushed: 0, conflicts: 0, errors: 0 };
    try {
      const settings = this.getSettings();
      for (const pathConfig of settings.syncPaths) {
        if (!pathConfig.enabled)
          continue;
        const stats = await this.syncPath(pathConfig, onConflict);
        totals.pulled += stats.pulled;
        totals.pushed += stats.pushed;
        totals.conflicts += stats.conflicts;
        totals.errors += stats.errors;
      }
      if (totals.pulled > 0 || totals.pushed > 0) {
        new import_obsidian5.Notice(
          `Sync complete: ${totals.pulled} pulled, ${totals.pushed} pushed` + (totals.errors > 0 ? `, ${totals.errors} errors` : "")
        );
      }
    } finally {
      this.isSyncing = false;
    }
    return totals;
  }
  /**
   * Start automatic sync
   */
  startAutoSync() {
    this.stopAutoSync();
    const settings = this.getSettings();
    if (!settings.syncEnabled || settings.syncInterval <= 0)
      return;
    const intervalMs = settings.syncInterval * 60 * 1e3;
    this.syncInterval = setInterval(() => {
      this.sync(async (conflict) => {
        const behavior = this.getSettings().syncConflictBehavior;
        if (behavior === "preferLocal")
          return "local";
        if (behavior === "preferRemote")
          return "remote";
        return "skip";
      }).catch(console.error);
    }, intervalMs);
    console.log(`Rennie: Auto-sync started (every ${settings.syncInterval} min)`);
  }
  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log("Rennie: Auto-sync stopped");
    }
  }
  /**
   * Test connection to sync server
   */
  async testConnection() {
    try {
      const settings = this.getSettings();
      const response = await (0, import_obsidian5.requestUrl)({
        url: `${settings.syncServerUrl}/sync/status`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.getToken()}`
        }
      });
      if (response.status === 200) {
        return { ok: true };
      }
      return { ok: false, error: `HTTP ${response.status}` };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
};

// src/conflictModal.ts
var import_obsidian6 = require("obsidian");
var ConflictModal = class extends import_obsidian6.Modal {
  constructor(app, conflict) {
    super(app);
    this.conflict = conflict;
    this.result = "skip";
    this.showDiff = false;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.addClass("rennie-conflict-modal");
    contentEl.createEl("h2", { text: "Sync Conflict" });
    contentEl.createEl("p", {
      text: `The file "${this.conflict.localPath}" has been modified in both locations.`,
      cls: "rennie-conflict-desc"
    });
    const comparisonEl = contentEl.createDiv({ cls: "rennie-conflict-comparison" });
    const localEl = comparisonEl.createDiv({ cls: "rennie-conflict-side rennie-conflict-local" });
    localEl.createEl("h3", { text: "\u{1F4C1} Local (Obsidian)" });
    this.renderFileInfo(localEl, {
      modified: this.conflict.localFile.modified,
      size: this.conflict.localFile.size
    });
    const remoteEl = comparisonEl.createDiv({ cls: "rennie-conflict-side rennie-conflict-remote" });
    remoteEl.createEl("h3", { text: "\u2601\uFE0F Remote (Gateway)" });
    this.renderFileInfo(remoteEl, {
      modified: this.conflict.remoteFile.modified,
      size: this.conflict.remoteFile.size
    });
    const diffToggle = contentEl.createDiv({ cls: "rennie-conflict-diff-toggle" });
    const diffBtn = diffToggle.createEl("button", {
      text: "Show Side-by-Side",
      cls: "rennie-btn-secondary"
    });
    diffBtn.addEventListener("click", () => {
      this.showDiff = !this.showDiff;
      diffBtn.setText(this.showDiff ? "Hide Side-by-Side" : "Show Side-by-Side");
      this.renderDiff(contentEl);
    });
    contentEl.createDiv({ cls: "rennie-conflict-diff", attr: { id: "diff-container" } });
    const buttonsEl = contentEl.createDiv({ cls: "rennie-conflict-buttons" });
    const keepLocalBtn = buttonsEl.createEl("button", {
      text: "Keep Local",
      cls: "rennie-btn-primary"
    });
    keepLocalBtn.addEventListener("click", () => {
      this.result = "local";
      this.close();
    });
    const keepRemoteBtn = buttonsEl.createEl("button", {
      text: "Keep Remote",
      cls: "rennie-btn-primary"
    });
    keepRemoteBtn.addEventListener("click", () => {
      this.result = "remote";
      this.close();
    });
    const skipBtn = buttonsEl.createEl("button", {
      text: "Skip",
      cls: "rennie-btn-secondary"
    });
    skipBtn.addEventListener("click", () => {
      this.result = "skip";
      this.close();
    });
  }
  renderFileInfo(container, info) {
    const infoEl = container.createDiv({ cls: "rennie-conflict-info" });
    const modDate = new Date(info.modified);
    infoEl.createEl("div", {
      text: `Modified: ${modDate.toLocaleString()}`,
      cls: "rennie-conflict-meta"
    });
    infoEl.createEl("div", {
      text: `Size: ${this.formatSize(info.size)}`,
      cls: "rennie-conflict-meta"
    });
  }
  formatSize(bytes) {
    if (bytes < 1024)
      return `${bytes} B`;
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  renderDiff(contentEl) {
    const diffContainer = contentEl.querySelector("#diff-container");
    if (!diffContainer)
      return;
    diffContainer.empty();
    if (!this.showDiff) {
      diffContainer.style.display = "none";
      return;
    }
    diffContainer.style.display = "flex";
    const localDiff = diffContainer.createDiv({ cls: "rennie-diff-pane" });
    localDiff.createEl("h4", { text: "Local" });
    const localContent = localDiff.createEl("pre", { cls: "rennie-diff-content" });
    localContent.createEl("code", { text: this.conflict.localFile.content });
    const remoteDiff = diffContainer.createDiv({ cls: "rennie-diff-pane" });
    remoteDiff.createEl("h4", { text: "Remote" });
    const remoteContent = remoteDiff.createEl("pre", { cls: "rennie-diff-content" });
    remoteContent.createEl("code", { text: this.conflict.remoteFile.content });
  }
  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (this.resolvePromise) {
      this.resolvePromise(this.result);
    }
  }
  async waitForResult() {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }
};

// main.ts
var RenniePlugin = class extends import_obsidian7.Plugin {
  async onload() {
    await this.loadSettings();
    this.api = new RennieAPI(this.settings);
    this.actionExecutor = new ActionExecutor(this.app, () => this.settings);
    this.syncService = new SyncService(this.app, () => this.settings);
    this.registerView(RENNIE_VIEW_TYPE, (leaf) => new RennieView(leaf, this));
    this.addRibbonIcon("message-circle", "Open Rennie Chat", () => {
      this.activateView();
    });
    this.addCommand({
      id: "open-rennie-chat",
      name: "Open Rennie Chat",
      callback: () => this.activateView()
    });
    this.addCommand({
      id: "ask-rennie-about-note",
      name: "Ask Rennie about current note",
      callback: async () => {
        await this.activateView();
      }
    });
    this.addCommand({
      id: "sync-now",
      name: "Sync Now",
      callback: () => this.runSync()
    });
    this.registerObsidianProtocolHandler("rennie-auth", async (params) => {
      if (params.token) {
        const { encrypted, plaintext } = secureTokenStorage.setToken(params.token);
        this.settings.gatewayTokenEncrypted = encrypted;
        this.settings.gatewayTokenPlaintext = plaintext;
        await this.saveSettings();
        new import_obsidian7.Notice(`\u{1F3E0} Welcome, ${params.user || "team member"}! Rennie is connected.`);
      }
    });
    this.addCommand({
      id: "login-github",
      name: "Login with GitHub",
      callback: () => {
        const baseUrl = this.settings.gatewayUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
        window.open(`${baseUrl}/auth/login`);
      }
    });
    this.addSettingTab(new RennieSettingTab(this.app, this));
    if (this.settings.syncEnabled && this.settings.syncInterval > 0) {
      this.syncService.startAutoSync();
    }
    console.log("Rennie loaded \u{1F3E0}");
  }
  onunload() {
    this.syncService.stopAutoSync();
    console.log("Rennie unloaded");
  }
  async loadSettings() {
    const data = await this.loadData() || {};
    if (data.gatewayToken && !data.gatewayTokenPlaintext && !data.gatewayTokenEncrypted) {
      data.gatewayTokenPlaintext = data.gatewayToken;
      delete data.gatewayToken;
    }
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }
  async saveSettings() {
    await this.saveData(this.settings);
    this.api = new RennieAPI(this.settings);
    if (this.settings.syncEnabled && this.settings.syncInterval > 0) {
      this.syncService.startAutoSync();
    } else {
      this.syncService.stopAutoSync();
    }
  }
  async runSync() {
    if (!this.settings.syncEnabled) {
      return;
    }
    try {
      await this.syncService.sync(async (conflict) => {
        if (this.settings.syncConflictBehavior === "preferLocal") {
          return "local";
        }
        if (this.settings.syncConflictBehavior === "preferRemote") {
          return "remote";
        }
        const modal = new ConflictModal(this.app, conflict);
        return await modal.waitForResult();
      });
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }
  async activateView() {
    const { workspace } = this.app;
    let leaf = null;
    const leaves = workspace.getLeavesOfType(RENNIE_VIEW_TYPE);
    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: RENNIE_VIEW_TYPE, active: true });
      }
    }
    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
};
