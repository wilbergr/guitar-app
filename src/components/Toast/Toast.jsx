import './Toast.css';

/* Small, purely-visual transient notice. Screen-reader parity is handled by the
   aria-live regions in App.jsx, so this is aria-hidden to avoid double reads. */
export default function Toast({ icon: Icon, message, tone = 'default' }) {
  return (
    <div className={`toast toast-${tone}`} aria-hidden="true">
      {Icon && <Icon className="toast-icon" aria-hidden="true" />}
      <span className="toast-message">{message}</span>
    </div>
  );
}
