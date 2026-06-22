import { useState, useRef, useCallback, useEffect } from "react";

export type ScreenState =
  | "idle"
  | "waiting-share"
  | "opening-window"
  | "live"
  | "error";

// Tipo propio para reemplazar el ScreenDetailed experimental
interface WMScreen {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  label?: string;
  isPrimary?: boolean;
}

export interface ScreenOption {
  id: string;
  label: string;
  screen?: WMScreen;
}

interface ActivateResult {
  needsPicker: boolean;
  screens: ScreenOption[];
}

interface UseSecondScreenWindowReturn {
  state: ScreenState;
  screens: ScreenOption[];
  errorMessage: string | null;
  supportsWindowManagement: boolean;
  activate: (screen?: ScreenOption) => Promise<ActivateResult>;
  deactivate: () => void;
}

const supportsWM = (): boolean =>
  typeof window !== "undefined" && "getScreenDetails" in window;

export function useSecondScreenWindow(): UseSecondScreenWindowReturn {
  const [state, setState] = useState<ScreenState>("idle");
  const [screens, setScreens] = useState<ScreenOption[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const secondWindowRef = useRef<Window | null>(null);

  const supportsWindowManagement = supportsWM();

  useEffect(() => {
    const handleUnload = () => {
      secondWindowRef.current?.close();
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, []);

  const deactivate = useCallback(() => {
    secondWindowRef.current?.close();
    secondWindowRef.current = null;
    setState("idle");
    setErrorMessage(null);
    setScreens([]);
  }, []);

  const openWindow = useCallback((targetScreen?: WMScreen) => {
    const features = targetScreen
      ? `left=${targetScreen.availLeft},top=${targetScreen.availTop},width=${targetScreen.availWidth},height=${targetScreen.availHeight}`
      : "width=960,height=540";

    const win = window.open("/SecondScreen", "_blank", features);

    if (!win) {
      setState("error");
      setErrorMessage(
        "El navegador bloqueó la ventana emergente. Permitila en la barra de direcciones."
      );
      return;
    }

    secondWindowRef.current = win;
    setState("live");

    const checkClosed = setInterval(() => {
      if (win.closed) {
        clearInterval(checkClosed);
        setState("idle");
        secondWindowRef.current = null;
      }
    }, 1000);
  }, []);

  const activate = useCallback(
    async (chosenScreen?: ScreenOption): Promise<ActivateResult> => {
      setErrorMessage(null);

      if (chosenScreen?.screen) {
        setState("opening-window");
        openWindow(chosenScreen.screen);
        return { needsPicker: false, screens: [] };
      }

      if (supportsWM()) {
        setState("waiting-share");
        try {
          // @ts-ignore – API experimental
          const details = await window.getScreenDetails();
          const allScreens: ScreenOption[] = (details.screens as WMScreen[]).map(
            (s, i) => ({
              id: `screen-${i}`,
              label: s.label || `Pantalla ${i + 1}${s.isPrimary ? " (principal)" : ""}`,
              screen: s,
            })
          );

          setScreens(allScreens);

          if (allScreens.length > 1) {
            setState("idle");
            return { needsPicker: true, screens: allScreens };
          }

          setState("opening-window");
          openWindow(allScreens[0]?.screen);
          return { needsPicker: false, screens: [] };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Error desconocido";
          if (msg.includes("denied") || msg.includes("NotAllowed")) {
            setState("error");
            setErrorMessage(
              "Permiso denegado para acceder a la información de pantallas."
            );
          } else {
            setState("opening-window");
            openWindow();
          }
          return { needsPicker: false, screens: [] };
        }
      }

      setState("opening-window");
      openWindow();
      return { needsPicker: false, screens: [] };
    },
    [openWindow]
  );

  return {
    state,
    screens,
    errorMessage,
    supportsWindowManagement,
    activate,
    deactivate,
  };
}