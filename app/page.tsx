"use client";

import { useState } from "react";
import { loginRequest } from "./lib/api";
import Player from "./components/Player/Player";
import "./styles/Page.css";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("Conectando...");
    try {
      const data = await loginRequest({ email, password });
      setMessage(`Bienvenido, ${data.user.email}`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error desconocido");
    }
  };

  return (
    <main className="home">
      <Player />
    </main>
  );
}
