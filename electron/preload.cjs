const { contextBridge, ipcRenderer } = require('electron');

const eventListeners = new Map(); // event -> Map(id, callback)
const callbacks = new Map(); // id -> { callback, once }
let nextCallbackId = 1;

ipcRenderer.on('tauri-event', (_e, { event, payload }) => {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach((cb) => {
      try {
        cb({ event, payload });
      } catch (err) {
        console.error('Error invoking event callback:', err);
      }
    });
  }
});

contextBridge.exposeInMainWorld('__TAURI_INTERNALS__', {
  invoke: async (cmd, args, options) => {
    if (cmd === 'plugin:event|listen') {
      const { event, handler: handlerId } = args;
      const cb = callbacks.get(handlerId);
      if (cb) {
        if (!eventListeners.has(event)) {
          eventListeners.set(event, new Map());
        }
        eventListeners.get(event).set(handlerId, cb.callback);
      }
      return handlerId;
    }

    if (cmd === 'plugin:event|unlisten') {
      const { event, eventId } = args;
      if (eventListeners.has(event)) {
        eventListeners.get(event).delete(eventId);
      }
      callbacks.delete(eventId);
      return;
    }

    return ipcRenderer.invoke('tauri-invoke', cmd, args);
  },

  transformCallback: (callback, once = false) => {
    const id = nextCallbackId++;
    callbacks.set(id, { callback, once });
    return id;
  }
});
