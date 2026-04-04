/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from "react";
import ApiKeySetup from "./components/ApiKeySetup";
import Designer from "./components/Designer";

export default function App() {
  const [apiKey, setApiKey] = useState<string>(
    () => localStorage.getItem("pica_gemini_key") ?? ""
  );

  function handleKeySubmit(key: string) {
    setApiKey(key);
  }

  function handleLogout() {
    localStorage.removeItem("pica_gemini_key");
    setApiKey("");
  }

  if (!apiKey) {
    return <ApiKeySetup onKeySubmit={handleKeySubmit} />;
  }

  return <Designer apiKey={apiKey} onLogout={handleLogout} />;
}
