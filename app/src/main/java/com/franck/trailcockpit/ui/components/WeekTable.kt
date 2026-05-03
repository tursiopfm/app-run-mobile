package com.franck.trailcockpit.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.res.stringResource
import com.franck.trailcockpit.R
import com.franck.trailcockpit.data.DaySession
import com.franck.trailcockpit.ui.theme.TrailColors

@Composable
fun WeekTable(sessions: List<DaySession>, modifier: Modifier = Modifier) {
    val totalKm = sessions.sumOf { it.volumeKm }
    val totalDPlus = sessions.sumOf { it.denivelePos.toLong() }.toInt()

    Column(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .border(1.dp, TrailColors.Border, RoundedCornerShape(4.dp))
            .horizontalScroll(rememberScrollState())
    ) {
        Row {
            HeaderCell(stringResource(R.string.week_table_header_session), width = 90.dp, bg = TrailColors.HeaderBg)
            for (s in sessions) {
                HeaderCell(s.day, width = 92.dp, bg = TrailColors.HeaderBg, bold = true)
            }
            HeaderCell(stringResource(R.string.week_table_header_total), width = 70.dp, bg = TrailColors.HeaderBg, bold = true)
        }
        Row {
            HeaderCell(stringResource(R.string.week_table_header_label), width = 90.dp, bg = TrailColors.CardBg)
            for (s in sessions) {
                BodyCell(s.label.ifEmpty { "\u2014" }, width = 92.dp)
            }
            BodyCell("", width = 70.dp)
        }
        Row {
            HeaderCell(stringResource(R.string.week_table_header_volume), width = 90.dp, bg = TrailColors.CardBg)
            for (s in sessions) {
                BodyCell(format1(s.volumeKm), width = 92.dp)
            }
            BodyCell(format1(totalKm), width = 70.dp, bold = true)
        }
        Row {
            HeaderCell(stringResource(R.string.week_table_header_elevation), width = 90.dp, bg = TrailColors.CardBg)
            for (s in sessions) {
                BodyCell(s.denivelePos.toString(), width = 92.dp)
            }
            BodyCell(totalDPlus.toString(), width = 70.dp, bold = true)
        }
    }
}

@Composable
private fun HeaderCell(text: String, width: Dp, bg: Color, bold: Boolean = false) {
    Box(
        Modifier
            .width(width)
            .height(28.dp)
            .background(bg)
            .border(0.5.dp, TrailColors.Border)
            .padding(horizontal = 6.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Text(
            text = text,
            fontSize = 11.sp,
            fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal,
            color = TrailColors.Text
        )
    }
}

@Composable
private fun BodyCell(text: String, width: Dp, bold: Boolean = false) {
    Box(
        Modifier
            .width(width)
            .height(26.dp)
            .background(TrailColors.Surface)
            .border(0.5.dp, TrailColors.Border)
            .padding(horizontal = 6.dp),
        contentAlignment = Alignment.CenterStart
    ) {
        Text(
            text = text,
            fontSize = 11.sp,
            fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal,
            color = TrailColors.Text
        )
    }
}

private fun format1(v: Double): String =
    if (v % 1.0 == 0.0) "%.0f".format(v) else "%.2f".format(v)
