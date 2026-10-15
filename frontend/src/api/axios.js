import axios from 'axios';

// Central Axios instance configured for School Management SaaS API
const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://school-saas-g12p.onrender.com/api'
      : 'http://localhost:5000/api'),
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach JWT Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('school_saas_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !window.location.pathname.includes('/login')) {
      localStorage.removeItem('school_saas_token');
      localStorage.removeItem('school_saas_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
