// src/layouts/DashboardLayout.jsx
import { Outlet, Link } from 'react-router-dom'
import Header from '../components/Header'

export default function DashboardLayout() {
  return (
    <div>
      <Header />

      <nav style={styles.breadcrumbs}>
        <Link to="/app/orders">Orders</Link>
        <Link to="/app/clerk">Clerk Dashboard</Link>
        <Link to="/app/messages">Messages</Link>
      </nav>

      <main style={{ padding: 20 }}>
        <Outlet />
      </main>
    </div>
  )
}

const styles = {
  breadcrumbs: {
    display: 'flex',
    gap: 20,
    padding: '10px 20px',
    borderBottom: '1px solid #e5e4e7'
  }
}