"use client";

import { useRef, useState } from "react";
import { FaTv, FaStop } from "react-icons/fa";

export default function SecondScreenButton() {
  const [active, setActive] = useState(false);
  const secondWindowRef = useRef<Window | null>(null);

  const start = () => {
    const win = window.open("/SecondScreen", "_blank", "width=960,height=540");
    if (!win) {
      alert("El navegador bloqueó la ventana emergente. Permitila en la barra de direcciones.");
      return;
    }
    secondWindowRef.current = win;
    setActive(true);

    const checkClosed = setInterval(() => {
      if (win.closed) {
        clearInterval(checkClosed);
        setActive(false);
        secondWindowRef.current = null;
      }
    }, 1000);
  };

  const stop = () => {
    secondWindowRef.current?.close();
    secondWindowRef.current = null;
    setActive(false);
  };

  return (
    <button
      onClick={active ? stop : start}
      title={active ? "Cerrar segunda pantalla" : "Abrir segunda pantalla"}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 12px", borderRadius: 6, cursor: "pointer",
        background: active ? "#d33" : "#4a90d9",
        color: "#fff", border: "none", fontSize: "0.9rem",
      }}
    >
      {active ? <><FaStop /> Cerrar</> : <><FaTv /> Segunda pantalla</>}
    </button>
  );
}