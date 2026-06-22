"use client";

import { useEffect, useRef, useState } from "react";
import { FaVolumeUp, FaVolumeMute, FaVolumeDown } from "react-icons/fa";

interface TrackInfo {
  name: string;
  trackType: "audio" | "video" | "image";
  cover: string | null;
  url: string | null;
}

const FALLBACK_COVER = "/assets/fondo.webp";
const SYNC_THRESHOLD = 1.5; // segundos de tolerancia antes de forzar sincronía
const VOLUME_STORAGE_KEY = "dj-second-screen-volume";

export default function SecondScreenPage() {
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Volumen local de la segunda pantalla (independiente del Player)
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);

  // ── Cargar volumen guardado de esta pantalla ──────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (saved !== null) {
      const v = parseFloat(saved);
      if (!isNaN(v)) setVolume(v);
    }
  }, []);

  // ── Aplicar volumen al elemento de media actual ──────────────────────────
  useEffect(() => {
    if (mediaRef.current) {
      mediaRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted, track?.url]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (v > 0 && muted) setMuted(false);
    localStorage.setItem(VOLUME_STORAGE_KEY, String(v));
  };

  const toggleMute = () => setMuted((m) => !m);

  // ── Escuchar mensajes del Player ──────────────────────────────────────────
  useEffect(() => {
    const channel = new BroadcastChannel("dj-second-screen");

    channel.onmessage = (e) => {
      const { type } = e.data;

      if (type === "TRACK_CHANGE") {
        setTrack(e.data.track);
        setIsPlaying(e.data.isPlaying);
        setProgress(0);
        setDuration(0);
      }

      if (type === "PLAYBACK_STATE") {
        const playing: boolean = e.data.isPlaying;
        setIsPlaying(playing);
        const el = mediaRef.current;
        if (!el) return;
        if (playing) el.play().catch(() => {});
        else el.pause();
      }

      if (type === "PROGRESS") {
        setProgress(e.data.progress);
        setDuration(e.data.duration);
        // Sincronizar currentTime si hay drift significativo
        const el = mediaRef.current;
        if (el && isFinite(e.data.progress)) {
          const diff = Math.abs(el.currentTime - e.data.progress);
          if (diff > SYNC_THRESHOLD) {
            el.currentTime = e.data.progress;
          }
        }
      }

      if (type === "SEEK") {
        const { time, duration: dur } = e.data;
        setProgress(time);
        setDuration(dur);
        const el = mediaRef.current;
        if (el && isFinite(time)) {
          el.currentTime = time;
        }
      }

      if (type === "REQUEST_STATE_RESPONSE") {
        setTrack(e.data.track);
        setIsPlaying(e.data.isPlaying);
        setProgress(e.data.progress);
        setDuration(e.data.duration);
      }
    };

    channel.postMessage({ type: "REQUEST_STATE" });

    return () => channel.close();
  }, []);

  // ── Cuando cambia el track: cargar y reproducir el medio ──────────────────
  useEffect(() => {
    if (!track?.url) return;
    if (track.trackType === "image") return; // las imágenes no usan mediaRef

    const el = mediaRef.current;
    if (!el) return;

    el.src = track.url;
    el.volume = muted ? 0 : volume;
    el.load();
    if (isPlaying) el.play().catch(() => {});
  }, [track?.url, track?.trackType]);

  // ── Cuando cambia el estado play/pause (sin cambio de track) ─────────────
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (isPlaying) el.play().catch(() => {});
    else el.pause();
  }, [isPlaying]);

  // ── UI helpers ────────────────────────────────────────────────────────────
  const coverSrc =
    track?.trackType === "image"
      ? track.url
      : track?.cover ?? FALLBACK_COVER;

  const progressPct = duration ? (progress / duration) * 100 : 0;

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs === 0) return "00:00";
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const VolumeIcon = muted || volume === 0
    ? FaVolumeMute
    : volume < 0.5
    ? FaVolumeDown
    : FaVolumeUp;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width: "100vw", height: "100vh", background: "#0a0a0a",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "sans-serif", color: "#fff", overflow: "hidden",
      gap: 24,
    }}>
      {!track ? (
        <p style={{ opacity: 0.4, fontSize: "1.4rem" }}>Esperando reproducción...</p>
      ) : (
        <>
          {/* ── VIDEO ─────────────────────────────────────────────────────── */}
          {track.trackType === "video" && (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              style={{
                maxWidth: "90vw", maxHeight: "75vh",
                objectFit: "contain", borderRadius: 12,
                boxShadow: "0 0 80px rgba(0,0,0,0.9)",
              }}
              playsInline
            />
          )}

          {/* ── AUDIO: cover art + elemento oculto ────────────────────────── */}
          {track.trackType === "audio" && (
            <>
              <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} />
              <img
                src={coverSrc ?? FALLBACK_COVER}
                alt={track.name}
                style={{
                  maxWidth: "60vw", maxHeight: "60vh",
                  objectFit: "contain", borderRadius: 12,
                  boxShadow: "0 0 80px rgba(0,0,0,0.9)",
                }}
              />
            </>
          )}

          {/* ── IMAGEN ────────────────────────────────────────────────────── */}
          {track.trackType === "image" && (
            <img
              src={coverSrc ?? FALLBACK_COVER}
              alt={track.name}
              style={{
                maxWidth: "90vw", maxHeight: "75vh",
                objectFit: "contain", borderRadius: 12,
                boxShadow: "0 0 80px rgba(0,0,0,0.9)",
              }}
            />
          )}

          {/* ── Nombre del track ─────────────────────────────────────────── */}
          <p style={{
            fontSize: "1.6rem", fontWeight: 700,
            textAlign: "center", maxWidth: "80vw",
            textShadow: "0 2px 12px rgba(0,0,0,0.8)",
            margin: 0,
          }}>
            {track.name}
          </p>

          {/* ── Barra de progreso (solo audio/video) ─────────────────────── */}
          {track.trackType !== "image" && (
            <div style={{ width: "60vw", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{
                width: "100%", height: 6,
                background: "#333", borderRadius: 3, overflow: "hidden",
              }}>
                <div style={{
                  width: `${progressPct}%`, height: "100%",
                  background: "#4a90d9", borderRadius: 3,
                  transition: "width 0.5s linear",
                }} />
              </div>
              <div style={{
                display: "flex", justifyContent: "space-between",
                opacity: 0.5, fontSize: "0.9rem",
              }}>
                <span>{formatTime(progress)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* ── Estado ───────────────────────────────────────────────────── */}
          <p style={{ opacity: 0.4, fontSize: "1rem", margin: 0 }}>
            {isPlaying ? "▶ Reproduciendo" : "⏸ Pausado"}
          </p>

          {/* ── Volumen propio de esta pantalla ───────────────────────────── */}
          {track.trackType !== "image" && (
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              width: "60vw", maxWidth: 320,
            }}>
              <button
                onClick={toggleMute}
                title={muted ? "Activar sonido" : "Silenciar"}
                style={{
                  background: "transparent", border: "none", color: "#fff",
                  cursor: "pointer", fontSize: "1.1rem", display: "flex",
                  alignItems: "center", opacity: 0.7,
                }}
              >
                <VolumeIcon />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                style={{ flex: 1, accentColor: "#4a90d9" }}
                title="Volumen de esta pantalla"
              />
              <span style={{ opacity: 0.5, fontSize: "0.85rem", width: 36, textAlign: "right" }}>
                {Math.round((muted ? 0 : volume) * 100)}%
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}