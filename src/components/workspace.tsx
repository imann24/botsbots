"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  BookmarkCheck,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Download,
  FileText,
  Lightbulb,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Square,
  Swords,
  Target,
  Trash2,
  Users,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { browserClient } from "@/lib/supabase/client";
import { modelInfo, type ModelPrice } from "@/lib/models";
import {
  agentClass,
  agentColors,
  assignAgentColors,
  nextAgentColor,
} from "@/lib/agent-colors";
import {
  DEFAULT_BOTS,
  DEFAULT_SETTINGS,
  type Bot,
  type Message,
  type Room,
  type RoomDraft,
  type Settings,
} from "@/lib/types";
import { Brand } from "./brand";
import { ModelLabel, ModelSelect } from "./model-identity";
import { SummaryPanel } from "./summary-panel";
import type { Summary } from "@/lib/summary";
import { AccountUsageMeter, useAccountUsage } from "./account-usage";
import { usageMoney } from "@/lib/usage";
import {
  appDefaults,
  sameLineup,
  type AccountDefaults,
} from "@/lib/account-defaults";
import { CommandBar, type WorkspaceCommand } from "./command-bar";
import { shortcutKey } from "@/lib/commands";
import { ContactModal } from "./contact-modal";
import type { ContactKind } from "@/lib/contact";
import { ArchiveChatModal } from "./archive-chat-modal";
import { compareRooms } from "@/lib/room-order";
import { RoomTitle } from "./room-title";
import {
  trackAction,
  trackEvent,
  roomAnalytics,
  lengthBucket,
} from "@/lib/analytics";
const presets = [
  {
    id: "plan" as const,
    name: "Make a plan",
    icon: Target,
    topic:
      "Help me turn a side-project idea into a realistic two-week plan. Challenge the scope, identify the riskiest assumption, and agree on the first three steps.",
  },
  {
    id: "research" as const,
    name: "Understand something",
    icon: BookOpen,
    topic:
      "Help me understand how small language models differ from larger ones. Compare their strengths and limitations, question assumptions, and separate established facts from uncertainty.",
  },
  {
    id: "debate" as const,
    name: "Test an idea",
    icon: Swords,
    topic:
      "Should a small startup focus on one excellent product or experiment with several? Explore both sides constructively and end with a useful decision framework.",
  },
  {
    id: "explore" as const,
    name: "Explore possibilities",
    icon: Lightbulb,
    topic:
      "Imagine a weekend that feels like a tiny adventure without a big budget. Combine unexpected ideas and turn the best ones into an achievable plan.",
  },
];
function freshDraft(
  defaults: Pick<AccountDefaults, "bots" | "settings"> = {
    bots: DEFAULT_BOTS,
    settings: DEFAULT_SETTINGS,
  },
): RoomDraft {
  return {
    title: "",
    topic: "",
    purpose: "plan",
    bots: structuredClone(defaults.bots),
    settings: { ...defaults.settings },
  };
}
async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "The request failed. Try again.");
  return body;
}
const money = (n: number) => `$${n.toFixed(n > 0 && n < 0.01 ? 4 : 2)}`;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Resolved on the client only: null on the server, on touch-only devices
// (no keyboard to press it with), and during hydration.
const noSubscribe = () => () => {};
function startModifier(): "⌘" | "Ctrl" | null {
  if (!matchMedia("(any-pointer: fine)").matches) return null;
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}
function StartShortcutHint() {
  const modifier = useSyncExternalStore(noSubscribe, startModifier, () => null);
  if (!modifier) return null;
  return (
    <span className="shortcut-hint">
      <kbd>{modifier}</kbd>
      <kbd>↵</kbd>
      to start
    </span>
  );
}
export function Workspace({ email }: { email: string }) {
  const [archiveTarget, setArchiveTarget] = useState<Room | null>(null);
  const [archiveView, setArchiveView] = useState(false);
  const [archivedRooms, setArchivedRooms] = useState<Room[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState("");
  const [restoreBusy, setRestoreBusy] = useState<string | null>(null);
  const [archiveNotice, setArchiveNotice] = useState("");
  const archiveMutation = useRef(false);
  const [contactKind, setContactKind] = useState<ContactKind | null>(null);
  function showContact(kind: ContactKind = "support") {
    trackEvent("contact_opened", { kind });
    setNavOpen(false);
    setPanelOpen(false);
    requestAnimationFrame(() => setContactKind(kind));
  }
  const accountUsage = useAccountUsage();
  const accountExhausted =
    !accountUsage.error && accountUsage.usage?.remaining === 0;
  const [summaries, setSummaries] = useState<Summary[]>([]),
    [summaryOpen, setSummaryOpen] = useState(false);
  const summaryButton = useRef<HTMLButtonElement>(null);
  const [rooms, setRooms] = useState<Room[]>([]),
    [room, setRoom] = useState<Room | null>(null),
    [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState<RoomDraft>(freshDraft),
    [editing, setEditing] = useState(true),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [text, setText] = useState(""),
    [search, setSearch] = useState(""),
    [prices, setPrices] = useState<ModelPrice[]>([]),
    [modelError, setModelError] = useState("");
  // Starting lineup and limits for new rooms, saved to the account.
  const [accountDefaults, setAccountDefaults] =
      useState<AccountDefaults>(appDefaults),
    [defaultsBusy, setDefaultsBusy] = useState(false),
    [defaultsNotice, setDefaultsNotice] = useState("");
  const accountDefaultsRef = useRef(accountDefaults);
  accountDefaultsRef.current = accountDefaults;
  const [navOpen, setNavOpen] = useState(false),
    [panelOpen, setPanelOpen] = useState(false),
    [expandedBot, setExpandedBot] = useState<string | null>(null),
    [limitsOpen, setLimitsOpen] = useState(false),
    [showJump, setShowJump] = useState(false);
  const [collapsedPanels, setCollapsedPanels] = useState({
    nav: false,
    setup: false,
  });
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("botsbots:collapsed-panels") ?? "null",
      );
      if (saved)
        setCollapsedPanels({
          nav: saved.nav === true,
          setup: saved.setup === true,
        });
    } catch {
      // Layout controls still work when browser storage is unavailable.
    }
  }, []);
  function toggleCollapsedPanel(panel: "nav" | "setup") {
    const next = { ...collapsedPanels, [panel]: !collapsedPanels[panel] };
    trackEvent("panel_toggled", {
      panel,
      open: !next[panel],
      layout: "desktop",
    });
    setCollapsedPanels(next);
    try {
      localStorage.setItem("botsbots:collapsed-panels", JSON.stringify(next));
    } catch {
      // Keep the preference for this visit if persistence is unavailable.
    }
  }
  const current = useRef<Room | null>(room);
  const navRef = useRef<HTMLElement>(null),
    panelRef = useRef<HTMLElement>(null);
  const [mobileNav, setMobileNav] = useState(false),
    [compactPanel, setCompactPanel] = useState(false);
  const activeDrawer =
    mobileNav && navOpen ? "nav" : compactPanel && panelOpen ? "panel" : null;
  useEffect(() => {
    const navQuery = window.matchMedia("(max-width: 640px)");
    const panelQuery = window.matchMedia("(max-width: 980px)");
    const sync = () => {
      setMobileNav(navQuery.matches);
      setCompactPanel(panelQuery.matches);
    };
    sync();
    navQuery.addEventListener("change", sync);
    panelQuery.addEventListener("change", sync);
    return () => {
      navQuery.removeEventListener("change", sync);
      panelQuery.removeEventListener("change", sync);
    };
  }, []);
  useEffect(() => {
    if (!activeDrawer) return;
    const drawer = activeDrawer === "nav" ? navRef.current : panelRef.current;
    if (!drawer) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusable = () =>
      Array.from(
        drawer.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]',
        ),
      ).filter((el) => el.getClientRects().length > 0);
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setNavOpen(false);
        setPanelOpen(false);
      } else if (event.key === "Tab") {
        const items = focusable(),
          first = items[0],
          last = items.at(-1);
        if (!first) {
          event.preventDefault();
          drawer.focus();
        } else if (
          event.shiftKey &&
          (document.activeElement === first ||
            document.activeElement === drawer)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    drawer.addEventListener("keydown", onKey);
    return () => {
      drawer.removeEventListener("keydown", onKey);
      if (previous?.isConnected) previous.focus();
    };
  }, [activeDrawer]);
  current.current = room;
  const selectedId = useRef<string | null>(null),
    feed = useRef<HTMLDivElement>(null),
    bottom = useRef<HTMLDivElement>(null),
    composer = useRef<HTMLTextAreaElement>(null);
  const draftOrRoom = editing ? draft : (room ?? draft);
  // Saved bots plus any removed bots that still have messages: unique colors.
  const chatColors = agentColors(
    room?.bots ?? [],
    messages.map((m) => m.bot_id),
  );
  const rosterColors = agentColors(draftOrRoom.bots);
  const count = messages.length,
    spent = [...messages, ...summaries].reduce(
      (sum, m) => sum + Number(m.cost ?? m.reserved_cost),
      0,
    ),
    pending = messages.filter((m) => m.status === "pending").length;
  const refreshRooms = useCallback(async () => {
    const data = await api<{ rooms: Room[] }>("/api/rooms");
    setRooms(data.rooms);
  }, []);
  const refresh = useCallback(async (id: string) => {
    const data = await api<{
      room: Room;
      messages: Message[];
      summaries: Summary[];
    }>(`/api/rooms/${id}`);
    if (selectedId.current !== id) return;
    if (
      current.current?.id === id &&
      current.current.updated_at > data.room.updated_at
    )
      return;
    if (data.room.archived_at) {
      selectedId.current = null;
      setRoom(null);
      setEditing(true);
      setArchiveView(true);
      setArchiveNotice(
        "This chat is archived. Restore it from Archived chats.",
      );
      window.history.replaceState(null, "", "/");
      setRooms((all) => all.filter((r) => r.id !== id));
      return;
    }
    setRoom(data.room);
    setMessages(data.messages);
    setSummaries(data.summaries);
    setRooms((all) => all.map((r) => (r.id === id ? data.room : r)));
  }, []);
  const selectRoom = useCallback(
    async (
      id: string,
      interaction?: { source: "navigation" | "command"; filtered?: boolean },
    ) => {
      selectedId.current = id;
      setLoading(true);
      setEditing(false);
      setError("");
      setMessages([]);
      setSummaries([]);
      setSummaryOpen(false);
      setRoom(null);
      setNavOpen(false);
      try {
        await refresh(id);
        if (selectedId.current === id) {
          window.history.replaceState(null, "", `/?room=${id}`);
          if (interaction) trackEvent("room_opened", interaction);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [refresh],
  );
  useEffect(() => {
    void refreshRooms()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    const id = new URLSearchParams(window.location.search).get("room");
    if (id) void selectRoom(id);
    void api<{ defaults: AccountDefaults }>("/api/account/defaults")
      .then(({ defaults }) => {
        setAccountDefaults(defaults);
        // Swap the saved lineup into an untouched new-room draft.
        setDraft((d) =>
          !selectedId.current && sameLineup(d, freshDraft())
            ? {
                ...d,
                ...freshDraft(defaults),
                title: d.title,
                topic: d.topic,
                purpose: d.purpose,
              }
            : d,
        );
      })
      .catch(() => {
        // App defaults still work; saving will surface any real problem.
      });
    void api<{ prices: ModelPrice[] }>("/api/models")
      .then((d) => setPrices(d.prices))
      .catch(() =>
        setModelError(
          "Live prices are unavailable. Starting a discussion requires a fresh price check.",
        ),
      );
  }, [refreshRooms, selectRoom]);
  useEffect(() => {
    if (!room?.id) return;
    const id = room.id;
    const timer = setInterval(() => {
      void refresh(id).catch((e) => setError(e.message));
    }, 1500);
    return () => clearInterval(timer);
  }, [room?.id, refresh]);
  useEffect(() => {
    if (!showJump)
      bottom.current?.scrollIntoView({ behavior: "instant", block: "end" });
  }, [messages, showJump]);
  useEffect(() => {
    if (!room || room.status !== "running" || !room.run_id) return;
    let cancelled = false;
    const id = room.id,
      runId = room.run_id,
      width =
        room.settings.mode === "moderated" ? 1 : room.settings.concurrency;
    async function worker() {
      while (
        !cancelled &&
        current.current?.id === id &&
        current.current?.status === "running" &&
        current.current?.run_id === runId
      ) {
        try {
          await api(`/api/rooms/${id}/tick`, {
            method: "POST",
            body: JSON.stringify({ runId }),
          });
          if (cancelled) return;
          await refresh(id);
          await pause(800);
        } catch (e) {
          if (!cancelled) {
            setError((e as Error).message);
            await api(`/api/rooms/${id}`, {
              method: "PATCH",
              body: JSON.stringify({ action: "pause" }),
            }).catch(() => {});
            await refresh(id).catch(() => {});
          }
          return;
        }
      }
    }
    for (let i = 0; i < width; i++) void worker();
    return () => {
      cancelled = true;
    };
  }, [
    room?.id,
    room?.run_id,
    room?.status,
    room?.settings.concurrency,
    room?.settings.mode,
    refresh,
  ]);
  function newRoom() {
    setArchiveView(false);
    setLoading(false);
    setText("");
    setSummaries([]);
    setSummaryOpen(false);
    selectedId.current = null;
    setRoom(null);
    setMessages([]);
    setDraft(freshDraft(accountDefaultsRef.current));
    setEditing(true);
    setDefaultsNotice("");
    setError("");
    setNavOpen(false);
    setExpandedBot(null);
    window.history.replaceState(null, "", "/");
  }
  function openNewRoom() {
    trackEvent("room_draft_opened", {
      custom_defaults: accountDefaultsRef.current.custom,
    });
    newRoom();
  }
  function toggleSummary() {
    trackEvent("panel_toggled", {
      panel: "summary",
      open: !summaryOpen,
      layout: "inline",
    });
    setSummaryOpen(!summaryOpen);
  }
  function changeArchiveView(open: boolean) {
    trackEvent("archive_view_changed", { open });
    setArchiveView(open);
    setSearch("");
  }
  function openDrawer(panel: "nav" | "setup", open: boolean) {
    trackEvent("panel_toggled", { panel, open, layout: "drawer" });
    if (panel === "nav") setNavOpen(open);
    else setPanelOpen(open);
  }
  const loadArchivedRooms = useCallback(async () => {
    setArchiveLoading(true);
    setArchiveError("");
    try {
      const data = await api<{ rooms: Room[] }>("/api/rooms?archived=true");
      setArchivedRooms(data.rooms);
    } catch (error) {
      setArchiveError(
        `Couldn’t load archived chats. ${(error as Error).message}`,
      );
    } finally {
      setArchiveLoading(false);
    }
  }, []);
  useEffect(() => {
    if (archiveView) void loadArchivedRooms();
  }, [archiveView, loadArchivedRooms]);
  function confirmArchive(target: Room) {
    trackEvent("room_archive_prompted", {});
    setNavOpen(false);
    setPanelOpen(false);
    requestAnimationFrame(() => setArchiveTarget(target));
  }
  async function archiveChat(target: Room) {
    const { room: archived } = await trackAction("room_archive", {}, () =>
      api<{ room: Room }>(`/api/rooms/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "archive" }),
      }),
    );
    setRooms((all) => all.filter((r) => r.id !== target.id));
    setArchivedRooms((all) =>
      [archived, ...all.filter((r) => r.id !== target.id)].sort(compareRooms),
    );
    if (selectedId.current === target.id) newRoom();
    setArchiveNotice(
      `“${target.title}” archived. Restore it from Archived chats.`,
    );
  }
  async function restoreChat(target: Room) {
    if (archiveMutation.current) return;
    archiveMutation.current = true;
    setRestoreBusy(target.id);
    setArchiveError("");
    try {
      const { room: restored } = await trackAction("room_restore", {}, () =>
        api<{ room: Room }>(`/api/rooms/${target.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "restore" }),
        }),
      );
      setArchivedRooms((all) => all.filter((r) => r.id !== target.id));
      setRooms((all) =>
        [restored, ...all.filter((r) => r.id !== target.id)].sort(compareRooms),
      );
      setArchiveView(false);
      setSearch("");
      await selectRoom(restored.id);
      setArchiveNotice(`“${target.title}” restored.`);
      requestAnimationFrame(() => {
        if (selectedId.current === restored.id)
          document.getElementById("main")?.focus({ preventScroll: true });
      });
    } catch (error) {
      setArchiveError(
        `Couldn’t restore this chat. ${(error as Error).message}`,
      );
    } finally {
      archiveMutation.current = false;
      setRestoreBusy(null);
    }
  }
  function editRoom() {
    if (!room) return;
    trackEvent("room_editor_opened", {});
    setDraft({
      title: room.title,
      topic: room.topic,
      purpose: room.purpose,
      bots: assignAgentColors(structuredClone(room.bots)),
      settings: { ...room.settings },
    });
    setEditing(true);
    setError("");
  }
  const saveInFlight = useRef(false);
  async function save(e?: FormEvent, startImmediately = false) {
    e?.preventDefault();
    if (busy || saveInFlight.current) return;
    if (startImmediately && accountExhausted) {
      trackEvent("room_start_blocked", { reason: "account_limit" });
      setError(
        "Your weekly allowance is used. You can still create a room and start it when your allowance resets.",
      );
      return;
    }
    saveInFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const value = {
        ...draft,
        title: draft.title.trim(),
      };
      const data = await trackAction(
        room ? "room_update" : "room_create",
        { ...roomAnalytics(draft), start_immediately: startImmediately },
        async () =>
          room
            ? await api<{ room: Room }>(`/api/rooms/${room.id}`, {
                method: "PATCH",
                body: JSON.stringify({ action: "settings", payload: value }),
              })
            : await api<{ room: Room }>("/api/rooms", {
                method: "POST",
                body: JSON.stringify(value),
              }),
      );
      selectedId.current = data.room.id;
      setRoom(data.room);
      setEditing(false);
      setPanelOpen(false);
      window.history.replaceState(null, "", `/?room=${data.room.id}`);
      setRooms((all) => [
        data.room,
        ...all.filter((item) => item.id !== data.room.id),
      ]);
      if (startImmediately) {
        try {
          const started = await trackAction(
            "room_start",
            { mode: data.room.settings.mode, source: "create" },
            () =>
              api<{ room: Room }>(`/api/rooms/${data.room.id}`, {
                method: "PATCH",
                body: JSON.stringify({ action: "start" }),
              }),
          );
          if (selectedId.current === started.room.id) setRoom(started.room);
        } catch (e) {
          setError(
            `Room created, but it couldn’t start: ${(e as Error).message} Use Start to try again.`,
          );
        }
      }
      await refreshRooms();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      saveInFlight.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!editing || room || loading) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        shortcutKey(event) !== "mod+enter" ||
        activeDrawer ||
        document.querySelector("dialog[open]")
      )
        return;
      event.preventDefault();
      if (busy || saveInFlight.current) return;
      const form = document.getElementById(
        "room-form",
      ) as HTMLFormElement | null;
      if (!form?.reportValidity()) return;
      if (draft.topic.trim().length < 3) {
        form.querySelector<HTMLTextAreaElement>("#room-topic")?.focus();
        return;
      }
      void save(undefined, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  async function action(name: "start" | "pause" | "stop") {
    if (!room) return;
    setBusy(true);
    setError("");
    try {
      const data = await trackAction(
        `room_${name}`,
        {
          mode: room.settings.mode,
          ...(name === "start" ? { source: "control" as const } : {}),
        },
        () =>
          api<{ room: Room }>(`/api/rooms/${room.id}`, {
            method: "PATCH",
            body: JSON.stringify({ action: name }),
          }),
      );
      setRoom(data.room);
      await refreshRooms();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function renameRoom(title: string) {
    if (!room) return;
    const id = room.id;
    const { room: renamed } = await trackAction("room_rename", {}, () =>
      api<{ room: Room }>(`/api/rooms/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "rename", payload: { title } }),
      }),
    );
    if (selectedId.current === id) setRoom(renamed);
    setRooms((all) => all.map((item) => (item.id === id ? renamed : item)));
  }
  const messageRequest = useRef<{ text: string; id: string } | null>(null);
  async function send(e?: FormEvent) {
    e?.preventDefault();
    if (!text.trim() || !room || busy) return;
    setBusy(true);
    setError("");
    const content = text.trim();
    if (messageRequest.current?.text !== content)
      messageRequest.current = { text: content, id: crypto.randomUUID() };
    const requestId = messageRequest.current.id;
    try {
      await trackAction(
        "message_send",
        {
          mode: room.settings.mode,
          room_status: room.status,
          length_bucket: lengthBucket(content.length),
        },
        () =>
          api(`/api/rooms/${room.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              action: "message",
              payload: { content, requestId },
            }),
          }),
      );
      setText("");
      messageRequest.current = null;
      await refresh(room.id);
      setShowJump(false);
      composer.current?.focus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDefaults() {
    setDefaultsBusy(true);
    setDefaultsNotice("");
    setError("");
    try {
      const { defaults } = await trackAction(
        "defaults_save",
        roomAnalytics(draft),
        () =>
          api<{ defaults: AccountDefaults }>("/api/account/defaults", {
            method: "PUT",
            body: JSON.stringify({
              bots: draft.bots,
              settings: draft.settings,
            }),
          }),
      );
      setAccountDefaults(defaults);
      setDefaultsNotice(
        "Saved. New rooms will start with these bots and limits.",
      );
    } catch (e) {
      setError(`Couldn’t save your defaults: ${(e as Error).message}`);
    } finally {
      setDefaultsBusy(false);
    }
  }
  async function resetDefaults() {
    setDefaultsBusy(true);
    setDefaultsNotice("");
    setError("");
    try {
      const { defaults } = await trackAction("defaults_reset", {}, () =>
        api<{ defaults: AccountDefaults }>("/api/account/defaults", {
          method: "DELETE",
        }),
      );
      setAccountDefaults(defaults);
      if (!room)
        setDraft((d) => ({
          ...d,
          ...freshDraft(defaults),
          title: d.title,
          topic: d.topic,
          purpose: d.purpose,
        }));
      setExpandedBot(null);
      setDefaultsNotice("Restored the BotsBots starting lineup for new rooms.");
    } catch (e) {
      setError(`Couldn’t reset your defaults: ${(e as Error).message}`);
    } finally {
      setDefaultsBusy(false);
    }
  }
  const draftIsDefault = sameLineup(draft, accountDefaults);
  function updateBot(id: string, patch: Partial<Bot>) {
    if (patch.model) trackEvent("bot_model_selected", { model: patch.model });
    setDraft((d) => ({
      ...d,
      bots: d.bots.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
  }
  function setting<K extends keyof Settings>(key: K, value: Settings[K]) {
    if (key === "mode" && value !== draft.settings.mode)
      trackEvent("room_setting_changed", { setting: key, value });
    setDraft((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
  }
  function exportChat() {
    if (!room) return;
    const body =
      `# ${room.title}\n\n${room.topic}\n\n` +
      messages
        .map(
          (m, i) =>
            `## ${String(i + 1).padStart(2, "0")} · ${m.speaker}${m.model ? ` (${modelInfo(m.model).name})` : ""}\n\n${m.content || m.error || "Pending reply"}\n`,
        )
        .join("\n");
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/markdown" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${room.title.replace(/[^a-z0-9]+/gi, "-")}.md`;
    a.click();
    URL.revokeObjectURL(url);
    trackEvent("room_exported", {
      message_count: messages.length,
      format: "markdown",
    });
  }
  function focusMainInput() {
    requestAnimationFrame(() => {
      if (editing)
        document.querySelector<HTMLTextAreaElement>("#room-topic")?.focus();
      else composer.current?.focus();
    });
  }
  function showUsage() {
    trackEvent("usage_viewed", {});
    if (mobileNav) setNavOpen(true);
    else if (collapsedPanels.nav) toggleCollapsedPanel("nav");
    requestAnimationFrame(() =>
      document.getElementById("weekly-usage")?.focus(),
    );
  }
  const roomUnavailable = loading
    ? "Wait for the room to load"
    : !room || editing
      ? "Open a saved conversation first"
      : undefined;
  const commands: WorkspaceCommand[] = [
    {
      id: "new",
      label: "New room",
      description: "Bring a new idea to the table",
      keywords: "create conversation",
      group: "Actions",
      icon: Plus,
      shortcut: "N",
      globalShortcut: "mod+shift+o",
      disabled: busy ? "Wait for the current action to finish" : undefined,
      run: () => {
        openNewRoom();
        requestAnimationFrame(() =>
          document.querySelector<HTMLTextAreaElement>("#room-topic")?.focus(),
        );
      },
    },
    {
      id: "compose",
      label: editing ? "Focus the topic" : "Write a message",
      description: editing
        ? "Set the conversation in motion"
        : "Add your perspective to the room",
      keywords: "compose focus input",
      group: "Actions",
      icon: MessageSquare,
      shortcut: "/",
      disabled:
        !editing && (!room || room.status === "stopped")
          ? "Choose an open room to write a message"
          : undefined,
      run: focusMainInput,
    },
    {
      id: "summary",
      label: summaryOpen ? "Close summary" : "Open summary",
      description: "Review or create a conversation summary",
      keywords: "summarize recap",
      group: "Actions",
      icon: FileText,
      shortcut: "S",
      disabled: roomUnavailable,
      run: () => {
        toggleSummary();
        requestAnimationFrame(() => summaryButton.current?.focus());
      },
    },
    {
      id: "run",
      label:
        room?.status === "running"
          ? "Pause conversation"
          : "Continue conversation",
      description:
        room?.status === "running"
          ? "Let replies in flight finish; pause new replies"
          : "Start the next bot replies within your limits",
      keywords: "start resume play",
      group: "Actions",
      icon: room?.status === "running" ? Pause : Play,
      disabled:
        roomUnavailable ||
        (busy
          ? "Wait for the current action to finish"
          : room?.status === "stopped"
            ? "This room has ended"
            : room?.status !== "running" && pending > 0
              ? "Wait for replies in flight to finish"
              : room?.status !== "running" && accountExhausted
                ? "Your weekly allowance is used"
                : undefined),
      run: () => void action(room?.status === "running" ? "pause" : "start"),
    },
    {
      id: "export",
      label: "Export conversation",
      description: "Download this room as Markdown",
      keywords: "save download",
      group: "Actions",
      icon: Download,
      shortcut: "E",
      disabled: roomUnavailable,
      run: exportChat,
    },
    {
      id: "latest",
      label: "Jump to latest replies",
      description: "Return to the end of the conversation",
      group: "Actions",
      icon: ArrowDown,
      shortcut: "J",
      disabled: roomUnavailable,
      run: () => {
        trackEvent("latest_replies_clicked", {});
        setSummaryOpen(false);
        setShowJump(false);
        requestAnimationFrame(() =>
          bottom.current?.scrollIntoView({ block: "end" }),
        );
      },
    },
    {
      id: "rooms",
      label: mobileNav
        ? navOpen
          ? "Close rooms"
          : "Open rooms"
        : collapsedPanels.nav
          ? "Show rooms"
          : "Hide rooms",
      description: "Toggle room navigation",
      keywords: "sidebar panel",
      group: "Actions",
      icon: PanelLeftOpen,
      shortcut: "[",
      globalShortcut: "mod+shift+s",
      run: () =>
        mobileNav ? openDrawer("nav", !navOpen) : toggleCollapsedPanel("nav"),
    },
    {
      id: "setup",
      label: compactPanel
        ? "Open room setup"
        : collapsedPanels.setup
          ? "Show room setup"
          : "Hide room setup",
      description: "Toggle bots, perspectives, and room limits",
      keywords: "settings panel",
      group: "Actions",
      icon: Settings2,
      shortcut: "]",
      run: () =>
        compactPanel
          ? openDrawer("setup", true)
          : toggleCollapsedPanel("setup"),
    },
    {
      id: "usage",
      label: "View weekly usage",
      description: "Check your account allowance and reset time",
      keywords: "budget cost plan",
      group: "Actions",
      icon: ShieldCheck,
      shortcut: "U",
      run: showUsage,
    },
    {
      id: "contact",
      label: "Contact us",
      description: "Get support, ask a question, or share feedback",
      keywords: "help email feedback support",
      group: "Actions",
      icon: MessageSquare,
      run: () => showContact(),
    },
    {
      id: "upgrade",
      label: "Request higher usage limits",
      description: "Tell us how much more room you need",
      keywords: "upgrade allowance budget premium",
      group: "Actions",
      icon: ArrowUp,
      run: () => showContact("limits"),
    },
    {
      id: "archived-chats",
      label: "Archived chats",
      description: "Find and restore hidden conversations",
      keywords: "archive restore hidden",
      group: "Actions",
      icon: Archive,
      run: () => {
        changeArchiveView(true);
        if (mobileNav) setNavOpen(true);
        else if (collapsedPanels.nav) toggleCollapsedPanel("nav");
      },
    },
    {
      id: "archive-chat",
      label: "Archive chat",
      description: "Hide this conversation; restore it anytime",
      group: "Actions",
      icon: Archive,
      disabled:
        roomUnavailable ||
        (busy ? "Wait for the current action to finish" : undefined),
      run: () => {
        if (room) confirmArchive(room);
      },
    },
    ...rooms.map((item): WorkspaceCommand => ({
      id: `room-${item.id}`,
      label: item.title,
      description:
        item.id === room?.id
          ? "Current room"
          : item.status === "running"
            ? "In conversation"
            : item.status === "stopped"
              ? "Ended room"
              : "Open conversation",
      keywords: `${item.topic} ${item.purpose}`,
      group: "Rooms",
      icon: MessageSquare,
      disabled: busy ? "Wait for the current action to finish" : undefined,
      run: () => {
        void selectRoom(item.id, { source: "command" });
      },
    })),
  ];
  const status =
    room?.status === "running"
      ? "In conversation"
      : room?.status === "limited"
        ? "Limit reached"
        : room?.status === "stopped"
          ? "Ended"
          : room?.status === "error"
            ? "Needs attention"
            : "Ready when you are";
  return (
    <div
      className={`workspace ${collapsedPanels.nav ? "nav-collapsed" : ""} ${collapsedPanels.setup ? "setup-collapsed" : ""}`}
    >
      <a className="skip-link" href="#main" inert={!!activeDrawer}>
        Skip to conversation
      </a>
      {mobileNav && navOpen && (
        <button
          className="drawer-backdrop"
          aria-label="Close navigation"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => openDrawer("nav", false)}
        />
      )}
      <nav
        ref={navRef}
        id="room-navigation"
        role={activeDrawer === "nav" ? "dialog" : undefined}
        aria-modal={activeDrawer === "nav" ? true : undefined}
        inert={
          (mobileNav ? !navOpen : collapsedPanels.nav) ||
          activeDrawer === "panel"
        }
        tabIndex={-1}
        className={`sidebar ${navOpen ? "open" : ""}`}
        aria-label="Room navigation"
      >
        <div className="sidebar-brand">
          <button
            type="button"
            className="brand-button"
            aria-label="BotsBots — New chat"
            title="New chat"
            onClick={openNewRoom}
          >
            <Brand />
          </button>
          <button
            className="icon-button mobile-only"
            aria-label="Close navigation"
            onClick={() => openDrawer("nav", false)}
          >
            <X size={20} />
          </button>
        </div>
        <button
          className="button new-room"
          onClick={openNewRoom}
          aria-keyshortcuts="Meta+Shift+O Control+Shift+O"
        >
          <Plus size={18} />
          New room
        </button>
        <label className="room-search">
          <Search size={16} />
          <input
            aria-label={archiveView ? "Search archived chats" : "Search rooms"}
            placeholder={
              archiveView ? "Find an archived chat" : "Find a conversation"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => {
              if (search.trim())
                trackEvent("room_search_used", {
                  scope: archiveView ? "archived" : "active",
                  result_count: (archiveView ? archivedRooms : rooms).filter(
                    (item) =>
                      item.title.toLowerCase().includes(search.toLowerCase()),
                  ).length,
                });
            }}
          />
        </label>
        {archiveView && (
          <button
            className="archive-view-toggle"
            onClick={() => {
              changeArchiveView(false);
              setArchiveError("");
            }}
          >
            <ArrowLeft size={16} /> Back to your rooms
          </button>
        )}
        <div className="nav-label">
          {archiveView ? "Archived chats" : "Your rooms"}
          <span className="nav-count">
            {archiveView ? archivedRooms.length : rooms.length}
          </span>
          {!archiveView && (
            <button
              className="nav-archive-link mobile-only"
              onClick={() => changeArchiveView(true)}
            >
              <Archive size={14} aria-hidden="true" /> Archived chats
            </button>
          )}
        </div>
        <div className="room-list" aria-busy={archiveView && archiveLoading}>
          {archiveView && archiveLoading ? (
            <p className="nav-empty" role="status">
              Loading archived chats…
            </p>
          ) : (
            (archiveView ? archivedRooms : rooms)
              .filter((r) =>
                r.title.toLowerCase().includes(search.toLowerCase()),
              )
              .map((r) => (
                <div
                  key={r.id}
                  className={`room-row ${room?.id === r.id ? "active" : ""}`}
                >
                  {archiveView ? (
                    <div className="room-link archived-room">
                      <Archive size={16} aria-hidden="true" />
                      <span title={r.title}>
                        {r.title}
                        <small>Archived</small>
                      </span>
                    </div>
                  ) : (
                    <button
                      className="room-link"
                      title={r.title}
                      onClick={() =>
                        void selectRoom(r.id, {
                          source: "navigation",
                          filtered: !!search.trim(),
                        })
                      }
                    >
                      <MessageSquare size={16} aria-hidden="true" />
                      <span>
                        {r.title}
                        <small>
                          {r.status === "running"
                            ? "In conversation"
                            : r.purpose === "plan"
                              ? "Planning"
                              : r.purpose === "research"
                                ? "Research"
                                : r.purpose === "debate"
                                  ? "Discussion"
                                  : "Exploration"}
                        </small>
                      </span>
                      {r.status === "running" && <i className="live-dot" />}
                    </button>
                  )}
                  <button
                    className={`icon-button room-archive-action${archiveView ? " restore-chat" : ""}`}
                    aria-label={`${archiveView ? "Restore" : "Archive"} chat: ${r.title}`}
                    title={archiveView ? "Restore chat" : "Archive chat"}
                    aria-haspopup={archiveView ? undefined : "dialog"}
                    disabled={busy || restoreBusy !== null}
                    onClick={() =>
                      archiveView ? void restoreChat(r) : confirmArchive(r)
                    }
                  >
                    {archiveView ? (
                      <ArchiveRestore size={16} />
                    ) : (
                      <Archive size={16} />
                    )}
                    {archiveView && (
                      <span>
                        {restoreBusy === r.id ? "Restoring…" : "Restore"}
                      </span>
                    )}
                  </button>
                </div>
              ))
          )}
          {archiveView && archiveError && (
            <div className="nav-empty" role="alert">
              {archiveError}
              <button
                className="sidebar-contact"
                onClick={() => void loadArchivedRooms()}
              >
                Retry loading
              </button>
            </div>
          )}
          {!(archiveView && (archiveLoading || archiveError)) &&
            (archiveView ? archivedRooms : rooms).length === 0 &&
            !loading && (
              <p className="nav-empty">
                {archiveView
                  ? "No archived chats. Chats you archive will appear here, ready to restore."
                  : "A good conversation starts here. Your rooms will appear as you create them."}
              </p>
            )}
          {!(archiveView && archiveLoading) &&
            search &&
            (archiveView ? archivedRooms : rooms).length > 0 &&
            !(archiveView ? archivedRooms : rooms).some((r) =>
              r.title.toLowerCase().includes(search.toLowerCase()),
            ) && (
              <p className="nav-empty">
                No {archiveView ? "archived chats" : "rooms"} match “{search}”.
              </p>
            )}
        </div>
        {!archiveView && (
          <button
            className="archive-view-toggle archive-view-entry"
            onClick={() => {
              changeArchiveView(true);
            }}
          >
            <Archive size={14} aria-hidden="true" /> Archived chats
          </button>
        )}
        <div className="sidebar-bottom">
          <AccountUsageMeter
            {...accountUsage}
            onRefresh={() => void accountUsage.refresh()}
            onRequestUpgrade={() => showContact("limits")}
          />
          <button
            className="sidebar-contact sidebar-contact-row"
            aria-haspopup="dialog"
            onClick={() => showContact()}
          >
            <MessageSquare size={16} aria-hidden="true" /> Contact us
          </button>
          <div className="account">
            <span className="account-avatar">{email[0].toUpperCase()}</span>
            <span title={email}>
              {email}
              <small>Personal workspace</small>
            </span>
            <button
              className="icon-button mobile-only"
              aria-label="Contact us"
              title="Contact us"
              aria-haspopup="dialog"
              onClick={() => showContact()}
            >
              <Mail size={17} />
            </button>
            <button
              className="icon-button"
              aria-label="Sign out"
              title="Sign out"
              onClick={async () => {
                try {
                  await trackAction("sign_out", {}, async () => {
                    const { error } = await browserClient().auth.signOut();
                    if (error) throw error;
                  });
                  window.location.reload();
                } catch (error) {
                  setError(
                    error instanceof Error
                      ? error.message
                      : "Sign-out failed. Try again.",
                  );
                }
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </nav>
      {archiveTarget && (
        <ArchiveChatModal
          title={archiveTarget.title}
          onArchive={() => archiveChat(archiveTarget)}
          onClose={() => setArchiveTarget(null)}
        />
      )}
      {contactKind && (
        <ContactModal
          email={email}
          initialKind={contactKind}
          onClose={() => setContactKind(null)}
        />
      )}
      <main className="main" id="main" tabIndex={-1} inert={!!activeDrawer}>
        <header className={`room-header${editing ? " builder-header" : ""}`}>
          <div className="header-title">
            <button
              className="icon-button nav-toggle"
              aria-label={
                mobileNav
                  ? "Open navigation"
                  : collapsedPanels.nav
                    ? "Show rooms"
                    : "Collapse rooms"
              }
              title={
                mobileNav
                  ? "Open navigation"
                  : collapsedPanels.nav
                    ? "Show rooms"
                    : "Collapse rooms"
              }
              aria-controls="room-navigation"
              aria-expanded={mobileNav ? navOpen : !collapsedPanels.nav}
              onClick={() =>
                mobileNav
                  ? openDrawer("nav", true)
                  : toggleCollapsedPanel("nav")
              }
            >
              {mobileNav ? (
                <Menu size={21} />
              ) : collapsedPanels.nav ? (
                <PanelLeftOpen size={19} />
              ) : (
                <PanelLeftClose size={19} />
              )}
            </button>
            {room && !editing ? (
              <RoomTitle
                key={room.id}
                title={room.title}
                onRename={renameRoom}
              />
            ) : (
              <span>
                {editing
                  ? room
                    ? "Edit room"
                    : "New conversation"
                  : (room?.title ?? "Loading room…")}
              </span>
            )}
          </div>
          <div className="header-actions">
            <CommandBar
              commands={commands}
              shortcutsBlocked={!!activeDrawer}
              onOpen={() => {
                setNavOpen(false);
                setPanelOpen(false);
              }}
            />
            <button
              className="button small usage-shortcut"
              aria-label="View weekly account usage"
              aria-controls="room-navigation"
              onClick={showUsage}
            >
              {accountUsage.error
                ? "Usage unavailable"
                : accountUsage.usage
                  ? accountUsage.usage.remaining === null
                    ? "Unlimited"
                    : `${usageMoney(accountUsage.usage.remaining)} left`
                  : "Usage…"}
            </button>
            {room && !editing && (
              <>
                <button
                  ref={summaryButton}
                  className="button small summary-toggle"
                  aria-expanded={summaryOpen}
                  aria-controls="conversation-summary"
                  onClick={toggleSummary}
                >
                  <FileText size={16} /> Summarize
                </button>
                <button
                  className="icon-button"
                  title="Archive chat"
                  aria-label="Archive chat"
                  aria-haspopup="dialog"
                  disabled={busy}
                  onClick={() => confirmArchive(room)}
                >
                  <Archive size={18} />
                </button>
                <span className={`status ${room.status}`}>
                  <i />
                  {status}
                </span>
                <button
                  className="icon-button export-button"
                  title="Export conversation"
                  aria-label="Export conversation"
                  onClick={exportChat}
                >
                  <Download size={18} />
                </button>
              </>
            )}
            <button
              className={
                compactPanel
                  ? "button small panel-toggle"
                  : "icon-button panel-toggle"
              }
              aria-label={
                compactPanel
                  ? "Room setup"
                  : collapsedPanels.setup
                    ? "Show room setup"
                    : "Collapse room setup"
              }
              title={
                compactPanel
                  ? "Room setup"
                  : collapsedPanels.setup
                    ? "Show room setup"
                    : "Collapse room setup"
              }
              aria-controls="room-setup"
              aria-expanded={compactPanel ? panelOpen : !collapsedPanels.setup}
              onClick={() =>
                compactPanel
                  ? openDrawer("setup", !panelOpen)
                  : toggleCollapsedPanel("setup")
              }
            >
              {compactPanel ? (
                <>
                  <Users size={16} />
                  Room setup
                </>
              ) : collapsedPanels.setup ? (
                <PanelRightOpen size={19} />
              ) : (
                <PanelRightClose size={19} />
              )}
            </button>
          </div>
        </header>
        {archiveNotice && (
          <div className="archive-notice" role="status">
            <span>{archiveNotice}</span>
            <button
              className="icon-button"
              aria-label="Dismiss archive notice"
              onClick={() => setArchiveNotice("")}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {accountExhausted && (
          <p className="account-limit-notice" role="status">
            {accountUsage.usage?.limit === 0
              ? "Your weekly allowance is $0. AI replies and summaries resume when your allowance changes."
              : "Weekly allowance used. AI replies and summaries pause until Monday at 00:00 UTC or your allowance changes."}{" "}
            You can still read, export, and add your own notes.
          </p>
        )}
        {room && !editing && summaryOpen && (
          <SummaryPanel
            key={room.id}
            room={room}
            messages={messages}
            summaries={summaries}
            accountExhausted={accountExhausted}
            onRefresh={() => refresh(room.id)}
            onClose={() => {
              trackEvent("panel_toggled", {
                panel: "summary",
                open: false,
                layout: "inline",
              });
              setSummaryOpen(false);
              summaryButton.current?.focus();
            }}
          />
        )}
        {error && (
          <div className="error-banner global-error" role="alert">
            <span>{error}</span>
            <button
              className="icon-button"
              aria-label="Dismiss error"
              onClick={() => setError("")}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {editing ? (
          <div className="builder-scroll">
            <form id="room-form" className="room-builder" onSubmit={save}>
              <div className="builder-heading">
                <div className="heading-mark" aria-hidden="true">
                  <Users size={28} />
                </div>
                <h1>
                  {room ? (
                    "Fine-tune the room."
                  ) : (
                    <>
                      Good ideas deserve
                      <br />a little company.
                    </>
                  )}
                </h1>
                <p>
                  {room
                    ? "Adjust the perspectives and boundaries, then keep thinking together."
                    : "Bring different models to the same table. Give each a perspective. See where the conversation takes you."}
                </p>
              </div>
              <fieldset className="purpose-field">
                <legend>What are we here to do?</legend>
                <div className="purpose-options">
                  {presets.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={draft.purpose === p.id ? "selected" : ""}
                      aria-pressed={draft.purpose === p.id}
                      onClick={() => {
                        trackEvent("room_purpose_selected", { purpose: p.id });
                        setDraft((d) => ({ ...d, purpose: p.id }));
                      }}
                    >
                      <p.icon size={17} />
                      {p.name}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div className="topic-field">
                <label htmlFor="room-topic">
                  Set the conversation in motion
                </label>
                <div className="topic-box">
                  <textarea
                    id="room-topic"
                    placeholder="An idea to explore, a decision to make, a problem to untangle…"
                    value={draft.topic}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, topic: e.target.value }))
                    }
                    minLength={3}
                    maxLength={2000}
                    required
                    rows={4}
                  />
                  <button
                    type="button"
                    className="text-button example-button"
                    onClick={() => {
                      trackEvent("room_prompt_applied", {
                        purpose: draft.purpose,
                      });
                      setDraft((d) => ({
                        ...d,
                        topic: presets.find((p) => p.id === d.purpose)!.topic,
                      }));
                    }}
                  >
                    <Lightbulb size={15} />
                    Try a starting prompt
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
              <label className="room-name-label">
                <span>
                  Room name
                  {!room && <span className="optional"> optional</span>}
                </span>
                <input
                  placeholder="Name this conversation"
                  required={!!room}
                  maxLength={80}
                  value={draft.title}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, title: e.target.value }))
                  }
                />
              </label>
              <fieldset className="mode-field">
                <legend>How should the bots talk?</legend>
                <div className="mode-options">
                  <button
                    type="button"
                    className={
                      draft.settings.mode === "moderated" ? "selected" : ""
                    }
                    aria-pressed={draft.settings.mode === "moderated"}
                    onClick={() => setting("mode", "moderated")}
                  >
                    <span>
                      <Users size={18} />
                      <b>Moderated rounds</b>
                      {draft.settings.mode === "moderated" && (
                        <Check size={16} />
                      )}
                    </span>
                    <small>
                      One at a time. Every bot gets a turn, then the room pauses
                      for you.
                    </small>
                  </button>
                  <button
                    type="button"
                    className={draft.settings.mode === "free" ? "selected" : ""}
                    aria-pressed={draft.settings.mode === "free"}
                    onClick={() => setting("mode", "free")}
                  >
                    <span>
                      <MessageSquare size={18} />
                      <b>Free-for-all</b>
                      {draft.settings.mode === "free" && <Check size={16} />}
                    </span>
                    <small>
                      A more spontaneous exchange. Bots reply independently
                      within your limits.
                    </small>
                  </button>
                </div>
                <p className="mode-note">
                  {draft.settings.mode === "moderated"
                    ? "One at a time. Every bot gets a turn, then the room pauses for you."
                    : "A more spontaneous exchange. Bots reply independently within your limits."}
                </p>
              </fieldset>
              <div className="builder-submit">
                {compactPanel && (
                  <button
                    type="button"
                    className="lineup-button"
                    aria-label={`Room setup: ${draft.bots.length} ${draft.bots.length === 1 ? "bot" : "bots"}`}
                    aria-controls="room-setup"
                    aria-expanded={panelOpen}
                    onClick={() => openDrawer("setup", true)}
                  >
                    <span className="lineup-avatars" aria-hidden="true">
                      {draft.bots.slice(0, 4).map((bot) => (
                        <span
                          key={bot.id}
                          className={`avatar ${agentClass(rosterColors, bot.id)}`}
                        >
                          {bot.name.replace(/^The /, "")[0]?.toUpperCase()}
                        </span>
                      ))}
                    </span>
                    <span className="lineup-count">
                      {draft.bots.length}{" "}
                      {draft.bots.length === 1 ? "bot" : "bots"}
                    </span>
                    <ChevronRight size={15} aria-hidden="true" />
                  </button>
                )}
                <button
                  className="button primary"
                  disabled={busy || draft.topic.trim().length < 3}
                >
                  {busy ? "Saving…" : room ? "Save changes" : "Create room"}
                  <ArrowRight size={18} />
                </button>
                {room ? (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => {
                      trackEvent("room_editor_cancelled", {});
                      setEditing(false);
                    }}
                  >
                    Cancel
                  </button>
                ) : (
                  <StartShortcutHint />
                )}
              </div>
            </form>
          </div>
        ) : loading ? (
          <div className="loading-state" role="status">
            Opening your room…
          </div>
        ) : room ? (
          <>
            <div
              className="conversation"
              hidden={summaryOpen}
              ref={feed}
              onScroll={() => {
                const el = feed.current;
                if (el)
                  setShowJump(
                    el.scrollHeight - el.scrollTop - el.clientHeight > 180,
                  );
              }}
            >
              <div className="topic-summary">
                <span className="topic-icon">
                  <Target size={18} />
                </span>
                <div>
                  <h2>The topic</h2>
                  <p>{room.topic}</p>
                </div>
              </div>
              {messages.length === 0 ? (
                <div className="conversation-empty">
                  <div className="empty-avatars">
                    {room.bots.map((b) => (
                      <span
                        key={b.id}
                        className={`avatar ${agentClass(chatColors, b.id)}`}
                      >
                        {b.name.replace(/^The /, "")[0]?.toUpperCase()}
                      </span>
                    ))}
                  </div>
                  <h2>The room is ready.</h2>
                  <p>
                    {room.bots.length} perspectives, one shared topic.
                    <br />
                    Add an opening thought, or let the bots get started.
                  </p>
                  <button
                    className="button primary"
                    disabled={
                      busy ||
                      accountExhausted ||
                      room.status === "running" ||
                      room.status === "stopped"
                    }
                    onClick={() => void action("start")}
                  >
                    <Play size={16} />
                    Start the conversation
                  </button>
                </div>
              ) : (
                <div
                  className="message-feed"
                  role="log"
                  aria-label="Conversation"
                >
                  {messages.map((m, i) => (
                    <article
                      className={`message ${m.bot_id ? "" : "human"} ${m.status}`}
                      key={m.id}
                    >
                      <span
                        className={`avatar ${m.bot_id ? agentClass(chatColors, m.bot_id) : "human-avatar"}`}
                      >
                        {m.bot_id
                          ? m.speaker.replace(/^The /, "")[0]?.toUpperCase()
                          : "Y"}
                      </span>
                      <div className="message-body">
                        <div className="message-meta">
                          <b>{m.speaker}</b>
                          {m.model && (
                            <>
                              <ModelLabel model={m.model} />
                              <time
                                className="message-time"
                                dateTime={m.completed_at ?? m.created_at}
                                title={new Date(
                                  m.completed_at ?? m.created_at,
                                ).toLocaleString()}
                              >
                                {new Date(
                                  m.completed_at ?? m.created_at,
                                ).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </time>
                            </>
                          )}
                          <small
                            className="turn-number"
                            title={`Turn ${i + 1}`}
                          >
                            {String(i + 1).padStart(2, "0")}
                          </small>
                        </div>
                        {m.status === "pending" ? (
                          <div className="thinking" role="status">
                            <span />
                            <span />
                            <span />
                            <small>Considering the conversation…</small>
                          </div>
                        ) : m.status === "failed" ? (
                          <p className="reply-error">{m.error}</p>
                        ) : (
                          <>
                            <div className="markdown">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {m.content}
                              </ReactMarkdown>
                            </div>
                            {m.finish_reason === "length" && (
                              <p className="reply-error">
                                Reply reached its token limit and may be
                                incomplete. Pause the room and raise “Reply
                                length (tokens)” in room limits for future
                                replies.
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
              {room.reason && (
                <div
                  className={`room-notice ${room.status === "limited" || room.status === "error" ? "attention" : ""}`}
                  role="status"
                >
                  <Pause size={16} />
                  <span>{room.reason}</span>
                </div>
              )}
              <div ref={bottom} />
            </div>
            {showJump && !summaryOpen && (
              <button
                className="jump-button"
                onClick={() => {
                  trackEvent("latest_replies_clicked", {});
                  setShowJump(false);
                  bottom.current?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <ArrowDown size={16} />
                Latest replies
              </button>
            )}
            <div className="composer-wrap">
              <div className="run-controls">
                <span>
                  {room.settings.mode === "moderated"
                    ? "Moderated rounds"
                    : "Free-for-all"}
                  <span className="muted">
                    {" "}
                    · {pending ? `${pending} thinking` : status}
                  </span>
                </span>
                <div>
                  {room.status === "running" ? (
                    <button
                      className="button small"
                      disabled={busy}
                      onClick={() => void action("pause")}
                    >
                      <Pause size={14} />
                      Pause
                    </button>
                  ) : (
                    room.status !== "stopped" && (
                      <button
                        className="button small"
                        disabled={busy || pending > 0 || accountExhausted}
                        onClick={() => void action("start")}
                      >
                        <Play size={14} />
                        {messages.length ? "Continue" : "Start"}
                      </button>
                    )
                  )}
                  {room.status !== "stopped" && (
                    <button
                      className="icon-button"
                      title="End room"
                      aria-label="End room"
                      disabled={busy}
                      onClick={() => void action("stop")}
                    >
                      <Square size={14} />
                    </button>
                  )}
                </div>
              </div>
              <form className="composer" onSubmit={send}>
                <textarea
                  ref={composer}
                  aria-label="Your message"
                  placeholder={
                    room.status === "stopped"
                      ? "This room has ended. Start a new one to keep exploring."
                      : "Add your perspective, ask a question, or steer the room…"
                  }
                  value={text}
                  maxLength={4000}
                  disabled={room.status === "stopped"}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      !e.nativeEvent.isComposing
                    ) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                />
                <button
                  className="send-button"
                  aria-label="Send message"
                  disabled={
                    busy ||
                    !text.trim() ||
                    room.status === "stopped" ||
                    count >= room.settings.maxMessages
                  }
                >
                  <ArrowUp size={20} />
                </button>
              </form>
              <div className="composer-hint">
                <span>You’re part of the conversation. Jump in anytime.</span>
                <span>Enter to send · Shift + Enter for a new line</span>
              </div>
            </div>
          </>
        ) : (
          <div className="loading-state">
            Choose a room or create a new one.
          </div>
        )}
      </main>
      {compactPanel && panelOpen && (
        <button
          className="panel-backdrop"
          aria-label="Close room setup"
          tabIndex={-1}
          aria-hidden="true"
          onClick={() => openDrawer("setup", false)}
        />
      )}
      <aside
        ref={panelRef}
        id="room-setup"
        role={activeDrawer === "panel" ? "dialog" : undefined}
        aria-modal={activeDrawer === "panel" ? true : undefined}
        inert={
          (compactPanel ? !panelOpen : collapsedPanels.setup) ||
          activeDrawer === "nav"
        }
        tabIndex={-1}
        className={`room-panel ${panelOpen ? "open" : ""}`}
        aria-label="Room setup"
      >
        <div className="panel-heading">
          <h2>In this room</h2>
          <span className="participant-count">
            {draftOrRoom.bots.length + 1}
          </span>
          <button
            className="icon-button panel-close"
            aria-label="Close room setup"
            onClick={() => openDrawer("setup", false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="panel-scroll">
          <div className="you-row">
            <span className="avatar human-avatar">Y</span>
            <div>
              <b>You</b>
              <small>The human perspective</small>
            </div>
            <span className="you-badge">Host</span>
          </div>
          <div className="bot-list">
            {draftOrRoom.bots.map((bot) => {
              const used = messages.filter((m) => m.bot_id === bot.id).length,
                price = prices.find((p) => p.id === bot.model);
              return (
                <div className="bot-item" key={bot.id}>
                  <button
                    className="bot-summary"
                    aria-expanded={expandedBot === bot.id}
                    onClick={() => {
                      trackEvent("bot_details_toggled", {
                        open: expandedBot !== bot.id,
                        model: bot.model,
                      });
                      setExpandedBot(expandedBot === bot.id ? null : bot.id);
                    }}
                  >
                    <span
                      className={`avatar ${agentClass(rosterColors, bot.id)}`}
                    >
                      {bot.name.replace(/^The /, "")[0]?.toUpperCase()}
                    </span>
                    <span className="bot-identity">
                      <b>{bot.name}</b>
                      <small>
                        <ModelLabel model={bot.model} />
                      </small>
                    </span>
                    <ChevronDown
                      size={15}
                      className={expandedBot === bot.id ? "rotated" : ""}
                    />
                  </button>
                  {expandedBot === bot.id ? (
                    <div className={`bot-details ${editing ? "" : "readonly"}`}>
                      {editing ? (
                        <>
                          <label>
                            Bot name
                            <input
                              value={bot.name}
                              onFocus={(e) => {
                                e.currentTarget.dataset.initialValue =
                                  e.currentTarget.value;
                              }}
                              onBlur={(e) => {
                                if (
                                  e.currentTarget.value !==
                                  e.currentTarget.dataset.initialValue
                                )
                                  trackEvent("bot_field_edited", {
                                    field: "name",
                                  });
                              }}
                              maxLength={32}
                              onChange={(e) =>
                                updateBot(bot.id, { name: e.target.value })
                              }
                            />
                          </label>
                          <label>
                            Model
                            <ModelSelect
                              value={bot.model}
                              onChange={(e) =>
                                updateBot(bot.id, {
                                  model: e.target.value as Bot["model"],
                                })
                              }
                              showTier
                            />
                          </label>
                          {price && (
                            <p className="price-note">
                              ${(price.input * 1e6).toFixed(2)} in / $
                              {(price.output * 1e6).toFixed(2)} out per 1M
                              tokens
                            </p>
                          )}
                          <label>
                            Perspective
                            <textarea
                              value={bot.perspective}
                              onFocus={(e) => {
                                e.currentTarget.dataset.initialValue =
                                  e.currentTarget.value;
                              }}
                              onBlur={(e) => {
                                if (
                                  e.currentTarget.value !==
                                  e.currentTarget.dataset.initialValue
                                )
                                  trackEvent("bot_field_edited", {
                                    field: "perspective",
                                  });
                              }}
                              rows={4}
                              maxLength={1000}
                              onChange={(e) =>
                                updateBot(bot.id, {
                                  perspective: e.target.value,
                                })
                              }
                            />
                          </label>
                          <button
                            className="text-button danger-text"
                            disabled={draft.bots.length <= 2}
                            onClick={() => {
                              trackEvent("bot_removed", {
                                model: bot.model,
                                bot_count: draft.bots.length - 1,
                              });
                              setDraft((d) => ({
                                ...d,
                                bots: d.bots.filter((b) => b.id !== bot.id),
                              }));
                            }}
                          >
                            <Trash2 size={14} />
                            Remove bot
                          </button>
                        </>
                      ) : (
                        <>
                          <p>{bot.perspective}</p>
                          <small>
                            {used} / {draftOrRoom.settings.maxPerBot} replies
                            used
                          </small>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="perspective-preview">{bot.perspective}</p>
                  )}
                </div>
              );
            })}
          </div>
          {editing && (
            <button
              className="button panel-action add-bot"
              disabled={draft.bots.length >= 6}
              onClick={() => {
                const bot: Bot = {
                  id: crypto.randomUUID(),
                  name: "The specialist",
                  model: "deepseek/deepseek-v4.1-flash-1017",
                  color: nextAgentColor(draft.bots),
                  perspective:
                    "Bring relevant expertise. Explain the details that matter and connect them to the next practical step.",
                };
                trackEvent("bot_added", {
                  model: bot.model,
                  bot_count: draft.bots.length + 1,
                });
                setDraft((d) => ({ ...d, bots: [...d.bots, bot] }));
                setExpandedBot(bot.id);
              }}
            >
              <Plus size={16} />
              Add a bot<span>{draft.bots.length} / 6</span>
            </button>
          )}
          {editing ? (
            <div className="account-defaults">
              <button
                type="button"
                className="button panel-action"
                disabled={defaultsBusy || draftIsDefault}
                onClick={() => void saveDefaults()}
              >
                <BookmarkCheck size={16} />
                {defaultsBusy
                  ? "Saving…"
                  : draftIsDefault
                    ? "These are your defaults"
                    : "Save as my defaults"}
              </button>
              <p className="defaults-note" role="status">
                {(draftIsDefault && defaultsNotice) ||
                  (accountDefaults.custom
                    ? "New rooms start with your saved bots and limits."
                    : "Save these bots and limits to start every new room with them.")}
              </p>
              {accountDefaults.custom && (
                <button
                  type="button"
                  className="text-button defaults-reset"
                  disabled={defaultsBusy}
                  onClick={() => void resetDefaults()}
                >
                  <RotateCcw size={13} />
                  Restore BotsBots defaults
                </button>
              )}
            </div>
          ) : (
            <button
              className="button panel-action"
              disabled={
                room?.status === "running" ||
                room?.status === "stopped" ||
                pending > 0
              }
              onClick={editRoom}
            >
              <Settings2 size={16} />
              Edit bots & settings
            </button>
          )}
        </div>
        <section
          className={`limits ${limitsOpen && editing ? "expanded" : ""}`}
        >
          <div className="limits-heading">
            <h2>Room limits</h2>
            {editing && (
              <button
                className="icon-button"
                aria-label="Tune room limits"
                aria-expanded={limitsOpen}
                onClick={() => {
                  trackEvent("panel_toggled", {
                    panel: "limits",
                    open: !limitsOpen,
                    layout: "inline",
                  });
                  setLimitsOpen(!limitsOpen);
                }}
              >
                <Settings2 size={17} />
              </button>
            )}
          </div>
          <div className="limit-line">
            <span>Total messages</span>
            <b>
              {!room ? 0 : count}
              <span> / {draftOrRoom.settings.maxMessages}</span>
            </b>
          </div>
          <div
            className="message-tickets"
            aria-label={`${!room ? 0 : count} of ${draftOrRoom.settings.maxMessages} messages used`}
          >
            {Array.from(
              { length: Math.min(draftOrRoom.settings.maxMessages, 40) },
              (_, i) => (
                <i
                  key={i}
                  className={
                    !!room &&
                    i <
                      Math.ceil(
                        (count / draftOrRoom.settings.maxMessages) *
                          Math.min(draftOrRoom.settings.maxMessages, 40),
                      )
                      ? "used"
                      : ""
                  }
                />
              ),
            )}
          </div>
          <div className="limit-line">
            <span>Accounted budget</span>
            <b>
              {money(!room ? 0 : spent)}
              <span> / {money(draftOrRoom.settings.budget)}</span>
            </b>
          </div>
          <progress
            max={draftOrRoom.settings.budget}
            value={!room ? 0 : spent}
            aria-label="Room budget used"
          />
          <div className="limit-facts">
            <span>{draftOrRoom.settings.maxPerBot} replies per bot</span>
            <span>Reply target: {draftOrRoom.settings.maxTokens} tokens</span>
          </div>
          {limitsOpen && editing && (
            <div className="limits-fields">
              {(
                [
                  ["maxMessages", "Total messages", 4, 100, 1],
                  ["maxPerBot", "Replies per bot", 1, 30, 1],
                  ["budget", "Room budget (USD)", 0.01, 5, 0.01],
                  ["maxTokens", "Reply length (tokens)", 128, 2000, 1],
                  ["contextMessages", "Recent messages in context", 2, 30, 1],
                  ["concurrency", "Concurrent bots (free-for-all)", 1, 4, 1],
                  ["cooldownSeconds", "Bot cooldown (seconds)", 1, 30, 1],
                  ["maxMinutes", "Minutes per session", 1, 30, 1],
                ] as const
              ).map(([key, label, min, max, step]) => (
                <label key={key}>
                  {label}
                  <input
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    value={draft.settings[key]}
                    onFocus={(e) => {
                      e.currentTarget.dataset.initialValue =
                        e.currentTarget.value;
                    }}
                    onBlur={(e) => {
                      if (
                        e.currentTarget.value !==
                        e.currentTarget.dataset.initialValue
                      )
                        trackEvent("room_setting_changed", {
                          setting: key,
                          value: draft.settings[key],
                        });
                    }}
                    onChange={(e) =>
                      setting(key, e.target.valueAsNumber || min)
                    }
                  />
                </label>
              ))}
            </div>
          )}
          <p className="budget-explanation">
            <ShieldCheck size={14} />
            Includes pending and uncertain replies. Limits pause the room; only
            you can extend them.
          </p>
          {limitsOpen && (
            <p className="budget-explanation">
              This sets the answer length target. Gemini 3.8 Flash and Hydrogen
              get up to 4,096 extra tokens for required thinking. All tokens
              count toward your room budget.
            </p>
          )}
        </section>
        <div className="panel-info">
          {modelError && <p className="price-note warning">{modelError}</p>}
          <details
            className="how-it-works"
            onToggle={(e) =>
              trackEvent("room_help_toggled", { open: e.currentTarget.open })
            }
          >
            <summary>
              <CircleHelp size={15} />
              How the room works
              <ChevronRight size={14} />
            </summary>
            <p>
              Moderated rounds give each bot one turn, then pause. Free-for-all
              runs independent replies with a configurable concurrency limit.
            </p>
            <p>
              Only an open room schedules new replies. Pause or end prevents new
              calls; replies already in flight can finish. Every attempt counts
              toward limits, including failures.
            </p>
            <p>
              Budget figures are conservative estimates with a 25% buffer, not
              your final Gateway bill. Reservations may pause the room before
              the displayed budget is spent.
            </p>
          </details>
        </div>
        <div className="panel-footer">
          <span className="gateway-mark" aria-hidden="true" />
          Powered by Vercel AI Gateway
        </div>
      </aside>
    </div>
  );
}
