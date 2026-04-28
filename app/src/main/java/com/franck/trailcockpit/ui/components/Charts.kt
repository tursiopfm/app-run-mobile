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
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.unit.sp
import com.franck.trailcockpit.R
import com.franck.trailcockpit.ui.theme.TrailColors
import java.text.NumberFormat
import java.util.Locale
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.sin

@Composable
fun ChartCard(
    title: String,
    modifier: Modifier = Modifier,
    minHeight: Dp = 180.dp,
    titleSlot: (@Composable () -> Unit)? = null,
    content: @Composable () -> Unit
) {
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(6.dp))
            .background(TrailColors.CardBg)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(6.dp))
            .padding(horizontal = 10.dp, vertical = 8.dp)
    ) {
        if (titleSlot != null) {
            titleSlot()
        } else {
            Text(
                text = title,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                color = TrailColors.Text
            )
        }
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
    val strokeWidth: Float = 4f,
    val drawPoints: Boolean = true,
    val valueLabels: Boolean = true,
    val valueLabelIndices: List<Int>? = null
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
    val subtleText = TrailColors.SubtleText
    val gridColor = TrailColors.Border.copy(alpha = 0.7f)
    Canvas(modifier = modifier.fillMaxSize()) {
        val leftPad = 40f
        val rightPad = 10f
        val topPad = 35f  // Increased from 18f for better top padding
        val bottomPad = if (showXLabels) 86f else 12f
        val chartW = size.width - leftPad - rightPad
        val chartH = size.height - topPad - bottomPad

        val allValues = series.flatMap { it.values }
        if (allValues.isEmpty()) return@Canvas

        val rawMin = allValues.minOrNull() ?: 0.0
        val rawMax = allValues.maxOrNull() ?: 1.0
        val minV = yMin ?: min(rawMin, 0.0)
        val rawMaxV = if (rawMax == minV) rawMin + 1 else rawMax
        val maxV = yMax ?: (rawMaxV * 1.25)  // Add 25% padding (increased from 15%)
        val range = (maxV - minV).coerceAtLeast(0.0001)

        for (i in 0..yTickCount) {
            val y = topPad + chartH * i / yTickCount
            drawLine(gridColor, Offset(leftPad, y), Offset(size.width - rightPad, y), 1f)
            val value = maxV - (maxV - minV) * i / yTickCount
            drawTextNative(
                text = formatNum(value),
                x = leftPad - 4f,
                y = y + 4f,
                color = subtleText,
                size = 13.sp.toPx(),
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
                        y = topPad + chartH + 68f,
                        color = subtleText,
                        size = 12.sp.toPx(),
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
                    drawCircle(s.color, radius = 5.5f, center = Offset(xAt(i), yAt(v)))
                }
            }
            if (s.valueLabels) {
                val indicesToShow = s.valueLabelIndices ?: s.values.indices.toList()
                indicesToShow.forEach { i ->
                    if (i < s.values.size) {
                        val v = s.values[i]
                        drawTextNative(
                            text = formatNum(v),
                            x = xAt(i),
                            y = yAt(v) - 6f,
                            color = s.color,
                            size = 13.sp.toPx(),
                            alignCenter = true,
                            bold = true
                        )
                    }
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
    val subtleText = TrailColors.SubtleText
    val gridColor = TrailColors.Border.copy(alpha = 0.7f)
    Canvas(modifier = modifier.fillMaxSize()) {
        val leftPad = 40f
        val rightPad = 10f
        val topPad = 18f
        val bottomPad = 86f
        val chartW = size.width - leftPad - rightPad
        val chartH = size.height - topPad - bottomPad

        if (values.isEmpty()) return@Canvas
        val maxV = (values.maxOrNull() ?: 1.0).coerceAtLeast(1.0) * 1.15
        val minV = 0.0
        val range = maxV - minV

        for (i in 0..yTickCount) {
            val y = topPad + chartH * i / yTickCount
            drawLine(gridColor, Offset(leftPad, y), Offset(size.width - rightPad, y), 1f)
            val value = maxV - range * i / yTickCount
            drawTextNative(
                text = formatNum(value),
                x = leftPad - 4f,
                y = y + 4f,
                color = subtleText,
                size = 13.sp.toPx(),
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
                    color = subtleText,
                    size = 12.sp.toPx(),
                    alignCenter = true
                )
            }
        }

        for (i in xLabels.indices) {
            if ((i % xLabelEveryN == 0 || i == xLabels.lastIndex) && xLabels[i].isNotEmpty()) {
                drawTextNative(
                    text = xLabels[i],
                    x = leftPad + slot * i + slot / 2,
                    y = topPad + chartH + 68f,
                    color = subtleText,
                    size = 12.sp.toPx(),
                    rotate = -40f
                )
            }
        }
    }
}

@Composable
fun BarChart(
    xLabels: List<String>,
    values: List<Double>,
    colors: List<Color>,
    modifier: Modifier = Modifier,
    yTickCount: Int = 5,
    xLabelEveryN: Int = 1,
    showValueLabels: Boolean = true,
    allowNegative: Boolean = false
) {
    val subtleText = TrailColors.SubtleText
    val gridColor = TrailColors.Border.copy(alpha = 0.7f)
    val defaultBarColor = TrailColors.SeriesYellow
    Canvas(modifier = modifier.fillMaxSize()) {
        val leftPad = 40f
        val rightPad = 10f
        val topPad = 18f
        val bottomPad = 86f
        val chartW = size.width - leftPad - rightPad
        val chartH = size.height - topPad - bottomPad

        if (values.isEmpty()) return@Canvas

        val maxV = if (allowNegative) {
            val absMax = maxOf(
                (values.maxOrNull() ?: 0.0).coerceAtLeast(0.0),
                kotlin.math.abs(values.minOrNull() ?: 0.0)
            )
            (absMax * 1.15).coerceAtLeast(1.0)
        } else {
            (values.maxOrNull() ?: 1.0).coerceAtLeast(1.0) * 1.15
        }
        val minV = if (allowNegative) -maxV else 0.0
        val range = maxV - minV

        for (i in 0..yTickCount) {
            val y = topPad + chartH * i / yTickCount
            drawLine(gridColor, Offset(leftPad, y), Offset(size.width - rightPad, y), 1f)
            val value = maxV - range * i / yTickCount
            drawTextNative(
                text = formatNum(value),
                x = leftPad - 4f,
                y = y + 4f,
                color = subtleText,
                size = 13.sp.toPx(),
                alignRight = true
            )
        }

        val n = values.size
        val slot = chartW / n
        val barW = slot * 0.55f
        values.forEachIndexed { i, v ->
            val ratio = (((v - minV) / range).coerceIn(0.0, 1.0)).toFloat()
            val h = (chartH * ratio).coerceAtLeast(0f)
            val x = leftPad + slot * i + (slot - barW) / 2
            val y = if (allowNegative && v < 0) {
                topPad + chartH * 0.5f + chartH * 0.5f * (1f - ratio)
            } else {
                topPad + chartH - h
            }
            val barColor = if (i < colors.size) colors[i] else defaultBarColor
            drawRect(color = barColor, topLeft = Offset(x, y), size = Size(barW, h))
            if (showValueLabels && kotlin.math.abs(v) > 0.1) {
                drawTextNative(
                    text = formatNum(v),
                    x = x + barW / 2,
                    y = y - 6f,
                    color = subtleText,
                    size = 12.sp.toPx(),
                    alignCenter = true
                )
            }
        }

        for (i in xLabels.indices) {
            if ((i % xLabelEveryN == 0 || i == xLabels.lastIndex) && xLabels[i].isNotEmpty()) {
                drawTextNative(
                    text = xLabels[i],
                    x = leftPad + slot * i + slot / 2,
                    y = topPad + chartH + 68f,
                    color = subtleText,
                    size = 12.sp.toPx(),
                    rotate = -40f
                )
            }
        }
    }
}

@Composable
fun ComboBarLineChart(
    xLabels: List<String>,
    barValues: List<Double>,
    lineValues: List<Double>,
    barColor: Color,
    lineColor: Color,
    modifier: Modifier = Modifier,
    xLabelEveryN: Int = 2
) {
    val subtleText = TrailColors.SubtleText
    val gridColor = TrailColors.Border.copy(alpha = 0.6f)
    Canvas(modifier = modifier.fillMaxSize()) {
        val leftPad = 40f
        val rightPad = 44f
        val topPad = 20f
        val bottomPad = 86f
        val chartW = size.width - leftPad - rightPad
        val chartH = size.height - topPad - bottomPad
        if (barValues.isEmpty() || lineValues.isEmpty()) return@Canvas
        val n = barValues.size

        val maxBar = (barValues.maxOrNull() ?: 1.0).coerceAtLeast(1.0) * 1.2
        val maxLine = (lineValues.maxOrNull() ?: 1.0).coerceAtLeast(1.0) * 1.2

        val yTickCount = 4
        for (i in 0..yTickCount) {
            val y = topPad + chartH * i / yTickCount
            drawLine(gridColor, Offset(leftPad, y), Offset(leftPad + chartW, y), 1f)
            val lineVal = maxLine * (1 - i.toDouble() / yTickCount)
            drawTextNative(text = formatNum(lineVal), x = leftPad - 4f, y = y + 4f,
                color = lineColor.copy(alpha = 0.7f), size = 12.sp.toPx(), alignRight = true, bold = true)
            val barVal = maxBar * (1 - i.toDouble() / yTickCount)
            drawTextNative(text = formatNum(barVal), x = leftPad + chartW + 4f, y = y + 4f,
                color = barColor.copy(alpha = 0.7f), size = 12.sp.toPx(), bold = true)
        }

        val slot = chartW / n
        val barW = slot * 0.45f

        val labelFontPx = 14.sp.toPx()
        barValues.forEachIndexed { i, v ->
            val ratio = (v / maxBar).toFloat()
            val h = (chartH * ratio).coerceAtLeast(0f)
            val x = leftPad + slot * i + (slot - barW) / 2
            val y = topPad + chartH - h
            drawRect(color = barColor.copy(alpha = 0.7f), topLeft = Offset(x, y), size = Size(barW, h))
            if (v > 0) {
                val insideBar = h >= labelFontPx * 2.2f
                val labelY = if (insideBar) y + h / 2 + labelFontPx / 2 else y - 4f
                drawTextNative(text = formatNum(v), x = x + barW / 2, y = labelY,
                    color = if (insideBar) Color.White else barColor, size = labelFontPx, alignCenter = true, bold = true)
            }
        }

        fun xAt(i: Int) = leftPad + slot * i + slot / 2
        fun yLineAt(v: Double) = (topPad + chartH * (1.0 - v / maxLine)).toFloat()

        val path = Path()
        lineValues.forEachIndexed { i, v ->
            val x = xAt(i); val y = yLineAt(v)
            if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        drawPath(path, lineColor, style = Stroke(width = 6f))

        lineValues.forEachIndexed { i, v ->
            val x = xAt(i); val y = yLineAt(v)
            drawCircle(lineColor, radius = 4f, center = Offset(x, y))
            if (v > 0) {
                val barV = barValues.getOrNull(i) ?: 0.0
                val barH = (chartH * (barV / maxBar).toFloat()).coerceAtLeast(0f)
                val barTop = topPad + chartH - barH
                val barInsideLabel = barH >= labelFontPx * 2.2f
                // barLabelBaseline = y baseline exacte telle que dessinée dans le bloc barValues
                val barLabelBaseline = if (barV > 0) {
                    if (barInsideLabel) barTop + barH / 2f + labelFontPx / 2f
                    else barTop - 4f
                } else Float.MAX_VALUE

                var lineLabelY = y - 11f
                if (barV > 0 && kotlin.math.abs(lineLabelY - barLabelBaseline) < labelFontPx * 1.8f) {
                    lineLabelY = minOf(lineLabelY, barLabelBaseline) - labelFontPx - 6f
                }
                drawTextNative(text = formatNum(v), x = x, y = lineLabelY,
                    color = lineColor, size = labelFontPx, alignCenter = true, bold = true)
            }
        }

        for (i in xLabels.indices) {
            if ((i % xLabelEveryN == 0 || i == xLabels.lastIndex) && xLabels[i].isNotEmpty()) {
                drawTextNative(text = xLabels[i], x = xAt(i), y = topPad + chartH + 70f,
                    color = subtleText, size = 13.sp.toPx(), alignCenter = true, rotate = -45f, bold = true)
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
                        size = 13.sp.toPx(),
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
                    Text(s.label, fontSize = 14.sp, color = TrailColors.Text)
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
    rotate: Float = 0f,
    bold: Boolean = false
) {
    val paint = android.graphics.Paint().apply {
        this.color = color.toArgb()
        this.textSize = size
        this.isAntiAlias = true
        this.isFakeBoldText = bold
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

@Composable
fun AreaChart(
    xLabels: List<String>,
    values: List<Double>,
    modifier: Modifier = Modifier,
    yTickCount: Int = 5,
    xLabelEveryN: Int = 1
) {
    if (values.isEmpty()) return

    // Calculate stats for optimal range
    val mean = values.average()
    val variance = values.map { (it - mean) * (it - mean) }.average()
    val stdDev = kotlin.math.sqrt(variance)
    val minOptimal = maxOf(0.0, mean - stdDev)
    val maxOptimal = mean + stdDev

    // Calculate chart bounds based on ACTUAL values, not just optimal range
    val actualMin = values.minOrNull() ?: 0.0
    val actualMax = values.maxOrNull() ?: 1.0
    val minValue = minOf(0.0, actualMin)
    val maxValue = actualMax * 1.3  // 30% padding above actual max

    val defaultBarColor = TrailColors.GreenOk
    val lineColor = TrailColors.Text
    val gridColor = TrailColors.SubtleText
    val subtleTextColor = TrailColors.SubtleText
    val optimalRangeLabel = stringResource(R.string.hr_zone_optimal_range)

    Box(modifier = modifier.fillMaxWidth()) {
        Canvas(modifier = Modifier.fillMaxWidth().height(192.dp)) {  // Maximum chart height
            val leftPad = 35.dp.toPx()
            val rightPad = 5.dp.toPx()
            val topPad = 16.dp.toPx()
            val bottomPad = 30.dp.toPx()  // Minimal padding for maximum chart space

            val chartWidth = size.width - leftPad - rightPad
            val chartHeight = size.height - topPad - bottomPad

            if (chartHeight <= 0 || chartWidth <= 0) return@Canvas

            val xStep = if (values.size <= 1) chartWidth / 2 else chartWidth / (values.size - 1)
            val range = (maxValue - minValue).coerceAtLeast(0.0001)

            fun valueToY(value: Double): Float {
                return (topPad + chartHeight - ((value - minValue) / range * chartHeight)).toFloat()
            }

            // Draw grid lines and Y-axis labels
            for (i in 0..yTickCount) {
                val ratio = i.toFloat() / yTickCount
                val y = topPad + chartHeight * (1 - ratio)
                val value = minValue + (maxValue - minValue) * ratio

                drawLine(
                    color = gridColor.copy(alpha = 0.5f),
                    start = Offset(leftPad, y),
                    end = Offset(leftPad + chartWidth, y),
                    strokeWidth = 0.5.dp.toPx()
                )

                drawTextNative(
                    formatNum(value),
                    leftPad - 8.dp.toPx(),
                    y + 4.dp.toPx(),
                    subtleTextColor,
                    13.sp.toPx(),  // Increased from 11.sp
                    alignRight = true
                )
            }

            // Draw axes
            drawLine(
                color = gridColor,
                start = Offset(leftPad, topPad),
                end = Offset(leftPad, topPad + chartHeight),
                strokeWidth = 1.dp.toPx()
            )
            drawLine(
                color = gridColor,
                start = Offset(leftPad, topPad + chartHeight),
                end = Offset(leftPad + chartWidth, topPad + chartHeight),
                strokeWidth = 1.dp.toPx()
            )

            // Draw optimal range as filled area
            val optimalTopY = valueToY(maxOptimal)
            val optimalBottomY = valueToY(minOptimal)

            val optimalPath = Path().apply {
                moveTo(leftPad, optimalBottomY)
                for (i in values.indices) {
                    val x = leftPad + i * xStep
                    lineTo(x, optimalTopY)
                }
                for (i in (values.size - 1) downTo 0) {
                    val x = leftPad + i * xStep
                    lineTo(x, optimalBottomY)
                }
                close()
            }
            drawPath(optimalPath, color = defaultBarColor.copy(alpha = 0.25f))

            // Draw line chart
            val linePath = Path()
            values.forEachIndexed { i, value ->
                val x = leftPad + i * xStep
                val y = valueToY(value)
                if (i == 0) linePath.moveTo(x, y) else linePath.lineTo(x, y)
            }
            drawPath(linePath, color = lineColor, style = Stroke(width = 2.5.dp.toPx()))

            // Draw points on line
            values.forEachIndexed { i, value ->
                val x = leftPad + i * xStep
                val y = valueToY(value)
                drawCircle(color = lineColor, radius = 3.5.dp.toPx(), center = Offset(x, y))
            }

            // Draw X-axis labels with filtering and rotation
            xLabels.forEachIndexed { i, label ->
                if (i % xLabelEveryN == 0) {  // Apply xLabelEveryN filtering
                    val x = leftPad + i * xStep
                    drawTextNative(
                        label,
                        x,
                        topPad + chartHeight + 21.dp.toPx(),  // Positioned below the chart
                        subtleTextColor,
                        13.sp.toPx(),  // Increased from 10.sp
                        alignCenter = true,
                        rotate = -45f  // Rotate labels by 45 degrees
                    )
                }
            }

            // Draw legend
            drawCircle(
                color = defaultBarColor.copy(alpha = 0.25f),
                radius = 4.dp.toPx(),
                center = Offset(leftPad + 20.dp.toPx(), topPad + 5.dp.toPx())
            )
            drawTextNative(
                optimalRangeLabel,
                leftPad + 32.dp.toPx(),
                topPad + 10.dp.toPx(),
                subtleTextColor,
                11.sp.toPx()
            )
        }
    }
}

private fun formatNum(v: Double): String {
    if (v == 0.0) return "0"
    val abs = kotlin.math.abs(v)
    val nf = NumberFormat.getInstance(Locale.getDefault())
    return when {
        abs >= 10 -> {
            nf.maximumFractionDigits = 0
            nf.minimumFractionDigits = 0
            nf.format(v)
        }
        abs >= 1 -> {
            nf.maximumFractionDigits = 1
            nf.minimumFractionDigits = 1
            nf.format(v)
        }
        else -> {
            nf.maximumFractionDigits = 2
            nf.minimumFractionDigits = 2
            nf.format(v)
        }
    }
}
