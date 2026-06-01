import { createContext, useContext, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon.jsx";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const navigate = useNavigate();

  const showToast = useCallback((msg, link) => {
    setToast({ msg, link });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="toast-wrap">
          <div className="toast">
            <span className="t-ico"><Icon name="check" /></span>
            <span>{toast.msg}</span>
            {toast.link && (
              <a onClick={() => { navigate(toast.link.to); setToast(null); }}>{toast.link.label}</a>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext) || { showToast: () => {} };
}
