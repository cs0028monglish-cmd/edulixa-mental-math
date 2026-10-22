// Shared sign-in, device limit and access checks for the Edulixa Mental Math portal.
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import { getAuth, initializeAuth, connectAuthEmulator, signInWithEmailAndPassword, onAuthStateChanged, signOut, browserSessionPersistence } from '../vendor/firebase/firebase-auth.js';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, arrayUnion, serverTimestamp } from '../vendor/firebase/firebase-firestore.js';
import { firebaseConfig, ADMIN_EMAILS, MAX_DEVICES } from './config.js';

export const app = initializeApp(firebaseConfig);
// Sign-in lasts for this browser tab only: every new visit starts at the sign-in window.
// Moving between the library, games, live test and admin panel in the same tab keeps the user signed in.
export const auth = (() => { try { return initializeAuth(app, { persistence: browserSessionPersistence }); } catch (e) { return getAuth(app); } })();
export const db = getFirestore(app);

// Marks that this tab passed through the sign-in window.
const IN_KEY = 'emm-in';
export const markEntered = () => { try { sessionStorage.setItem(IN_KEY, '1'); } catch (e) {} };
export const hasEntered = () => { try { return sessionStorage.getItem(IN_KEY) === '1'; } catch (e) { return false; } };
const clearEntered = () => { try { sessionStorage.removeItem(IN_KEY); } catch (e) {} };

// Small friendly notice at the bottom of the page (used instead of silent failures).
export function toast(text, ms = 6000) {
  let t = document.getElementById('emm-toast');
  if (!t) {
    t = document.createElement('div'); t.id = 'emm-toast'; t.setAttribute('role', 'status');
    t.style.cssText = 'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,520px);background:#06332D;color:#fff;font:700 15px/1.4 Nunito,Segoe UI,system-ui,sans-serif;padding:12px 18px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.3);border-left:6px solid #FFC93C;transition:opacity .3s';
    document.body.appendChild(t);
  }
  t.textContent = text; t.style.opacity = '1'; clearTimeout(t._h); t._h = setTimeout(() => { t.style.opacity = '0'; }, ms);
}
const friendly = e => {
  const m = String((e && (e.code || e.message)) || e || '');
  if (/network|offline|unavailable|failed to fetch|deadline/i.test(m)) return 'The internet connection is weak. Please check it and try again.';
  if (/permission/i.test(m)) return 'You do not have permission for this. Please sign in again or ask your teacher.';
  return 'Something went wrong. Please try again.';
};
// Catches unexpected errors on every page and shows a short message instead of freezing.
addEventListener('unhandledrejection', ev => { console.warn(ev.reason); toast(friendly(ev.reason)); });
addEventListener('offline', () => toast('You are offline. Your work will continue when the internet is back.'));
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
export const logout = () => { clearEntered(); return signOut(auth); };

// Waits for the saved session. Resolves with the profile, or null when nobody is signed in
// or this device / account is not allowed (the user is then signed out).
// If the connection is too slow, it gives up after `wait` ms (resolves null, with a message saved).
export function currentProfile(wait = 15000) {
  return new Promise(res => {
    let done = false; const finish = v => { if (!done) { done = true; clearTimeout(timer); res(v); } };
    const timer = setTimeout(() => { try { sessionStorage.setItem('emm-msg', 'The connection is slow. Please check your internet and sign in again.'); } catch (x) {} finish(null); }, wait);
    const stop = onAuthStateChanged(auth, async user => {
      stop();
      if (!user) return finish(null);
      try { finish(await checkProfile(user)); }
      catch (e) {
        const net = /network|offline|unavailable/i.test(String(e && (e.code || e.message)));
        try { sessionStorage.setItem('emm-msg', net ? 'The internet connection is weak. Please check it and sign in again.' : e.message); } catch (x) {}
        if (!net) { try { await signOut(auth); } catch (x) {} }
        finish(null);
      }
    }, () => finish(null));
  });
}

// Used inside each game, live-test and admin page: the user must have come through the sign-in window
// in this tab. Games also check that the student has that book.
export async function requireSignIn(next, home = 'index.html') {
  const p = await currentProfile();
  if (!p || !hasEntered()) {
    if (p) { try { await signOut(auth); } catch (e) {} }
    location.replace(home + '?next=' + encodeURIComponent(next)); return null;
  }
  return p;
}
export async function guardBook(bookId, home = '../index.html') {
  const next = location.pathname.split('/').slice(-2).join('/');
  const p = await requireSignIn(next, home);
  if (!p) return null;
  if (!p.admin && !(p.books || []).includes(bookId)) { try { sessionStorage.setItem('emm-msg', 'This book is not on your account yet. Please ask your teacher.'); } catch (x) {} location.replace(home); return null; }
  document.documentElement.classList.remove('emm-locked');
  return p;
}
