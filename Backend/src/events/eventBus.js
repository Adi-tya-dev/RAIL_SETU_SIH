/**
 * eventBus.js — Singleton EventEmitter for internal pub/sub messaging.
 *
 * Events:
 *   "new_request"      — { source, task }   fired by simulatorWatcher
 *   "request_stored"   — { source, task, isNew } fired by changeProcessor after DB upsert
 *   "plan_updated"     — { reason, newTask, planId } fired when auto-replan runs
 *   "watcher_tick"     — { sources, checkedAt } heartbeat from watcher
 */
const { EventEmitter } = require("events");

const eventBus = new EventEmitter();
eventBus.setMaxListeners(20); // prevent spurious warnings

module.exports = eventBus;
