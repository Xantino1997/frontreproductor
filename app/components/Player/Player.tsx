"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  FaPlay, FaPause, FaStop, FaForward, FaBackward,
  FaUpload, FaSave, FaVolumeUp, FaVolumeMute, FaVolumeDown,
  FaSearch, FaTimes, FaLayerGroup,
} from "react-icons/fa";
import Swal from "sweetalert2";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Track, TrackType } from "./types";
import { extractCoverFromAudio } from "./coverExtractor";
import SecondScreenButton from "./SecondScreenButton";
import QueueItem from "./QueueItem";
import "../../styles/Player.css";

const FALLBACK_COVER = "../../../assets/fondo.webp";
const IMAGE_DISPLAY_SECONDS = 5;
const LIST_NAME_STORAGE_KEY = "dj-console-list-name";
const DEFAULT_LIST_NAME = "Mi lista inicial";
const VOLUME_STORAGE_KEY = "dj-console-volume";

type TypeFilter = "all" | TrackType;

const TYPE_LABELS: Record<TrackType, string> = {
  audio: "Audio",
  video: "Video",
  image: "Imágenes",
};

const channel =
  typeof window !== "undefined" ? new BroadcastChannel("dj-second-screen") : null;

export default function Player() {
  const [tracks, setTracks] = useState<Track[]>([]);

  // Selección / reproducción ahora por ID, no por índice numérico,
  // porque drag&drop, duplicar y agrupar cambian el orden/cantidad del array.
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [overrideTrackId, setOverrideTrackId] = useState<string | null>(null);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [listName, setListName] = useState(DEFAULT_LIST_NAME);

  // Volumen local de esta pantalla
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  // Edición de nombre inline
  const [editingName, setEditingName] = useState("");

  // Búsqueda / filtro / agrupación
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [groupByType, setGroupByType] = useState(false);

  const mediaRef = useRef<HTMLAudioElement | HTMLVideoElement | null>(null);
  const resumeTrackIdRef = useRef<string | null>(null);
  const pendingAfterOverrideIdRef = useRef<string | null>(null);
  const imageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const isDraggingSeekRef = useRef(false);

  const currentTrack =
    currentTrackId !== null ? tracks.find((t) => t.id === currentTrackId) ?? null : null;

  // ── Sensores de drag&drop (distancia mínima para no romper el click normal) ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // ── Broadcast: cambio de track ──────────────────────────────────────────
  useEffect(() => {
    if (!channel || !currentTrack) return;
    channel.postMessage({
      type: "TRACK_CHANGE",
      track: {
        name: currentTrack.name,
        trackType: currentTrack.type,
        cover: currentTrack.cover ?? null,
        url: currentTrack.url,
      },
      isPlaying,
    });
  }, [currentTrack]);

  // ── Broadcast: estado de play/pause ────────────────────────────────────
  useEffect(() => {
    if (!channel) return;
    channel.postMessage({ type: "PLAYBACK_STATE", isPlaying });
  }, [isPlaying]);

  // ── Broadcast: progreso ─────────────────────────────────────────────────
  useEffect(() => {
    if (!channel) return;
    channel.postMessage({ type: "PROGRESS", progress, duration });
  }, [progress, duration]);

  // ── Broadcast: responder REQUEST_STATE ──────────────────────────────────
  useEffect(() => {
    if (!channel) return;
    const handleRequest = (e: MessageEvent) => {
      if (e.data.type === "REQUEST_STATE") {
        channel.postMessage({
          type: "REQUEST_STATE_RESPONSE",
          track: currentTrack
            ? {
                name: currentTrack.name,
                trackType: currentTrack.type,
                cover: currentTrack.cover ?? null,
                url: currentTrack.url,
              }
            : null,
          isPlaying,
          progress,
          duration,
        });
      }
    };
    channel.addEventListener("message", handleRequest);
    return () => channel.removeEventListener("message", handleRequest);
  }, [currentTrack, isPlaying, progress, duration]);

  // ── Cargar nombre de lista guardado ────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem(LIST_NAME_STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed?.name) setListName(parsed.name);
      } catch {}
    }
  }, []);

  // ── Cargar volumen guardado ─────────────────────────────────────────────
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
  }, [volume, muted, currentTrack]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (v > 0 && muted) setMuted(false);
    localStorage.setItem(VOLUME_STORAGE_KEY, String(v));
  };

  const toggleMute = () => setMuted((m) => !m);

  const VolumeIcon = muted || volume === 0
    ? FaVolumeMute
    : volume < 0.5
    ? FaVolumeDown
    : FaVolumeUp;

  // ── Carga de archivos ──────────────────────────────────────────────────
  const getTrackType = (file: File): TrackType | null => {
    if (file.type.startsWith("audio/")) return "audio";
    if (file.type.startsWith("video/")) return "video";
    if (file.type.startsWith("image/")) return "image";
    return null;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newTracks: Track[] = [];
    for (const file of Array.from(files)) {
      const type = getTrackType(file);
      if (!type) continue;
      const url = URL.createObjectURL(file);
      let cover: string | undefined;
      if (type === "audio") {
        const extracted = await extractCoverFromAudio(file);
        cover = extracted ?? undefined;
      }
      newTracks.push({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file, url, name: file.name, type, cover, holdAtEnd: false,
      });
    }
    setTracks((prev) => [...prev, ...newTracks]);
    e.target.value = "";
  };

  // ── Búsqueda / filtro / agrupación ──────────────────────────────────────
  const matchesSearch = useCallback(
    (t: Track) => t.name.toLowerCase().includes(searchQuery.trim().toLowerCase()),
    [searchQuery]
  );

  const matchesType = useCallback(
    (t: Track) => typeFilter === "all" || t.type === typeFilter,
    [typeFilter]
  );

  const visibleTracks = useMemo(
    () => tracks.filter((t) => matchesSearch(t) && matchesType(t)),
    [tracks, matchesSearch, matchesType]
  );

  const sections = useMemo(() => {
    if (!groupByType) {
      return [{ key: "all", label: "Todos", tracks: visibleTracks }];
    }
    const order: TrackType[] = ["audio", "video", "image"];
    return order
      .map((type) => ({
        key: type,
        label: TYPE_LABELS[type],
        tracks: visibleTracks.filter((t) => t.type === type),
      }))
      .filter((s) => s.tracks.length > 0);
  }, [groupByType, visibleTracks]);

  // ── Click / doble click en la lista ───────────────────────────────────
  const handleItemClick = (id: string) => {
    if (editingTrackId !== null) return;
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      handleItemDoubleClick(id);
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      setSelectedTrackId(id);
      clickTimerRef.current = null;
    }, 250);
  };

  const handleItemDoubleClick = (id: string) => {
    setSelectedTrackId(id);
    if (currentTrackId === null || !isPlaying) { playTrackAt(id); return; }
    if (resumeTrackIdRef.current === null) {
      const idx = tracks.findIndex((t) => t.id === currentTrackId);
      const nextIdx = idx + 1 < tracks.length ? idx + 1 : 0;
      resumeTrackIdRef.current = tracks[nextIdx]?.id ?? null;
    }
    setOverrideTrackId(id);
  };

  // ── Edición de nombre ──────────────────────────────────────────────────
  const handleStartEdit = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
    }
    const track = tracks.find((t) => t.id === id);
    if (!track) return;
    setEditingTrackId(id);
    setEditingName(track.name);
  };

  const handleConfirmEdit = () => {
    if (editingTrackId === null) return;
    const trimmed = editingName.trim();
    if (trimmed) {
      setTracks((prev) =>
        prev.map((t) => (t.id === editingTrackId ? { ...t, name: trimmed } : t))
      );
    }
    setEditingTrackId(null);
  };

  // ── Reproducción ───────────────────────────────────────────────────────
  const playTrackAt = (id: string) => {
    setCurrentTrackId(id);
    setOverrideTrackId(null);
    setIsPlaying(true);
  };

  const handleDirectPlay = (id: string) => {
    resumeTrackIdRef.current = null;
    pendingAfterOverrideIdRef.current = null;
    playTrackAt(id);
  };

  const handlePlay = () => {
    if (currentTrack?.type === "image") { setIsPlaying(true); return; }
    if (mediaRef.current) { mediaRef.current.play().catch(() => {}); setIsPlaying(true); return; }
    if (currentTrackId === null && tracks.length > 0) playTrackAt(tracks[0].id);
  };

  const handlePause = () => {
    if (currentTrack?.type === "image") { setIsPlaying(false); return; }
    mediaRef.current?.pause();
    setIsPlaying(false);
  };

  const handleStop = () => {
    if (mediaRef.current) { mediaRef.current.pause(); mediaRef.current.currentTime = 0; }
    if (imageTimerRef.current) clearTimeout(imageTimerRef.current);
    setIsPlaying(false);
    setProgress(0);
  };

  const goToNext = useCallback(() => {
    if (tracks.length === 0) return;
    if (overrideTrackId !== null) {
      const toPlay = overrideTrackId;
      pendingAfterOverrideIdRef.current = resumeTrackIdRef.current;
      resumeTrackIdRef.current = null;
      setOverrideTrackId(null);
      playTrackAt(toPlay);
      return;
    }
    if (pendingAfterOverrideIdRef.current !== null) {
      const next = pendingAfterOverrideIdRef.current;
      pendingAfterOverrideIdRef.current = null;
      playTrackAt(next);
      return;
    }
    if (currentTrackId === null) { playTrackAt(tracks[0].id); return; }
    const idx = tracks.findIndex((t) => t.id === currentTrackId);
    const nextIdx = idx + 1 < tracks.length ? idx + 1 : 0;
    playTrackAt(tracks[nextIdx].id);
  }, [tracks, overrideTrackId, currentTrackId]);

  const goToPrev = () => {
    if (currentTrackId === null || tracks.length === 0) return;
    const idx = tracks.findIndex((t) => t.id === currentTrackId);
    const prevIdx = idx - 1 >= 0 ? idx - 1 : tracks.length - 1;
    playTrackAt(tracks[prevIdx].id);
  };

  const toggleHoldAtEnd = (id: string) => {
    setTracks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, holdAtEnd: !t.holdAtEnd } : t))
    );
  };

  const handleDeleteTrack = async (id: string) => {
    const track = tracks.find((t) => t.id === id);
    if (!track) return;
    const result = await Swal.fire({
      title: "¿Querés borrar este tema?", text: track.name, icon: "warning",
      showCancelButton: true, confirmButtonText: "Sí, borrar", cancelButtonText: "Cancelar",
      confirmButtonColor: "#d33", cancelButtonColor: "#4a90d9",
    });
    if (!result.isConfirmed) return;

    if (id === currentTrackId) { handleStop(); setCurrentTrackId(null); }
    if (id === overrideTrackId) setOverrideTrackId(null);
    if (id === selectedTrackId) setSelectedTrackId(null);
    if (id === editingTrackId) setEditingTrackId(null);

    setTracks((prev) => {
      // Si hay duplicados que comparten el mismo blob URL, no lo revocamos
      // todavía o rompemos la reproducción de la copia.
      const stillUsesUrl = prev.some((t) => t.id !== id && t.url === track.url);
      if (!stillUsesUrl) URL.revokeObjectURL(track.url);
      return prev.filter((t) => t.id !== id);
    });

    Swal.fire({ title: "Borrado", icon: "success", timer: 1200, showConfirmButton: false });
  };

  // ── Duplicar ─────────────────────────────────────────────────────────────
  const handleDuplicateTrack = (id: string) => {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return prev;
      const original = prev[idx];
      const clone: Track = {
        ...original,
        id: `${original.file.name}-dup-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: `${original.name} (copia)`,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, clone);
      return next;
    });
  };

  // ── Reordenar (drag&drop y botones subir/bajar) ─────────────────────────
  // Mueve un track dentro del subconjunto visible (filtro/búsqueda/grupo),
  // preservando la posición real de los tracks no visibles en el array completo.
  const reorderWithinSubset = useCallback(
    (predicate: (t: Track) => boolean, oldIndex: number, newIndex: number) => {
      setTracks((prev) => {
        const subsetWithIndex = prev.map((t, i) => ({ t, i })).filter((x) => predicate(x.t));
        const subsetTracks = subsetWithIndex.map((x) => x.t);
        if (oldIndex < 0 || newIndex < 0 || oldIndex >= subsetTracks.length || newIndex >= subsetTracks.length) {
          return prev;
        }
        const reordered = arrayMove(subsetTracks, oldIndex, newIndex);
        const next = [...prev];
        subsetWithIndex.forEach((x, idx) => { next[x.i] = reordered[idx]; });
        return next;
      });
    },
    []
  );

  const sectionPredicateFor = useCallback(
    (track: Track) => (t: Track) =>
      matchesSearch(t) && matchesType(t) && (!groupByType || t.type === track.type),
    [matchesSearch, matchesType, groupByType]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    const activeTrack = tracks.find((t) => t.id === activeId);
    const overTrack = tracks.find((t) => t.id === overId);
    if (!activeTrack || !overTrack) return;
    if (groupByType && activeTrack.type !== overTrack.type) return;

    const predicate = sectionPredicateFor(activeTrack);
    const subset = tracks.filter(predicate);
    const oldIndex = subset.findIndex((t) => t.id === activeId);
    const newIndex = subset.findIndex((t) => t.id === overId);
    reorderWithinSubset(predicate, oldIndex, newIndex);
  };

  const handleMoveUp = (track: Track) => {
    const predicate = sectionPredicateFor(track);
    const subset = tracks.filter(predicate);
    const oldIndex = subset.findIndex((t) => t.id === track.id);
    reorderWithinSubset(predicate, oldIndex, oldIndex - 1);
  };

  const handleMoveDown = (track: Track) => {
    const predicate = sectionPredicateFor(track);
    const subset = tracks.filter(predicate);
    const oldIndex = subset.findIndex((t) => t.id === track.id);
    reorderWithinSubset(predicate, oldIndex, oldIndex + 1);
  };

  // ── Imagen: avance automático ──────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying || currentTrack?.type !== "image") return;
    if (currentTrack.holdAtEnd) return;
    imageTimerRef.current = setTimeout(() => goToNext(), IMAGE_DISPLAY_SECONDS * 1000);
    return () => { if (imageTimerRef.current) clearTimeout(imageTimerRef.current); };
  }, [isPlaying, currentTrack, goToNext]);

  const onTimeUpdate = () => {
    if (mediaRef.current) {
      setProgress(mediaRef.current.currentTime);
      setDuration(mediaRef.current.duration || 0);
    }
  };

  const onEnded = () => {
    if (currentTrack?.holdAtEnd) { setIsPlaying(false); return; }
    goToNext();
  };

  // ── Seek con la barra de progreso ──────────────────────────────────────
  const seekToPosition = useCallback(
    (clientX: number) => {
      const bar = progressBarRef.current;
      if (!bar || !duration) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
      const newTime = ratio * duration;
      setProgress(newTime);
      if (mediaRef.current) mediaRef.current.currentTime = newTime;
      if (channel) {
        channel.postMessage({ type: "SEEK", time: newTime, duration });
      }
    },
    [duration]
  );

  const handleProgressMouseDown = (e: React.MouseEvent) => {
    if (!duration) return;
    isDraggingSeekRef.current = true;
    seekToPosition(e.clientX);

    const onMove = (ev: MouseEvent) => {
      if (isDraggingSeekRef.current) seekToPosition(ev.clientX);
    };
    const onUp = () => {
      isDraggingSeekRef.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // ── Guardar lista ──────────────────────────────────────────────────────
  const handleSaveList = async () => {
    const { value: newName } = await Swal.fire({
      title: "Nombre de la lista", input: "text", inputValue: listName,
      showCancelButton: true, confirmButtonText: "Guardar", cancelButtonText: "Cancelar",
      confirmButtonColor: "#4a90d9",
      inputValidator: (value) => (!value?.trim() ? "Ponele un nombre a la lista" : undefined),
    });
    if (!newName) return;
    setListName(newName);
    localStorage.setItem(
      LIST_NAME_STORAGE_KEY,
      JSON.stringify({
        name: newName,
        trackNames: tracks.map((t) => ({ name: t.name, type: t.type })),
        savedAt: Date.now(),
      })
    );
    Swal.fire({ title: "Lista guardada", icon: "success", timer: 2200, showConfirmButton: false });
  };

  // ── Cover ──────────────────────────────────────────────────────────────
  const coverSrc = (() => {
    if (!currentTrack) return FALLBACK_COVER;
    if (currentTrack.type === "image") return currentTrack.url;
    if (currentTrack.type === "audio") return currentTrack.cover ?? FALLBACK_COVER;
    return null;
  })();

  const formatTime = (secs: number) => {
    if (!isFinite(secs)) return "00:00";
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = Math.floor(secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const progressPct = duration ? (progress / duration) * 100 : 0;

  // ── Elemento de media ──────────────────────────────────────────────────
  const mediaElement =
    currentTrack?.type === "video" ? (
      <video
        key={currentTrack.id}
        ref={mediaRef as React.RefObject<HTMLVideoElement>}
        src={currentTrack.url}
        className="player-media"
        autoPlay={isPlaying}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onLoadedMetadata={onTimeUpdate}
      />
    ) : currentTrack?.type === "audio" ? (
      <audio
        key={currentTrack.id}
        ref={mediaRef as React.RefObject<HTMLAudioElement>}
        src={currentTrack.url}
        autoPlay={isPlaying}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onLoadedMetadata={onTimeUpdate}
      />
    ) : null;

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="player">
      {/* Top bar */}
      <div className="player-top-bar">
        <span className="player-list-name">{listName}</span>
        <div className="player-top-actions">
          <button onClick={handleSaveList} title="Guardar / renombrar lista">
            <FaSave /> Guardar lista
          </button>
          <SecondScreenButton />
        </div>
      </div>

      <div className="player-layout">
        {/* Bloque principal: cover/video + info + controles */}
        <div className="player-main">
          <div className="player-visual">
            {mediaElement}
            {currentTrack?.type !== "video" && (
              <img
                src={coverSrc ?? FALLBACK_COVER}
                alt={currentTrack?.name ?? "Sin tema"}
                className="player-cover"
              />
            )}
          </div>

          <div className="player-info">
            <span className="player-track-name">
              {currentTrack ? currentTrack.name : "Sin tema seleccionado"}
            </span>

            <div
              className="player-progress-bar"
              ref={progressBarRef}
              onMouseDown={handleProgressMouseDown}
            >
              <div className="player-progress-fill" style={{ width: `${progressPct}%` }} />
              <div className="player-progress-thumb" style={{ left: `${progressPct}%` }} />
            </div>

            <div className="player-times">
              <span>{formatTime(progress)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          <div className="player-controls">
            <button onClick={goToPrev} title="Anterior"><FaBackward /></button>
            {isPlaying ? (
              <button onClick={handlePause} title="Pausa" className="player-btn-main">
                <FaPause />
              </button>
            ) : (
              <button onClick={handlePlay} title="Play" className="player-btn-main">
                <FaPlay />
              </button>
            )}
            <button onClick={handleStop} title="Stop"><FaStop /></button>
            <button onClick={goToNext} title="Siguiente"><FaForward /></button>
            <label className="player-upload">
              <FaUpload />
              <input
                type="file"
                accept="audio/*,video/*,image/*"
                multiple
                onChange={handleFileUpload}
                hidden
              />
            </label>
          </div>

          <div className="player-volume">
            <button className="player-volume-btn" onClick={toggleMute} title={muted ? "Activar sonido" : "Silenciar"}>
              <VolumeIcon />
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              className="player-volume-slider"
              title="Volumen de esta pantalla"
            />
            <span className="player-volume-value">{Math.round((muted ? 0 : volume) * 100)}%</span>
          </div>
        </div>

        {/* Cola de tracks */}
        <div className="player-queue-wrapper">
          {/* Toolbar: búsqueda + filtro + agrupar */}
          <div className="player-queue-toolbar">
            <div className="player-queue-search">
              <FaSearch className="player-queue-search-icon" />
              <input
                type="text"
                placeholder="Buscar en la lista..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="player-queue-search-clear"
                  onClick={() => setSearchQuery("")}
                  title="Limpiar búsqueda"
                >
                  <FaTimes />
                </button>
              )}
            </div>

            <div className="player-queue-filters">
              {(["all", "audio", "video", "image"] as TypeFilter[]).map((f) => (
                <button
                  key={f}
                  className={`player-filter-btn ${typeFilter === f ? "is-active" : ""}`}
                  onClick={() => setTypeFilter(f)}
                >
                  {f === "all" ? "Todos" : TYPE_LABELS[f as TrackType]}
                </button>
              ))}
              <button
                className={`player-filter-btn player-filter-btn--group ${groupByType ? "is-active" : ""}`}
                onClick={() => setGroupByType((g) => !g)}
                title="Agrupar por tipo"
              >
                <FaLayerGroup /> Agrupar
              </button>
            </div>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            {sections.map((section) => (
              <div key={section.key} className="player-queue-section">
                {groupByType && (
                  <div className="player-queue-section-header">
                    {section.label} <span>({section.tracks.length})</span>
                  </div>
                )}
                <SortableContext
                  items={section.tracks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <ul className="player-queue">
                    {section.tracks.map((track, idx) => (
                      <QueueItem
                        key={track.id}
                        track={track}
                        isCurrent={track.id === currentTrackId}
                        isSelected={track.id === selectedTrackId}
                        isQueued={track.id === overrideTrackId}
                        isPlayingCurrent={isPlaying}
                        isEditing={track.id === editingTrackId}
                        editingName={editingName}
                        canMoveUp={idx > 0}
                        canMoveDown={idx < section.tracks.length - 1}
                        onItemClick={() => handleItemClick(track.id)}
                        onStartEdit={(e) => handleStartEdit(track.id, e)}
                        onConfirmEdit={handleConfirmEdit}
                        onEditingNameChange={setEditingName}
                        onCancelEdit={() => setEditingTrackId(null)}
                        onDirectPlay={() => handleDirectPlay(track.id)}
                        onToggleHoldAtEnd={() => toggleHoldAtEnd(track.id)}
                        onDelete={() => handleDeleteTrack(track.id)}
                        onDuplicate={() => handleDuplicateTrack(track.id)}
                        onMoveUp={() => handleMoveUp(track)}
                        onMoveDown={() => handleMoveDown(track)}
                      />
                    ))}
                  </ul>
                </SortableContext>
              </div>
            ))}
          </DndContext>

          {tracks.length === 0 && (
            <p className="player-queue-empty">
              Subí audio, video o imágenes para armar la lista
            </p>
          )}
          {tracks.length > 0 && visibleTracks.length === 0 && (
            <p className="player-queue-empty">
              No se encontraron resultados para tu búsqueda/filtro
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
