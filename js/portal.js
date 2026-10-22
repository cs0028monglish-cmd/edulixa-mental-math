// Shared sign-in, device limit and access checks for the Edulixa Mental Math portal.
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from '../vendor/firebase/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from '../vendor/firebase/firebase-firestore.js';
import { firebaseConfig, ADMIN_EMAILS, MAX_DEVICES } from './config.js';

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
// Local testing only: on this computer (localhost) with ?emulator in the address, use the Firebase emulators.
export const EMULATOR = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && (/[?&]emulator/.test(location.search) || (() => { try { return sessionStorage.getItem('emm-emu') === '1'; } catch (e) { return false; } })());
if (EMULATOR) { try { sessionStorage.setItem('emm-emu', '1'); } catch (e) {} connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true }); connectFirestoreEmulator(db, '127.0.0.1', 8080); }
export function useEmulator(a) { if (EMULATOR) connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true }); }

export const isAdminEmail = e => !!e && ADMIN_EMAILS.includes(String(e).toLowerCase());

// One id per browser. Clearing the browser's data makes it count as a new device.
export function deviceId() {
  let id = null;
  try { id = localStorage.getItem('emm-device'); } catch (e) {}
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2));
    try { localStorage.setItem('emm-device', id); } catch (e) {}
  }
  return id;
}
export function deviceLabel() {
  const ua = navigator.userAgent; const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : 'Device';
  const br = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser';
  return `${os} · ${br}`;
}

const MSG = {
  'auth/invalid-credential': 'The email or password is not right.',
  'auth/wrong-password': 'The email or password is not right.',
  'auth/user-not-found': 'The email or password is not right.',
  'auth/invalid-email': 'Please type a valid email.',
  'auth/too-many-requests': 'Too many tries. Please wait a few minutes and try again.',
  'auth/network-request-failed': 'No internet connection. Please check your connection.',
  'auth/user-disabled': 'This account is switched off. Please ask your teacher.'
};
export const errText = e => MSG[e && e.code] || (e && e.message) || 'Something went wrong. Please try again.';

// Checks the profile for this device. Registers the device if there is a free slot.
// Returns the profile, or throws an Error with a friendly message.
export async function checkProfile(user) {
  const ref = doc(db, 'users', user.uid);
  let snap = await getDoc(ref);
  if (!snap.exists()) {
    if (isAdminEmail(user.email)) {   // first sign-in of an administrator
      await setDoc(ref, { email: user.email.toLowerCase(), name: 'Administrator', role: 'admin', books: ['L1', 'L2', 'L3', 'L4', 'L5'], devices: [], createdAt: serverTimestamp() });
      snap = await getDoc(ref);
    } else throw new Error('This account has no access yet. Please ask your teacher.');
  }
  const p = snap.data();
  if (p.disabled) throw new Error('This account is switched off. Please ask your teacher.');
  if (p.role === 'admin' || isAdminEmail(user.email)) return { ...p, uid: user.uid, admin: true };
  const id = deviceId(), devices = p.devices || [];
  if (!devices.some(d => d.id === id)) {
    if (devices.length >= MAX_DEVICES) throw new Error(`This account is already used on ${MAX_DEVICES} devices. Ask your teacher to reset your devices.`);
    const entry = { id, label: deviceLabel(), at: Date.now() };
    await updateDoc(ref, { devices: arrayUnion(entry), lastLogin: serverTimestamp() });
    p.devices = [...devices, entry];
  }
  return { ...p, uid: user.uid, admin: false };
}

export async function login(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  try { return await checkProfile(cred.user); }
  catch (e) { await signOut(auth); throw e; }
}
export const logout = () => signOut(auth);

// Waits for the saved session. Resolves with the profile, or null when nobody is signed in
// or this device / account is not allowed (the user is then signed out).
export function currentProfile() {
  return new Promise(res => {
    const stop = onAuthStateChanged(auth, async user => {
      stop();
      if (!user) return res(null);
      try { res(await checkProfile(user)); }
      catch (e) { try { sessionStorage.setItem('emm-msg', e.message); } catch (x) {} await signOut(auth); res(null); }
    });
  });
}

// Used inside each game page: only signed-in users who have this book may play.
export async function guardBook(bookId, home = '../index.html') {
  const p = await currentProfile();
  if (!p) { location.replace(home + '?next=' + encodeURIComponent(location.pathname.split('/').slice(-2).join('/'))); return null; }
  if (!p.admin && !(p.books || []).includes(bookId)) { try { sessionStorage.setItem('emm-msg', 'This book is not on your account yet. Please ask your teacher.'); } catch (x) {} location.replace(home); return null; }
  document.documentElement.classList.remove('emm-locked');
  return p;
}
