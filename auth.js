// ===================================================================================
// 🔐 AUTHENTICATION MODULE - PHASE 2
// ===================================================================================
// Comprehensive authentication system with session management, 
// password hashing, login attempts tracking, and security features
// ===================================================================================

class AuthenticationSystem {
  constructor() {
    this.currentSession = null;
    this.sessionTimeout = 4 * 60 * 60 * 1000; // 4 hours
    this.maxLoginAttempts = 5;
    this.lockoutDuration = 30 * 60 * 1000; // 30 minutes
    this.usersDatabase = null;
  }

  // 📊 Initialize authentication system
  async initialize(usersDb) {
    try {
      this.usersDatabase = await this._resolveUsersDatabase(usersDb);
    } catch (error) {
      console.error('Authentication initialize error:', error);
      throw error;
    }
    this.checkExistingSession();
    console.log('🔐 Authentication system initialized');
    return this.usersDatabase;
  }

  // 🔄 Alias for backwards compatibility
  async init(usersDb) {
    return this.initialize(usersDb);
  }

  // 📚 Ensure users database is loaded
  async ensureUsersDatabase(usersDb) {
    if (!this.usersDatabase) {
      await this.initialize(usersDb);
    }
    return this.usersDatabase;
  }

  // 📥 Resolve users database from provided data, global window or local file
  async _resolveUsersDatabase(usersDb) {
    if (usersDb && typeof usersDb === 'object') {
      return usersDb;
    }

    if (this.usersDatabase && typeof this.usersDatabase === 'object') {
      return this.usersDatabase;
    }

    if (typeof window !== 'undefined') {
      if (window.usersDatabase && typeof window.usersDatabase === 'object') {
        return window.usersDatabase;
      }

      try {
        const response = await fetch('./users.json', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          return data;
        }
      } catch (error) {
        console.warn('users.json load warning:', error);
      }
    }

    throw new Error('Kullanıcı veritabanı bulunamadı');
  }

  // 🔍 Simple password hashing (for demo - production should use bcrypt)
  async hashPassword(password) {
    // Simple hash for demo purposes
    // Production: use proper bcrypt library
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'lipodem_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '$demo$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // 🔐 Verify password against hash
  async verifyPassword(password, hash) {
    if (!hash.startsWith('$demo$') && !hash.startsWith('$2b$')) {
      return false;
    }
    
    // Demo hash verification
    if (hash.startsWith('$demo$')) {
      const computedHash = await this.hashPassword(password);
      return computedHash === hash;
    }
    
    // For bcrypt hashes (demo purpose - simple demo password check)
    if (hash.startsWith('$2b$')) {
      // Demo credentials mapping
      const demoPasswords = {
        'admin': 'admin123',
        'dyt.ayse': 'dyt123', 
        'hasta001': 'hasta123',
        'hasta002': 'hasta123',
        'hasta003': 'hasta123',
        'zeynep.senturk': 'zeynep123'
      };
      
      // Check against demo passwords
      const username = Object.keys(demoPasswords).find(user => 
        hash.includes('KIXWq7rJ8GKVJGxE9QXB3uyG8K6FQ4LZ') && user === 'admin' ||
        hash.includes('VEQp8rG9FGxD2YXB5uyP7eLM4K8FQ4LZ') && user === 'dyt.ayse' ||
        hash.includes('XYZa9rH6MGxE3YXC7uyQ8fNP5K9GQ5MZ') && user === 'hasta001' ||
        hash.includes('ABCb8sI7NHyF4ZYD8vzR9gOP6L0HR6NZ') && user === 'hasta002' ||
        hash.includes('DEFc9tJ8OIzG5aZE9w0S0hPQ7M1IS7OA') && user === 'hasta003' ||
        hash.includes('ZEYa0rH7PHxF5bYE0w1T1iPR8N2JT8PB') && user === 'zeynep.senturk'
      );
      
      return username && demoPasswords[username] === password;
    }
    
    return false;
  }

  // 👤 Authenticate user
  async authenticateUser(username, password) {
    try {
      await this.ensureUsersDatabase();
      if (!this.usersDatabase) {
        throw new Error('Kullanıcı veritabanı yüklenemedi');
      }

      // Find user
      const user = this.usersDatabase.users.find(u => u.username === username);
      if (!user) {
        return { success: false, error: 'Kullanıcı bulunamadı' };
      }

      // Check if user is active
      if (!user.isActive) {
        return { success: false, error: 'Kullanıcı hesabı deaktif' };
      }

      // Check lockout
      if (user.lockedUntil && new Date() < new Date(user.lockedUntil)) {
        const remainingTime = Math.ceil((new Date(user.lockedUntil) - new Date()) / 60000);
        return { success: false, error: `Hesap kilitli. ${remainingTime} dakika sonra tekrar deneyin.` };
      }

      // Verify password
      const passwordValid = await this.verifyPassword(password, user.passwordHash);
      
      if (!passwordValid) {
        // Increment login attempts
        user.loginAttempts = (user.loginAttempts || 0) + 1;
        
        if (user.loginAttempts >= this.maxLoginAttempts) {
          user.lockedUntil = new Date(Date.now() + this.lockoutDuration).toISOString();
          return { success: false, error: 'Çok fazla başarısız deneme. Hesap 30 dakika kilitlendi.' };
        }
        
        return { success: false, error: `Yanlış şifre. ${this.maxLoginAttempts - user.loginAttempts} deneme hakkınız kaldı.` };
      }

      // Successful login
      user.loginAttempts = 0;
      user.lockedUntil = null;
      user.lastLogin = new Date().toISOString();

      // Create session
      const session = this.createSession(user);
      this.currentSession = session;
      this.saveSession(session);

      return { success: true, user, session };

    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: 'Sistim hatası oluştu' };
    }
  }

  // 🚪 Unified login helper (including localStorage persistence)
  async login(username, password) {
    try {
      const result = await this.authenticateUser(username, password);
      if (result.success) {
        const sessionId = result.session?.id || result.session?.sessionId || `sess_${Date.now()}`;
        try { localStorage.setItem('currentUser', JSON.stringify(result.user)); } catch {}
        try { localStorage.setItem('sessionToken', sessionId); } catch {}
        try { localStorage.setItem('sessionTimestamp', Date.now().toString()); } catch {}
        return {
          success: true,
          user: result.user,
          session: result.session,
          message: 'Giriş başarılı'
        };
      }
      return {
        success: false,
        message: result.error || 'Giriş başarısız'
      };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: error?.message || 'Giriş hatası' };
    }
  }

  // 🎫 Create user session
  createSession(user) {
    const sessionId = this.generateSessionId();
    const expiresAt = new Date(Date.now() + this.sessionTimeout);
    
    return {
      id: sessionId,
      userId: user.id,
      role: user.role,
      fullName: user.fullName,
      permissions: user.permissions,
      patientId: user.patientId,
      assignedPatients: user.assignedPatients,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastActivity: new Date().toISOString()
    };
  }

  // 🔢 Generate session ID
  generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 💾 Save session to localStorage
  saveSession(session) {
    localStorage.setItem('lipodem_session', JSON.stringify(session));
    localStorage.setItem('lipodem_session_timestamp', Date.now().toString());
  }

  // 🔍 Check existing session
  checkExistingSession() {
    try {
      const sessionData = localStorage.getItem('lipodem_session');
      const timestamp = localStorage.getItem('lipodem_session_timestamp');
      
      if (!sessionData || !timestamp) {
        return null;
      }

      const session = JSON.parse(sessionData);
      const now = new Date();
      const sessionExpiry = new Date(session.expiresAt);

      // Check if session is expired
      if (now > sessionExpiry) {
        this.logout();
        return null;
      }

      // Check session timeout (4 hours of inactivity)
      const lastActivity = parseInt(timestamp);
      if (now.getTime() - lastActivity > this.sessionTimeout) {
        this.logout();
        return null;
      }

      // Session is valid
      this.currentSession = session;
      this.updateSessionActivity();
      return session;

    } catch (error) {
      console.error('Error checking session:', error);
      this.logout();
      return null;
    }
  }

  // 🔄 Update session activity
  updateSessionActivity() {
    if (this.currentSession) {
      this.currentSession.lastActivity = new Date().toISOString();
      localStorage.setItem('lipodem_session_timestamp', Date.now().toString());
    }
  }

  // 🚪 Logout user
  logout() {
    this.currentSession = null;
    localStorage.removeItem('lipodem_session');
    localStorage.removeItem('lipodem_session_timestamp');
    localStorage.removeItem('currentUser');
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('sessionTimestamp');
    localStorage.removeItem('serverJwt');
    
  // Redirect to entry page
  window.location.href = 'entry.html';
  }

  // 🔍 Check if user is authenticated
  isAuthenticated() {
    return this.currentSession !== null;
  }

  // 🔐 Check user permission
  hasPermission(permission) {
    if (!this.currentSession) return false;
    
    const permissions = this.currentSession.permissions || [];
    return permissions.includes('ALL') || permissions.includes(permission);
  }

  // 👤 Get current user
  getCurrentUser() {
    return this.currentSession;
  }

  // 🔄 Refresh session
  refreshSession() {
    if (this.currentSession) {
      const newExpiresAt = new Date(Date.now() + this.sessionTimeout);
      this.currentSession.expiresAt = newExpiresAt.toISOString();
      this.updateSessionActivity();
      this.saveSession(this.currentSession);
    }
  }

  // 🔁 Load session from backend response (JWT flow)
  loadSessionFromBackend(userPayload) {
    if (!userPayload) return;

    const session = this.createSession({
      ...userPayload,
      id: userPayload.id || userPayload.userId || Date.now(),
      permissions: userPayload.permissions || [],
      patientId: userPayload.patientId,
      assignedPatients: userPayload.assignedPatients || null
    });

    this.currentSession = session;
    this.saveSession(session);
    try {
      localStorage.setItem('currentUser', JSON.stringify(userPayload));
      localStorage.setItem('sessionToken', session.id);
      localStorage.setItem('sessionTimestamp', Date.now().toString());
    } catch (err) {
      console.warn('loadSessionFromBackend storage warning:', err);
    }
  }
}

// 🌐 Global authentication instance
window.authSystem = new AuthenticationSystem();

// 🔄 Auto-refresh session activity
setInterval(() => {
  if (window.authSystem.isAuthenticated()) {
    window.authSystem.updateSessionActivity();
  }
}, 60000); // Update every minute

// 📤 Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AuthenticationSystem;
}
