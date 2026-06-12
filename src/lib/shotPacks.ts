/**
 * Cinematic shot matrix: categories, shot types, and prompt suffixes from
 * "Cinematic Shot Types Matrix" (Google Sheets, user-provided).
 * https://docs.google.com/spreadsheets/d/1MFsHt3Eg6awUQG0qLHYObWtOcj95E3uMclVZHLmJKdc/edit?usp=sharing
 *
 * `presetPrompt` is the sheet’s "Prompt Suffix" column, merged with the internal style anchor at batch time.
 */
export type ShotDef = {
  id: string
  label: string
  /** From the sheet’s Description column; shown in the UI, not the model unless you add it. */
  description: string
  /** Sheet "Prompt Suffix" — model-facing fragment with the style anchor. */
  presetPrompt: string
}

export type ShotPack = {
  id: string
  title: string
  description: string
  shots: ShotDef[]
}

export const SHOT_PACKS: ShotPack[] = [
  {
    id: 'cinematic',
    title: 'Cinematic',
    description: 'Framing and interaction: singles, OTS, POV, angles.',
    shots: [
      {
        id: 'single-shot',
        label: 'Single shot',
        description: 'A shot that focuses on one person or subject.',
        presetPrompt: 'single shot focus on subject',
      },
      {
        id: 'two-shot',
        label: 'Two-shot',
        description: 'A shot containing two people or subjects in the same frame.',
        presetPrompt: 'two-shot interaction',
      },
      {
        id: 'three-shot',
        label: 'Three-shot',
        description: 'A shot containing three people or subjects.',
        presetPrompt: 'three-shot group interaction',
      },
      {
        id: 'ots',
        label: 'Over-the-Shoulder (OTS)',
        description: "Looking over one person's shoulder at another.",
        presetPrompt: 'over the shoulder view',
      },
      {
        id: 'oth',
        label: 'Over-the-Hip (OTH)',
        description: 'Looking from the hip level of one subject toward another.',
        presetPrompt: 'over the hip view',
      },
      {
        id: 'pov',
        label: 'Point of View (POV)',
        description: 'Camera represents the eyes of the subject.',
        presetPrompt: 'POV point of view shot',
      },
      {
        id: 'reaction',
        label: 'Reaction shot',
        description: "Focus on the subject's face responding to an event.",
        presetPrompt: 'close-up reaction shot',
      },
      {
        id: 'frontal',
        label: 'Frontal view',
        description: 'Camera is directly in front of the subject.',
        presetPrompt: 'frontal view direct shot',
      },
      {
        id: 'profile',
        label: 'Profile view',
        description: 'Subject is viewed from the side (90-degree angle).',
        presetPrompt: 'profile view side shot',
      },
      {
        id: 'three-quarter',
        label: 'Three-quarter view',
        description: 'Subject is at a 45-degree angle from the camera.',
        presetPrompt: 'three-quarter view portrait',
      },
      {
        id: 'rear',
        label: 'Rear view',
        description: 'Camera is positioned directly behind the subject.',
        presetPrompt: 'rear view from behind',
      },
    ],
  },
  {
    id: 'detail',
    title: 'Detail',
    description: 'Shot scale: choker through full, inserts, and Italian shot.',
    shots: [
      {
        id: 'ecu',
        label: 'Extreme close-up (ECU)',
        description: 'Focus on a single tiny detail like an eye or a tool part.',
        presetPrompt: 'extreme close-up detail',
      },
      {
        id: 'choker',
        label: 'Choker',
        description: 'Framed from the neck to the top of the head.',
        presetPrompt: 'choker shot head focus',
      },
      {
        id: 'cu',
        label: 'Close-up (CU)',
        description: 'Framed from the shoulders up.',
        presetPrompt: 'close-up portrait',
      },
      {
        id: 'mcu',
        label: 'Medium close-up (MCU)',
        description: 'Framed from the chest up.',
        presetPrompt: 'medium close-up',
      },
      {
        id: 'ms',
        label: 'Medium shot (MS)',
        description: 'Framed from the waist up.',
        presetPrompt: 'medium shot waist up',
      },
      {
        id: 'mls',
        label: 'Medium long shot (MLS)',
        description: 'Framed from the knees up.',
        presetPrompt: 'medium long shot knees up',
      },
      {
        id: 'cowboy',
        label: 'Cowboy shot',
        description: 'Framed from mid-thigh up (modern western style).',
        presetPrompt: 'cowboy shot mid-thigh up',
      },
      {
        id: 'fs',
        label: 'Full shot (FS)',
        description: 'The entire subject fills the frame from head to toe.',
        presetPrompt: 'full shot entire body',
      },
      {
        id: 'insert',
        label: 'Insert shot',
        description: 'A specific shot showing an object or tool in detail.',
        presetPrompt: 'insert shot of object',
      },
      {
        id: 'italian',
        label: 'Italian shot',
        description: 'Extreme horizontal close-up focusing only on eyes.',
        presetPrompt: 'italian shot focus on eyes',
      },
    ],
  },
  {
    id: 'context',
    title: 'Context',
    description: 'Environment, height, and lens attitude (wide, aerial, Dutch, etc.).',
    shots: [
      {
        id: 'establishing',
        label: 'Establishing shot',
        description: 'Wide shot showing the location or environment.',
        presetPrompt: 'establishing shot location view',
      },
      {
        id: 'ws',
        label: 'Wide shot (WS)',
        description: 'Subject is fully visible within their environment.',
        presetPrompt: 'wide shot environment',
      },
      {
        id: 'ews',
        label: 'Extreme wide shot (EWS)',
        description: 'Subject is very small; focus is on the vast landscape.',
        presetPrompt: 'extreme wide shot landscape',
      },
      {
        id: 'aerial',
        label: 'Aerial shot',
        description: 'High-altitude view looking down from a drone.',
        presetPrompt: 'aerial drone view',
      },
      {
        id: 'birds-eye',
        label: "Bird's eye",
        description: 'Directly overhead view looking straight down.',
        presetPrompt: "bird's eye view from above",
      },
      {
        id: 'ground-level',
        label: 'Ground level',
        description: 'Camera is placed on the floor looking forward.',
        presetPrompt: 'ground level camera angle',
      },
      {
        id: 'worms-eye',
        label: "Worm's eye",
        description: 'From the ground level looking straight up.',
        presetPrompt: "worm's eye view looking up",
      },
      {
        id: 'dutch',
        label: 'Dutch angle',
        description: 'Camera is tilted sideways to create a slanted horizon.',
        presetPrompt: 'dutch angle tilted view',
      },
      {
        id: 'eye-level',
        label: 'Eye level',
        description: "Standard neutral perspective at the subject's eye height.",
        presetPrompt: 'eye level neutral shot',
      },
      {
        id: 'high-angle',
        label: 'High angle',
        description: 'Looking down on the subject from a high point.',
        presetPrompt: 'high angle looking down',
      },
      {
        id: 'low-angle',
        label: 'Low angle',
        description: 'Looking up at the subject from a low point.',
        presetPrompt: 'low angle looking up',
      },
    ],
  },
  {
    id: 'pedagogy',
    title: 'Pedagogy',
    description: 'Instructional and diagram-style shots (hands, flat-lay, cutaways).',
    shots: [
      {
        id: 'hand-focus',
        label: 'Hand-focus shot',
        description: 'Close focus on hands performing a task.',
        presetPrompt: 'close-up focus on hands',
      },
      {
        id: 'shoulder-level',
        label: 'Shoulder-level shot',
        description: "Camera height fixed at the subject's shoulder.",
        presetPrompt: 'shoulder-level camera angle',
      },
      {
        id: 'hip-level',
        label: 'Hip-level shot',
        description: "Camera height fixed at the subject's hip.",
        presetPrompt: 'hip-level camera angle',
      },
      {
        id: 'knee-level',
        label: 'Knee-level shot',
        description: "Camera height fixed at the subject's knee.",
        presetPrompt: 'knee-level camera angle',
      },
      {
        id: 'user-perspective',
        label: 'User perspective',
        description: 'Specifically angled to show "how-to" actions from user POV.',
        presetPrompt: 'user perspective manual task',
      },
      {
        id: 'flat-lay',
        label: 'Flat-lay',
        description: 'Top-down organized layout of items on a surface.',
        presetPrompt: 'flat-lay organized items',
      },
      {
        id: 'cut-in',
        label: 'Cut-in',
        description: 'A closer shot of something already in the main scene.',
        presetPrompt: 'cut-in close-up detail',
      },
      {
        id: 'cutaway',
        label: 'Cutaway',
        description: 'A shot of something related but outside the main action.',
        presetPrompt: 'cutaway shot of related detail',
      },
    ],
  },
  {
    id: 'technical',
    title: 'Technical',
    description: 'Lighting and depth cues (bokeh, rim, high/low key).',
    shots: [
      {
        id: 'deep-focus',
        label: 'Deep focus',
        description: 'Ensures everything from foreground to background is sharp.',
        presetPrompt: 'deep focus high depth of field',
      },
      {
        id: 'shallow-focus',
        label: 'Shallow focus',
        description: 'Subject is sharp while background is blurred (bokeh).',
        presetPrompt: 'shallow focus bokeh background',
      },
      {
        id: 'rim-light',
        label: 'Rim light profile',
        description: 'Focus on the highlighted outline/silhouette of the subject.',
        presetPrompt: 'rim light silhouette profile',
      },
      {
        id: 'silhouette',
        label: 'Silhouette',
        description: 'Subject is dark against a bright light source.',
        presetPrompt: 'silhouette against bright light',
      },
      {
        id: 'high-key',
        label: 'High-key',
        description: 'Bright and clean with minimal shadows.',
        presetPrompt: 'high-key lighting bright clean',
      },
      {
        id: 'low-key',
        label: 'Low-key',
        description: 'Moody and dramatic with heavy shadows.',
        presetPrompt: 'low-key lighting dramatic shadows',
      },
    ],
  },
]

export function shotKey(packId: string, shotId: string): string {
  return `${packId}:${shotId}`
}

export function parseShotKey(key: string): { packId: string; shotId: string } | null {
  const i = key.indexOf(':')
  if (i <= 0) return null
  return { packId: key.slice(0, i), shotId: key.slice(i + 1) }
}
