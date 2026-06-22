import type jsmediatagsType from "jsmediatags";

type JsMediaTagsModule = typeof jsmediatagsType;

export function extractCoverFromAudio(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    // Import dinámico: evita que Next intente resolver
    // las dependencias de Node/React Native en el build de SSR.
    import("jsmediatags/dist/jsmediatags.min.js")
      .then((mod) => {
        const jsmediatags = (mod as any).default as JsMediaTagsModule;

        jsmediatags.read(file, {
          onSuccess: (tag) => {
            const picture = tag.tags.picture;
            if (!picture) {
              resolve(null);
              return;
            }
            const { data, format } = picture;
            const byteArray = new Uint8Array(data);
            let binary = "";
            for (let i = 0; i < byteArray.length; i++) {
              binary += String.fromCharCode(byteArray[i]);
            }
            const base64 = window.btoa(binary);
            resolve(`data:${format};base64,${base64}`);
          },
          onError: () => resolve(null),
        });
      })
      .catch(() => resolve(null));
  });
}