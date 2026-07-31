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

function getClientId() {
  return `smartplug-web-${Math.random().toString(16).slice(2, 10)}`;
}

export function connectMqtt(onConnected, onDisconnected) {
  if (client && client.connected) {
    onConnected?.();
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
    onConnected?.();
  });

  client.on('message', (topic, payload) => {
    const msg = payload.toString();
    const cbs = subscribers.get(topic);
    if (cbs) cbs.forEach((cb) => cb(msg, topic));
  });

  client.on('disconnect', () => { onDisconnected?.(); });
  client.on('error', (err)  => { console.error('[MQTT] Error', err); });

  return client;
}

export function subscribe(topic, callback) {
  if (!client) return;
  if (!subscribers.has(topic)) {
    subscribers.set(topic, new Set());
    client.subscribe(topic, { qos: 1 });
  }
  subscribers.get(topic).add(callback);

  // Return unsubscribe function
  return () => {
    const cbs = subscribers.get(topic);
    if (!cbs) return;
    cbs.delete(callback);
    if (cbs.size === 0) {
      subscribers.delete(topic);
      client?.unsubscribe(topic);
    }
  };
}

export function publish(topic, payload, opts = {}) {
  if (!client || !client.connected) {
    console.warn('[MQTT] Not connected; cannot publish');
    return;
  }
  const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
  client.publish(topic, message, { qos: 1, retain: false, ...opts });
}

export function disconnectMqtt() {
  if (client) {
    client.end(true);
    client = null;
    subscribers.clear();
  }
}

export function isMqttConnected() {
  return client?.connected ?? false;
}
