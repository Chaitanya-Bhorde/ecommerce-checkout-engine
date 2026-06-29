import { Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Products from './pages/Products';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderConfirmation from './pages/OrderConfirmation';
import AdminDashboard from './pages/AdminDashboard';
import AdminOrders from './pages/AdminOrders';
import AdminProducts from './pages/AdminProducts';
import AdminCategories from './pages/AdminCategories';
import AdminCustomers from './pages/AdminCustomers';
import AdminLedger from './pages/AdminLedger';

export default function App() {
  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <Navbar />
      <Routes>
        <Route path="/" element={<Navigate to="/products" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/products" element={<Products />} />
        <Route path="/cart" element={
          <ProtectedRoute>
            <Cart />
          </ProtectedRoute>
        } />
        <Route path="/checkout" element={
          <ProtectedRoute>
            <Checkout />
          </ProtectedRoute>
        } />
        <Route path="/orders" element={
          <ProtectedRoute>
            <Orders />
          </ProtectedRoute>
        } />
        <Route path="/order-confirmation/:orderId" element={
          <ProtectedRoute>
            <OrderConfirmation />
          </ProtectedRoute>
        } />
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        } />
        <Route path="/admin/orders" element={
          <AdminRoute>
            <AdminOrders />
          </AdminRoute>
        } />
        <Route path="/admin/orders/:orderId" element={
          <AdminRoute>
            <AdminOrders />
          </AdminRoute>
        } />
        <Route path="/admin/products" element={
          <AdminRoute>
            <AdminProducts />
          </AdminRoute>
        } />
        <Route path="/admin/categories" element={
          <AdminRoute>
            <AdminCategories />
          </AdminRoute>
        } />
        <Route path="/admin/customers" element={
          <AdminRoute>
            <AdminCustomers />
          </AdminRoute>
        } />
        <Route path="/admin/ledger" element={
          <AdminRoute>
            <AdminLedger />
          </AdminRoute>
        } />
      </Routes>
    </div>
  );
}
