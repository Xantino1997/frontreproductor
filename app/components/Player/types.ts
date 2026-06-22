export type TrackType = "audio" | "video" | "image";

export interface Track {
  id: string;
  file: File;
  url: string;
  name: string;
  type: TrackType;
  cover?: string;
  holdAtEnd?: boolean; 
}