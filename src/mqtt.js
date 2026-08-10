/**
 * MQTT Singleton Client Manager
 *
 * Connects once to the broker over WebSockets (wss://).
 * All components share this single connection.
 *
 * Security note:
 *   Currently uses static credentials from env vars (VITE_MQTT_USERNAME /
 *   VITE_MQTT_PASSWORD). In production, replace with a Cloud Function that
 *   issues short-lived, per-user scoped credentials so broker admin
 *   credentials are never exposed in the frontend bundle.
 */

import mqtt from 'mqtt';

let client = null;
const subscribers = new Map(); // topic -> Set of callbacks
const connectHandlers = new Set();
const disconnectHandlers = new Set();

function getClientId() {
  return `smartplug-web-${Math.random().toString(16).slice(2, 10)}`;
}

export function connectMqtt(onConnected, onDisconnected) {
  if (onConnected) connectHandlers.add(onConnected);
  if (onDisconnected) disconnectHandlers.add(onDisconnected);

  if (client) {
    if (client.connected) {
      onConnected?.();
    }
    return client;
  }

  const brokerUrl = import.meta.env.VITE_MQTT_BROKER_URL;
  const username  = import.meta.env.VITE_MQTT_USERNAME;
  const password  = import.meta.env.VITE_MQTT_PASSWORD;

  if (!brokerUrl) {
    console.warn('[MQTT] VITE_MQTT_BROKER_URL not set. MQTT disabled.');
    return null;
  }

  client = mqtt.connect(brokerUrl, {
    clientId:   getClientId(),
    username,
    password,
    clean:      true,
    reconnectPeriod: 3000,
    connectTimeout:  10000,
    keepalive: 30,
  });

  client.on('connect', () => {
    console.log('[MQTT] Connected');
    // Re-subscribe to all tracked topics after reconnect
    subscribers.forEach((_, topic) => {
      client.subscribe(topic, { qos: 1 });
    });
    connectHandlers.forEach((handler) => handler());
  });

  client.on('message', (topic, payload, packet) => {
    const msg = payload.toString();
    const cbs = subscribers.get(topic);
    if (cbs) cbs.forEach((cb) => cb(msg, topic, packet));
  });

  client.on('close', () => {
    disconnectHandlers.forEach((handler) => handler());
  });
  client.on('offline', () => {
    disconnectHandlers.forEach((handler) => handler());
  });
  client.on('disconnect', () => {
    disconnectHandlers.forEach((handler) => handler());
  });
  client.on('error', (err)  => {
    console.error('[MQTT] Error', err);
    disconnectHandlers.forEach((handler) => handler());
  });

  return client;
}

export function subscribe(topic, callback) {
  if (!subscribers.has(topic)) {
    subscribers.set(topic, new Set());
    if (client && client.connected) {
      client.subscribe(topic, { qos: 1 });
    }
  }
  subscribers.get(topic).add(callback);

  // Return unsubscribe function
  return () => {
    const cbs = subscribers.get(topic);
    if (!cbs) return;
    cbs.delete(callback);
    if (cbs.size === 0) {
      subscribers.delete(topic);
      if (client && client.connected) {
        client.unsubscribe(topic);
      }
    }
  };
}

export function publish(topic, payload, opts = {}) {
  if (!client || !client.connected) {
    console.warn('[MQTT] Not connected; cannot publish');
    return false;
  }
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  client.publish(topic, message, { qos: 1, retain: false, ...opts });
  return true;
}

export function publishAsync(topic, payload, opts = {}) {
  return new Promise((resolve, reject) => {
    if (!client || !client.connected) {
      reject(new Error('MQTT is not connected'));
      return;
    }

    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    client.publish(topic, message, { qos: 1, retain: false, ...opts }, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve(true);
      }
    });
  });
}

export function disconnectMqtt() {
  if (client) {
    client.end(true);
    client = null;
    subscribers.clear();
    connectHandlers.clear();
    disconnectHandlers.clear();
  }
}

export function isMqttConnected() {
  return client?.connected ?? false;
}
