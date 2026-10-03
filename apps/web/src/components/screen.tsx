export function Screen({
    alt,
    className = "",
    pins,
    src,
}: {
    alt: string;
    className?: string;
    pins?: readonly number[];
    src: string;
}) {
    return (
        <figure className={`relative w-full max-w-[22rem] md:max-w-[19rem] 2xl:max-w-[21rem] ${className}`}>
            <img
                alt={alt}
                className="screen light-only"
                decoding="async"
                height={1912}
                loading="lazy"
                src={src}
                width={880}
            />
            <img
                alt={alt}
                className="screen dark-only"
                decoding="async"
                height={1912}
                loading="lazy"
                src={src.replace(/\.webp$/u, "-dark.webp")}
                width={880}
            />
            {pins?.map((y, index) => (
                <span
                    aria-hidden="true"
                    className="bg-tint text-background ring-background absolute left-0 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-mono text-xs font-medium ring-2"
                    key={y}
                    style={{ top: `${y}%` }}
                >
                    {index + 1}
                </span>
            ))}
        </figure>
    );
}
