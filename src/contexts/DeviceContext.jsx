import React, { createContext, useContext, useEffect, useState } from 'react';
import { ref, onValue, off, update, remove } from 'firebase/database';
import { db, isFirebaseConfigured } from '../firebase';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const DeviceContext = createContext(null);

export function DeviceProvider({ children }) {
  const { user, mqttOk } = useAuth();
  const [devices, setDevices] = useState(isFirebaseConfigured ? undefined : []); // undefined = loading
  const [activeDeviceId, setActiveDeviceId] = useState(() => {
    return localStorage.getItem('active_device_id') || null;
  });
  const [activeDeviceConfig, setActiveDeviceConfig] = useState(undefined); // undefined = loading
  const [plugLabels, setPlugLabels] = useState({
    1: 'Plug 1', 2: 'Plug 2', 3: 'Plug 3', 4: 'Plug 4',
  });

  const getNumPlugsFromId = (id) => {
    // New format: SH{plugs}{sensors}-XXXXXXXX  e.g. SH2-..., SH3d-..., SH4gfd-...
    if (!id) return 4;
    const m = id.match(/^SH([234])/i);
    if (m) return parseInt(m[1], 10);
    // Legacy fallback
    if (id.startsWith('SP2-')) return 2;
    if (id.startsWith('SP3-')) return 3;
    return 4;
  };

  // Parse enabled sensors from device ID prefix (e.g. SH4gfd -> {gas:true, flame:true, dht11:true})
  const getSensorsFromId = (id) => {
    if (!id) return { gas: false, flame: false, dht11: false };
    const m = id.match(/^SH[234]([GFDgfd]*)(?:-|$)/i);
    const suffix = m?.[1] ?? '';
    return {
      gas:   suffix.toLowerCase().includes('g'),
      flame: suffix.toLowerCase().includes('f'),
      dht11: suffix.toLowerCase().includes('d'),
    };
  };

  const numPlugs = activeDeviceId ? getNumPlugsFromId(activeDeviceId) : 4;

  // Listen for the user's paired devices in Firebase DB
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setDevices([]);
      setActiveDeviceId(null);
      localStorage.removeItem('active_device_id');
      return;
    }

    if (user === undefined) {
      return;
    }

    if (user === null) {
      setDevices([]);
      setActiveDeviceId(null);
      localStorage.removeItem('active_device_id');
      return;
    }

    setDevices(undefined); // Reset loading state

    const devicesRef = ref(db, `users/${user.uid}/devices`);
    const handleValue = (snap) => {
      if (!snap.exists()) {
        setDevices([]);
        setActiveDeviceId(null);
        localStorage.removeItem('active_device_id');
        return;
      }
      const data = snap.val();
      const list = Object.entries(data).map(([id, info]) => ({ id, ...info }));
      setDevices(list);

      // Auto-select activeDeviceId if it is not set or not in the list of devices anymore
      setActiveDeviceId((prev) => {
        if (prev && list.some(d => d.id === prev)) {
          return prev;
        }
        const nextId = list[0]?.id || null;
        if (nextId) {
          localStorage.setItem('active_device_id', nextId);
        } else {
          localStorage.removeItem('active_device_id');
        }
        return nextId;
      });
    };

    onValue(devicesRef, handleValue);
    return () => off(devicesRef, 'value', handleValue);
  }, [user]);

  // Listen to the active device config node (owner's path if shared)
  useEffect(() => {
    if (!isFirebaseConfigured || !db || user === null) {
      setActiveDeviceConfig(null);
      return;
    }

    if (user === undefined || devices === undefined) {
      setActiveDeviceConfig(undefined);
      return;
    }

    if (!activeDeviceId || devices.length === 0) {
      setActiveDeviceConfig(null);
      return;
    }

    const activeDevRef = devices.find(d => d.id === activeDeviceId);
    if (!activeDevRef) return;

    const ownerUid = activeDevRef.is_shared ? activeDevRef.owner_uid : user.uid;
    const configRef = ref(db, `users/${ownerUid}/devices/${activeDeviceId}`);

    const handleConfigValue = (snap) => {
      if (snap.exists()) {
        setActiveDeviceConfig(snap.val());
      } else {
        setActiveDeviceConfig(null);
      }
    };

    onValue(configRef, handleConfigValue);
    return () => off(configRef, 'value', handleConfigValue);
  }, [user, activeDeviceId, devices]);

  // Load plug labels dynamically based on selected active device model and labels
  useEffect(() => {
    if (!activeDeviceConfig) {
      setPlugLabels({ 1: 'Plug 1', 2: 'Plug 2', 3: 'Plug 3', 4: 'Plug 4' });
      return;
    }

    const labels = {};
    const count = getNumPlugsFromId(activeDeviceId);
    for (let n = 1; n <= count; n++) {
      labels[n] = activeDeviceConfig.plugs?.[n]?.label ?? `Plug ${n}`;
    }
    setPlugLabels(labels);
  }, [activeDeviceConfig, activeDeviceId]);

  // Listen for unpairing triggered from the ESP physical menu
  useEffect(() => {
    if (!user || !activeDeviceId || !mqttOk || !devices || devices.length === 0) return;

    let unsubUserEvent = null;
    let unsubDeviceEvent = null;

    const activeDevRef = devices.find(d => d.id === activeDeviceId);
    if (!activeDevRef) return;

    const ownerUid = activeDevRef.is_shared ? activeDevRef.owner_uid : user.uid;

    import('../mqtt').then(({ subscribe, publish }) => {
      const userTopic = `users/${ownerUid}/devices/${activeDeviceId}/unpair_event`;
      const deviceTopic = `devices/${activeDeviceId}/unpair_event`;

      const handleUnpairEvent = async (msg) => {
        if (msg === 'unpair') {
          console.log('[DeviceContext] Received unpair command from device via MQTT');
          try {
            // 1. Remove device pairing details directly via DB
            const deviceRef = ref(db, `devices/${activeDeviceId}`);
            await update(deviceRef, { claimed_by: null, claimed_at: null });
            await remove(ref(db, `devices/${activeDeviceId}/shared_members`));
            await remove(ref(db, `users/${ownerUid}/devices/${activeDeviceId}`));

            // 2. Clear retained unpair message
            publish(userTopic, '', { retain: true });
            publish(deviceTopic, '', { retain: true });

            // 3. Inform user
            toast.success('Device was unpaired from the physical menu.');
            
            // Adjust activeDeviceId
            setActiveDeviceId((prev) => {
              const remaining = (devices || []).filter(d => d.id !== activeDeviceId);
              const nextId = remaining[0]?.id || null;
              if (nextId) {
                localStorage.setItem('active_device_id', nextId);
              } else {
                localStorage.removeItem('active_device_id');
              }
              return nextId;
            });
          } catch (err) {
            console.error('[DeviceContext] Error processing unpair from MQTT:', err);
          }
        }
      };

      unsubUserEvent = subscribe(userTopic, handleUnpairEvent);
      unsubDeviceEvent = subscribe(deviceTopic, handleUnpairEvent);
    });

    return () => {
      if (unsubUserEvent) unsubUserEvent();
      if (unsubDeviceEvent) unsubDeviceEvent();
    };
  }, [user, activeDeviceId, mqttOk, devices]);

  // Periodically trigger sync on active device state load
  useEffect(() => {
    if (user && activeDeviceId && mqttOk && devices && devices.length > 0) {
      const activeDevRef = devices.find(d => d.id === activeDeviceId);
      if (!activeDevRef) return;
      const ownerUid = activeDevRef.is_shared ? activeDevRef.owner_uid : user.uid;

      import('../mqtt').then(({ publish }) => {
        const topic = `users/${ownerUid}/devices/${activeDeviceId}/sync`;
        console.log(`[DeviceContext] Publishing sync message to topic: ${topic}`);
        publish(topic, "sync", { retain: false, qos: 1 });
      });
    }
  }, [user, activeDeviceId, mqttOk, devices]);

  const updatePlugLabel = async (plugNum, label) => {
    if (!isFirebaseConfigured || !user || !activeDeviceId || !devices || devices.length === 0) return;
    const activeDevRef = devices.find(d => d.id === activeDeviceId);
    const ownerUid = activeDevRef?.is_shared ? activeDevRef.owner_uid : user.uid;

    await update(
      ref(db, `users/${ownerUid}/devices/${activeDeviceId}/plugs/${plugNum}`),
      { label }
    );
    setPlugLabels((prev) => ({ ...prev, [plugNum]: label }));
  };

  const updateDeviceName = async (name) => {
    if (!isFirebaseConfigured || !user || !activeDeviceId || !devices || devices.length === 0) return;
    const activeDevRef = devices.find(d => d.id === activeDeviceId);
    const ownerUid = activeDevRef?.is_shared ? activeDevRef.owner_uid : user.uid;

    await update(
      ref(db, `users/${ownerUid}/devices/${activeDeviceId}`),
      { name }
    );
  };

  const clearDevice = () => {
    setActiveDeviceId(null);
    localStorage.removeItem('active_device_id');
  };

  const selectDevice = (id) => {
    setActiveDeviceId(id);
    localStorage.setItem('active_device_id', id);
  };

  const device = devices && activeDeviceId ? devices.find(d => d.id === activeDeviceId) : null;

  const deviceSensors = getSensorsFromId(activeDeviceId);

  const value = {
    devices: devices || [],
    device: activeDeviceConfig || device, // use config node details first
    deviceId: activeDeviceId,
    plugLabels,
    updatePlugLabel,
    updateDeviceName,
    clearDevice,
    selectDevice,
    numPlugs,
    deviceSensors,
    loading: devices === undefined || (devices.length > 0 && !!activeDeviceId && activeDeviceConfig === undefined),
    hasPairedDevice: devices !== null && devices !== undefined && devices.length > 0,
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
