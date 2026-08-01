import React, { createContext, useContext, useEffect, useState } from 'react';
import { ref, onValue, off, update } from 'firebase/database';
import { db, isFirebaseConfigured } from '../firebase';
import { useAuth } from './AuthContext';

const DeviceContext = createContext(null);

export function DeviceProvider({ children }) {
  const { user, mqttOk } = useAuth();
  const [device, setDevice]     = useState(isFirebaseConfigured ? undefined : null); // undefined = loading
  const [deviceId, setDeviceId] = useState(null);
  const [plugLabels, setPlugLabels] = useState({
    1: 'Plug 1', 2: 'Plug 2', 3: 'Plug 3', 4: 'Plug 4',
  });

  useEffect(() => {
    if (!isFirebaseConfigured || !db || !user) {
      setDevice(null);
      setDeviceId(null);
      return;
    }

    const devicesRef = ref(db, `users/${user.uid}/devices`);
    const handleValue = (snap) => {
      if (!snap.exists()) {
        setDevice(null);
        setDeviceId(null);
        return;
      }
      const data = snap.val();
      const [id, info] = Object.entries(data)[0];
      setDeviceId(id);
      setDevice(info);

      // Load plug labels
      if (info?.plugs) {
        const labels = {};
        for (let n = 1; n <= 4; n++) {
          labels[n] = info.plugs?.[n]?.label ?? `Plug ${n}`;
        }
        setPlugLabels(labels);
      }
    };

    onValue(devicesRef, handleValue);
    return () => off(devicesRef, 'value', handleValue);
  }, [user]);

  useEffect(() => {
    if (user && deviceId && mqttOk) {
      import('../mqtt').then(({ publish }) => {
        const topic = `users/${user.uid}/devices/${deviceId}/sync`;
        console.log(`[DeviceContext] Publishing sync message to topic: ${topic}`);
        publish(topic, "sync", { retain: true, qos: 1 });
      });
    }
  }, [user, deviceId, mqttOk]);

  const updatePlugLabel = async (plugNum, label) => {
    if (!isFirebaseConfigured || !user || !deviceId) return;
    await update(
      ref(db, `users/${user.uid}/devices/${deviceId}/plugs/${plugNum}`),
      { label }
    );
    setPlugLabels((prev) => ({ ...prev, [plugNum]: label }));
  };

  const clearDevice = () => {
    setDevice(null);
    setDeviceId(null);
  };

  const value = {
    device,
    deviceId,
    plugLabels,
    updatePlugLabel,
    clearDevice,
    loading: device === undefined,
    hasPairedDevice: device !== null && device !== undefined,
  };

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDevice() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error('useDevice must be used inside DeviceProvider');
  return ctx;
}
