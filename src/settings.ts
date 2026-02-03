import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import type RenniePlugin from "../main";
import { secureTokenStorage } from "./secureStorage";
import { SyncPathConfig } from "./types";

export class RennieSettingTab extends PluginSettingTab {
  constructor(app: App, private plugin: RenniePlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

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
          .setPlaceholder("Rennie/audit-log.md")
          .setValue(this.plugin.settings.auditLogPath)
          .onChange(async (value) => {
            this.plugin.settings.auditLogPath = value || "Rennie/audit-log.md";
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

      // Sync paths
      containerEl.createEl("h4", { text: "Sync Paths" });
      containerEl.createEl("p", { 
        text: "Configure which folders to sync between the gateway and your vault.",
        cls: "setting-item-description"
      });

      const pathsContainer = containerEl.createDiv({ cls: "rennie-sync-paths" });
      
      this.plugin.settings.syncPaths.forEach((pathConfig, index) => {
        this.renderSyncPath(pathsContainer, pathConfig, index);
      });

      new Setting(containerEl)
        .addButton((btn) =>
          btn
            .setButtonText("Add Sync Path")
            .onClick(async () => {
              this.plugin.settings.syncPaths.push({
                remotePath: "",
                localPath: "",
                enabled: true,
              });
              await this.plugin.saveSettings();
              this.display();
            })
        );

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

  private renderSyncPath(container: HTMLElement, pathConfig: SyncPathConfig, index: number): void {
    const pathEl = container.createDiv({ cls: "rennie-sync-path-item" });

    new Setting(pathEl)
      .setName(`Path ${index + 1}`)
      .addToggle((toggle) =>
        toggle
          .setValue(pathConfig.enabled)
          .setTooltip("Enable/disable this sync path")
          .onChange(async (value) => {
            this.plugin.settings.syncPaths[index].enabled = value;
            await this.plugin.saveSettings();
          })
      )
      .addText((text) =>
        text
          .setPlaceholder("Remote path (e.g., notes)")
          .setValue(pathConfig.remotePath)
          .onChange(async (value) => {
            this.plugin.settings.syncPaths[index].remotePath = value;
            await this.plugin.saveSettings();
          })
      )
      .addText((text) =>
        text
          .setPlaceholder("Local path (e.g., Rennie/Notes)")
          .setValue(pathConfig.localPath)
          .onChange(async (value) => {
            this.plugin.settings.syncPaths[index].localPath = value;
            await this.plugin.saveSettings();
          })
      )
      .addButton((btn) =>
        btn
          .setIcon("trash")
          .setTooltip("Remove this sync path")
          .onClick(async () => {
            this.plugin.settings.syncPaths.splice(index, 1);
            await this.plugin.saveSettings();
            this.display();
          })
      );
  }
}
