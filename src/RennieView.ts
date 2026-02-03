import { ItemView, WorkspaceLeaf, MarkdownRenderer, TFile } from "obsidian";
import type RenniePlugin from "../main";
import { ChatMessage } from "./types";

export const RENNIE_VIEW_TYPE = "rennie-chat-view";

export class RennieView extends ItemView {
  private messages: ChatMessage[] = [];
  private inputEl: HTMLTextAreaElement;
  private messagesEl: HTMLElement;
  private isLoading = false;

  constructor(leaf: WorkspaceLeaf, private plugin: RenniePlugin) {
    super(leaf);
  }

  getViewType(): string {
    return RENNIE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "Ask Rennie Anything";
  }

  getIcon(): string {
    return "message-circle";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.addClass("rennie-chat-container");

    // Messages area
    this.messagesEl = container.createDiv({ cls: "rennie-messages" });

    // Input area
    const inputContainer = container.createDiv({ cls: "rennie-input-container" });
    
    this.inputEl = inputContainer.createEl("textarea", {
      cls: "rennie-input",
      attr: { placeholder: "Ask Rennie anything...", rows: "2" },
    });

    const buttonRow = inputContainer.createDiv({ cls: "rennie-button-row" });
    
    const includeNoteToggle = buttonRow.createEl("label", { cls: "rennie-toggle" });
    const checkbox = includeNoteToggle.createEl("input", { type: "checkbox" });
    checkbox.checked = true;
    includeNoteToggle.appendText(" Include current note");
    
    const sendBtn = buttonRow.createEl("button", {
      cls: "rennie-send-btn",
      text: "Send",
    });

    // Event handlers
    sendBtn.addEventListener("click", () => this.sendMessage(checkbox.checked));
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        this.sendMessage(checkbox.checked);
      }
    });

    // Welcome state with Rennie visual
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
      <div class="rennie-welcome-hint">I know your vault. Try ⌘+Enter to send.</div>
    `;

    // Also add as first message for history
    this.addMessage({
      role: "assistant",
      content: "Hey! I'm Rennie — ask me anything, or ask me to create and edit notes.",
      timestamp: Date.now(),
    });
  }

  async onClose(): Promise<void> {
    // Cleanup if needed
  }

  private async sendMessage(includeCurrentNote: boolean): Promise<void> {
    const message = this.inputEl.value.trim();
    if (!message || this.isLoading) return;

    this.inputEl.value = "";
    this.isLoading = true;

    // Add user message
    this.addMessage({
      role: "user",
      content: message,
      timestamp: Date.now(),
    });

    // Get context
    let context: { currentFile?: string; currentContent?: string } = {};
    if (includeCurrentNote) {
      const activeFile = this.app.workspace.getActiveFile();
      if (activeFile instanceof TFile) {
        context.currentFile = activeFile.path;
        context.currentContent = await this.app.vault.read(activeFile);
      }
    }

    // Show loading indicator
    const loadingEl = this.messagesEl.createDiv({ cls: "rennie-message rennie-loading" });
    loadingEl.setText("Rennie is thinking...");

    try {
      const response = await this.plugin.api.chat(message, context);

      // Remove loading indicator
      loadingEl.remove();

      // Add assistant message
      this.addMessage({
        role: "assistant",
        content: response.text,
        timestamp: Date.now(),
        actions: response.actions,
      });

      // Execute actions
      if (response.actions.length > 0) {
        await this.plugin.actionExecutor.execute(response.actions);
      }
    } catch (err) {
      loadingEl.remove();
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.addMessage({
        role: "error",
        content: errorMsg,
        timestamp: Date.now(),
      });
    }

    this.isLoading = false;
  }

  private addMessage(msg: ChatMessage): void {
    this.messages.push(msg);

    const messageEl = this.messagesEl.createDiv({
      cls: `rennie-message rennie-${msg.role}`,
    });

    const contentEl = messageEl.createDiv({ cls: "rennie-message-content" });
    
    // Render markdown for assistant messages
    if (msg.role === "assistant") {
      MarkdownRenderer.render(
        this.app,
        msg.content,
        contentEl,
        "",
        this.plugin
      );
    } else if (msg.role === "error") {
      // Error messages are selectable/copyable
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

    // Show actions if any
    if (msg.actions && msg.actions.length > 0 && this.plugin.settings.showActionsInChat) {
      const actionsEl = messageEl.createDiv({ cls: "rennie-actions" });
      actionsEl.setText(`📁 ${msg.actions.length} file action(s)`);
    }

    // Scroll to bottom
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
