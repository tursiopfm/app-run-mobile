package com.franck.trailcockpit.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.franck.trailcockpit.ui.theme.TrailColors
import java.text.NumberFormat
import java.util.Locale

@Composable
fun KpiTile(
    title: String,
    titleColor: Color,
    mainValue: String,
    mainValueColor: Color? = null,
    subline1: String? = null,
    subline2: String? = null,
    trailing: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    val resolvedMainValueColor = mainValueColor ?: TrailColors.Text
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(TrailColors.CardBg)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(4.dp))
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(TrailColors.HeaderBg)
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = title,
                    color = titleColor,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp,
                    modifier = Modifier.weight(1f)
                )
                trailing?.invoke()
            }
        }
        Column(
            modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)
        ) {
            Text(
                text = mainValue,
                fontWeight = FontWeight.Bold,
                fontSize = 20.sp,
                color = resolvedMainValueColor
            )
            if (subline1 != null) {
                Spacer(Modifier.height(2.dp))
                Text(text = subline1, fontSize = 11.sp, color = TrailColors.SubtleText)
            }
            if (subline2 != null) {
                Spacer(Modifier.height(4.dp))
                Row(
                    horizontalArrangement = Arrangement.spacedBy(2.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(text = subline2, fontSize = 11.sp, color = TrailColors.SubtleText)
                }
            }
        }
    }
}

@Composable
fun FullWidthBarStrip(
    values: List<Float>,
    labels: List<String>,
    color: Color
) {
    val textMeasurer = rememberTextMeasurer()
    val insideStyle = TextStyle(fontSize = 10.sp, color = Color.White, fontWeight = FontWeight.SemiBold)
    val aboveStyle = TextStyle(fontSize = 10.sp, color = color, fontWeight = FontWeight.SemiBold)

    Canvas(
        modifier = Modifier
            .fillMaxWidth()
            .height(26.dp)
    ) {
        val n = values.size
        if (n == 0) return@Canvas
        val gapPx = 2f
        val labelAreaH = 9.dp.toPx()
        val barAreaH = size.height - labelAreaH
        val barW = (size.width - gapPx * (n - 1)) / n
        val minInsideH = 13.dp.toPx()
        val cornerR = 2.dp.toPx()

        values.forEachIndexed { i, v ->
            val barH = (barAreaH * v.coerceIn(0f, 1f)).coerceAtLeast(2.dp.toPx())
            val x = i * (barW + gapPx)
            val barTop = size.height - barH

            drawRoundRect(
                color = color,
                topLeft = Offset(x, barTop),
                size = Size(barW, barH),
                cornerRadius = CornerRadius(cornerR)
            )

            val label = labels.getOrNull(i) ?: ""
            if (label.isNotEmpty()) {
                if (barH >= minInsideH) {
                    val m = textMeasurer.measure(label, insideStyle)
                    val lx = (x + (barW - m.size.width) / 2).coerceAtLeast(0f)
                    val ly = barTop + (barH - m.size.height) / 2
                    drawText(m, topLeft = Offset(lx, ly))
                } else {
                    val m = textMeasurer.measure(label, aboveStyle)
                    val lx = (x + (barW - m.size.width) / 2).coerceAtLeast(0f)
                    val ly = (barTop - m.size.height - 1.dp.toPx()).coerceAtLeast(0f)
                    drawText(m, topLeft = Offset(lx, ly))
                }
            }
        }
    }
}

@Composable
fun ProgressRow(
    label: String,
    current: Double,
    target: Double,
    bgColor: Color,
    fgColor: Color,
    unit: String = "",
    modifier: Modifier = Modifier
) {
    val ratio = if (target <= 0) 0f else (current / target).coerceIn(0.0, 1.0).toFloat()
    val pct = (ratio * 100).toInt()
    Column(modifier = modifier) {
        Text(
            text = "$label \u2022 ${formatDouble(current)} / ${formatDouble(target)} ($pct%)" +
                if (unit.isNotEmpty()) " $unit" else "",
            fontSize = 12.sp,
            color = TrailColors.Text,
            fontWeight = FontWeight.SemiBold
        )
        Spacer(Modifier.height(4.dp))
        Box(
            Modifier
                .fillMaxWidth()
                .height(16.dp)
                .clip(RoundedCornerShape(2.dp))
                .background(bgColor)
        ) {
            Box(
                Modifier
                .fillMaxWidth(ratio)
                    .height(16.dp)
                    .background(fgColor)
            )
        }
    }
}

private fun formatDouble(v: Double): String {
    val nf = NumberFormat.getInstance(Locale.getDefault())
    return if (v >= 100) {
        nf.maximumFractionDigits = 0
        nf.minimumFractionDigits = 0
        nf.format(v)
    } else if (v % 1.0 == 0.0) {
        nf.maximumFractionDigits = 0
        nf.minimumFractionDigits = 0
        nf.format(v)
    } else {
        nf.maximumFractionDigits = 1
        nf.minimumFractionDigits = 1
        nf.format(v)
    }
}
