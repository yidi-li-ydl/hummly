export const hummiStates = {
  "curious-listening": { src: "/mascot/hummi/curious-listening.webp", alt: "Hummi leans in to listen to your melody", motion: "listen" },
  unhappy: { src: "/mascot/hummi/unhappy.webp", alt: "Hummi looks a little disappointed", motion: "breathe" },
  singing: { src: "/mascot/hummi/singing-microphone-v1.webp", alt: "Hummi sings into a handheld microphone with eyes closed", motion: "breathe" },
  dancing: { src: "/mascot/hummi/dancing.webp", alt: "Hummi dances to celebrate your song", motion: "dance" },
  "group-dance": { src: "/mascot/hummi/group-dance.webp", alt: "Four Hummis dance together, connected by two musical beams", motion: "dance" },
  "cool-sunglasses": { src: "/mascot/hummi/cool-sunglasses.webp", alt: "Hummi wears sunglasses with a playful smile", motion: "breathe" },
  headphones: { src: "/mascot/hummi/headphones.webp", alt: "Hummi enjoys music through headphones", motion: "sway" },
  dj: { src: "/mascot/hummi/dj.webp", alt: "Hummi plays a miniature DJ turntable", motion: "breathe" },
} as const;

export type HummiState = keyof typeof hummiStates;
