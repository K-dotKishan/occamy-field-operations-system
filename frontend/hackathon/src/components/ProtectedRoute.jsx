import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");

  // If there is no token in local storage, redirect to login page
  if (!token) {
    return <Navigate to="/login" />;
  }

  return children;
}



