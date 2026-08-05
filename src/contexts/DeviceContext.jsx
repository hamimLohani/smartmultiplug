import React, { createContext, useContext, useEffect, useState } from 'react';
import { ref, onValue, off, update, remove } from 'firebase/database';
import { db, isFirebaseConfigured } from '../firebase';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const DeviceContext = createContext(null);

export function DeviceProvider({ children }) {
  const { user, mqttOk } = useAuth();
  const [device, setDevice]     = useState(isFirebaseConfigured ? undefined : null); // undefined = loading
  const [deviceId, setDeviceId] = useState(null);
  const [plugLabels, setPlugLabels] = useState({
    1: 'Plug 1', 2: 'Plug 2', 3: 'Plug 3', 4: 'Plug 4',
  });

  const getNumPlugsFromId = (id) => {
    if (id?.startsWith('SP2-')) return 2;
    if (id?.startsWith('SP3-')) return 3;
    return 4; // default
  };

  const numPlugs = deviceId ? getNumPlugsFromId(deviceId) : 4;

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

      // Load plug labels dynamically based on model
      if (info?.plugs) {
        const labels = {};
        const count = getNumPlugsFromId(id);
        for (let n = 1; n <= count; n++) {
          labels[n] = info.plugs?.[n]?.label ?? `Plug ${n}`;
        }
        setPlugLabels(labels);
      }
    };

    onValue(devicesRef, handleValue);
    return () => off(devicesRef, 'value', handleValue);
  }, [user]);

  // Listen for unpairing triggered from the ESP physical menu
  useEffect(() => {
    if (!user || !deviceId || !mqttOk) return;

    let unsubscribe = null;

    import('../mqtt').then(({ subscribe, publish }) => {
      const topic = `users/${user.uid}/devices/${deviceId}/unpair`;
      unsubscribe = subscribe(topic, async (msg) => {
        if (msg === 'unpair') {
          console.log('[DeviceContext] Received unpair command from device via MQTT');
          try {
            const deviceRef = ref(db, `devices/${deviceId}`);
            const userDeviceRef = ref(db, `users/${user.uid}/devices/${deviceId}`);

            // 1. Remove device pairing details in Firebase DB
            await update(deviceRef, {
              claimed_by: null,
              claimed_at: null,
            });
            await remove(userDeviceRef);

            // 2. Clear retained unpair message
            publish(topic, '', { retain: true });

            // 3. Inform user
            toast.success('Device was unpaired from the physical menu.');
            clearDevice();
          } catch (err) {
            console.error('[DeviceContext] Error processing unpair from MQTT:', err);
          }
        }
      });
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, deviceId, mqttOk]);

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
    numPlugs,
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
