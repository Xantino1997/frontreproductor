"use client";

import { usePathname } from "next/navigation";
import UpdateBaner from "./UpdateBaner";

export default function ConditionalShell() {
  const pathname = usePathname();
  const isSecondScreen = pathname.startsWith("/SecondScreen");

  if (isSecondScreen) return null;

  return <UpdateBaner />;
}