import React from 'react';

// Client-Side Offline Mock of Firebase Auth and Firestore
// This completely removes network dependency and Firestore backend errors.

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  isAnonymous: boolean;
}

export type FirebaseUser = User;

// Initialize currentUser from localStorage
let currentUser: User | null = null;
try {
  const stored = localStorage.getItem('dice_chess_auth_user');
  if (stored) {
    currentUser = JSON.parse(stored);
  }
} catch (e) {
  console.warn('Failed to parse stored auth user', e);
}

const authListeners = new Set<(user: User | null) => void>();

export const auth = {
  get currentUser() {
    return currentUser;
  },
  signOut: () => signOut(auth)
};

export function onAuthStateChanged(dummyAuth: any, callback: (user: User | null) => void) {
  authListeners.add(callback);
  // Trigger immediately
  setTimeout(() => callback(currentUser), 0);
  return () => {
    authListeners.delete(callback);
  };
}

export async function signInAnonymously(dummyAuth: any) {
  const id = 'guest_' + Math.random().toString(36).substring(2, 11);
  const newUser: User = {
    uid: id,
    email: null,
    displayName: 'Guest Player ' + id.substring(6).toUpperCase(),
    photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${id}`,
    isAnonymous: true
  };
  currentUser = newUser;
  localStorage.setItem('dice_chess_auth_user', JSON.stringify(newUser));
  authListeners.forEach(cb => cb(currentUser));
  return { user: newUser };
}

export async function signInWithPopup(dummyAuth: any, provider: any) {
  const id = 'google_' + Math.random().toString(36).substring(2, 11);
  const newUser: User = {
    uid: id,
    email: 'chessplayer@gmail.com',
    displayName: 'Google Chessmaster',
    photoURL: `https://api.dicebear.com/7.x/adventurer/svg?seed=${id}`,
    isAnonymous: false
  };
  currentUser = newUser;
  localStorage.setItem('dice_chess_auth_user', JSON.stringify(newUser));
  authListeners.forEach(cb => cb(currentUser));
  return { user: newUser };
}

export async function signOut(dummyAuth: any) {
  currentUser = null;
  localStorage.removeItem('dice_chess_auth_user');
  authListeners.forEach(cb => cb(null));
}

export async function updateProfile(user: any, profile: { displayName?: string, photoURL?: string }) {
  if (currentUser && currentUser.uid === user.uid) {
    if (profile.displayName !== undefined) currentUser.displayName = profile.displayName;
    if (profile.photoURL !== undefined) currentUser.photoURL = profile.photoURL;
    localStorage.setItem('dice_chess_auth_user', JSON.stringify(currentUser));
    authListeners.forEach(cb => cb(currentUser));
  }
}

export class GoogleAuthProvider {}

// --- FIRESTORE CLIENT-SIDE IMPLEMENTATION ---

export const db = {};

export interface DocRef {
  id: string;
  path: string;
  collectionName: string;
  type: 'doc';
}

export interface CollectionRef {
  path: string;
  collectionName: string;
  type: 'collection';
}

export interface QueryRef {
  collectionRef: CollectionRef;
  constraints: any[];
  type: 'query';
}

export function doc(dummyDb: any, collectionName: string, ...paths: string[]): DocRef {
  const id = paths[paths.length - 1];
  return {
    id,
    path: `${collectionName}/${paths.join('/')}`,
    collectionName,
    type: 'doc'
  };
}

export function collection(dummyDb: any, collectionName: string): CollectionRef {
  return {
    path: collectionName,
    collectionName,
    type: 'collection'
  };
}

export class Timestamp {
  constructor(public seconds: number, public nanoseconds: number) {}
  toDate() {
    return new Date(this.seconds * 1000);
  }
  static now() {
    const ms = Date.now();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }
  static fromDate(date: Date) {
    const ms = date.getTime();
    return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1000000);
  }
}

export function serverTimestamp() {
  return Timestamp.now();
}

export class FieldValueIncrement {
  constructor(public value: number) {}
}

export function increment(value: number) {
  return new FieldValueIncrement(value);
}

interface LocalDatabase {
  [collectionName: string]: {
    [docId: string]: any;
  };
}

function loadDatabase(): LocalDatabase {
  try {
    const data = localStorage.getItem('dice_chess_local_db');
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to load local db', e);
  }
  // Initialize with some mock data for Arena / Public challenges to look lively offline
  return {
    games: {
      'game_cpu_demo_1': {
        id: 'game_cpu_demo_1',
        opponentType: 'cpu',
        creatorId: 'cpu',
        creatorName: 'Virtual Chess Engine',
        whiteId: 'cpu',
        whiteName: 'Virtual Chess Engine',
        blackId: '',
        blackName: '',
        status: 'waiting',
        statusMessage: 'Play against the computer engine',
        createdAt: { seconds: Math.floor(Date.now() / 1000) - 100, nanoseconds: 0 }
      }
    },
    users: {}
  };
}

function saveDatabase(dbData: LocalDatabase) {
  try {
    localStorage.setItem('dice_chess_local_db', JSON.stringify(dbData));
    notifyDbChange();
  } catch (e) {
    console.error('Failed to save local db', e);
  }
}

const dbListeners = new Set<() => void>();

function notifyDbChange() {
  dbListeners.forEach(listener => {
    try {
      listener();
    } catch (err) {
      console.error('Error in snapshot listener:', err);
    }
  });
}

// Cross-tab sync via storage events
window.addEventListener('storage', (event) => {
  if (event.key === 'dice_chess_local_db' || event.key === 'dice_chess_auth_user') {
    if (event.key === 'dice_chess_auth_user') {
      try {
        currentUser = event.newValue ? JSON.parse(event.newValue) : null;
        authListeners.forEach(cb => cb(currentUser));
      } catch (e) {}
    }
    notifyDbChange();
  }
});

function reconstructTimestamps(obj: any): any {
  if (!obj) return obj;
  if (typeof obj !== 'object') return obj;
  if (obj.seconds !== undefined && obj.nanoseconds !== undefined) {
    return new Timestamp(obj.seconds, obj.nanoseconds);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => reconstructTimestamps(item));
  }
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    newObj[key] = reconstructTimestamps(obj[key]);
  }
  return newObj;
}

function serializeCustomTypes(obj: any): any {
  if (obj instanceof Timestamp) {
    return { seconds: obj.seconds, nanoseconds: obj.nanoseconds };
  }
  if (obj instanceof FieldValueIncrement) {
    return obj.value;
  }
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(serializeCustomTypes);
  }
  const newObj: any = {};
  for (const key of Object.keys(obj)) {
    newObj[key] = serializeCustomTypes(obj[key]);
  }
  return newObj;
}

function mergeDeep(target: any, source: any): any {
  if (typeof target !== 'object' || typeof source !== 'object' || !target || !source) {
    return source;
  }
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] instanceof Timestamp) {
      output[key] = source[key];
    } else if (source[key] instanceof FieldValueIncrement) {
      const prev = typeof target[key] === 'number' ? target[key] : 0;
      output[key] = prev + source[key].value;
    } else if (typeof source[key] === 'object' && source[key] !== null) {
      if (target[key]) {
        output[key] = mergeDeep(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    } else {
      output[key] = source[key];
    }
  }
  return output;
}

export async function getDoc(docRef: DocRef) {
  const dbData = loadDatabase();
  const collectionData = dbData[docRef.collectionName] || {};
  const docData = collectionData[docRef.id];
  return {
    id: docRef.id,
    exists: () => docData !== undefined,
    data: () => {
      if (!docData) return undefined;
      return reconstructTimestamps(docData);
    }
  };
}

export async function setDoc(docRef: DocRef, data: any, options?: { merge?: boolean }) {
  const dbData = loadDatabase();
  if (!dbData[docRef.collectionName]) {
    dbData[docRef.collectionName] = {};
  }
  const existing = dbData[docRef.collectionName][docRef.id] || {};
  
  let finalData = { ...data };
  if (options?.merge) {
    finalData = mergeDeep(existing, data);
  }
  
  finalData = serializeCustomTypes(finalData);
  dbData[docRef.collectionName][docRef.id] = finalData;
  saveDatabase(dbData);
}

export async function updateDoc(docRef: DocRef, data: any) {
  const dbData = loadDatabase();
  if (!dbData[docRef.collectionName] || !dbData[docRef.collectionName][docRef.id]) {
    // If updating a non-existent document, let's create it rather than failing
    if (!dbData[docRef.collectionName]) dbData[docRef.collectionName] = {};
    dbData[docRef.collectionName][docRef.id] = {};
  }
  const existing = dbData[docRef.collectionName][docRef.id];
  
  let finalData = { ...existing };
  for (const key of Object.keys(data)) {
    const val = data[key];
    if (key.includes('.')) {
      const parts = key.split('.');
      let curr = finalData;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!curr[parts[i]]) curr[parts[i]] = {};
        curr = curr[parts[i]];
      }
      const lastKey = parts[parts.length - 1];
      if (val instanceof FieldValueIncrement) {
        curr[lastKey] = (typeof curr[lastKey] === 'number' ? curr[lastKey] : 0) + val.value;
      } else {
        curr[lastKey] = val;
      }
    } else {
      if (val instanceof FieldValueIncrement) {
        finalData[key] = (typeof finalData[key] === 'number' ? finalData[key] : 0) + val.value;
      } else {
        finalData[key] = val;
      }
    }
  }

  finalData = serializeCustomTypes(finalData);
  dbData[docRef.collectionName][docRef.id] = finalData;
  saveDatabase(dbData);
}

export async function addDoc(collectionRef: CollectionRef, data: any) {
  const dbData = loadDatabase();
  if (!dbData[collectionRef.collectionName]) {
    dbData[collectionRef.collectionName] = {};
  }
  const id = 'doc_' + Math.random().toString(36).substring(2, 15);
  const finalData = serializeCustomTypes({ ...data, id });
  dbData[collectionRef.collectionName][id] = finalData;
  saveDatabase(dbData);
  return { id, path: `${collectionRef.collectionName}/${id}`, type: 'doc' as const };
}

export async function deleteDoc(docRef: DocRef) {
  const dbData = loadDatabase();
  if (dbData[docRef.collectionName]) {
    delete dbData[docRef.collectionName][docRef.id];
    saveDatabase(dbData);
  }
}

export function query(collectionRef: CollectionRef, ...constraints: any[]): QueryRef {
  return {
    collectionRef,
    constraints,
    type: 'query'
  };
}

export function where(field: string, op: '==' | '<' | '>' | '<=' | '>=', value: any) {
  return { type: 'where', field, op, value };
}

export function orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
  return { type: 'orderBy', field, direction };
}

export async function getDocs(ref: CollectionRef | QueryRef) {
  const collRef = ref.type === 'query' ? ref.collectionRef : ref;
  const dbData = loadDatabase();
  const collectionData = dbData[collRef.collectionName] || {};
  
  let docsList = Object.keys(collectionData).map(id => ({
    id,
    ...reconstructTimestamps(collectionData[id])
  }));

  if (ref.type === 'query') {
    for (const constraint of ref.constraints) {
      if (constraint.type === 'where') {
        const { field, op, value } = constraint;
        docsList = docsList.filter(doc => {
          const docVal = doc[field];
          if (op === '==') return docVal === value;
          if (op === '<') return docVal < value;
          if (op === '>') return docVal > value;
          if (op === '<=') return docVal <= value;
          if (op === '>=') return docVal >= value;
          return true;
        });
      }
    }
    
    const orderConstraint = ref.constraints.find(c => c.type === 'orderBy');
    if (orderConstraint) {
      const { field, direction } = orderConstraint;
      docsList.sort((a, b) => {
        let valA = a[field];
        let valB = b[field];
        if (valA instanceof Timestamp) valA = valA.seconds * 1000 + valA.nanoseconds / 1000000;
        if (valB instanceof Timestamp) valB = valB.seconds * 1000 + valB.nanoseconds / 1000000;
        
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
  }

  return {
    empty: docsList.length === 0,
    docs: docsList.map(docData => ({
      id: docData.id,
      exists: () => true,
      data: () => {
        const { id, ...rest } = docData;
        return rest;
      }
    }))
  };
}

export function onSnapshot(ref: DocRef | CollectionRef | QueryRef, callback: (snapshot: any) => void, onError?: (error: any) => void) {
  const trigger = async () => {
    if (ref.type === 'doc') {
      const snap = await getDoc(ref);
      callback(snap);
    } else {
      const snap = await getDocs(ref);
      callback(snap);
    }
  };

  dbListeners.add(trigger);
  trigger();

  return () => {
    dbListeners.delete(trigger);
  };
}
