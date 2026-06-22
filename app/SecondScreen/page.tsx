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
const SYNC_THRESHOLD = 1.5;
const VOLUME_STORAGE_KEY = "dj-second-screen-volume";

export default function SecondScreenPage() {
  const [track, setTrack] = useState<TrackInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [hovered, setHovered] = useState(false);

  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(VOLUME_STORAGE_KEY);
    if (saved !== null) {
      const v = parseFloat(saved);
      if (!isNaN(v)) setVolume(v);
    }
  }, []);

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

  useEffect(() => {
    if (!track?.url || track.trackType === "image") return;
    const el = mediaRef.current;
    if (!el) return;
    el.src = track.url;
    el.volume = muted ? 0 : volume;
    el.load();
    if (isPlaying) el.play().catch(() => {});
  }, [track?.url, track?.trackType]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (isPlaying) el.play().catch(() => {});
    else el.pause();
  }, [isPlaying]);

  const coverSrc = track?.trackType === "image" ? track.url : track?.cover ?? FALLBACK_COVER;
  const progressPct = duration ? (progress / duration) * 100 : 0;

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs === 0) return "00:00";
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const VolumeIcon =
    muted || volume === 0 ? FaVolumeMute : volume < 0.5 ? FaVolumeDown : FaVolumeUp;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        inset: 0,
        background: "#000",
        overflow: "hidden",
        cursor: hovered ? "default" : "none",
      }}
    >
      {/* ── MEDIA A PANTALLA COMPLETA ─────────────────────────────────────── */}
      {!track ? (
        <div style={{
          width: "100%", height: "100%",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "1.4rem", fontFamily: "sans-serif" }}>
            Esperando reproducción...
          </p>
        </div>
      ) : (
        <>
          {track.trackType === "video" && (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              playsInline
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                background: "#000",
              }}
            />
          )}

          {track.trackType === "audio" && (
            <>
              <audio ref={mediaRef as React.RefObject<HTMLAudioElement>} />
              <img
                src={coverSrc ?? FALLBACK_COVER}
                alt={track.name}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  background: "#000",
                }}
              />
            </>
          )}

          {track.trackType === "image" && (
            <img
              src={coverSrc ?? FALLBACK_COVER}
              alt={track.name}
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "contain",
                background: "#000",
              }}
            />
          )}

          {/* ── OVERLAY: aparece solo con hover ──────────────────────────── */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "40px 48px 36px",
              background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              opacity: hovered ? 1 : 0,
              transform: hovered ? "translateY(0)" : "translateY(12px)",
              transition: "opacity 0.3s ease, transform 0.3s ease",
              pointerEvents: hovered ? "auto" : "none",
            }}
          >
            {/* Nombre */}
            <p style={{
              margin: 0,
              color: "#fff",
              fontSize: "1.5rem",
              fontWeight: 700,
              fontFamily: "sans-serif",
              textShadow: "0 2px 8px rgba(0,0,0,0.6)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}>
              {track.name}
            </p>

            {/* Barra de progreso */}
            {track.trackType !== "image" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{
                  width: "100%", height: 4,
                  background: "rgba(255,255,255,0.2)",
                  borderRadius: 2, overflow: "hidden",
                }}>
                  <div style={{
                    width: `${progressPct}%`,
                    height: "100%",
                    background: "#4a90d9",
                    borderRadius: 2,
                    transition: "width 0.5s linear",
                  }} />
                </div>
                <div style={{
                  display: "flex", justifyContent: "space-between",
                  color: "rgba(255,255,255,0.5)", fontSize: "0.8rem",
                  fontFamily: "sans-serif",
                }}>
                  <span>{formatTime(progress)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>
            )}

            {/* Volumen + estado */}
            {track.trackType !== "image" && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                justifyContent: "space-between",
              }}>
                <span style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "0.85rem",
                  fontFamily: "sans-serif",
                }}>
                  {isPlaying ? "▶ Reproduciendo" : "⏸ Pausado"}
                </span>

                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 220 }}>
                  <button
                    onClick={toggleMute}
                    title={muted ? "Activar sonido" : "Silenciar"}
                    style={{
                      background: "transparent", border: "none",
                      color: "#fff", cursor: "pointer",
                      fontSize: "1rem", display: "flex", alignItems: "center",
                      opacity: 0.75, padding: 0,
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
                    title="Volumen"
                  />
                  <span style={{
                    color: "rgba(255,255,255,0.5)",
                    fontSize: "0.8rem", width: 36,
                    textAlign: "right", fontFamily: "sans-serif",
                  }}>
                    {Math.round((muted ? 0 : volume) * 100)}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
