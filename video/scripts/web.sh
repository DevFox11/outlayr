#!/bin/sh
set -eu

out="../apps/web/public/videos"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$out"

npx remotion bundle --out-dir "$work/bundle" --log=error

film() {
    id="$1"
    poster="$2"
    crf="$3"
    npx remotion render "$work/bundle" "$id" "$work/$id.mp4" --codec=h264 --crf=8 --image-format=png --color-space=bt709 --log=error
    ffmpeg -v error -y -i "$work/$id.mp4" -an -c:v libx264 -preset veryslow -tune animation -crf "$crf" \
        -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
        -movflags +faststart "$out/$id.mp4"
    npx remotion still "$work/bundle" "$id" "$work/$id.png" --frame="$poster" --image-format=png --log=error
    magick "$work/$id.png" -resize 1080x -quality 84 "$out/$id.webp"
}

for mode in light dark; do
    for cut in "$mode" "$mode-es"; do
        film "chaos-$cut" 90 21
        film "capture-$cut" 276 18
        film "sorted-$cut" 372 19
        film "month-$cut" 300 18
    done
done
out="out"
mkdir -p "$out"
film promo-dark 468 20
