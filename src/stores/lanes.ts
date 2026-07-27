import { defineStore } from "pinia";
import { ref, computed, watch, nextTick } from "vue";
import { useSupabaseDatabase } from "@/composables/useSupabaseDatabase";
import { type Lane } from "@/types/tasks";

// TASK-1812: Lanes store — sprint-style cross-project goals. Mirrors the projects
// store's offline-first dual-write idiom (memory → cache → sync queue → remote).
// v1 keeps the offline cache in localStorage (no IndexedDB schema bump yet).
export const useLaneStore = defineStore("lanes", () => {
  // State — _rawLanes mirrors _rawProjects; use `lanes` (filtered) for display.
  const _rawLanes = ref<Lane[]>([]);
  const isLoading = ref(false);

  const manualOperationInProgress = ref(false);
  let loadInFlightPromise: Promise<void> | null = null;
  let syncUpdateInProgress = false;

  const LANES_CACHE_KEY = "flowstate-lanes-cache";

  const saveLanesToLocalStorage = () => {
    try {
      localStorage.setItem(LANES_CACHE_KEY, JSON.stringify(_rawLanes.value));
    } catch (e) {
      console.error("❌ [LANES] Failed to cache lanes to localStorage:", e);
    }
  };

  const loadLanesFromLocalStorage = (): Lane[] => {
    try {
      const stored = localStorage.getItem(LANES_CACHE_KEY);
      if (stored) {
        const lanes = JSON.parse(stored) as Lane[];
        const seenIds = new Set<string>();
        return lanes.filter((l) => {
          if (!l.id || seenIds.has(l.id)) return false;
          seenIds.add(l.id);
          return true;
        });
      }
    } catch (e) {
      console.error("❌ [LANES] Failed to load lanes from localStorage:", e);
    }
    return [];
  };

  // Filtered lanes for display — drop corrupted/soft-deleted entries.
  const lanes = computed(() =>
    _rawLanes.value.filter((l) => {
      if (!l.id) return false;
      if (
        (l as Record<string, unknown>).is_deleted === true ||
        (l as Record<string, unknown>).isDeleted === true
      )
        return false;
      if (!l.name || typeof l.name !== "string" || l.name.trim() === "")
        return false;
      return true;
    }),
  );

  const laneMap = computed(() => {
    const map = new Map<string, Lane>();
    for (const l of _rawLanes.value) map.set(l.id, l);
    return map;
  });

  // -- Supabase Integration --
  const {
    fetchLanes,
    saveLane,
    deleteLane: deleteLaneRemote,
  } = useSupabaseDatabase();

  const loadLanesFromDatabase = async () => {
    if (loadInFlightPromise) return loadInFlightPromise;

    loadInFlightPromise = (async () => {
      isLoading.value = true;
      try {
        const { useAuthStore } = await import("@/stores/auth");
        const authStore = useAuthStore();
        if (!authStore.isAuthenticated) {
          _rawLanes.value = loadLanesFromLocalStorage();
          console.log(
            `👤 [GUEST-MODE] Loaded ${_rawLanes.value.length} lanes from localStorage`,
          );
          return;
        }

        const { useWorkspaceStore } = await import("@/stores/workspace");
        const workspaceId = useWorkspaceStore().activeWorkspaceId;
        const loaded = await fetchLanes(workspaceId);
        syncUpdateInProgress = true;
        _rawLanes.value = loaded;
        nextTick(() => {
          syncUpdateInProgress = false;
        });
        saveLanesToLocalStorage();
        console.log(`✅ [SUPABASE] Loaded ${loaded.length} lanes`);
      } catch (error) {
        console.error("❌ [SUPABASE] Lanes load failed:", error);
        if (_rawLanes.value.length === 0) {
          _rawLanes.value = loadLanesFromLocalStorage();
        }
      } finally {
        isLoading.value = false;
      }
    })();

    try {
      await loadInFlightPromise;
    } finally {
      loadInFlightPromise = null;
    }
  };

  const enqueueLaneOp = async (
    operation: "create" | "update" | "delete",
    lane: Lane | { id: string },
  ) => {
    try {
      const { useSyncOrchestrator } =
        await import("@/composables/sync/useSyncOrchestrator");
      const syncOrchestrator = useSyncOrchestrator();
      const { useAuthStore } = await import("@/stores/auth");
      const userId = useAuthStore().user?.id;
      if (!userId) return;
      let payload: Record<string, unknown> = { id: lane.id };
      if (operation !== "delete") {
        const { toSupabaseLane } = await import("@/utils/supabaseMappers");
        payload = JSON.parse(
          JSON.stringify(toSupabaseLane(lane as Lane, userId)),
        );
      }
      await syncOrchestrator.enqueue({
        entityType: "lane",
        operation,
        entityId: lane.id,
        payload,
        baseVersion: 0,
      });
    } catch (queueError) {
      console.warn(
        `[SYNC-QUEUE] Failed to queue lane ${operation}:`,
        queueError,
      );
    }
  };

  const createLane = async (laneData: Partial<Lane>) => {
    manualOperationInProgress.value = true;
    try {
      const { useWorkspaceStore } = await import("@/stores/workspace");
      const activeWorkspaceId = useWorkspaceStore().activeWorkspaceId;

      const newLane: Lane = {
        id: crypto.randomUUID(),
        name: laneData.name || "New Lane",
        color: laneData.color || "#4ECDC4",
        createdAt: new Date(),
        updatedAt: new Date(),
        ...laneData,
        workspaceId:
          laneData.workspaceId !== undefined
            ? laneData.workspaceId
            : activeWorkspaceId,
      } as Lane;
      _rawLanes.value.push(newLane);
      saveLanesToLocalStorage();

      await enqueueLaneOp("create", newLane);
      await saveLane(newLane);
      return newLane;
    } finally {
      manualOperationInProgress.value = false;
    }
  };

  const updateLane = async (laneId: string, updates: Partial<Lane>) => {
    const index = _rawLanes.value.findIndex((l) => l.id === laneId);
    if (index === -1) return;
    manualOperationInProgress.value = true;
    try {
      _rawLanes.value[index] = {
        ..._rawLanes.value[index],
        ...updates,
        updatedAt: new Date(),
      };
      saveLanesToLocalStorage();
      await enqueueLaneOp("update", _rawLanes.value[index]);
      await saveLane(_rawLanes.value[index]);
    } finally {
      manualOperationInProgress.value = false;
    }
  };

  const deleteLane = async (laneId: string) => {
    const index = _rawLanes.value.findIndex((l) => l.id === laneId);
    if (index === -1) return;
    manualOperationInProgress.value = true;

    const snapshot = _rawLanes.value.map((l) => ({ ...l }));
    try {
      // Clear lane membership on local tasks so the UI doesn't reference a
      // deleted lane. (Hard-delete would also do this via ON DELETE SET NULL,
      // but our delete is a soft-delete — clear it explicitly here.)
      const { useTaskStore } = await import("./tasks");
      type TaskStoreLoophole = {
        _rawTasks: { id: string; laneId?: string | null }[];
        updateTask: (id: string, updates: { laneId: null }) => Promise<void>;
      };
      const taskStore = useTaskStore() as unknown as TaskStoreLoophole;
      const affected = taskStore._rawTasks.filter((t) => t.laneId === laneId);
      const BATCH = 10;
      for (let i = 0; i < affected.length; i += BATCH) {
        const batch = affected.slice(i, i + BATCH);
        await Promise.all(
          batch.map((t) =>
            taskStore
              .updateTask(t.id, { laneId: null })
              .catch((err) =>
                console.error(
                  `[DELETE-LANE] Failed to clear lane on task ${t.id}:`,
                  err,
                ),
              ),
          ),
        );
      }

      // TASK-1977: lane delete + task detachment must be atomic on the
      // invariant that matters — no task may reference a lane that no
      // longer exists. The per-task clears above are best-effort, so if
      // any of them failed the task still points at this lane. Deleting
      // the lane anyway (the old behaviour) left a dangling reference the
      // user sees as a task stuck in a phantom lane. Fail closed: if any
      // task still references the lane, abort so the catch below rolls the
      // lane list back. The successfully-detached tasks keep laneId=null,
      // which is harmless (they were losing the lane regardless).
      const stillReferenced = taskStore._rawTasks.some(
        (t) => t.laneId === laneId,
      );
      if (stillReferenced) {
        throw new Error(
          `Lane ${laneId} not deleted: one or more tasks could not be detached`,
        );
      }

      _rawLanes.value.splice(index, 1);
      saveLanesToLocalStorage();

      await enqueueLaneOp("delete", { id: laneId });
      await deleteLaneRemote(laneId);
    } catch (e) {
      console.error(
        "[DELETE-LANE] Delete failed, rolling back local state:",
        e,
      );
      _rawLanes.value = snapshot;
      saveLanesToLocalStorage();
      throw e;
    } finally {
      manualOperationInProgress.value = false;
    }
  };

  const getLaneById = (laneId: string | null | undefined): Lane | undefined => {
    if (!laneId) return undefined;
    return laneMap.value.get(laneId);
  };

  const getLaneName = (laneId: string | null | undefined): string => {
    if (!laneId) return "No Lane";
    return getLaneById(laneId)?.name || "No Lane";
  };

  // -- Realtime sync hooks (mirror updateProjectFromSync/removeProjectFromSync) --
  const updateLaneFromSync = (laneId: string, payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const data = payload as Record<string, unknown>;
    if (!data.name || typeof data.name !== "string" || data.name.trim() === "")
      return;

    syncUpdateInProgress = true;
    try {
      const index = _rawLanes.value.findIndex((l) => l.id === laneId);
      const normalized: Lane = {
        id: laneId,
        name: data.name,
        color: typeof data.color === "string" ? data.color : "#4ECDC4",
        createdAt: new Date(
          typeof data.createdAt === "string" ||
            typeof data.createdAt === "number"
            ? data.createdAt
            : Date.now(),
        ),
        updatedAt: new Date(
          typeof data.updatedAt === "string" ||
            typeof data.updatedAt === "number"
            ? data.updatedAt
            : Date.now(),
        ),
        workspaceId:
          typeof data.workspaceId === "string" ? data.workspaceId : null,
      };
      if (index !== -1) {
        _rawLanes.value[index] = { ..._rawLanes.value[index], ...normalized };
      } else {
        _rawLanes.value.push(normalized);
      }
      saveLanesToLocalStorage();
    } finally {
      nextTick(() => {
        syncUpdateInProgress = false;
      });
    }
  };

  const removeLaneFromSync = (laneId: string) => {
    const index = _rawLanes.value.findIndex((l) => l.id === laneId);
    if (index !== -1) {
      _rawLanes.value.splice(index, 1);
      saveLanesToLocalStorage();
    }
  };

  const clearAll = () => {
    _rawLanes.value = [];
  };

  // Auto-save watcher (guest-mode/local cache only; authed writes go through CRUD)
  let saveTimeout: ReturnType<typeof setTimeout> | null = null;
  watch(
    lanes,
    () => {
      if (
        manualOperationInProgress.value ||
        isLoading.value ||
        syncUpdateInProgress
      )
        return;
      if (saveTimeout) clearTimeout(saveTimeout);
      saveTimeout = setTimeout(() => {
        saveLanesToLocalStorage();
      }, 1000);
    },
    { deep: true },
  );

  return {
    lanes,
    _rawLanes,
    isLoading,
    loadLanesFromDatabase,
    createLane,
    updateLane,
    deleteLane,
    getLaneById,
    getLaneName,
    updateLaneFromSync,
    removeLaneFromSync,
    clearAll,
  };
});
