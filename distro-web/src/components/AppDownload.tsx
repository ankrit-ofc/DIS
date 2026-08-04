import Image from "next/image";

/**
 * "Get the app" — official Google Play badge plus an honest iOS placeholder.
 *
 * Two rules drive the markup:
 *
 * 1. **The Play badge is Google's artwork, unmodified.** Their brand guidelines
 *    require the supplied badge rather than a redrawn lookalike, and forbid
 *    cropping or recolouring it. `public/google-play-badge.png` is the official
 *    en_us generic badge; its transparent margin IS the mandated clear space,
 *    so nothing may be layered into it — hence no wrapper background or border
 *    on the anchor itself.
 *
 * 2. **iOS is not published, so it is not a link.** A greyed-out Apple badge or
 *    an `href="#"` both promise a store page that does not exist; the previous
 *    markup did exactly that on the landing page and in the footer. Plain text
 *    in the same visual family states the position without pretending to be
 *    tappable, and is invisible to keyboard and screen-reader users as an
 *    interactive control because it is a <span>, not an <a> or <button>.
 */

const PLAY_URL = "https://play.google.com/store/apps/details?id=com.distronepal.app";

/** Rendered width of the badge in px. Height follows the 646×250 aspect ratio. */
const SIZES = {
  sm: { w: 135, h: 52 },
  md: { w: 155, h: 60 },
} as const;

export type AppDownloadSize = keyof typeof SIZES;

interface AppDownloadProps {
  size?: AppDownloadSize;
  /** Stack vertically instead of side by side. Footer columns are narrow. */
  vertical?: boolean;
  className?: string;
}

export default function AppDownload({
  size = "md",
  vertical = false,
  className = "",
}: AppDownloadProps) {
  const { w, h } = SIZES[size];

  return (
    <div
      className={[
        "flex gap-3",
        // Emit exactly one alignment class — listing both `items-center` and
        // `items-start` lets CSS source order decide, which silently centred
        // the footer's stacked badge instead of aligning it to the column.
        vertical ? "flex-col items-start" : "flex-row flex-wrap items-center",
        className,
      ].join(" ")}
    >
      <a
        href={PLAY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Get DISTRO on Google Play (opens in a new tab)"
        className="inline-block shrink-0 rounded-lg transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--blue)]"
      >
        <Image
          src="/google-play-badge.png"
          alt="Get it on Google Play"
          width={w}
          height={h}
          // The badge is fixed artwork, not content — never let it upscale past
          // its natural size or Google's proportions stop being Google's.
          style={{ width: w, height: "auto" }}
          unoptimized
        />
      </a>

      <span
        className="inline-flex shrink-0 select-none items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-jakarta text-[12px] font-medium leading-none text-gray-500"
        style={{ minHeight: size === "sm" ? 38 : 42 }}
      >
        <AppleGlyph className="h-3.5 w-3.5 shrink-0 opacity-60" />
        iOS — coming soon
      </span>
    </div>
  );
}

/**
 * Apple's logo mark, used only as a platform indicator alongside text. This is
 * NOT the "Download on the App Store" badge — that artwork is reserved for a
 * live store link, which is exactly what we do not have yet.
 */
function AppleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}
