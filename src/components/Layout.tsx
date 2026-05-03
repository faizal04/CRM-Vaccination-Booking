import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function Layout() {
  return (
    <div className="bg-background font-body-md text-on-background antialiased overflow-x-hidden min-h-screen">
      <Sidebar />
      <Header />
      <div className="ml-64 pt-16 h-full">
        <Outlet />
      </div>
    </div>
  );
}
