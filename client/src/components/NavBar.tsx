import { Link, useNavigate } from "react-router-dom";
import { LogOut, LifeBuoy } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

export function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="topnav">
      <Link to="/organizations" className="topnav-brand">
        <LifeBuoy size={20} />
        HelpDeskly
      </Link>
      {user && (
        <div className="topnav-actions">
          <span className="topnav-user">{user.name}</span>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
