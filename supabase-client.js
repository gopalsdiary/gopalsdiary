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
        
        console.log('Session check:', {
            hasSession: !!session,
            accessTokenLength: session?.access_token?.length,
            usingAnonKey: !session,
            anonKeyLength: this.anonKey?.length
        });
        
        const headers = {
            'Content-Type': 'application/json',
            'apikey': typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : this.anonKey, // Always anon key for apikey
            'Authorization': `Bearer ${authToken}`, // Use session token if available
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
            localStorage.setItem('supabase_token', data.access_token);
            localStorage.setItem('supabase_user', JSON.stringify(data.user));
            // Don't overwrite this.anonKey - keep it as the original anon key
        }
        
        return data;
    }

    // AUTH - Sign out
    async signOut() {
        localStorage.removeItem('supabase_token');
        localStorage.removeItem('supabase_user');
        localStorage.removeItem('adminToken');
        localStorage.removeItem('adminUsername');
        // No need to reset this.anonKey - it stays as the original anon key
    }

    // AUTH - Get current session
    getSession() {
        const token = localStorage.getItem('supabase_token');
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
        return !!localStorage.getItem('supabase_token');
    }
}

// Initialize Supabase client
console.log('Initializing Supabase with URL:', SUPABASE_URL);
console.log('API Key available:', !!SUPABASE_ANON_KEY);
console.log('API Key length:', SUPABASE_ANON_KEY ? SUPABASE_ANON_KEY.length : 0);

const supabase = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log('Supabase client created:', supabase);
console.log('Client has API key:', !!supabase.anonKey);

// Check for existing session on load
if (typeof window !== 'undefined') {
    const session = supabase.getSession();
    console.log('Existing session:', session);
}
