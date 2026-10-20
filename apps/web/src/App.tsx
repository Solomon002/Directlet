import { useEffect } from "react";
import { RouterProvider } from "react-router/dom";
import { router } from "./routes";
import { startSession } from "./lib/session";

export default function App() {
  useEffect(() => {
    void startSession();
  }, []);

  return <RouterProvider router={router} />;
}
