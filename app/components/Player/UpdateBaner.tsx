'use client';

import { useEffect, useState } from 'react';

export default function UpdateBaner() {
  const [isElectron, setIsElectron] = useState<boolean | null>(null);

  useEffect(() => {
    // Detectamos si estamos en Electron
    const win = window as any;
    const isElectronEnv = win.process && win.process['type'] === 'renderer';
    setIsElectron(!!isElectronEnv);
  }, []);

  // Si aún no sabemos si es Electron, no renderizamos nada (evita parpadeos)
  if (isElectron === null) return null;

  // Si estamos en la app, no mostramos el banner de descarga
  if (isElectron) return null;

  return (
    <section className="relative w-full py-16 px-6 overflow-hidden">
      {/* Fondo con imagen */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/assets/fondo.webp')" }}
      />
      {/* Capa oscura para que el texto sea legible */}
      <div className="absolute inset-0 bg-black/70 z-10" />

      <div className="relative z-20 container mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-white mb-2">Lleva DJ Console a tu Escritorio</h2>
          <p className="text-gray-200">Obtén mejor rendimiento, atajos de teclado globales y acceso sin conexión.</p>
        </div>
        
        <a 
          href="/descargas/dj-console-setup.exe" 
          download="DJ_Console_Setup.exe"
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-8 rounded-lg shadow-lg transition-transform hover:scale-105 active:scale-95"
        >
          Descargar .EXE para Windows
        </a>
      </div>
    </section>
  );
}