package expo.modules.glow

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.FileInputStream
import java.io.FileNotFoundException
import java.io.InputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class GlowModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("Glow")

    Function("fromEmoji") { emoji: String ->
      GlowExtractor.colorsFromEmoji(emoji)
    }

    AsyncFunction("fromImage") { uri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      GlowExtractor.colorsFromImage(context.contentResolver, uri)
    }
  }
}

/**
 * Up-to-two dominant hues (`#RRGGBB`, most-present first) of a source, by
 * rasterizing it into a small bitmap and histogramming its colors — the Android
 * counterpart to the iOS `GlowExtractor`, kept algorithmically identical. A
 * glyph and a photo fill the same bitmap and run through the same buckets.
 */
private object GlowExtractor {
  private const val SIDE = 24

  /** A photo is never subsampled below this on its short side; the histogram only reads SIDE. */
  private const val DECODE_MIN = SIDE * 4

  fun colorsFromEmoji(emoji: String): List<String> {
    val bitmap = Bitmap.createBitmap(SIDE, SIDE, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)
    val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      textSize = SIDE * 0.85f
      textAlign = Paint.Align.CENTER
    }
    val metrics = paint.fontMetrics
    val baseline = SIDE / 2f - (metrics.ascent + metrics.descent) / 2f
    canvas.drawText(emoji, SIDE / 2f, baseline, paint)
    return histogram(bitmap)
  }

  fun colorsFromImage(resolver: ContentResolver, uri: String): List<String> {
    val bitmap = loadBitmap(resolver, uri) ?: return emptyList()
    val scaled = Bitmap.createScaledBitmap(bitmap, SIDE, SIDE, true)
    if (scaled !== bitmap) bitmap.recycle()
    return histogram(scaled)
  }

  private fun histogram(bitmap: Bitmap): List<String> {
    val buckets = 12
    val weight = DoubleArray(buckets)
    val sumR = DoubleArray(buckets)
    val sumG = DoubleArray(buckets)
    val sumB = DoubleArray(buckets)

    val pixels = IntArray(bitmap.width * bitmap.height)
    bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)

    for (pixel in pixels) {
      // getPixels returns straight (non-premultiplied) ARGB, so no divide-by-alpha.
      val a = Color.alpha(pixel) / 255.0
      if (a <= 0.5) continue
      val r = Color.red(pixel) / 255.0
      val g = Color.green(pixel) / 255.0
      val b = Color.blue(pixel) / 255.0

      val hi = max(r, max(g, b))
      val lo = min(r, min(g, b))
      val saturation = if (hi == 0.0) 0.0 else (hi - lo) / hi
      if (saturation <= 0.15 || hi <= 0.15) continue

      val delta = hi - lo
      var hue = when {
        delta == 0.0 -> 0.0
        hi == r -> ((g - b) / delta) % 6.0
        hi == g -> (b - r) / delta + 2
        else -> (r - g) / delta + 4
      }
      hue = (hue / 6 + 1) % 1.0

      val bucket = min((hue * buckets).toInt(), buckets - 1)
      val w = saturation * a
      weight[bucket] += w
      sumR[bucket] += r * w
      sumG[bucket] += g * w
      sumB[bucket] += b * w
    }

    return (0 until buckets)
      .filter { weight[it] > 0 }
      .sortedByDescending { weight[it] }
      .take(2)
      .map { bucket ->
        val mr = (sumR[bucket] / weight[bucket] * 255).roundToInt()
        val mg = (sumG[bucket] / weight[bucket] * 255).roundToInt()
        val mb = (sumB[bucket] / weight[bucket] * 255).roundToInt()
        String.format("#%02X%02X%02X", mr, mg, mb)
      }
  }

  /**
   * Decodes a `content://` or `file://` URI, or a bare path, subsampled by the
   * largest power of two that doesn't take either side below [DECODE_MIN]. A
   * photo already smaller than that decodes at its own size. The
   * histogram reads a SIDE × SIDE copy, so a 100 MP photo never needs its
   * full-size bitmap (about 400 MB) in memory.
   */
  private fun loadBitmap(resolver: ContentResolver, uri: String): Bitmap? {
    return try {
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      open(resolver, uri).use { BitmapFactory.decodeStream(it, null, bounds) }
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

      val options = BitmapFactory.Options().apply {
        inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight)
      }
      open(resolver, uri).use { BitmapFactory.decodeStream(it, null, options) }
    } catch (e: Exception) {
      null
    }
  }

  private fun open(resolver: ContentResolver, uri: String): InputStream {
    val parsed = Uri.parse(uri)
    if (parsed.scheme == null) return FileInputStream(uri)
    return resolver.openInputStream(parsed) ?: throw FileNotFoundException(uri)
  }

  private fun sampleSize(width: Int, height: Int): Int {
    var sample = 1
    while (width / (sample * 2) >= DECODE_MIN && height / (sample * 2) >= DECODE_MIN) {
      sample *= 2
    }
    return sample
  }
}
