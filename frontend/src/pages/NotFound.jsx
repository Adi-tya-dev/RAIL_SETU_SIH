import Button from "../components/common/Button";
import { navigate } from "../hooks/useRoute";

export default function NotFound() {
  return (
    <div className="state" style={{ paddingTop: 80 }}>
      <p className="state__title" style={{ fontSize: 20 }}>Page not found</p>
      <p>The route you requested does not exist.</p>
      <Button variant="primary" size="md" onClick={() => navigate("/dashboard")}>
        Back to Dashboard
      </Button>
    </div>
  );
}