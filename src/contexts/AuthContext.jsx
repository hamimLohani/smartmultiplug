import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '../firebase';
import { connectMqtt, disconnectMqtt } from '../mqtt';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(isFirebaseConfigured ? undefined : null); // undefined = loading
  const [mqttOk, setMqttOk]   = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setUser(null);
      return;
    }
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser ?? null);
      if (firebaseUser) {
        connectMqtt(
          () => setMqttOk(true),
          () => setMqttOk(false),
        );
      } else {
        disconnectMqtt();
        setMqttOk(false);
      }
    });
    return unsub;
  }, []);

  const login = (email, password) => {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured');
    return signInWithEmailAndPassword(auth, email, password);
  };

  const register = (email, password) => {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured');
    return createUserWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = () => {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured');
    return signInWithPopup(auth, googleProvider);
  };

  const logout = async () => {
    if (!isFirebaseConfigured) return;
    disconnectMqtt();
    await signOut(auth);
  };

  const resetPassword = (email) => {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured');
    return sendPasswordResetEmail(auth, email);
  };

  const changePassword = (newPassword) => {
    if (!isFirebaseConfigured) throw new Error('Firebase is not configured');
    return updatePassword(auth.currentUser, newPassword);
  };

  const value = {
    user,
    mqttOk,
    loading: user === undefined,
    login,
    register,
    loginWithGoogle,
    logout,
    resetPassword,
    changePassword,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
