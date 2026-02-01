import { Plugin, WorkspaceLeaf } from "obsidian";
import { OpenClawView, OPENCLAW_VIEW_TYPE } from "./src/OpenClawView";
import { OpenClawAPI } from "./src/api";
import { ActionExecutor } from "./src/actions";
import { OpenClawSettingTab } from "./src/settings";
import { OpenClawSettings, DEFAULT_SETTINGS } from "./src/types";

export default class OpenClawPlugin extends Plugin {
  settings: OpenClawSettings;
  api: OpenClawAPI;
  actionExecutor: ActionExecutor;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.api = new OpenClawAPI(this.settings);
    this.actionExecutor = new ActionExecutor(this.app);

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
        // The view will be opened, user can then type their question
      },
    });

    // Settings tab
    this.addSettingTab(new OpenClawSettingTab(this.app, this));

    console.log("OpenClaw loaded 🐉");
  }

  onunload(): void {
    console.log("OpenClaw unloaded");
  }

  async loadSettings(): Promise<void> {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
    // Recreate API with new settings
    this.api = new OpenClawAPI(this.settings);
  }

  async activateView(): Promise<void> {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(OPENCLAW_VIEW_TYPE);

    if (leaves.length > 0) {
      // View already exists, focus it
      leaf = leaves[0];
    } else {
      // Create new view in right sidebar
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
