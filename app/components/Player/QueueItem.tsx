"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  FaMusic, FaVideo, FaImage, FaTrash, FaPauseCircle,
  FaPen, FaPlay, FaClone, FaArrowUp, FaArrowDown, FaGripVertical,
} from "react-icons/fa";
import { Track } from "./types";

interface QueueItemProps {
  track: Track;
  isCurrent: boolean;
  isSelected: boolean;
  isQueued: boolean;
  isPlayingCurrent: boolean;
  isEditing: boolean;
  editingName: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onItemClick: () => void;
  onStartEdit: (e: React.MouseEvent) => void;
  onConfirmEdit: () => void;
  onEditingNameChange: (value: string) => void;
  onCancelEdit: () => void;
  onDirectPlay: () => void;
  onToggleHoldAtEnd: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export default function QueueItem({
  track, isCurrent, isSelected, isQueued, isPlayingCurrent,
  isEditing, editingName, canMoveUp, canMoveDown,
  onItemClick, onStartEdit, onConfirmEdit, onEditingNameChange, onCancelEdit,
  onDirectPlay, onToggleHoldAtEnd, onDelete, onDuplicate, onMoveUp, onMoveDown,
}: QueueItemProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: track.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={[
        "player-queue-item",
        isCurrent ? "is-current" : "",
        isSelected ? "is-selected" : "",
        isQueued ? "is-queued" : "",
        isDragging ? "is-dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Asa de arrastre */}
      <span
        className="player-queue-drag"
        {...attributes}
        {...listeners}
        title="Arrastrar para reordenar"
      >
        <FaGripVertical />
      </span>

      {/* Ícono de tipo */}
      <span className="player-queue-icon" onClick={onItemClick}>
        {track.type === "audio" && <FaMusic />}
        {track.type === "video" && <FaVideo />}
        {track.type === "image" && <FaImage />}
      </span>

      {/* Nombre: normal o en edición */}
      {isEditing ? (
        <input
          className="player-queue-name-input"
          value={editingName}
          autoFocus
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={onConfirmEdit}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirmEdit();
            if (e.key === "Escape") onCancelEdit();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="player-queue-name"
          onClick={onItemClick}
          onDoubleClick={onStartEdit}
          title="Doble click para renombrar"
        >
          {track.name}
        </span>
      )}

      {/* Tags de estado */}
      {isQueued && <span className="player-queue-tag">en cola</span>}
      {isCurrent && isPlayingCurrent && (
        <span className="player-queue-tag player-queue-tag--live">sonando</span>
      )}

      {/* Botones de acción */}
      <div className="player-queue-actions">
        <button className="player-item-btn" title="Mover arriba" disabled={!canMoveUp} onClick={onMoveUp}>
          <FaArrowUp />
        </button>
        <button className="player-item-btn" title="Mover abajo" disabled={!canMoveDown} onClick={onMoveDown}>
          <FaArrowDown />
        </button>
        {!isEditing && (
          <button className="player-item-btn" title="Renombrar" onClick={onStartEdit}>
            <FaPen />
          </button>
        )}
        <button className="player-item-btn" title="Duplicar" onClick={onDuplicate}>
          <FaClone />
        </button>
        <button className="player-item-btn" title="Reproducir ahora" onClick={onDirectPlay}>
          <FaPlay />
        </button>
        <button
          className={`player-item-btn ${track.holdAtEnd ? "is-active" : ""}`}
          title={track.holdAtEnd ? "Al terminar: pausa" : "Al terminar: siguiente"}
          onClick={onToggleHoldAtEnd}
        >
          <FaPauseCircle />
        </button>
        <button className="player-item-btn player-item-btn--danger" title="Borrar" onClick={onDelete}>
          <FaTrash />
        </button>
      </div>
    </li>
  );
}