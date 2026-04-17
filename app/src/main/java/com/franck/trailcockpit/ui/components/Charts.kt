package com.franck.trailcockpit.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.franck.trailcockpit.ui.theme.TrailColors
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

@Composable
fun ChartCard(
    title: String,
    modifier: Modifier = Modifier,
    minHeight: Dp = 180.dp,
    content: @Composable () -> Unit
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(TrailColors.CardBg)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(6.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp)
    ) {
        Text(
            text = title,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            color = TrailColors.Text
        )
        Spacer(Modifier.height(6.dp))
        Box(modifier = Modifier.fillMaxWidth().height(minHeight)) {
            content()
        }
    }
}

data class LineSeries(
    val label: String,
    val color: Color,
    val values: List<Double>,
    val strokeWidth: Float = 2f,
    val drawPoints: Boolean = true,
    val valueLabels: Boolean = false
)

@Composable
fun LineChart(
    xLabels: List<String>,
    series: List<LineSeries>,
    modifier: Modifier = Modifier,
    yTickCount: Int = 5,
    showXLabels: Boolean = true,
    xLabelEveryN: Int = 1,
    yMin: Double? = null,
    yMax: Double? = null
) {
    Canvas(modifier = modifier.fillMaxSize()) {
        val leftPad = 40f
        val rightPad = 10f
        val topPad = 18f
        val bottomPad = if (showXLabels) 44f else 12f
        val chartW = size.width - leftPad - rightPad
        val chartH = size.height - topPad - bottomPad

        val allValues = series.flatMap { it.values }
        if (allValues.isEmpty()) return@Canvas

        val rawMin = allValues.minOrNull() ?: 0.0
        val rawMax = allValues.maxOrNull() ?: 1.0
        val minV = yMin ?: min(rawMin, 0.0)
        val maxV = yMax ?: (if (rawMax == minV) rawMin + 1 else rawMax)
        val range = (maxV - minV).coerceAtLeast(0.0001)

        val gridColor = Color(0xFFE5E5E5)
        for (i in 0..yTickCount) {
            val y = topPad + chartH * i / yTickCount
            drawLine(gridColor, Offset(leftPad, y), Offset(size.width - rightPad, y), 1f)
            val value = maxV - (maxV - minV) * i / yTickCount
            drawTextNative(
                text = formatNum(value),
                x = leftPad - 4f,
                y = y + 4f,
                color = TrailColors.SubtleText,
                size = 10.sp.toPx(),
                alignRight = true
            )
        }

        val n = xLabels.size
        fun xAt(i: Int): Float =
            if (n <= 1) leftPad + chartW / 2
            else leftPad + chartW * i / (n - 1f)

        fun yAt(v: Double): Float =
            (topPad + chartH * (1 - (v - minV) / range)).toFloat()

        if (showXLabels) {
            for (i in xLabels.indices) {
                if ((i % xLabelEveryN == 0 || i == xLabels.lastIndex) && xLabels[i].isNotEmpty()) {
                    drawTextNative(
                        text = xLabels[i],
                        x = xAt(i),
                        y = topPad + chartH + 26f,
                        color = TrailColors.SubtleText,
                        size = 9.sp.toPx(),
                        rotate = -40f
                    )
                }
            }
        }

        for (s in series) {
            val path = Path()
            s.values.forEachIndexed { i, v ->
                val x = xAt(i)
                val y = yAt(v)
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path, s.color, style = Stroke(width = s.strokeWidth))

            if (s.drawPoints) {
                s.values.forEachIndexed { i, v ->
                    drawCircle(s.color, radius = 3f, center = Offset(xAt(i), yAt(v)))
                }
            }
            if (s.valueLabels) {
                s.values.forEachIndexed { i, v ->
                    drawTextNative(
                        text = formatNum(v),
                        x = xAt(i),
                        y = yAt(v) - 6f,
                        color = s.color,
                        size = 9.sp.toPx(),
                        alignCenter = true
                    )
                }
            }
        }
    }
}

@Composable
fun BarChart(
    xLabels: List<String>,
    values: List<Double>,
    color: Color,
    modifier: Modifier = Modifier,
    yTickCount: Int = 5,
    xLabelEveryN: Int = 1,
    showValueLabels: Boolean = true
) {
    Canvas(modifier = modifier.fillMaxSize()) {
        val leftPad = 40f
        val rightPad = 10f
        val topPad = 18f
        val bottomPad = 44f
        val chartW = size.width - leftPad - rightPad
        val chartH = size.height - topPad - bottomPad

        if (values.isEmpty()) return@Canvas
        val maxV = (values.maxOrNull() ?: 1.0).coerceAtLeast(1.0) * 1.15
        val minV = 0.0
        val range = maxV - minV

        val gridColor = Color(0xFFE5E5E5)
        for (i in 0..yTickCount) {
            val y = topPad + chartH * i / yTickCount
            drawLine(gridColor, Offset(leftPad, y), Offset(size.width - rightPad, y), 1f)
            val value = maxV - range * i / yTickCount
            drawTextNative(
                text = formatNum(value),
                x = leftPad - 4f,
                y = y + 4f,
                color = TrailColors.SubtleText,
                size = 10.sp.toPx(),
                alignRight = true
            )
        }

        val n = values.size
        val slot = chartW / n
        val barW = slot * 0.55f
        values.forEachIndexed { i, v ->
            val ratio = (v / maxV).toFloat()
            val h = (chartH * ratio).coerceAtLeast(0f)
            val x = leftPad + slot * i + (slot - barW) / 2
            val y = topPad + chartH - h
            drawRect(color = color, topLeft = Offset(x, y), size = Size(barW, h))
            if (showValueLabels && v > 0) {
                drawTextNative(
                    text = formatNum(v),
                    x = x + barW / 2,
                    y = y - 6f,
                    color = TrailColors.SubtleText,
                    size = 9.sp.toPx(),
                    alignCenter = true
                )
            }
        }

        for (i in xLabels.indices) {
            if ((i % xLabelEveryN == 0 || i == xLabels.lastIndex) && xLabels[i].isNotEmpty()) {
                drawTextNative(
                    text = xLabels[i],
                    x = leftPad + slot * i + slot / 2,
                    y = topPad + chartH + 26f,
                    color = TrailColors.SubtleText,
                    size = 9.sp.toPx(),
                    rotate = -40f
                )
            }
        }
    }
}

data class PieSlice(val label: String, val value: Double, val color: Color)

@Composable
fun PieChart(
    slices: List<PieSlice>,
    modifier: Modifier = Modifier
) {
    val total = slices.sumOf { it.value }.coerceAtLeast(0.0001)
    Row(
        modifier = modifier,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Canvas(
            modifier = Modifier
                .size(150.dp)
                .padding(4.dp)
        ) {
            var start = -90f
            val radius = min(size.width, size.height) / 2f
            val center = Offset(size.width / 2, size.height / 2)
            val strokeW = radius * 0.55f
            for (s in slices) {
                val sweep = (s.value / total * 360.0).toFloat()
                drawArc(
                    color = s.color,
                    startAngle = start,
                    sweepAngle = sweep,
                    useCenter = false,
                    style = Stroke(width = strokeW),
                    topLeft = Offset(center.x - radius + strokeW / 2, center.y - radius + strokeW / 2),
                    size = Size(2 * radius - strokeW, 2 * radius - strokeW)
                )
                val midAngle = Math.toRadians((start + sweep / 2f).toDouble())
                val labelR = radius - strokeW / 2f
                val lx = (center.x + labelR * cos(midAngle)).toFloat()
                val ly = (center.y + labelR * sin(midAngle)).toFloat()
                if (sweep > 12f) {
                    drawTextNative(
                        text = formatNum(s.value),
                        x = lx,
                        y = ly + 3f,
                        color = Color.White,
                        size = 10.sp.toPx(),
                        alignCenter = true
                    )
                }
                start += sweep
            }
        }
        Spacer(Modifier.width(8.dp))
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            for (s in slices) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier
                            .size(10.dp)
                            .clip(RoundedCornerShape(2.dp))
                            .background(s.color)
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(s.label, fontSize = 11.sp, color = TrailColors.Text)
                }
            }
        }
    }
}

private fun DrawScope.drawTextNative(
    text: String,
    x: Float,
    y: Float,
    color: Color,
    size: Float,
    alignRight: Boolean = false,
    alignCenter: Boolean = false,
    rotate: Float = 0f
) {
    val paint = android.graphics.Paint().apply {
        this.color = color.toArgb()
        this.textSize = size
        this.isAntiAlias = true
        this.textAlign = when {
            alignCenter -> android.graphics.Paint.Align.CENTER
            alignRight -> android.graphics.Paint.Align.RIGHT
            else -> android.graphics.Paint.Align.LEFT
        }
    }
    val canvas = drawContext.canvas.nativeCanvas
    if (rotate != 0f) {
        canvas.save()
        canvas.rotate(rotate, x, y)
        canvas.drawText(text, x, y, paint)
        canvas.restore()
    } else {
        canvas.drawText(text, x, y, paint)
    }
}

private fun formatNum(v: Double): String {
    val abs = kotlin.math.abs(v)
    return when {
        abs >= 1000 -> "%,.0f".format(v).replace(",", " ")
        abs >= 100 -> "%.0f".format(v)
        abs >= 10 -> "%.0f".format(v)
        abs >= 1 -> "%.1f".format(v)
        else -> "%.2f".format(v)
    }
}
