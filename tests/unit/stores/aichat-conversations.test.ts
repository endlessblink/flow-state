/**
 * TASK-1977 — feature-matrix coverage for AI chat conversations.
 * Features: aichat.conversations (create / switch / rename / delete, never
 * leaving the user without an active conversation) and aichat.panel
 * (open / close / toggle). Both were unaudited.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";

vi.mock("@/services/ai/tools", () => ({ executeTool: vi.fn() }));
vi.mock("@/services/ai/usageSync", () => ({ startUsageSync: vi.fn() }));

import { useAIChatStore } from "@/stores/aiChat";

describe("AI chat conversations", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("creates a conversation, sets it active, and seeds a welcome message", () => {
    const store = useAIChatStore();
    const conv = store.createConversation();
    expect(conv.id).toBeTruthy();
    expect(store.activeConversationId).toBe(conv.id);
    expect(conv.messages.length).toBeGreaterThan(0);
    expect(conv.messages[0].role).toBe("assistant");
  });

  it("switches only to an existing conversation", () => {
    const store = useAIChatStore();
    const a = store.createConversation();
    const b = store.createConversation();
    store.switchConversation(a.id);
    expect(store.activeConversationId).toBe(a.id);
    store.switchConversation("does-not-exist");
    expect(store.activeConversationId).toBe(a.id); // unchanged
    expect(b.id).toBeTruthy();
  });

  it("renames a conversation", () => {
    const store = useAIChatStore();
    const conv = store.createConversation();
    store.renameConversation(conv.id, "Planning session");
    expect(store.conversations.find((c) => c.id === conv.id)?.title).toBe(
      "Planning session",
    );
  });

  it("deleting a non-active conversation just removes it", () => {
    const store = useAIChatStore();
    const a = store.createConversation();
    const b = store.createConversation(); // b is active
    store.deleteConversation(a.id);
    expect(store.conversations.some((c) => c.id === a.id)).toBe(false);
    expect(store.activeConversationId).toBe(b.id);
  });

  it("deleting the active conversation never leaves the user without one", () => {
    const store = useAIChatStore();
    const a = store.createConversation();
    const b = store.createConversation(); // active

    store.deleteConversation(b.id); // delete the active one
    // Must fall back to the remaining conversation, not leave activeId dangling.
    expect(store.activeConversationId).toBe(a.id);

    store.deleteConversation(a.id); // delete the last one
    // With none remaining it must create a fresh active conversation.
    expect(store.activeConversationId).toBeTruthy();
    expect(store.conversations.length).toBeGreaterThan(0);
  });

  it("opens, closes, and toggles the AI panel", () => {
    const store = useAIChatStore();
    expect(store.isPanelOpen).toBe(false);
    store.openPanel();
    expect(store.isPanelOpen).toBe(true);
    store.closePanel();
    expect(store.isPanelOpen).toBe(false);
    store.togglePanel();
    expect(store.isPanelOpen).toBe(true);
  });
});
