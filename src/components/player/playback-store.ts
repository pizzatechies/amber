// A tiny shared channel between the video player and the notes panel, which
// live in different parts of the page: notes are stamped with the current
// playback time, and clicking a note's timestamp seeks the video.

let currentLecture: string | null = null;
let currentPosition = 0;
const seekListeners = new Set<(sec: number) => void>();

export const playback = {
  report(lectureId: string, positionSec: number): void {
    currentLecture = lectureId;
    currentPosition = positionSec;
  },
  /** Current position in the given lecture, or 0 if it isn't the one playing. */
  position(lectureId: string): number {
    return currentLecture === lectureId ? Math.floor(currentPosition) : 0;
  },
  seek(positionSec: number): void {
    for (const listener of seekListeners) listener(positionSec);
  },
  onSeek(listener: (sec: number) => void): () => void {
    seekListeners.add(listener);
    return () => {
      seekListeners.delete(listener);
    };
  },
};
