import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import { NotificationsProvider } from "./context/NotificationsContext.jsx";
import { PresenceProvider } from "./context/PresenceContext.jsx";
import { BrandProvider } from "./context/BrandContext.jsx";
import App from "./App.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <BrandProvider>
        <AuthProvider>
          <NotificationsProvider>
            <PresenceProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </PresenceProvider>
          </NotificationsProvider>
        </AuthProvider>
      </BrandProvider>
    </BrowserRouter>
  </React.StrictMode>
);
