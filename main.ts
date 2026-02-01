import { Plugin, WorkspaceLeaf } from "obsidian";
import { OpenClawView, OPENCLAW_VIEW_TYPE } from "./src/OpenClawView";
import { OpenClawAPI } from "./src/api";
import { ActionExecutor } from "./src/actions";
import { OpenClawSettingTab } from "./src/settings";
import { OpenClawSettings, DEFAULT_SETTINGS } from "./src/types";
import { SyncService } from "./src/syncService";
import { ConflictModal } from "./src/conflictModal";

export default class OpenClawPlugin extends Plugin {
  settings: OpenClawSettings;
  api: OpenClawAPI;
  actionExecutor: ActionExecutor;
  syncService: SyncService;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.api = new OpenClawAPI(this.settings);
    this.actionExecutor = new ActionExecutor(this.app, () => this.settings);
    this.syncService = new SyncService(this.app, () => this.settings);

    // Register the chat view
    this.registerView(OPENCLAW_VIEW_TYPE, (leaf) => new OpenClawView(leaf, this));

    // Add ribbon icon to open chat
    this.addRibbonIcon("message-circle", "Open OpenClaw Chat", () => {
      this.activateView();
    });

    // Add command to open chat
    this.addCommand({
      id: "open-openclaw-chat",
      name: "Open OpenClaw Chat",
      callback: () => this.activateView(),
    });

    // Add command to ask about current note
    this.addCommand({
      id: "ask-openclaw-about-note",
      name: "Ask OpenClaw about current note",
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

    // Settings tab
    this.addSettingTab(new OpenClawSettingTab(this.app, this));

    // Start auto-sync if enabled
    if (this.settings.syncEnabled && this.settings.syncInterval > 0) {
      this.syncService.startAutoSync();
    }

    console.log("OpenClaw loaded 🐉");
  }

  onunload(): void {
    this.syncService.stopAutoSync();
    console.log("OpenClaw unloaded");
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
    this.api = new OpenClawAPI(this.settings);
    
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
    const leaves = workspace.getLeavesOfType(OPENCLAW_VIEW_TYPE);

    if (leaves.length > 0) {
      leaf = leaves[0];
    } else {
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({ type: OPENCLAW_VIEW_TYPE, active: true });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }
}
