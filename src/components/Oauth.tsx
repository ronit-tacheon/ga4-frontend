import { useEffect, useState } from 'react';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import type { Session } from '@supabase/supabase-js';
// import added
import { useNavigate } from 'react-router-dom'; // Add this import

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

interface GoogleCredentials {
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface GoogleProfile {
  id: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
  locale?: string;
  hd?: string; // Hosted domain (for G Workspace)
}

interface ClientMetadata {
  timestamp: string;
  user_agent: string;
  screen_resolution: string;
  timezone: string;
  language: string;
  referrer: string;
}

interface EnhancedSessionData {
  session: Session;
  google_credentials: GoogleCredentials;
  google_profile: GoogleProfile;
  client_metadata: ClientMetadata;
}



// ---- Supabase config ----
const supabaseUrl: string = import.meta.env.VITE_RAZORPAY_KEY_ID;
const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const OAuthGoogle: React.FC = () => {
  const navigate = useNavigate(); // Add this hook
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
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'openid email profile https://www.googleapis.com/auth/analytics.readonly https://www.googleapis.com/auth/analytics.manage.users.readonly',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
        
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
      
      // 🆕 Extract comprehensive session data
      const enhancedSessionData: EnhancedSessionData = {
        // Original session
        session: session,
        
        // 🆕 Google-specific tokens and profile
        google_credentials: {
          access_token: session.provider_token || '',
          refresh_token: session.provider_refresh_token || null,
          expires_in: session.expires_in || 3600,
          token_type: session.token_type || 'Bearer',
          scope: 'https://www.googleapis.com/auth/analytics.readonly'
        },
        
        // 🆕 User profile from Google
        google_profile: {
          id: session.user.user_metadata.provider_id || session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata.full_name || session.user.user_metadata.name || '',
          picture: session.user.user_metadata.avatar_url || session.user.user_metadata.picture || '',
          email_verified: session.user.user_metadata.email_verified || false,
          locale: session.user.user_metadata.locale,
          hd: session.user.user_metadata.custom_claims?.hd // Hosted domain (for G Workspace)
        },
        
        // 🆕 Client metadata
        client_metadata: {
          timestamp: new Date().toISOString(),
          user_agent: navigator.userAgent,
          screen_resolution: `${screen.width}x${screen.height}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          referrer: document.referrer || 'direct'
        }
      };
      
      console.log('Enhanced session data:', enhancedSessionData);
      console.log('🔍 Google credentials:', enhancedSessionData.google_credentials);
      console.log('🔍 Google profile:', enhancedSessionData.google_profile);
      
      const backendUrl: string = 'https://remote-ga4-mcp-229250458092.us-central1.run.app';
      const callbackUrl = new URL('/callback', backendUrl);
      console.log('🔍 Full callback URL:', callbackUrl.toString());

      // Add OAuth params as query parameters
      Object.entries(oauthParams).forEach(([key, value]) => {
        if (value) {
          callbackUrl.searchParams.set(key, value);
        }
      });

      // 🆕 Send enhanced data to backend
      const response = await axios.post<CallbackResponse>(
        callbackUrl.toString(), 
        enhancedSessionData,  // ← Enhanced session data
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 15000 // Increased timeout for processing
        }
      );

      console.log('Callback success:', response.data);
      
      // Clean up
      sessionStorage.removeItem('oauth_params');

      // Write the code to redirect to /payment
      const redirectUri = oauthParams.redirect_uri;
      // redirection changed earlier it was to original redirectUri that we are passing to payment page now
      navigate(`/payment?redirect_uri=${encodeURIComponent(redirectUri || '')}`);
      
    } catch (err) {
      console.error('Callback POST failed:', err);
      if (axios.isAxiosError(err)) {
        const errorMessage = err.response?.data?.message || err.message;
        const statusCode = err.response?.status;
        setError(`Authentication failed (${statusCode}): ${errorMessage}`);
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
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ 
          color: '#dc3545', 
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: '8px'
        }}>
          <strong>Error:</strong> {error}
        </div>
        <button 
          onClick={() => {
            setError(null);
            sessionStorage.removeItem('oauth_params');
            window.location.href = '/';
          }}
          style={{
            padding: '12px 24px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: '500'
          }}
        >
          Go Back
        </button>
      </div>
    );
  }

  if (currentPath === '/auth/callback') {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
          <div className="spinner" style={{
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #4285f4',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            animation: 'spin 1s linear infinite'
          }} />
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', color: '#333' }}>Processing Authentication</h3>
            <p style={{ margin: '0', color: '#666' }}>
              Please wait while we complete the authorization with Google Analytics...
            </p>
          </div>
          <div style={{ 
            fontSize: '14px', 
            color: '#888',
            fontStyle: 'italic'
          }}>
            This may take a few moments
          </div>
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
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ color: '#333', marginBottom: '0.5rem' }}>Authorize GA4 MCP Server</h2>
          <p style={{ color: '#666', fontSize: '16px' }}>
            An application is requesting access to your Google Analytics data.
          </p>
        </div>
        
        {oauthParams && (
          <div style={{ 
            margin: '2rem 0', 
            padding: '1.5rem', 
            backgroundColor: '#f8f9fa', 
            borderRadius: '12px',
            border: '1px solid #dee2e6',
            textAlign: 'left'
          }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#495057', fontSize: '18px' }}>
              Authorization Details
            </h3>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Client ID:</strong> 
              <code style={{ 
                marginLeft: '0.5rem',
                padding: '2px 6px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                {oauthParams.client_id}
              </code>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <strong>Scope:</strong> 
              <code style={{ 
                marginLeft: '0.5rem',
                padding: '2px 6px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                {oauthParams.scope || 'scrape'}
              </code>
            </div>
            <div>
              <strong>Redirect URI:</strong> 
              <code style={{ 
                marginLeft: '0.5rem',
                padding: '2px 6px',
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                fontSize: '14px',
                wordBreak: 'break-all',
                display: 'inline-block',
                maxWidth: '100%'
              }}>
                {oauthParams.redirect_uri}
              </code>
            </div>
          </div>
        )}

        <div style={{ 
          margin: '2rem 0',
          padding: '1rem',
          backgroundColor: '#e7f3ff',
          border: '1px solid #b3d9ff',
          borderRadius: '8px',
          textAlign: 'left'
        }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#0066cc' }}>
            🔐 What you're granting access to:
          </h4>
          <ul style={{ margin: '0', paddingLeft: '1.5rem', color: '#333' }}>
            <li>Read access to your Google Analytics data</li>
            <li>View your Google profile information</li>
            <li>Access to generate analytics reports</li>
          </ul>
        </div>
        
        <button 
          onClick={handleLogin}
          disabled={isLoading || !oauthParams}
          style={{
            padding: '16px 32px',
            fontSize: '18px',
            backgroundColor: isLoading || !oauthParams ? '#ccc' : '#4285f4',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: isLoading || !oauthParams ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s',
            fontWeight: '600',
            boxShadow: isLoading || !oauthParams ? 'none' : '0 2px 4px rgba(66, 133, 244, 0.3)',
            minWidth: '200px'
          }}
          onMouseOver={(e) => {
            if (!isLoading && oauthParams) {
              e.currentTarget.style.backgroundColor = '#3367d6';
            }
          }}
          onMouseOut={(e) => {
            if (!isLoading && oauthParams) {
              e.currentTarget.style.backgroundColor = '#4285f4';
            }
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
        
        <div style={{ 
          marginTop: '2rem', 
          fontSize: '14px', 
          color: '#666',
          lineHeight: '1.4'
        }}>
          By clicking "Sign in with Google", you agree to grant the requested permissions 
          and allow this application to access your Google Analytics data.
        </div>
      </div>
    );
  }

  // Default view for other routes
  return (
    <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
      <div style={{
        padding: '2rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '12px',
        border: '1px solid #dee2e6'
      }}>
        <h3 style={{ color: '#333', marginBottom: '1rem' }}>GA4 MCP OAuth Server</h3>
        <p style={{ color: '#666', marginBottom: '1rem' }}>
          OAuth component loaded and ready for authorization requests.
        </p>
        <div style={{ fontSize: '14px', color: '#888' }}>
          Current path: <code style={{ 
            padding: '2px 6px',
            backgroundColor: '#e9ecef',
            borderRadius: '4px'
          }}>
            {currentPath}
          </code>
        </div>
      </div>
    </div>
  );
};

export default OAuthGoogle;