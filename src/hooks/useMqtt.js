import { useEffect, useCallback } from 'react';
import { subscribe, publish } from '../mqtt';

/**
 * useMqtt — subscribe to a topic and get a publish helper.
 * Returns an unsubscribe function automatically on unmount.
 */
export function useMqttSubscribe(topic, callback, deps = []) {
  useEffect(() => {
    if (!topic) return;
    const unsub = subscribe(topic, callback);
    return () => unsub?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic, ...deps]);
}

export function useMqttPublish() {
  return useCallback((topic, payload, opts) => {
    publish(topic, payload, opts);
  }, []);
}
