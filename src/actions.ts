import { App, TFile, Notice, Modal, Setting } from "obsidian";
import { OpenClawAction } from "./types";

// Actions that require user confirmation before executing
const DESTRUCTIVE_ACTIONS = ["deleteFile", "updateFile", "renameFile"];

class ConfirmActionModal extends Modal {
  private result: boolean = false;
  private resolvePromise: (value: boolean) => void;

  constructor(
    app: App,
    private action: OpenClawAction,
    private description: string
  ) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    
    contentEl.createEl("h2", { text: "Confirm Action" });
    contentEl.createEl("p", { text: "OpenClaw wants to perform the following action:" });
    
    const detailsEl = contentEl.createDiv({ cls: "openclaw-confirm-details" });
    detailsEl.createEl("strong", { text: this.getActionLabel() });
    detailsEl.createEl("p", { text: this.description });
    
    // Warning for destructive actions
    if (this.action.action === "deleteFile") {
      const warningEl = contentEl.createDiv({ cls: "openclaw-confirm-warning" });
      warningEl.setText("⚠️ This action cannot be undone.");
    }

    const buttonContainer = contentEl.createDiv({ cls: "openclaw-confirm-buttons" });
    
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

    // Focus confirm button
    confirmBtn.focus();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (this.resolvePromise) {
      this.resolvePromise(this.result);
    }
  }

  private getActionLabel(): string {
    switch (this.action.action) {
      case "deleteFile": return "🗑️ Delete File";
      case "updateFile": return "✏️ Update File";
      case "renameFile": return "📝 Rename File";
      default: return this.action.action;
    }
  }

  async waitForResult(): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolvePromise = resolve;
      this.open();
    });
  }
}

export class ActionExecutor {
  constructor(private app: App) {}

  async execute(actions: OpenClawAction[]): Promise<{ success: number; failed: number; skipped: number }> {
    let success = 0;
    let failed = 0;
    let skipped = 0;

    for (const action of actions) {
      try {
        // Check if action requires confirmation
        if (DESTRUCTIVE_ACTIONS.includes(action.action)) {
          const description = this.getActionDescription(action);
          const modal = new ConfirmActionModal(this.app, action, description);
          const confirmed = await modal.waitForResult();
          
          if (!confirmed) {
            skipped++;
            new Notice(`OpenClaw: Skipped ${action.action}`);
            continue;
          }
        }

        await this.executeOne(action);
        success++;
      } catch (err) {
        console.error("Action failed:", action, err);
        failed++;
      }
    }

    if (success > 0) {
      new Notice(`OpenClaw: ${success} action(s) completed`);
    }
    if (failed > 0) {
      new Notice(`OpenClaw: ${failed} action(s) failed`);
    }

    return { success, failed, skipped };
  }

  private getActionDescription(action: OpenClawAction): string {
    switch (action.action) {
      case "deleteFile":
        return `Delete: ${action.path}`;
      case "updateFile":
        return `Replace contents of: ${action.path}`;
      case "renameFile":
        return `Rename: ${action.path} → ${action.newPath}`;
      default:
        return JSON.stringify(action);
    }
  }

  private async executeOne(action: OpenClawAction): Promise<void> {
    const { vault } = this.app;

    switch (action.action) {
      case "createFile": {
        const exists = vault.getAbstractFileByPath(action.path);
        if (exists) {
          throw new Error(`File already exists: ${action.path}`);
        }
        await vault.create(action.path, action.content);
        break;
      }

      case "updateFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!(file instanceof TFile)) {
          throw new Error(`File not found: ${action.path}`);
        }
        await vault.modify(file, action.content);
        break;
      }

      case "appendToFile": {
        const file = vault.getAbstractFileByPath(action.path);
        if (!(file instanceof TFile)) {
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
        if (!(file instanceof TFile)) {
          throw new Error(`File not found: ${action.path}`);
        }
        await this.app.workspace.getLeaf().openFile(file);
        break;
      }

      default:
        throw new Error(`Unknown action: ${(action as OpenClawAction).action}`);
    }
  }
}
