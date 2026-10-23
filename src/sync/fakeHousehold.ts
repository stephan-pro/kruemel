// The server side of one household, in memory, with the same rules as the database will have
// (stage 2). `FakeRemote` uses it directly, the fake server of the end-to-end tests puts HTTP in
// front of it. The rules themselves are `applyChange`; this class adds what only a server does:
// it numbers every change in order of arrival (the "server time" the last-writer rule goes by),
// remembers deleted rows as tombstones, recognises a change that arrives a second time, and refuses
// changes from an app older than the newest one that wrote to the household (`outdated`).

import { type AppData, emptyAppData, SCHEMA_VERSION } from "../storage/appData";
import { applyChange, type Change, isDeepEqual, OUTDATED, type PushResult } from "./changes";
import type { CompletionRow, PullResult, TaskRow } from "./remote";

export class FakeHousehold {
  private data: AppData = emptyAppData();
  /** Counts every change that altered something; row numbers say when a row last changed. */
  private clock = 0;
  private readonly taskClock = new Map<string, number>();
  private readonly completionClock = new Map<string, number>();
  private readonly taskGraves = new Map<string, number>();
  private readonly completionGraves = new Map<string, { clock: number; taskId: string }>();
  private settingsClock = 0;
  /** The newest `schemaVersion` that wrote to the household. */
  private schemaVersion: number = SCHEMA_VERSION;
  private readonly answers = new Map<string, PushResult>();
  private readonly listeners = new Set<() => void>();

  constructor(initial?: AppData) {
    if (initial !== undefined) {
      this.replace(initial);
    }
  }

  /** The data as they are now (for tests). */
  snapshot(): AppData {
    return this.data;
  }

  /** `schemaVersion` is that of the sending app. */
  push(change: Change, schemaVersion: number = SCHEMA_VERSION): PushResult {
    const known = this.answers.get(change.id);
    if (known !== undefined) {
      return known;
    }
    if (schemaVersion < this.schemaVersion) {
      return OUTDATED; // not remembered: the same change goes through once the app is newer
    }
    this.schemaVersion = schemaVersion;
    const { data, result } = applyChange(this.data, change, new Set(this.taskGraves.keys()));
    if (result.status === "applied") {
      this.replace(data);
    }
    this.answers.set(change.id, result);
    return result;
  }

  pull(cursor: string | null): PullResult {
    const since = cursor === null ? 0 : Number(cursor);
    const tasks: TaskRow[] = this.data.tasks
      .filter((task) => (this.taskClock.get(task.id) ?? 0) > since)
      .map((task) => ({ id: task.id, schemaVersion: SCHEMA_VERSION, deleted: false, task }));
    // A first pull has no use for tombstones: the device has nothing to delete.
    if (since > 0) {
      for (const [id, clock] of this.taskGraves) {
        if (clock > since) {
          tasks.push({ id, schemaVersion: SCHEMA_VERSION, deleted: true });
        }
      }
    }
    const completions: CompletionRow[] = this.data.completions
      .filter((completion) => (this.completionClock.get(completion.id) ?? 0) > since)
      .map((completion) => ({
        id: completion.id,
        taskId: completion.taskId,
        schemaVersion: SCHEMA_VERSION,
        deleted: false,
        completion,
      }));
    if (since > 0) {
      for (const [id, grave] of this.completionGraves) {
        if (grave.clock > since) {
          completions.push({
            id,
            taskId: grave.taskId,
            schemaVersion: SCHEMA_VERSION,
            deleted: true,
          });
        }
      }
    }
    return {
      cursor: String(this.clock),
      schemaVersion: this.schemaVersion,
      tasks,
      completions,
      ...(this.settingsClock > since ? { settings: this.data.settings } : {}),
    };
  }

  /** Calls `hint` (asynchronously) after every change; returns the way to stop. */
  subscribe(hint: () => void): () => void {
    this.listeners.add(hint);
    return () => {
      this.listeners.delete(hint);
    };
  }

  /** Makes `next` the data and notes what differs from before. */
  private replace(next: AppData): void {
    const previous = this.data;
    this.clock++;
    const now = this.clock;

    const nextTasks = new Map(next.tasks.map((task) => [task.id, task]));
    for (const task of previous.tasks) {
      if (!nextTasks.has(task.id)) {
        this.taskClock.delete(task.id);
        this.taskGraves.set(task.id, now);
      }
    }
    const previousTasks = new Map(previous.tasks.map((task) => [task.id, task]));
    for (const task of next.tasks) {
      if (!isDeepEqual(previousTasks.get(task.id), task)) {
        this.taskClock.set(task.id, now);
        this.taskGraves.delete(task.id);
      }
    }

    const nextCompletionIds = new Set(next.completions.map((completion) => completion.id));
    for (const completion of previous.completions) {
      if (!nextCompletionIds.has(completion.id)) {
        this.completionClock.delete(completion.id);
        this.completionGraves.set(completion.id, { clock: now, taskId: completion.taskId });
      }
    }
    const previousCompletionIds = new Set(previous.completions.map((completion) => completion.id));
    for (const completion of next.completions) {
      if (!previousCompletionIds.has(completion.id)) {
        this.completionClock.set(completion.id, now);
        this.completionGraves.delete(completion.id);
      }
    }

    if (!isDeepEqual(previous.settings, next.settings)) {
      this.settingsClock = now;
    }
    this.data = next;
    for (const listener of [...this.listeners]) {
      queueMicrotask(listener);
    }
  }
}
