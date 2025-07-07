import { useEffect, useState } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';

// ---- Types ----
interface OAuthParams {
  client_id: string | null;
  redirect_uri: string | null;
  response_type: string | null;
  state: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
  scope: string | null;
}

interface CallbackResponse {
  success: boolean;
  message?: string;
  redirectUrl?: string;
}

// ---- Supabase config ----
const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const OAuthGoogle: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [oauthParams, setOauthParams] = useState<OAuthParams | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const currentPath: string = window.location.pathname;
    const urlParams = new URLSearchParams(window.location.search);

    // Handle /authorize route - show login page with OAuth params
    if (currentPath === '/authorize') {
      const params: OAuthParams = {
        client_id: urlParams.get('client_id'),
        redirect_uri: urlParams.get('redirect_uri'),
        response_type: urlParams.get('response_type'),
        state: urlParams.get('state'),
        code_challenge: urlParams.get('code_challenge'),
        code_challenge_method: urlParams.get('code_challenge_method'),
        scope: urlParams.get('scope')
      };
      
      // Validate required OAuth parameters
      if (!params.client_id || !params.redirect_uri || params.response_type !== 'code') {
        setError('Invalid OAuth request: Missing required parameters');
        return;
      }
      
      setOauthParams(params);
    }

    // Handle /auth/callback route - process Supabase callback
    if (currentPath === '/auth/callback') {
      handleSupabaseCallback();
    }
  }, []);

  const handleLogin = async (): Promise<void> => {
    if (!oauthParams) {
      console.error('No OAuth parameters found');
      setError('No OAuth parameters found');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Store OAuth params in sessionStorage for later use
      sessionStorage.setItem('oauth_params', JSON.stringify(oauthParams));
      
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { 
          redirectTo: `${window.location.origin}/auth/callback`
        },
      });

      if (authError) {
        console.error('Login error:', authError.message);
        setError(`Login failed: ${authError.message}`);
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Unexpected login error:', err);
      setError('An unexpected error occurred during login');
      setIsLoading(false);
    }
  };

  const handleSupabaseCallback = async (): Promise<void> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !data.session) {
        console.error('Error getting session:', sessionError);
        setError('Failed to authenticate with Google');
        setIsLoading(false);
        return;
      }

      // Retrieve OAuth params from sessionStorage
      const storedParams: string | null = sessionStorage.getItem('oauth_params');
      if (!storedParams) {
        console.error('No OAuth parameters found in storage');
        setError('OAuth session expired. Please try again.');
        setIsLoading(false);
        return;
      }

      const oauthParams: OAuthParams = JSON.parse(storedParams);
      const session: Session = data.session;
      
      console.log('Session data:', session);
      console.log('🔍 Backend URL:', import.meta.env.VITE_BACKEND_URL); // Debug log
      const backendUrl: string = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const callbackUrl = new URL('/callback', backendUrl);
      console.log('🔍 Full callback URL:', callbackUrl.toString()); // Debug log

      // Add OAuth params as query parameters
      Object.entries(oauthParams).forEach(([key, value]) => {
        if (value) {
          callbackUrl.searchParams.set(key, value);
        }
      });

      const response = await axios.post<CallbackResponse>(
        callbackUrl.toString(), 
        { session },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        }
      );

      console.log('Callback success:', response.data);
      
      // Clean up
      sessionStorage.removeItem('oauth_params');
      
      // If backend provides a redirect URL, use it
      if (response.data.redirectUrl) {
        window.location.href = response.data.redirectUrl;
      }
      
    } catch (err) {
      console.error('Callback POST failed:', err);
      if (axios.isAxiosError(err)) {
        setError(`Authentication failed: ${err.response?.data?.message || err.message}`);
      } else {
        setError('An unexpected error occurred during authentication');
      }
      setIsLoading(false);
    }
  };

  // Show different UI based on current route
  const currentPath: string = window.location.pathname;

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          <strong>Error:</strong> {error}
        </div>
        <button 
          onClick={() => {
            setError(null);
            window.location.href = '/';
          }}
          style={{
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (currentPath === '/auth/callback') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div className="spinner" style={{
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #3498db',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            animation: 'spin 2s linear infinite'
          }} />
          <p>Authenticating with Google...</p>
          <div>Please wait while we complete the authorization...</div>
        </div>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (currentPath === '/authorize') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <h2>Authorize Application</h2>
        <p>An application is requesting access to your data.</p>
        
        {oauthParams && (
          <div style={{ 
            margin: '1rem 0', 
            padding: '1rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '8px',
            border: '1px solid #dee2e6',
            textAlign: 'left'
          }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Client ID:</strong> <code>{oauthParams.client_id}</code>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>Scope:</strong> <code>{oauthParams.scope || 'scrape'}</code>
            </div>
            <div>
              <strong>Redirect URI:</strong> <code style={{ wordBreak: 'break-all' }}>
                {oauthParams.redirect_uri}
              </code>
            </div>
          </div>
        )}
        
        <button 
          onClick={handleLogin}
          disabled={isLoading || !oauthParams}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: isLoading || !oauthParams ? '#ccc' : '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isLoading || !oauthParams ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            fontWeight: '500'
          }}
        >
          {isLoading ? (
            <>
              <span style={{ marginRight: '8px' }}>⏳</span>
              Signing in...
            </>
          ) : (
            <>
              <span style={{ marginRight: '8px' }}>🔐</span>
              Sign in with Google
            </>
          )}
        </button>
        
        <div style={{ marginTop: '1rem', fontSize: '14px', color: '#666' }}>
          By clicking "Sign in with Google", you agree to grant the requested permissions.
        </div>
      </div>
    );
  }

  // Default view for other routes
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <p>OAuth component loaded</p>
      <div style={{ fontSize: '14px', color: '#666', marginTop: '1rem' }}>
        Current path: <code>{currentPath}</code>
      </div>
    </div>
  );
};

export default OAuthGoogle;