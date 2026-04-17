package com.franck.trailcockpit.ui.components

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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.franck.trailcockpit.ui.theme.TrailColors

@Composable
fun KpiTile(
    title: String,
    titleColor: Color,
    mainValue: String,
    mainValueColor: Color = TrailColors.Text,
    subline1: String? = null,
    subline2: String? = null,
    trailing: (@Composable () -> Unit)? = null,
    modifier: Modifier = Modifier
) {
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
                color = mainValueColor
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
fun SmallBarStrip(values: List<Float>, color: Color) {
    Row(
        verticalAlignment = Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(2.dp)
    ) {
        values.forEach { v ->
            val h = (14f * v.coerceIn(0f, 1f)).dp
            Box(
                Modifier
                    .width(6.dp)
                    .height(if (h.value < 2f) 2.dp else h)
                    .clip(RoundedCornerShape(1.dp))
                    .background(color)
            )
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
    return if (v >= 100) "%,.0f".format(v).replace(",", " ")
    else if (v % 1.0 == 0.0) "%.0f".format(v)
    else "%.1f".format(v)
}
