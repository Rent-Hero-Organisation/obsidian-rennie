import { Plugin, WorkspaceLeaf, Notice } from "obsidian";
import { RennieView, RENNIE_VIEW_TYPE } from "./src/RennieView";
import { RennieAPI } from "./src/api";
import { ActionExecutor } from "./src/actions";
import { RennieSettingTab } from "./src/settings";
import { RennieSettings, DEFAULT_SETTINGS } from "./src/types";
import { SyncService } from "./src/syncService";
import { ConflictModal } from "./src/conflictModal";
import { secureTokenStorage } from "./src/secureStorage";

export default class RenniePlugin extends Plugin {
  settings: RennieSettings;
  api: RennieAPI;
  actionExecutor: ActionExecutor;
  syncService: SyncService;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.api = new RennieAPI(this.settings);
    this.actionExecutor = new ActionExecutor(this.app, () => this.settings);
    this.syncService = new SyncService(this.app, () => this.settings);

    // Register the chat view
    this.registerView(RENNIE_VIEW_TYPE, (leaf) => new RennieView(leaf, this));

    // Add ribbon icon to open chat
    this.addRibbonIcon("message-circle", "Open Rennie Chat", () => {
      this.activateView();
    });

    // Add command to open chat
    this.addCommand({
      id: "open-rennie-chat",
      name: "Open Rennie Chat",
      callback: () => this.activateView(),
    });

    // Add command to ask about current note
    this.addCommand({
      id: "ask-rennie-about-note",
      name: "Ask Rennie about current note",
      callback: async () => {
        await this.activateView();
      },
    });

    // Add sync command
    this.addCommand({
      id: "sync-now",
      name: "Sync Now",
      callback: () => this.runSync(),
    });

    // Handle OAuth callback protocol
    this.registerObsidianProtocolHandler("rennie-auth", async (params) => {
      if (params.token) {
        // Store token
        const { encrypted, plaintext } = secureTokenStorage.setToken(params.token);
        this.settings.gatewayTokenEncrypted = encrypted;
        this.settings.gatewayTokenPlaintext = plaintext;
        await this.saveSettings();
        new Notice(`🏠 Welcome, ${params.user || 'team member'}! Rennie is connected.`);
      }
    });

    // Login command
    this.addCommand({
      id: "login-github",
      name: "Login with GitHub",
      callback: () => {
        const baseUrl = this.settings.gatewayUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');
        window.open(`${baseUrl}/auth/login`);
      },
    });

    // Settings tab
    this.addSettingTab(new RennieSettingTab(this.app, this));

    // Start auto-sync if enabled
    if (this.settings.syncEnabled && this.settings.syncInterval > 0) {
      this.syncService.startAutoSync();
    }

    console.log("Rennie loaded 🏠");
  }

  onunload(): void {
    this.syncService.stopAutoSync();
    console.log("Rennie unloaded");
  }

  async loadSettings(): Promise<void> {
    const data = await this.loadData() || {};
    
    // Migrate old gatewayToken field to new structure
    if (data.gatewayToken && !data.gatewayTokenPlaintext && !data.gatewayTokenEncrypted) {
      data.gatewayTokenPlaintext = data.gatewayToken;
      delete data.gatewayToken;
    }
    
    this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Recreate API with new settings
    this.api = new RennieAPI(this.settings);
    
    // Update auto-sync
    if (this.settings.syncEnabled && this.settings.syncInterval > 0) {
      this.syncService.startAutoSync();
    } else {
      this.syncService.stopAutoSync();
    }
  }

  async runSync(): Promise<void> {
    if (!this.settings.syncEnabled) {
      return;
    }

    try {
      await this.syncService.sync(async (conflict) => {
        // Handle conflict based on settings
        if (this.settings.syncConflictBehavior === "preferLocal") {
          return "local";
        }
        if (this.settings.syncConflictBehavior === "preferRemote") {
          return "remote";
        }
        
        // Show conflict modal
        const modal = new ConflictModal(this.app, conflict);
        return await modal.waitForResult();
      });
    } catch (err) {
      console.error("Sync failed:", err);
    }
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
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
}
