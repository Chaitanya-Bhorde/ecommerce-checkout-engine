import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) return (
    <p style={{
      padding: '4rem',
      textAlign: 'center',
      color: '#6b7280',
      fontSize: '0.95rem',
    }}>
      Loading...
    </p>
  );
  
  if (!user) return <Navigate to="/login" replace />;
  
  if (user.role !== 'admin') return <Navigate to="/products" replace />;

  return children;
}