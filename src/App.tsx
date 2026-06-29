import { useEffect, useState } from "react";
import LibraryApp from "./views/LibraryApp";
import CommandBar from "./views/CommandBar";
import { applyAccent, getSettings } from "./lib/settings";
import "./App.css";

// Both Tauri windows load the same bundle; the hash chooses which app to render.
// The command-bar window opens index.html#/command-bar (see tauri.conf.json).
function routeFromHash(): "command-bar" | "main" {
  return window.location.hash.replace(/^#\/?/, "") === "command-bar"
    ? "command-bar"
    : "main";
}

export default function App() {
  const [route, setRoute] = useState(routeFromHash());

  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Apply the saved accent on load so both windows share the chosen theme.
  useEffect(() => {
    void getSettings().then((s) => applyAccent(s.accent));
  }, []);

  return route === "command-bar" ? <CommandBar /> : <LibraryApp />;
}
