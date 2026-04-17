package com.franck.trailcockpit.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.franck.trailcockpit.data.FitnessPoint
import com.franck.trailcockpit.data.WeeklyPoint
import com.franck.trailcockpit.ui.theme.*

@Composable
fun ChartCard(
    title: String,
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(CardBg, RoundedCornerShape(12.dp))
            .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
            .padding(16.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.padding(bottom = 12.dp)
        )
        content()
    }
}

// ─── LINE CHART ───────────────────────────────────────────
@Composable
fun LineChart(
    data: List<WeeklyPoint>,
    lineColor: Color = ChartLine1,
    fillAlpha: Float = 0.15f,
    modifier: Modifier = Modifier.height(160.dp)
) {
    if (data.isEmpty()) return
    val maxVal = data.maxOf { it.value } * 1.15f
    val minVal = 0f

    Canvas(modifier = modifier.fillMaxWidth()) {
        val w = size.width
        val h = size.height
        val padLeft = 40f
        val padBottom = 24f
        val chartW = w - padLeft
        val chartH = h - padBottom

        // Grid lines
        for (i in 0..4) {
            val y = chartH * (1 - i / 4f)
            drawLine(CardBorder, Offset(padLeft, y), Offset(w, y), strokeWidth = 1f)
            val label = ((minVal + (maxVal - minVal) * i / 4f)).toInt().toString()
            drawContext.canvas.nativeCanvas.drawText(
                label, 4f, y + 4f,
                android.graphics.Paint().apply {
                    color = 0xFF5A6480.toInt()
                    textSize = 22f
                    isAntiAlias = true
                }
            )
        }

        // Line path
        val path = Path()
        val fillPath = Path()
        data.forEachIndexed { i, point ->
            val x = padLeft + chartW * i / (data.size - 1).coerceAtLeast(1)
            val y = chartH * (1 - (point.value - minVal) / (maxVal - minVal))
            if (i == 0) {
                path.moveTo(x, y)
                fillPath.moveTo(x, chartH)
                fillPath.lineTo(x, y)
            } else {
                path.lineTo(x, y)
                fillPath.lineTo(x, y)
            }
        }

        // Fill
        val lastX = padLeft + chartW
        fillPath.lineTo(lastX, chartH)
        fillPath.close()
        drawPath(fillPath, lineColor.copy(alpha = fillAlpha))

        // Stroke
        drawPath(path, lineColor, style = Stroke(width = 3f, cap = StrokeCap.Round))

        // Dots
        data.forEachIndexed { i, point ->
            val x = padLeft + chartW * i / (data.size - 1).coerceAtLeast(1)
            val y = chartH * (1 - (point.value - minVal) / (maxVal - minVal))
            drawCircle(lineColor, radius = 4f, center = Offset(x, y))
        }
    }
}

// ─── MULTI-LINE CHART (ATL/CTL/TSB) ──────────────────────
@Composable
fun MultiLineChart(
    data: List<FitnessPoint>,
    modifier: Modifier = Modifier.height(160.dp)
) {
    if (data.isEmpty()) return
    val allValues = data.flatMap { listOf(it.atl, it.ctl, it.tsb) }
    val maxVal = allValues.max() * 1.2f
    val minVal = allValues.min() * 1.2f

    Canvas(modifier = modifier.fillMaxWidth()) {
        val w = size.width
        val h = size.height
        val padLeft = 40f
        val padBottom = 24f
        val chartW = w - padLeft
        val chartH = h - padBottom
        val range = maxVal - minVal

        // Grid
        for (i in 0..4) {
            val y = chartH * (1 - i / 4f)
            drawLine(CardBorder, Offset(padLeft, y), Offset(w, y), strokeWidth = 1f)
            val label = (minVal + range * i / 4f).toInt().toString()
            drawContext.canvas.nativeCanvas.drawText(
                label, 4f, y + 4f,
                android.graphics.Paint().apply {
                    color = 0xFF5A6480.toInt()
                    textSize = 22f
                    isAntiAlias = true
                }
            )
        }

        // Zero line
        if (minVal < 0) {
            val zeroY = chartH * (1 - (0f - minVal) / range)
            drawLine(TextMuted, Offset(padLeft, zeroY), Offset(w, zeroY), strokeWidth = 1f)
        }

        fun drawLine(values: List<Float>, color: Color) {
            val path = Path()
            values.forEachIndexed { i, v ->
                val x = padLeft + chartW * i / (values.size - 1).coerceAtLeast(1)
                val y = chartH * (1 - (v - minVal) / range)
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path, color, style = Stroke(width = 3f, cap = StrokeCap.Round))
        }

        drawLine(data.map { it.atl }, AccentOrange)
        drawLine(data.map { it.ctl }, AccentBlue)
        drawLine(data.map { it.tsb }, AccentGreen)
    }

    // Legend
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        LegendDot("ATL", AccentOrange)
        LegendDot("CTL", AccentBlue)
        LegendDot("TSB", AccentGreen)
    }
}

@Composable
private fun LegendDot(label: String, color: Color) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Canvas(modifier = Modifier.size(8.dp)) {
            drawCircle(color)
        }
        Spacer(modifier = Modifier.width(4.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = color)
    }
}

// ─── BAR CHART ────────────────────────────────────────────
@Composable
fun BarChart(
    data: List<WeeklyPoint>,
    barColor: Color = AccentBlue,
    modifier: Modifier = Modifier.height(160.dp)
) {
    if (data.isEmpty()) return
    val maxVal = data.maxOf { it.value } * 1.15f

    Canvas(modifier = modifier.fillMaxWidth()) {
        val w = size.width
        val h = size.height
        val padLeft = 40f
        val padBottom = 24f
        val chartW = w - padLeft
        val chartH = h - padBottom
        val barW = chartW / data.size * 0.7f
        val gap = chartW / data.size * 0.3f

        // Grid
        for (i in 0..4) {
            val y = chartH * (1 - i / 4f)
            drawLine(CardBorder, Offset(padLeft, y), Offset(w, y), strokeWidth = 1f)
        }

        data.forEachIndexed { i, point ->
            val barH = chartH * (point.value / maxVal)
            val x = padLeft + i * (barW + gap) + gap / 2
            val y = chartH - barH

            // Bar with rounded top
            drawRoundRect(
                color = barColor,
                topLeft = Offset(x, y),
                size = Size(barW, barH),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(4f, 4f)
            )
        }
    }
}

// ─── BAR CHART for yearly accumulation ────────────────────
@Composable
fun YearlyBarChart(
    years: List<String>,
    values: List<Float>,
    barColor: Color = AccentCyan,
    modifier: Modifier = Modifier.height(160.dp)
) {
    if (values.isEmpty()) return
    val maxVal = values.max() * 1.15f

    Canvas(modifier = modifier.fillMaxWidth()) {
        val w = size.width
        val h = size.height
        val padLeft = 40f
        val padBottom = 30f
        val chartW = w - padLeft
        val chartH = h - padBottom
        val totalBarSpace = chartW / values.size
        val barW = totalBarSpace * 0.7f

        // Grid
        for (i in 0..4) {
            val y = chartH * (1 - i / 4f)
            drawLine(CardBorder, Offset(padLeft, y), Offset(w, y), strokeWidth = 1f)
        }

        values.forEachIndexed { i, value ->
            val barH = chartH * (value / maxVal)
            val x = padLeft + i * totalBarSpace + (totalBarSpace - barW) / 2
            val y = chartH - barH

            val color = if (i == values.lastIndex) AccentGreen else barColor

            drawRoundRect(
                color = color,
                topLeft = Offset(x, y),
                size = Size(barW, barH),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(3f, 3f)
            )

            // Year label
            if (i % 2 == 0 || i == values.lastIndex) {
                drawContext.canvas.nativeCanvas.drawText(
                    years[i].takeLast(2),
                    x + barW / 2 - 10f,
                    h - 4f,
                    android.graphics.Paint().apply {
                        color = 0xFF5A6480.toInt()
                        textSize = 18f
                        isAntiAlias = true
                    }
                )
            }
        }
    }
}

// ─── DONUT / PIE CHART ────────────────────────────────────
@Composable
fun DonutChart(
    values: List<Float>,
    colors: List<Color>,
    labels: List<String>,
    modifier: Modifier = Modifier.height(180.dp)
) {
    if (values.isEmpty()) return
    val total = values.sum()

    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Canvas(
            modifier = Modifier
                .size(140.dp)
                .padding(8.dp)
        ) {
            val strokeWidth = 28f
            val radius = (size.minDimension - strokeWidth) / 2
            val center = Offset(size.width / 2, size.height / 2)
            var startAngle = -90f

            values.forEachIndexed { i, value ->
                val sweep = 360f * value / total
                drawArc(
                    color = colors[i % colors.size],
                    startAngle = startAngle,
                    sweepAngle = sweep,
                    useCenter = false,
                    topLeft = Offset(center.x - radius, center.y - radius),
                    size = Size(radius * 2, radius * 2),
                    style = Stroke(width = strokeWidth, cap = StrokeCap.Butt)
                )
                startAngle += sweep
            }
        }

        Spacer(modifier = Modifier.width(12.dp))

        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            labels.forEachIndexed { i, label ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Canvas(modifier = Modifier.size(10.dp)) {
                        drawCircle(colors[i % colors.size])
                    }
                    Spacer(modifier = Modifier.width(6.dp))
                    Text(
                        "$label ${values[i].toInt()}%",
                        style = MaterialTheme.typography.bodyMedium,
                        color = TextSecondary
                    )
                }
            }
        }
    }
}

// ─── MONTHLY ACCUMULATION MULTI-LINE ──────────────────────
@Composable
fun MonthlyAccumChart(
    yearLabels: List<String>,
    yearData: List<List<Float>>,
    colors: List<Color> = listOf(AccentGreen, AccentBlue, AccentOrange, AccentPurple),
    modifier: Modifier = Modifier.height(160.dp)
) {
    if (yearData.isEmpty()) return
    val allValues = yearData.flatten()
    val maxVal = if (allValues.isEmpty()) 1f else allValues.max() * 1.15f

    Canvas(modifier = modifier.fillMaxWidth()) {
        val w = size.width
        val h = size.height
        val padLeft = 50f
        val padBottom = 24f
        val chartW = w - padLeft
        val chartH = h - padBottom

        // Grid
        for (i in 0..4) {
            val y = chartH * (1 - i / 4f)
            drawLine(CardBorder, Offset(padLeft, y), Offset(w, y), strokeWidth = 1f)
            val label = (maxVal * i / 4f).toInt().toString()
            drawContext.canvas.nativeCanvas.drawText(
                label, 2f, y + 4f,
                android.graphics.Paint().apply {
                    color = 0xFF5A6480.toInt()
                    textSize = 20f
                    isAntiAlias = true
                }
            )
        }

        yearData.forEachIndexed { yi, values ->
            val color = colors[yi % colors.size]
            val path = Path()
            values.forEachIndexed { i, v ->
                val x = padLeft + chartW * i / (values.size - 1).coerceAtLeast(1)
                val y = chartH * (1 - v / maxVal)
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path, color, style = Stroke(width = 2.5f, cap = StrokeCap.Round))
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        yearLabels.forEachIndexed { i, label ->
            LegendDot(label, colors[i % colors.size])
        }
    }
}
