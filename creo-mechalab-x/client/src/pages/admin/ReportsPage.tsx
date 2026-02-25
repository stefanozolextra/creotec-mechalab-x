import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function ReportsPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/admin/users?view=reports", { replace: true });
  }, [navigate]);

  return null;
}
