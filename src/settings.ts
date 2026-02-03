import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type RenniePlugin from "../main";
import { secureTokenStorage } from "./secureStorage";
import { SyncPathConfig, RENTHERO_SYNC_PATHS } from "./types";

export class RennieSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: RenniePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ===== CONNECTION STATUS =====
    containerEl.createEl("h2", { text: "🏠 Rennie Connection" });

    const token = secureTokenStorage.getToken(
      this.plugin.settings.gatewayTokenEncrypted,
      this.plugin.settings.gatewayTokenPlaintext
    );

    if (token) {
      const statusDiv = containerEl.createDiv({ cls: "rennie-connected" });
      statusDiv.innerHTML = `<div style="padding: 12px; background: #1a3a2a; border-radius: 8px; border: 1px solid #2d5a3d; margin-bottom: 16px;">
        <span style="color: #4ecca3; font-weight: bold;">✅ Connected to Rennie</span>
        <p style="color: #a0a0a0; margin: 4px 0 0; font-size: 12px;">Token stored securely. Chat and sync are ready.</p>
      </div>`;

      new Setting(containerEl)
        .setName("Logout")
        .setDesc("Remove stored credentials")
        .addButton((btn) =>
          btn.setButtonText("Logout").setWarning().onClick(async () => {
            this.plugin.settings.gatewayTokenEncrypted = null;
            this.plugin.settings.gatewayTokenPlaintext = "";
            await this.plugin.saveSettings();
            this.display(); // Refresh
          })
        );
    } else {
      const loginDiv = containerEl.createDiv({ cls: "rennie-login" });
      loginDiv.innerHTML = `<div style="padding: 20px; background: #1a1a2e; border-radius: 12px; border: 1px solid #2d2d4e; margin-bottom: 16px; text-align: center;">
        <div style="font-size: 36px; margin-bottom: 8px;">🏠</div>
        <h3 style="margin: 0 0 4px; color: #e0e0e0;">Welcome to Rennie</h3>
        <p style="color: #a0a0a0; margin: 0 0 16px; font-size: 13px;">Sign in with your GitHub account to connect to RentHero.</p>
      </div>`;

      new Setting(containerEl)
        .setName("Login with GitHub")
        .setDesc("Authenticates via your organization's GitHub account")
        .addButton((btn) =>
          btn.setButtonText("🔑 Login with GitHub").setCta().onClick(() => {
            const baseUrl = this.plugin.settings.gatewayUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
            window.open(`${baseUrl}/auth/login`);
          })
        );
    }

    // ===== CHAT SETTINGS =====
    containerEl.createEl("h2", { text: "Chat Settings" });

    new Setting(containerEl)
      .setName("Gateway URL")
      .setDesc("URL of your RentHero gateway. Do not include a trailing slash.")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:18789")
          .setValue(this.plugin.settings.gatewayUrl)
          .onChange(async (value) => {
            this.plugin.settings.gatewayUrl = value.replace(/\/+$/, "");
            await this.plugin.saveSettings();
          })
      );

    // Token security status
    const statusInfo = secureTokenStorage.getStatusInfo();
    const tokenSetting = new Setting(containerEl)
      .setName("Gateway Token")
      .setDesc("Authentication token for the RentHero gateway");

    const statusEl = containerEl.createDiv({ cls: "rennie-token-status" });
    const statusIcon = statusInfo.secure ? "🔒" : "⚠️";
    statusEl.innerHTML = `<span class="rennie-status-${statusInfo.secure ? 'secure' : 'insecure'}">${statusIcon} ${statusInfo.description}</span>`;

    if (statusInfo.method === "envVar") {
      tokenSetting.addButton((btn) =>
        btn.setButtonText("Using Environment Variable").setDisabled(true)
      );
    } else {
      const currentToken = secureTokenStorage.getToken(
        this.plugin.settings.gatewayTokenEncrypted,
        this.plugin.settings.gatewayTokenPlaintext
      );

      tokenSetting.addText((text) => {
        text
          .setPlaceholder("Enter your token")
          .setValue(currentToken)
          .onChange(async (value) => {
            const { encrypted, plaintext } = secureTokenStorage.setToken(value);
            this.plugin.settings.gatewayTokenEncrypted = encrypted;
            this.plugin.settings.gatewayTokenPlaintext = plaintext;
            await this.plugin.saveSettings();
          });
        text.inputEl.type = "password";
      });
    }

    new Setting(containerEl)
      .setName("Show actions in chat")
      .setDesc("Display file action indicators in chat messages")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showActionsInChat)
          .onChange(async (value) => {
            this.plugin.settings.showActionsInChat = value;
            await this.plugin.saveSettings();
          })
      );

    // ===== AUDIT LOG =====
    containerEl.createEl("h3", { text: "Audit Log" });

    new Setting(containerEl)
      .setName("Enable audit logging")
      .setDesc("Log all file actions to a markdown file for review")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.auditLogEnabled)
          .onChange(async (value) => {
            this.plugin.settings.auditLogEnabled = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Audit log path")
      .setDesc("Path to the audit log file (relative to vault root)")
      .addText((text) =>
        text
          .setPlaceholder("RentHero/audit-log.md")
          .setValue(this.plugin.settings.auditLogPath)
          .onChange(async (value) => {
            this.plugin.settings.auditLogPath = value || "RentHero/audit-log.md";
            await this.plugin.saveSettings();
          })
      );

    // ===== SYNC SETTINGS =====
    containerEl.createEl("h2", { text: "Sync Settings" });

    new Setting(containerEl)
      .setName("Enable sync")
      .setDesc("Sync files between your vault and the RentHero server")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.syncEnabled)
          .onChange(async (value) => {
            this.plugin.settings.syncEnabled = value;
            await this.plugin.saveSettings();
            this.display(); // Refresh to show/hide sync options
          })
      );

    if (this.plugin.settings.syncEnabled) {
      new Setting(containerEl)
        .setName("Sync server URL")
        .setDesc("URL of the sync server (default port: 18790)")
        .addText((text) =>
          text
            .setPlaceholder("http://127.0.0.1:18790")
            .setValue(this.plugin.settings.syncServerUrl)
            .onChange(async (value) => {
              this.plugin.settings.syncServerUrl = value.replace(/\/+$/, "");
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Sync interval")
        .setDesc("How often to sync automatically (0 = manual only)")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("0", "Manual only")
            .addOption("5", "Every 5 minutes")
            .addOption("15", "Every 15 minutes")
            .addOption("30", "Every 30 minutes")
            .addOption("60", "Every hour")
            .setValue(String(this.plugin.settings.syncInterval))
            .onChange(async (value) => {
              this.plugin.settings.syncInterval = parseInt(value);
              await this.plugin.saveSettings();
            })
        );

      new Setting(containerEl)
        .setName("Conflict behavior")
        .setDesc("How to handle conflicts when a file is modified in both places")
        .addDropdown((dropdown) =>
          dropdown
            .addOption("ask", "Ask each time")
            .addOption("preferLocal", "Prefer local (Obsidian)")
            .addOption("preferRemote", "Prefer remote (Gateway)")
            .setValue(this.plugin.settings.syncConflictBehavior)
            .onChange(async (value) => {
              this.plugin.settings.syncConflictBehavior = value as "ask" | "preferLocal" | "preferRemote";
              await this.plugin.saveSettings();
            })
        );

      // Sync paths — managed by RentHero, not user-editable
      containerEl.createEl("h4", { text: "Sync Folders" });
      containerEl.createEl("p", { 
        text: "Managed by RentHero. Toggle folders on/off — structure is shared across the team.",
        cls: "setting-item-description"
      });

      // Ensure user's paths match the hardcoded set (handles plugin updates adding new paths)
      this.ensureSyncPaths();

      const pathsContainer = containerEl.createDiv({ cls: "rennie-sync-paths" });
      
      this.plugin.settings.syncPaths.forEach((pathConfig, index) => {
        new Setting(pathsContainer)
          .setName(pathConfig.localPath)
          .setDesc(`↔ server: ${pathConfig.remotePath}/`)
          .addToggle((toggle) =>
            toggle
              .setValue(pathConfig.enabled)
              .onChange(async (value) => {
                this.plugin.settings.syncPaths[index].enabled = value;
                await this.plugin.saveSettings();
              })
          );
      });

      // Sync actions
      containerEl.createEl("h4", { text: "Sync Actions" });

      const syncActionsContainer = containerEl.createDiv({ cls: "rennie-sync-actions" });
      
      const testBtn = syncActionsContainer.createEl("button", { text: "Test Connection" });
      const syncNowBtn = syncActionsContainer.createEl("button", { text: "Sync Now", cls: "mod-cta" });
      const statusSpan = syncActionsContainer.createEl("span", { cls: "rennie-sync-status" });

      testBtn.addEventListener("click", async () => {
        statusSpan.setText("Testing...");
        const result = await this.plugin.syncService.testConnection();
        if (result.ok) {
          statusSpan.setText("✓ Connected");
          statusSpan.addClass("rennie-test-success");
        } else {
          statusSpan.setText(`✗ ${result.error}`);
          statusSpan.addClass("rennie-test-error");
        }
      });

      syncNowBtn.addEventListener("click", async () => {
        statusSpan.setText("Syncing...");
        try {
          await this.plugin.runSync();
          statusSpan.setText("✓ Sync complete");
          statusSpan.addClass("rennie-test-success");
        } catch (err) {
          statusSpan.setText(`✗ ${err instanceof Error ? err.message : "Sync failed"}`);
          statusSpan.addClass("rennie-test-error");
        }
      });
    }

    // ===== CONNECTION TEST =====
    containerEl.createEl("h3", { text: "Chat Connection Test" });

    const testContainer = containerEl.createDiv({ cls: "rennie-test-container" });
    const testBtn = testContainer.createEl("button", { text: "Test Chat Connection" });
    const testResult = testContainer.createEl("span", { cls: "rennie-test-result" });

    testBtn.addEventListener("click", async () => {
      testResult.setText("Testing...");
      testResult.removeClass("rennie-test-success", "rennie-test-error");
      try {
        const response = await this.plugin.api.chat("Say 'Connection successful!' in 5 words or less", {});
        testResult.setText(`✓ ${response.text}`);
        testResult.addClass("rennie-test-success");
      } catch (err) {
        testResult.setText(`✗ ${err instanceof Error ? err.message : "Failed"}`);
        testResult.addClass("rennie-test-error");
      }
    });

    // ===== SECURITY INFO =====
    containerEl.createEl("h3", { text: "Security Info" });
    
    const securityInfo = containerEl.createDiv({ cls: "rennie-security-info" });
    securityInfo.innerHTML = `
      <p><strong>Token Storage Methods (in priority order):</strong></p>
      <ol>
        <li><strong>Environment Variable</strong> — Set <code>OPENCLAW_TOKEN</code> to keep the token out of Obsidian entirely</li>
        <li><strong>OS Keychain</strong> — Uses Electron safeStorage (Keychain on macOS, DPAPI on Windows, libsecret on Linux)</li>
        <li><strong>Plaintext</strong> — Stored in plugin settings. Avoid syncing <code>.obsidian/plugins/obsidian-renthero-sync/</code></li>
      </ol>
    `;
  }

  // Ensures user's sync paths match the hardcoded RentHero structure
  // Preserves user's enabled/disabled toggles, adds new paths from updates
  private ensureSyncPaths(): void {
    const existing = new Map(
      this.plugin.settings.syncPaths.map(p => [p.remotePath, p])
    );
    
    let changed = false;
    const updated: SyncPathConfig[] = [];
    
    for (const defaultPath of RENTHERO_SYNC_PATHS) {
      const userPath = existing.get(defaultPath.remotePath);
      if (userPath) {
        // Keep user's enabled toggle, but enforce the local path from hardcoded config
        updated.push({
          ...defaultPath,
          enabled: userPath.enabled,
        });
      } else {
        // New path added in update — enable by default
        updated.push({ ...defaultPath });
        changed = true;
      }
    }
    
    if (changed || updated.length !== this.plugin.settings.syncPaths.length) {
      this.plugin.settings.syncPaths = updated;
      this.plugin.saveSettings();
    }
  }
}
