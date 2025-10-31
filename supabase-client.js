// Supabase Client Initialization
class SupabaseClient {
    constructor(url, anonKey) {
        if (!url) throw new Error('Supabase URL is required');
        if (!anonKey) throw new Error('Supabase API key is required');
        
        this.url = url;
        this.anonKey = anonKey;
    }

    async request(method, path, options = {}) {
        if (!this.anonKey) {
            console.error('API key missing! this.anonKey:', this.anonKey);
            throw new Error('No API key found in request - SupabaseClient not properly initialized');
        }
        
        const url = `${this.url}/rest/v1${path}`;
        
        // Get session token if available
        const session = this.getSession();
        const authToken = session?.access_token || this.anonKey;
        
        const headers = {
            'Content-Type': 'application/json',
            'apikey': this.anonKey,
            'Authorization': `Bearer ${authToken}`,
            'Prefer': 'return=representation',
        };

        // Merge options headers without overwriting auth
        if (options.headers) {
            Object.assign(headers, options.headers);
        }

        const config = {
            method,
            headers,
        };

        if (options.body) {
            config.body = JSON.stringify(options.body);
        }

        console.log('Making request to:', url);
        console.log('Headers apikey length:', headers.apikey?.length);
        console.log('Headers Authorization:', headers.Authorization?.substring(0, 30) + '...');

        const response = await fetch(url, config);
        
        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            console.error('Request failed:', error);
            throw new Error(error.message || `Request failed with status ${response.status}`);
        }

        const data = await response.json();
        
        // If returnFullResponse is requested, return both data and response
        if (options.returnFullResponse) {
            return { data, response };
        }
        
        return data;
    }

    // GET - Fetch photos with pagination
    // Returns { photos: [], totalCount: number }
    async getPhotos(limit = 50, offset = 0) {
        const rangeStart = offset;
        const rangeEnd = offset + limit - 1;
        
        const result = await this.request('GET', '/bangla_quotes_2?order=created_at.desc', {
            headers: {
                'Range': `${rangeStart}-${rangeEnd}`,
                'Prefer': 'count=exact', // Request total count in Content-Range header
            },
            returnFullResponse: true,
        });
        
        // Extract total count from Content-Range header
        // Format: "0-49/150" where 150 is the total count
        const contentRange = result.response.headers.get('Content-Range');
        let totalCount = 0;
        
        if (contentRange) {
            const match = contentRange.match(/\/(\d+)$/);
            if (match) {
                totalCount = parseInt(match[1], 10);
            }
        }
        
        return {
            photos: result.data,
            totalCount: totalCount,
        };
    }

    // POST - Add a new photo
    async addPhoto(photo) {
        return this.request('POST', '/bangla_quotes_2', {
            body: photo,
        });
    }

    // PATCH - Update a photo
    async updatePhoto(id, updates) {
        return this.request('PATCH', `/bangla_quotes_2?image_iid=eq.${id}`, {
            body: updates,
        });
    }

    // DELETE - Delete a photo
    async deletePhoto(id) {
        return this.request('DELETE', `/bangla_quotes_2?image_iid=eq.${id}`);
    }

    // AUTH - Sign in with email and password
    async signIn(email, password) {
        const response = await fetch(`${this.url}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : this.anonKey,
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
        
        // Store session
        if (data.access_token) {
            localStorage.setItem('supabase_access_token', data.access_token);
            localStorage.setItem('supabase_user', JSON.stringify(data.user));
            // Don't overwrite this.anonKey - keep it as the original anon key
        }
        
        return data;
    }

    // AUTH - Sign out
    async signOut() {
        localStorage.removeItem('supabase_access_token');
        localStorage.removeItem('supabase_user');
        localStorage.removeItem('supabase_session');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        // No need to reset this.anonKey - it stays as the original anon key
    }

    // Get current session
    getSession() {
        const token = localStorage.getItem('supabase_access_token');
        const user = localStorage.getItem('supabase_user');
        
        if (token && user) {
            // Don't modify this.anonKey - it should stay as the original anon key!
            return {
                access_token: token,
                user: JSON.parse(user),
            };
        }
        
        return null;
    }

    // AUTH - Check if user is authenticated
    isAuthenticated() {
        return !!localStorage.getItem('supabase_access_token');
    }

    // NEW: from() method for Supabase-like API
    from(tableName) {
        return new TableQuery(this, tableName);
    }
}

// TableQuery class for fluent API
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
        // Return a Promise-like object that can be awaited OR chained
        const self = this;
        const executePromise = this._execute('GET', null);
        
        // Add then/catch methods for promise behavior
        executePromise.order = function(column, options = {}) {
            self.orderByColumn = column;
            self.orderAsc = options.ascending !== false;
            // Re-execute with new order
            return self._execute('GET', null);
        };
        
        return executePromise;
    }

    order(column, options = {}) {
        this.orderByColumn = column;
        this.orderAsc = options.ascending !== false;
        // If in select mode, execute now
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

            // Add select
            params.append('select', this.selectColumns);

            // Add filters
            if (this.filters.length > 0) {
                this.filters.forEach(f => {
                    params.append(`${f.column}`, `${f.operator}.${f.value}`);
                });
            }

            // Add order
            if (this.orderByColumn) {
                const orderDir = this.orderAsc ? 'asc' : 'desc';
                params.append('order', `${this.orderByColumn}.${orderDir}`);
            }

            if (params.toString()) {
                url += '?' + params.toString();
            }

            const session = this.client.getSession();
            const authToken = session?.access_token || this.client.anonKey;

            const headers = {
                'Content-Type': 'application/json',
                'apikey': this.client.anonKey,
                'Authorization': `Bearer ${authToken}`,
            };

            if (method !== 'GET') {
                headers['Prefer'] = 'return=representation';
            }

            const config = {
                method,
                headers,
            };

            if (data) {
                config.body = JSON.stringify(data);
            }

            console.log('TableQuery._execute:', { method, url, selectColumns: this.selectColumns });

            const response = await fetch(url, config);
            const responseData = await response.json();

            if (!response.ok) {
                console.error('Query error:', responseData);
                return { 
                    data: null, 
                    error: responseData.message || responseData.error || 'Request failed'
                };
            }

            console.log('Query success - rows returned:', Array.isArray(responseData) ? responseData.length : 1);
            return { data: responseData, error: null };
        } catch (error) {
            console.error('Query exception:', error);
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

// Initialize Supabase client
console.log('Initializing Supabase with URL:', SUPABASE_URL);
console.log('API Key available:', !!SUPABASE_ANON_KEY);
console.log('API Key length:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0);

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase client created:', supabase);
console.log('Client has API key:', !!supabase.anonKey);
console.log('Client has from method:', typeof supabase.from);

// Check for existing session on load
if (typeof window !== 'undefined') {
    const session = supabase.getSession();
    console.log('Existing session:', session);
}
