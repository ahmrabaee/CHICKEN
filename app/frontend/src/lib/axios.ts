import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth';

// Read from .env (VITE_API_URL), fall back to localhost for local dev
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/v1';
console.log('🔧 Axios configured with base URL:', API_BASE_URL);

const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true, // Important for CORS with credentials
});

// Track if we're currently refreshing to prevent multiple refresh calls
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: AxiosError | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

// Request interceptor: Add access token to all requests
axiosInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
            // Let the browser set multipart boundaries for FormData uploads.
            if (typeof (config.headers as { set?: (name: string, value?: string) => void }).set === 'function') {
                (config.headers as { set: (name: string, value?: string) => void }).set('Content-Type', undefined);
            } else {
                delete (config.headers as Record<string, unknown>)['Content-Type'];
            }
        }
        console.log(`🌐 [Request] ${config.method?.toUpperCase()} ${config.url}`, config.data);
        const token = getAccessToken();
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor: Handle 401 errors and auto-refresh tokens
axiosInstance.interceptors.response.use(
    (response) => {
        console.log(`✅ [Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, response.data);
        return response;
    },
    async (error: AxiosError) => {
        console.error(`❌ [Error] ${error.config?.method?.toUpperCase()} ${error.config?.url}`, error.response?.data || error.message);
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Skip 401 handling for auth endpoints - let the error propagate normally
        const authEndpoints = ['/auth/login', '/auth/refresh', '/auth/check-setup', '/auth/setup'];
        const isAuthEndpoint = authEndpoints.some(endpoint => originalRequest.url?.includes(endpoint));
        const isOnLoginPage = window.location.pathname === '/login' || window.location.pathname === '/setup';

        if (isAuthEndpoint || isOnLoginPage) {
            // Don't try to refresh tokens for auth endpoints - just let the error through
            console.log('🔓 Auth endpoint or login page - skipping token refresh, returning error normally');
            return Promise.reject(error);
        }

        // If error is 401 and we haven't retried yet
        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                // If already refreshing, queue this request
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then(() => {
                        return axiosInstance(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = getRefreshToken();

            if (!refreshToken) {
                // No refresh token, clear everything and redirect to login
                clearTokens();
                // Only redirect if not already on login page
                if (!isOnLoginPage) {
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }

            try {
                // Call refresh token endpoint - use a separate axios instance to avoid recursive intercepted calls
                // The backend returns { success: true, data: { accessToken, expiresIn } }
                const response = await axios.post(
                    `${API_BASE_URL}/auth/refresh`,
                    { refreshToken }
                );

                // standard API response structure: { success, data: { accessToken, ... } }
                const { accessToken } = response.data.data;

                // Store new tokens (keep existing refresh token if not provided)
                setTokens(accessToken, refreshToken);

                // Update authorization header
                if (originalRequest.headers) {
                    originalRequest.headers.Authorization = `Bearer ${accessToken}`;
                }

                // Process queued requests
                processQueue(null);

                return axiosInstance(originalRequest);
            } catch (refreshError) {
                // Refresh failed, clear tokens and redirect to login
                processQueue(refreshError as AxiosError);
                clearTokens();
                // Only redirect if not already on login page
                if (window.location.pathname !== '/login' && window.location.pathname !== '/setup') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export default axiosInstance;
