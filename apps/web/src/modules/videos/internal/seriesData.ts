export interface Episode {
  id: string;
  title: string;
  description: string;
  duration: string;
  source: string;
  resolution: string;
  format: string;
  size: string;
  createdAt: string;
  tags: string[];
}

export interface Series {
  id: string;
  title: string;
  description: string;
  episodes: Episode[];
}

export const MOCK_SERIES: Series[] = [
  {
    id: 'deep-modules',
    title: 'Deep Modules',
    description:
      'A curated playlist covering the Deep Modules architecture and its practical application across the monorepo.',
    episodes: [
      {
        id: 'dm-01',
        title: 'Intro to Deep Modules',
        description:
          'Learn the core concepts of Deep Modules architecture, public entrypoints, and strict boundary enforcement across package features.',
        duration: '12:34',
        source: 'Internal Storage',
        resolution: '4K (3840x2160)',
        format: 'MP4 / H.264',
        size: '450 MB',
        createdAt: '2026-08-10',
        tags: ['Architecture', 'Core'],
      },
      {
        id: 'dm-02',
        title: 'Architecture Overview',
        description:
          'A deep dive into monorepo boundaries, thin composition roots, and modular isolation patterns in modern fullstack web apps.',
        duration: '08:15',
        source: 'S3 Bucket',
        resolution: '1080p (1920x1080)',
        format: 'WebM / VP9',
        size: '280 MB',
        createdAt: '2026-08-11',
        tags: ['Overview', 'Monorepo'],
      },
      {
        id: 'dm-03',
        title: 'TanStack Router Setup',
        description:
          'Step-by-step guide to file-based routing and composition roots using TanStack React Router and Vite plugins.',
        duration: '15:42',
        source: 'Vimeo',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '520 MB',
        createdAt: '2026-08-12',
        tags: ['Routing', 'React'],
      },
    ],
  },
  {
    id: 'state-ui',
    title: 'State & UI',
    description:
      'Episodes focused on state encapsulation and the Structured Console design system.',
    episodes: [
      {
        id: 'su-01',
        title: 'Zustand State Encapsulation',
        description:
          'Encapsulating store state inside internal feature module directories for clean, uncoupled state management.',
        duration: '06:50',
        source: 'YouTube',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '190 MB',
        createdAt: '2026-08-13',
        tags: ['State', 'Zustand'],
      },
      {
        id: 'su-02',
        title: 'Structured Console Design System',
        description:
          'Implementing dense developer-facing UI components adhering strictly to design tokens and custom CSS variables.',
        duration: '10:05',
        source: 'CDN Storage',
        resolution: '4K (3840x2160)',
        format: 'MP4 / AV1',
        size: '340 MB',
        createdAt: '2026-08-14',
        tags: ['UI', 'Design'],
      },
    ],
  },
  {
    id: 'mushoku-tensei',
    title: 'Mushoku Tensei',
    description:
      'A 34-year-old NEET dies and is reincarnated into a world of magic, vowing to live his new life without regrets.',
    episodes: [
      {
        id: 'mt-01',
        title: 'Mushoku Tensei — Season 2 Episode 12',
        description: 'Rudeus continues his journey of self-discovery and magical training.',
        duration: '24:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '350 MB',
        createdAt: '2025-07-12',
        tags: ['Fantasy', 'Adventure'],
      },
      {
        id: 'mt-02',
        title: 'Mushoku Tensei — Season 2 Episode 13',
        description: 'New challenges arise as Rudeus faces the consequences of his past.',
        duration: '24:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '350 MB',
        createdAt: '2025-07-19',
        tags: ['Fantasy', 'Adventure'],
      },
    ],
  },
  {
    id: 'one-punch-man',
    title: 'One Punch Man',
    description:
      'The strongest hero, Saitama, can defeat any enemy with a single punch — and he\'s bored by it.',
    episodes: [
      {
        id: 'opm-01',
        title: 'One Punch Man — Season 2 Episode 12',
        description: 'Saitama and Genos face new threats in the Hero Association.',
        duration: '24:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '340 MB',
        createdAt: '2025-06-10',
        tags: ['Action', 'Comedy'],
      },
      {
        id: 'opm-02',
        title: 'One Punch Man — Season 2 Episode 13',
        description: 'The season finale brings epic battles and unexpected twists.',
        duration: '24:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '340 MB',
        createdAt: '2025-06-17',
        tags: ['Action', 'Comedy'],
      },
    ],
  },
  {
    id: 'frieren',
    title: 'Sousou no Frieren',
    description:
      'An elf mage journeys through a world that has moved on after her adventuring party defeated the Demon King.',
    episodes: [
      {
        id: 'fr-01',
        title: 'Sousou no Frieren — Episode 28',
        description: 'Frieren reflects on her journey and the meaning of the bonds she has formed.',
        duration: '24:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '330 MB',
        createdAt: '2025-08-10',
        tags: ['Adventure', 'Fantasy'],
      },
    ],
  },
  {
    id: 'dungeon-meshi',
    title: 'Dungeon Meshi',
    description:
      'A party of adventurers must cook and eat monsters to survive a deep dungeon.',
    episodes: [
      {
        id: 'dm-04',
        title: 'Dungeon Meshi — Episode 24',
        description: 'The party discovers a new recipe as they delve deeper into the dungeon.',
        duration: '24:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '320 MB',
        createdAt: '2025-08-08',
        tags: ['Comedy', 'Fantasy'],
      },
    ],
  },
  {
    id: 'jujutsu-kaisen',
    title: 'Jujutsu Kaisen',
    description:
      'A boy swallows a cursed talisman and becomes entangled in the world of sorcerers and curses.',
    episodes: [
      {
        id: 'jk-01',
        title: 'Jujutsu Kaisen — Season 2 Episode 23',
        description: 'The Shibuya Incident arc reaches its climax with devastating consequences.',
        duration: '23:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '360 MB',
        createdAt: '2025-08-05',
        tags: ['Action', 'Supernatural'],
      },
    ],
  },
  {
    id: 'vinland-saga',
    title: 'Vinland Saga',
    description:
      'A young Viking seeks revenge against the man who killed his father in this epic historical saga.',
    episodes: [
      {
        id: 'vs-01',
        title: 'Vinland Saga — Season 2 Episode 24',
        description: 'Thorfinn confronts his past and the true meaning of a warrior.',
        duration: '25:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '370 MB',
        createdAt: '2025-08-03',
        tags: ['Action', 'Historical'],
      },
    ],
  },
  {
    id: 'aot',
    title: 'Attack on Titan',
    description:
      'Humanity fights for survival against man-eating giants in a world of walls and desperation.',
    episodes: [
      {
        id: 'aot-01',
        title: 'Attack on Titan — The Final Chapters',
        description: 'The epic conclusion to the battle for humanity\'s freedom.',
        duration: '2h 01m',
        source: 'otakudesu',
        resolution: '4K (3840x2160)',
        format: 'MP4 / H.265',
        size: '2.1 GB',
        createdAt: '2025-07-28',
        tags: ['Action', 'Drama'],
      },
    ],
  },
  {
    id: 'oshi-no-ko',
    title: 'Oshi no Ko',
    description:
      'A reincarnation drama set in the dark underbelly of the entertainment industry.',
    episodes: [
      {
        id: 'on-01',
        title: 'Oshi no Ko — Episode 11',
        description: 'Aqua and Ruby navigate the complexities of the entertainment world.',
        duration: '24:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '310 MB',
        createdAt: '2025-07-25',
        tags: ['Drama', 'Supernatural'],
      },
    ],
  },
  {
    id: 'one-piece',
    title: 'One Piece',
    description:
      'Monkey D. Luffy and his pirate crew search for the ultimate treasure, the One Piece.',
    episodes: [
      {
        id: 'op-01',
        title: 'One Piece — Episode 1092',
        description: 'The Straw Hat Pirates continue their adventure on Egghead Island.',
        duration: '24:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '340 MB',
        createdAt: '2025-07-22',
        tags: ['Adventure', 'Shounen'],
      },
    ],
  },
  {
    id: 'demon-slayer',
    title: 'Demon Slayer',
    description:
      'A boy becomes a demon slayer to avenge his family and cure his sister.',
    episodes: [
      {
        id: 'ds-01',
        title: 'Demon Slayer — Hashira Training Arc',
        description: 'Tanjiro undergoes rigorous training under the Hashira to prepare for the final battle.',
        duration: '26:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '380 MB',
        createdAt: '2025-07-18',
        tags: ['Action', 'Supernatural'],
      },
    ],
  },
  {
    id: 'spy-x-family',
    title: 'Spy x Family',
    description:
      'A spy, an assassin, and a telepath form a fake family for a top-secret mission.',
    episodes: [
      {
        id: 'sxf-01',
        title: 'Spy x Family — Season 3 Episode 1',
        description: 'The Forger family takes on a new mission that tests their bonds.',
        duration: '24:00',
        source: 'otakudesu',
        resolution: '1080p (1920x1080)',
        format: 'MP4 / H.264',
        size: '330 MB',
        createdAt: '2025-07-15',
        tags: ['Comedy', 'Action'],
      },
    ],
  },
];