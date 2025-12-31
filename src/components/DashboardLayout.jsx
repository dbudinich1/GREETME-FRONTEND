import DashboardStats from "./DashboardStats";
import UpcomingEvents from "./UpcomingEvents";
import Occasions from "./Occasions";
import MediaLibrary from "./MediaLibrary";

export default function DashboardLayout({ children }) {
  return (
    <div style={{ padding: 20 }}>
      <h2>Dashboard</h2>

      <DashboardStats />
      <UpcomingEvents />
      <Occasions />
      <MediaLibrary />

      <div>{children}</div>
    </div>
  );
}
