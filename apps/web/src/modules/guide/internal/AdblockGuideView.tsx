import { useState } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

interface PlatformGuide {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  recommendations: Array<{
    name: string;
    description: string;
    steps?: string[];
    link?: { label: string; url: string };
  }>;
}

const GUIDES: PlatformGuide[] = [
  {
    id: 'desktop',
    title: 'Desktop',
    icon: Monitor,
    description: 'Setup instructions for Google Chrome, Mozilla Firefox, Microsoft Edge, and Brave Browser.',
    recommendations: [
      {
        name: 'uBlock Origin (Recommended)',
        description:
          'The premier open-source wide-spectrum content blocker. Highly efficient with minimal memory footprint.',
        steps: [
          'Install uBlock Origin from your browser’s extension web store (Chrome Web Store, Firefox Add-ons, or Edge Add-ons).',
          'Once installed, the shield icon will appear in your browser toolbar.',
          'Keep default filter lists active for comprehensive ad and popup blocking.',
        ],
        link: {
          label: 'Visit uBlock Origin project',
          url: 'https://ublockorigin.com/',
        },
      },
      {
        name: 'Brave Browser',
        description:
          'Brave comes with built-in Brave Shields that automatically block trackers and aggressive video popups out-of-the-box.',
        steps: [
          'Download and launch Brave Browser.',
          'Brave Shields are enabled by default (Standard or Aggressive blocking mode).',
        ],
        link: {
          label: 'Download Brave',
          url: 'https://brave.com/',
        },
      },
      {
        name: 'Firefox / Chrome / Edge Setup',
        description:
          'For Google Chrome, Mozilla Firefox, and Microsoft Edge, simply install uBlock Origin from the respective extension store.',
      },
    ],
  },
  {
    id: 'android',
    title: 'Android',
    icon: Smartphone,
    description: 'Recommendations for Android devices including mobile browsers and system-wide private DNS.',
    recommendations: [
      {
        name: 'Brave Browser for Android',
        description:
          'The simplest approach: built-in Shields block video popups and redirects without installing any extensions.',
        steps: [
          'Install Brave from Google Play Store.',
          'Open the app and browse directly with Shields enabled.',
        ],
      },
      {
        name: 'Firefox for Android + uBlock Origin',
        description:
          'Firefox Mobile supports full desktop-class browser extensions on Android.',
        steps: [
          'Install Firefox from Google Play Store.',
          'Open Firefox Settings -> Add-ons Manager.',
          'Tap the "+" icon next to uBlock Origin to install it.',
        ],
      },
      {
        name: 'AdGuard Private DNS (System-wide)',
        description:
          'Blocks ads and malicious redirect domains at the network level across all browsers and apps without installing third-party software.',
        steps: [
          'Go to Android Settings -> Network & Internet (or Connections) -> More Connection Settings.',
          'Select Private DNS -> Private DNS provider hostname.',
          'Enter dns.adguard-dns.com and tap Save.',
        ],
      },
    ],
  },
  {
    id: 'ios',
    title: 'iOS & iPadOS',
    icon: Tablet,
    description: 'Recommendations for iPhone and iPad devices using Safari or dedicated privacy browsers.',
    recommendations: [
      {
        name: 'Brave Browser for iOS',
        description:
          'Built-in tracker and popup blocking engine that works effortlessly on iOS.',
        steps: [
          'Install Brave from the Apple App Store.',
          'Browse directly with Shields active.',
        ],
      },
      {
        name: 'Safari Content Blockers (AdGuard / 1Blocker)',
        description:
          'Integrate native content blocking directly into Apple Safari.',
        steps: [
          'Install AdGuard for Safari or 1Blocker from the App Store.',
          'Open iOS Settings -> Safari -> Extensions (or Content Blockers).',
          'Toggle ON all enabled filter lists for your chosen ad blocker.',
        ],
      },
    ],
  },
];

export function AdblockGuideView() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    desktop: false,
    android: false,
    ios: false,
  });

  const toggleSection = (id: string) => {
    setExpanded((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--fg)] p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-card border border-c rounded p-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded bg-primary/10 text-primary">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Adblock Setup Guide</h1>
              <p className="text-xs mono text-muted mt-0.5">DOCS_REF: GUIDE-ADB-01</p>
            </div>
          </div>
          <p className="text-sm text-muted mt-3 leading-relaxed">
            Third-party video mirrors and embed providers often attempt to open intrusive popup windows or redirect your browser during playback. Setting up an ad blocker eliminates these disruptions and provides a clean, continuous streaming experience.
          </p>
        </div>

        {/* Platform Cards */}
        <div className="space-y-4">
          {GUIDES.map((guide) => {
            const isExpanded = !!expanded[guide.id];
            const Icon = guide.icon;

            return (
              <div key={guide.id} className="bg-card border border-c rounded overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleSection(guide.id)}
                  aria-expanded={isExpanded}
                  className="w-full px-4 py-3 border-b border-c flex items-center justify-between hover-bg text-left transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-primary" />
                    <div>
                      <h2 className="text-sm font-medium">{guide.title}</h2>
                      <p className="text-xs text-muted mt-0.5">{guide.description}</p>
                    </div>
                  </div>
                  <div className="text-muted p-1">
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4" />
                    ) : (
                      <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </button>

                {isExpanded && (
                  <div className="p-4 md:p-5 space-y-4">
                    {guide.recommendations.map((rec) => (
                      <div
                        key={rec.name}
                        className="border border-c rounded p-4 bg-[var(--bg)]/50 space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-medium text-[var(--fg)] flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                            <span>{rec.name}</span>
                          </h3>
                          {rec.link && (
                            <a
                              href={rec.link.url}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="inline-flex items-center gap-1 text-xs mono text-primary hover:underline shrink-0"
                            >
                              <span>{rec.link.label}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        <p className="text-xs text-muted leading-relaxed">{rec.description}</p>

                        {rec.steps && rec.steps.length > 0 && (
                          <div className="pt-2 border-t border-c/60">
                            <p className="text-[11px] mono uppercase text-muted mb-2 tracking-wider">
                              Steps to configure:
                            </p>
                            <ol className="space-y-1.5 pl-4 list-decimal text-xs text-muted">
                              {rec.steps.map((step, idx) => (
                                <li key={idx} className="leading-relaxed">
                                  {step}
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
