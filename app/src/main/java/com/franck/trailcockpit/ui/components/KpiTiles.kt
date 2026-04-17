package com.franck.trailcockpit.ui.components

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.franck.trailcockpit.data.ObjectiveProgress
import com.franck.trailcockpit.ui.theme.*

@Composable
fun KpiTile(
    title: String,
    value: String,
    subtitle: String = "",
    accentColor: Color = AccentGreen,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .background(CardBg, RoundedCornerShape(12.dp))
            .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(4.dp))
        Text(
            text = value,
            fontSize = 22.sp,
            fontWeight = FontWeight.Bold,
            color = accentColor,
            textAlign = TextAlign.Center
        )
        if (subtitle.isNotEmpty()) {
            Spacer(modifier = Modifier.height(2.dp))
            Text(
                text = subtitle,
                style = MaterialTheme.typography.labelMedium,
                color = TextMuted,
                textAlign = TextAlign.Center
            )
        }
    }
}

@Composable
fun KpiTileWide(
    title: String,
    values: List<Pair<String, String>>,
    accentColor: Color = AccentBlue,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(CardBg, RoundedCornerShape(12.dp))
            .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
            .padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.bodyMedium,
            color = TextSecondary
        )
        Spacer(modifier = Modifier.height(6.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly
        ) {
            values.forEach { (label, value) ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        text = value,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = accentColor
                    )
                    Text(
                        text = label,
                        style = MaterialTheme.typography.labelMedium,
                        color = TextMuted
                    )
                }
            }
        }
    }
}

@Composable
fun StatusBadge(
    label: String,
    color: Color = StatusOk,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .background(color.copy(alpha = 0.15f), RoundedCornerShape(20.dp))
            .padding(horizontal = 12.dp, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = color
        )
    }
}

// ─── PROGRESS BAR ROW ─────────────────────────────────────
@Composable
fun ProgressRow(
    objective: ObjectiveProgress,
    barColor: Color = AccentBlue,
    modifier: Modifier = Modifier
) {
    val progress = (objective.current / objective.target).coerceIn(0f, 1f)
    val percent = (progress * 100).toInt()

    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = objective.label,
                style = MaterialTheme.typography.bodyMedium,
                color = TextSecondary
            )
            Text(
                text = "${objective.current.toInt()} / ${objective.target.toInt()} ${objective.unit}  ($percent%)",
                style = MaterialTheme.typography.bodyMedium,
                color = TextPrimary
            )
        }
        Spacer(modifier = Modifier.height(6.dp))
        Canvas(
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
        ) {
            // Background track
            drawRoundRect(
                color = SurfaceDark,
                cornerRadius = CornerRadius(4f),
                size = Size(size.width, size.height)
            )
            // Filled portion
            drawRoundRect(
                color = barColor,
                cornerRadius = CornerRadius(4f),
                size = Size(size.width * progress, size.height)
            )
        }
    }
}

// ─── SMALL BAR STRIP (sparkline bars) ─────────────────────
@Composable
fun SmallBarStrip(
    values: List<Float>,
    color: Color = AccentBlue,
    modifier: Modifier = Modifier.height(32.dp)
) {
    if (values.isEmpty()) return
    val maxVal = values.max()

    Canvas(modifier = modifier.fillMaxWidth()) {
        val w = size.width
        val h = size.height
        val barW = w / values.size * 0.7f
        val gap = w / values.size * 0.3f

        values.forEachIndexed { i, v ->
            val barH = h * (v / maxVal)
            val x = i * (barW + gap) + gap / 2
            drawRoundRect(
                color = if (i == values.lastIndex) color else color.copy(alpha = 0.5f),
                topLeft = Offset(x, h - barH),
                size = Size(barW, barH),
                cornerRadius = CornerRadius(2f)
            )
        }
    }
}
