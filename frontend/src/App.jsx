import AppLayout from "./components/layout/AppLayout";
import { useRoute } from "./hooks/useRoute";
import Dashboard from "./pages/Dashboard";
import Maintenance from "./pages/Maintenance";
import Blocks from "./pages/Blocks";
import Trains from "./pages/Trains";
import Assets from "./pages/Assets";
import Planning from "./pages/Planning";
import Schedules from "./pages/Schedules";
import IncomingRequests from "./pages/IncomingRequests";
import CoaData from "./pages/CoaData";
import Conflicts from "./pages/Conflicts";
import Simulation from "./pages/Simulation";
import RailwayMap from "./pages/RailwayMap";
import TrainImpacts from "./pages/TrainImpacts";
import NotFound from "./pages/NotFound";

const FULL_HEIGHT_PAGES = new Set(["map"]);

function resolvePage(segment) {
  switch (segment) {
    case "dashboard":      return <Dashboard />;
    case "maintenance":    return <Maintenance />;
    case "blocks":         return <Blocks />;
    case "trains":         return <Trains />;
    case "assets":         return <Assets />;
    case "planning":       return <Planning />;
    case "schedules":      return <Schedules />;
    case "incoming-requests": return <IncomingRequests />;
    case "coa":            return <CoaData />;
    case "conflicts":      return <Conflicts />;
    case "simulation":     return <Simulation />;
    case "map":            return <RailwayMap />;
    case "train-impacts":  return <TrainImpacts />;
    default:               return <NotFound />;
  }
}

export default function App() {
  const path = useRoute();
  const segment = path.split("?")[0].split("/")[1] || "dashboard";
  const noPadding = FULL_HEIGHT_PAGES.has(segment);

  return (
    <AppLayout currentPath={path} noPadding={noPadding}>
      <div key={path} style={noPadding ? { height: "100%", overflow: "hidden" } : undefined}>
        {resolvePage(segment)}
      </div>
    </AppLayout>
  );
}