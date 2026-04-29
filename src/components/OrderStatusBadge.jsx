// src/components/OrderStatusBadge.jsx
import { badge } from '../styles/components';

const LABELS = {
  pending:   'Pending',
  confirmed: 'Confirmed',
  ready:     'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function OrderStatusBadge({ status }) {
  const style = badge[status] ?? badge.pending;
  return (
    <span style={style}>
      {LABELS[status] ?? status}
    </span>
  );
}