/**
 * Simple Authentication Library for Supabase
 * Use this to handle authentication and database operations in other projects.
 */

// ============================================
// CONFIG - All Configuration Variables
// ============================================
// Note: In a real app, these should be passed to an init function or pulled from env
const SUPABASE_URL = 'https://mwkoqxtyxdkkqlakrrvd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13a29xeHR5eGRra3FsYWtycnZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY2NzYzODcsImV4cCI6MjA4MjI1MjM4N30.2SvderBmI6Ick5Z91M4hrmJwKuXQZmvwWxQOpZod1kg';

// ============================================
// SUPABASE CLIENT - Database Operations
// ============================================
class SupabaseClient {
    constructor(url, anonKey) {
        if (!url) throw new Error('Supabase URL is required');
        if (!anonKey) throw new Error('Supabase API key is required');
        
        this.url = url;
        this.anonKey = anonKey;
    }

    async request(path, method = 'GET', body = null, options = {}) {
        if (!this.anonKey) {
            console.error('API key missing! this.anonKey:', this.anonKey);
            throw new Error('No API key found in request - SupabaseClient not properly initialized');
        }
        
        const url = `${this.url}/rest/v1/${path}`;
        
        const session = this.getSession();
        const authToken = session?.access_token || this.anonKey;
        
        const headers = {
            'Content-Type': 'application/json',
            'apikey': this.anonKey,
            'Authorization': `Bearer ${authToken}`
        };

        if (options.prefer) {
            headers['Prefer'] = options.prefer;
        } else if (method !== 'GET') {
            headers['Prefer'] = 'return=representation';
        }

        if (options.headers) {
            Object.assign(headers, options.headers);
        }

        const config = {
            method: method.toUpperCase(),
            headers,
        };

        if (body && method !== 'GET') {
            config.body = JSON.stringify(body);
        }

        const response = await fetch(url, config);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error('Request failed:', error);
            throw new Error(error.message || `Request failed with status ${response.status}`);
        }

        if (response.status === 204) {
            return null;
        }

        const data = await response.json();
        
        return data;
    }

    async signIn(email, password) {
        const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': this.anonKey,
            },
            body: JSON.stringify({
                email: email,
                password: password,
            }),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.error_description || error.message || 'Login failed');
        }

        const data = await response.json();
        
        if (data.access_token) {
            localStorage.setItem('supabase_access_token', data.access_token);
            localStorage.setItem('supabase_user', JSON.stringify(data.user));
            localStorage.setItem('supabase_session', JSON.stringify(data));
        }
        
        return data;
    }

    async signOut() {
        localStorage.removeItem('supabase_access_token');
        localStorage.removeItem('supabase_user');
        localStorage.removeItem('supabase_session');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
    }

    getSession() {
        const sessionStr = localStorage.getItem('supabase_session');
        if (sessionStr) {
            return JSON.parse(sessionStr);
        }

        const token = localStorage.getItem('supabase_access_token');
        const user = localStorage.getItem('supabase_user');
        
        if (token && user) {
            return {
                access_token: token,
                user: JSON.parse(user),
            };
        }
        
        return null;
    }

    isAuthenticated() {
        const token = localStorage.getItem('supabase_access_token');
        if (!token) return false;
        return !isTokenExpired(token);
    }

    from(tableName) {
        return new TableQuery(this, tableName);
    }
}

class TableQuery {
    constructor(client, tableName) {
        this.client = client;
        this.tableName = tableName;
        this.filters = [];
        this.orderByColumn = null;
        this.orderAsc = true;
        this.selectColumns = '*';
        this.insertData = null;
        this.updateData = null;
        this._isSelectMode = false;
    }

    select(columns = '*') {
        this.selectColumns = columns;
        this._isSelectMode = true;
        const self = this;
        const executePromise = this._execute('GET', null);
        
        executePromise.order = function(column, options = {}) {
            self.orderByColumn = column;
            self.orderAsc = options.ascending !== false;
            return self._execute('GET', null);
        };
        
        return executePromise;
    }

    order(column, options = {}) {
        this.orderByColumn = column;
        this.orderAsc = options.ascending !== false;
        if (this._isSelectMode) {
            return this._execute('GET', null);
        }
        return this;
    }

    eq(column, value) {
        this.filters.push({ column, operator: 'eq', value });
        return this;
    }

    async _execute(method = 'GET', data = null) {
        try {
            let url = `${this.client.url}/rest/v1/${this.tableName}`;
            const params = new URLSearchParams();

            params.append('select', this.selectColumns);

            if (this.filters.length > 0) {
                this.filters.forEach(f => {
                    params.append(`${f.column}`, `${f.operator}.${f.value}`);
                });
            }

            if (this.orderByColumn) {
                const orderDir = this.orderAsc ? 'asc' : 'desc';
                params.append('order', `${this.orderByColumn}.${orderDir}`);
            }

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const options = {
                body: data,
                prefer: method !== 'GET' ? 'return=representation' : null
            };

            const responseData = await this.client.request(`${this.tableName}${params.toString() ? '?' + params.toString() : ''}`, method, data, options);
            return { data: responseData, error: null };
        } catch (error) {
            console.error('Query exception:', error);
            if (isAuthError(error)) {
                handleAuthError(error);
            }
            return { data: null, error: error.message };
        }
    }

    async insert(records) {
        const data = Array.isArray(records) ? records : [records];
        return this._execute('POST', data);
    }

    async update(updates) {
        return this._execute('PATCH', updates);
    }

    async delete() {
        return this._execute('DELETE');
    }
}

// ============================================
// TOKEN VALIDATION - Check if JWT is expired
// ============================================
function isTokenExpired(token) {
    if (!token) return true;
    
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp * 1000; // Convert to milliseconds
        const now = Date.now();
        
        // Token expires soon (within 5 minutes)
        return now >= (exp - 300000);
    } catch (error) {
        console.error('Error checking token expiry:', error);
        return true;
    }
}

// ============================================
// GLOBAL ERROR HANDLER - Handle Auth Errors
// ============================================
function handleAuthError(error) {
    console.error('🚨 Authentication error:', error);
    localStorage.removeItem('supabase_access_token');
    localStorage.removeItem('supabase_user');
    localStorage.removeItem('supabase_session');
    alert('Your session has expired. Please login again.');
    window.location.href = 'login.html';
}

// Check if error is authentication related
function isAuthError(error) {
    const errorStr = String(error?.message || error || '').toLowerCase();
    return errorStr.includes('jwt') || 
           errorStr.includes('expired') || 
           errorStr.includes('401') ||
           errorStr.includes('unauthorized') ||
           errorStr.includes('invalid');
}

// Initialize Supabase client
const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
