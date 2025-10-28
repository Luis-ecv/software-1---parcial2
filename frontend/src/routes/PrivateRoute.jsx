import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';

// Simple PrivateRoute that asks backend for profile
const PrivateRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_WS_URL || window.location.origin}/apis`, {
          method: 'GET',
          credentials: 'include'
        });
        if (!mounted) return;
        if (res.ok) {
          setAuthed(true);
        } else {
          setAuthed(false);
        }
      } catch (err) {
        setAuthed(false);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return null; // or a spinner
  return authed ? children : <Navigate to="/login" />;
};

export default PrivateRoute;
