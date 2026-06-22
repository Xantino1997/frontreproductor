"use client";

import "../../styles/ComingSoonButton.css";

interface ComingSoonButtonProps {
  label?: string;
}

export default function ComingSoonButton({
  label = "Próximamente",
}: ComingSoonButtonProps) {
  return (
    <button className="coming-soon-btn" disabled>
      {label}
    </button>
  );
}