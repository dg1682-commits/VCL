/**
 * Firebase Firestore Service for VCL-Light
 * Manages scripts, templates, and user data with real-time cloud sync & offline fallback
 */
import { CONFIG } from './config.js';
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

class FirebaseService {
  constructor() {
    this.app = null;
    this.db = null;
    this.isInitialized = false;
    this.init();
  }

  init() {
    try {
      this.app = initializeApp(CONFIG.firebase);
      this.db = getFirestore(this.app);
      this.isInitialized = true;
      console.log('Firebase initialized successfully for project:', CONFIG.firebase.projectId);
    } catch (e) {
      console.warn('Firebase init warning (using offline storage mode):', e);
      this.isInitialized = false;
    }
  }

  /* ================== SCRIPTS (대본 저장소) ================== */

  async saveScript(script) {
    const id = script.id || 'script_' + Date.now();
    const data = {
      ...script,
      id,
      updatedAt: new Date().toISOString(),
      createdAt: script.createdAt || new Date().toISOString()
    };

    // 1. LocalStorage 즉시 동기화 (오프라인 보호)
    this._saveLocalScript(data);

    // 2. Cloud Firestore 저장
    if (this.isInitialized && this.db) {
      try {
        const docRef = doc(this.db, 'scripts', id);
        await setDoc(docRef, data, { merge: true });
      } catch (err) {
        console.warn('Firestore script save error (saved to local):', err);
      }
    }
    return data;
  }

  async getScripts() {
    let cloudScripts = [];
    if (this.isInitialized && this.db) {
      try {
        const q = query(collection(this.db, 'scripts'), orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
          cloudScripts.push(doc.data());
        });
      } catch (err) {
        console.warn('Firestore fetch failed, falling back to local storage:', err);
      }
    }

    const localScripts = this._getLocalScripts();
    
    // Merge cloud and local (prefer newer)
    const map = new Map();
    localScripts.forEach(s => map.set(s.id, s));
    cloudScripts.forEach(s => {
      const existing = map.get(s.id);
      if (!existing || new Date(s.updatedAt) >= new Date(existing.updatedAt)) {
        map.set(s.id, s);
      }
    });

    const merged = Array.from(map.values()).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    // Update local storage with merged state
    localStorage.setItem('vcl_scripts', JSON.stringify(merged));
    return merged;
  }

  async deleteScript(id) {
    // Remove from local
    this._deleteLocalScript(id);

    // Remove from cloud
    if (this.isInitialized && this.db) {
      try {
        await deleteDoc(doc(this.db, 'scripts', id));
      } catch (err) {
        console.warn('Firestore delete failed:', err);
      }
    }
    return true;
  }

  /* ================== TEMPLATES (템플릿 관리) ================== */

  async saveTemplate(template) {
    const id = template.id || 'tpl_' + Date.now();
    const data = {
      ...template,
      id,
      updatedAt: new Date().toISOString(),
      createdAt: template.createdAt || new Date().toISOString()
    };

    this._saveLocalTemplate(data);

    if (this.isInitialized && this.db) {
      try {
        const docRef = doc(this.db, 'templates', id);
        await setDoc(docRef, data, { merge: true });
      } catch (err) {
        console.warn('Firestore template save error:', err);
      }
    }
    return data;
  }

  async getTemplates() {
    let cloudTemplates = [];
    if (this.isInitialized && this.db) {
      try {
        const q = query(collection(this.db, 'templates'), orderBy('updatedAt', 'desc'));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
          cloudTemplates.push(doc.data());
        });
      } catch (err) {
        console.warn('Firestore template fetch failed:', err);
      }
    }

    const localTemplates = this._getLocalTemplates();
    const map = new Map();
    localTemplates.forEach(t => map.set(t.id, t));
    cloudTemplates.forEach(t => map.set(t.id, t));

    const merged = Array.from(map.values()).sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    localStorage.setItem('vcl_templates', JSON.stringify(merged));
    return merged;
  }

  async deleteTemplate(id) {
    this._deleteLocalTemplate(id);
    if (this.isInitialized && this.db) {
      try {
        await deleteDoc(doc(this.db, 'templates', id));
      } catch (err) {
        console.warn('Firestore template delete failed:', err);
      }
    }
    return true;
  }

  /* ================== LOCAL STORAGE HELPERS ================== */

  _getLocalScripts() {
    try {
      const data = localStorage.getItem('vcl_scripts');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveLocalScript(script) {
    const list = this._getLocalScripts();
    const idx = list.findIndex(s => s.id === script.id);
    if (idx >= 0) {
      list[idx] = script;
    } else {
      list.unshift(script);
    }
    localStorage.setItem('vcl_scripts', JSON.stringify(list));
  }

  _deleteLocalScript(id) {
    const list = this._getLocalScripts().filter(s => s.id !== id);
    localStorage.setItem('vcl_scripts', JSON.stringify(list));
  }

  _getLocalTemplates() {
    try {
      const data = localStorage.getItem('vcl_templates');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  _saveLocalTemplate(template) {
    const list = this._getLocalTemplates();
    const idx = list.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      list[idx] = template;
    } else {
      list.unshift(template);
    }
    localStorage.setItem('vcl_templates', JSON.stringify(list));
  }

  _deleteLocalTemplate(id) {
    const list = this._getLocalTemplates().filter(t => t.id !== id);
    localStorage.setItem('vcl_templates', JSON.stringify(list));
  }
}

export const firebaseService = new FirebaseService();
