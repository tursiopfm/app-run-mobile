package com.franck.trailcockpit.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
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
import com.franck.trailcockpit.data.SampleData
import com.franck.trailcockpit.ui.components.BarChart
import com.franck.trailcockpit.ui.components.ChartCard
import com.franck.trailcockpit.ui.components.KpiTile
import com.franck.trailcockpit.ui.components.LineChart
import com.franck.trailcockpit.ui.components.LineSeries
import com.franck.trailcockpit.ui.components.PieChart
import com.franck.trailcockpit.ui.components.PieSlice
import com.franck.trailcockpit.ui.components.ProgressRow
import com.franck.trailcockpit.ui.components.SmallBarStrip
import com.franck.trailcockpit.ui.components.WeekTable
import com.franck.trailcockpit.ui.theme.TrailColors

@Composable
fun DashboardScreen() {
    val weekly = SampleData.weekly
    val xLabels = weekly.map { it.weekLabel }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(TrailColors.Background),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item { Header() }
        item { WeekKpiRow() }
        item { WeekTable(SampleData.week) }
        item { YtdRow() }
        item { ProgressSection() }

        item {
            ChartCard(title = "RUN km \u2014 16 semaines", minHeight = 200.dp) {
                LineChart(
                    xLabels = xLabels,
                    series = listOf(
                        LineSeries(
                            label = "km",
                            color = TrailColors.SeriesRed,
                            values = weekly.map { it.km },
                            valueLabels = true
                        )
                    ),
                    xLabelEveryN = 2
                )
            }
        }
        item {
            ChartCard(title = "RUN D+ (m) \u2014 16 semaines", minHeight = 200.dp) {
                BarChart(
                    xLabels = xLabels,
                    values = weekly.map { it.dPlus.toDouble() },
                    color = TrailColors.SeriesBlue,
                    xLabelEveryN = 2
                )
            }
        }
        item {
            ChartCard(title = "ATL / CTL / TSB (RUN) \u2014 16 semaines", minHeight = 200.dp) {
                LineChart(
                    xLabels = xLabels,
                    series = listOf(
                        LineSeries("ATL", TrailColors.SeriesRed, weekly.map { it.atl.toDouble() }, valueLabels = true),
                        LineSeries("CTL", TrailColors.SeriesBlue, weekly.map { it.ctl.toDouble() }, valueLabels = true),
                        LineSeries("TSB", TrailColors.SeriesOrange, weekly.map { it.tsb.toDouble() }, valueLabels = true)
                    ),
                    xLabelEveryN = 2
                )
            }
        }
        item {
            ChartCard(title = "R\u00e9partition intensit\u00e9s \u2014 30 jours glissants (RUN)", minHeight = 180.dp) {
                PieChart(slices = intensitiesSlices())
            }
        }
        item {
            ChartCard(title = "RUN Suffer \u2014 16 semaines", minHeight = 200.dp) {
                BarChart(
                    xLabels = xLabels,
                    values = weekly.map { it.suffer.toDouble() },
                    color = TrailColors.SeriesYellow,
                    xLabelEveryN = 2
                )
            }
        }
        item {
            ChartCard(title = "Ratio RUN D+/km \u2014 tendance", minHeight = 200.dp) {
                LineChart(
                    xLabels = xLabels,
                    series = listOf(
                        LineSeries(
                            "Ratio D+/km",
                            TrailColors.SeriesGreen,
                            SampleData.ratio16,
                            valueLabels = true
                        )
                    ),
                    xLabelEveryN = 2
                )
            }
        }
        item {
            ChartCard(title = "RUN \u2014 Cumul km par ann\u00e9e", minHeight = 260.dp) {
                val seriesList = SampleData.yearSeries
                val palette = listOf(
                    Color(0xFF1F77B4), Color(0xFFE45757), Color(0xFFF0A020),
                    Color(0xFF4CAF50), Color(0xFF8E63C7), Color(0xFF00ACC1),
                    Color(0xFFAB7C00), Color(0xFF5E7CE2), Color(0xFFD47DB4),
                    Color(0xFF80A7C2), Color(0xFFBFBF4B), Color(0xFF6F9A5A),
                    Color(0xFF9AA0A6), Color(0xFFFF7F50)
                )
                val lines = seriesList.mapIndexed { idx, ys ->
                    val resampled = resampleTo(ys.points.map { it.dayOfYear to it.km }, 120)
                    val color = if (ys.year == 2026) TrailColors.SeriesBlue else palette[idx % palette.size]
                    LineSeries(
                        label = ys.year.toString(),
                        color = color,
                        values = resampled,
                        strokeWidth = if (ys.year == 2026) 3.5f else 1.5f,
                        drawPoints = false
                    )
                }
                LineChart(
                    xLabels = monthXLabels(),
                    series = lines,
                    xLabelEveryN = 20,
                    showXLabels = true
                )
            }
        }
        item {
            YearLegend()
        }
        item {
            ChartCard(title = "RUN \u2014 Cumul km par mois (4 derniers mois)", minHeight = 220.dp) {
                val months = SampleData.monthSeries
                val palette = listOf(TrailColors.SeriesGreen, TrailColors.SeriesYellow,
                    TrailColors.SeriesRed, TrailColors.SeriesBlue)
                val seriesList = months.mapIndexed { idx, m ->
                    val pts = m.points.map { it.dayOfMonth to it.km }
                    LineSeries(
                        label = m.label,
                        color = palette[idx % palette.size],
                        values = resampleTo(pts, 31),
                        strokeWidth = 2.2f,
                        drawPoints = true,
                        valueLabels = (idx == months.lastIndex)
                    )
                }
                Column {
                    LineChart(
                        xLabels = (1..31).map { it.toString() },
                        series = seriesList,
                        xLabelEveryN = 3,
                        modifier = Modifier.fillMaxWidth().height(180.dp)
                    )
                    Spacer(Modifier.height(4.dp))
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        months.forEachIndexed { idx, m ->
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Box(
                                    Modifier
                                        .size(10.dp)
                                        .clip(CircleShape)
                                        .background(palette[idx % palette.size])
                                )
                                Spacer(Modifier.width(4.dp))
                                Text(m.label, fontSize = 10.sp, color = TrailColors.Text)
                            }
                        }
                    }
                }
            }
        }
        item { Spacer(Modifier.height(12.dp)) }
    }
}

@Composable
private fun Header() {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(TrailColors.SeriesGreen),
                contentAlignment = Alignment.Center
            ) {
                Text("\u25b2", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
            Spacer(Modifier.width(8.dp))
            Text(
                text = "TRAIL COCKPIT \u2014 FRANCK 2026",
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp,
                color = TrailColors.Text
            )
        }
        Spacer(Modifier.height(6.dp))
        Box(
            Modifier
                .clip(RoundedCornerShape(4.dp))
                .background(TrailColors.PaleGreen)
                .border(1.dp, TrailColors.GreenOk, RoundedCornerShape(4.dp))
                .padding(horizontal = 10.dp, vertical = 4.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(8.dp)
                        .clip(CircleShape)
                        .background(TrailColors.GreenOk)
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    "Zone OK \u2014 TSB 7",
                    color = TrailColors.GreenOk,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 12.sp
                )
            }
        }
    }
}

@Composable
private fun WeekKpiRow() {
    val o = SampleData.overview
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        KpiTile(
            title = "RUN SEMAINE",
            titleColor = TrailColors.RunRed,
            mainValue = "${format1(o.runKm)} km",
            subline1 = "Objectif ${o.runTargetKm} km \u2022 ${o.runSessions} s\u00e9ances",
            trailing = { SmallBarStrip(listOf(0.7f, 0.8f, 0.4f, 0.9f, 0.3f), TrailColors.RunRed) },
            modifier = Modifier.weight(1f)
        )
        KpiTile(
            title = "RUN D+ SEMAINE",
            titleColor = TrailColors.SeriesBlue,
            mainValue = "${o.runDPlus} m",
            subline1 = "Objectif ${o.runDPlusTarget} \u2022 Suffer ${o.runSuffer}",
            trailing = { SmallBarStrip(listOf(0.5f, 0.6f, 0.95f, 0.4f, 0.3f), TrailColors.SeriesBlue) },
            modifier = Modifier.weight(1f)
        )
        KpiTile(
            title = "V\u00c9LO SEMAINE",
            titleColor = TrailColors.BikeBlack,
            mainValue = "${format1(o.bikeKm)} km",
            subline1 = "${o.bikeSessions} s\u00e9ances \u2022 D+ ${o.bikeDPlus} m",
            trailing = { SmallBarStrip(listOf(0.3f, 0.5f, 0.4f), TrailColors.BikeBlack) },
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun YtdRow() {
    val y = SampleData.ytd
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        KpiTile(
            title = "YTD RUN",
            titleColor = TrailColors.RunRed,
            mainValue = "${format1(y.runKm)} km",
            subline1 = "D+ ${formatThousands(y.runDPlus)} m",
            trailing = { SmallBarStrip(listOf(0.2f, 0.35f, 0.7f, 0.95f), TrailColors.SeriesBlue) },
            modifier = Modifier.weight(1f)
        )
        KpiTile(
            title = "CHARGE (RUN)",
            titleColor = TrailColors.ChargeOrange,
            mainValue = "ATL ${y.atl}  \u2022  CTL ${y.ctl}",
            subline1 = "TSB ${y.tsb} (CTL-ATL) \u2022 LAST 7 DAYS",
            trailing = { SmallBarStrip(listOf(0.4f, 0.5f, 0.3f, 0.7f), TrailColors.ChargeOrange) },
            modifier = Modifier.weight(1f)
        )
        KpiTile(
            title = "YTD V\u00c9LO",
            titleColor = TrailColors.BikeBlack,
            mainValue = "${format1(y.bikeKm)} km",
            subline1 = "D+ ${formatThousands(y.bikeDPlus)} m",
            trailing = { SmallBarStrip(listOf(0.1f, 0.2f, 0.25f, 0.4f), TrailColors.BikeBlack) },
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun ProgressSection() {
    val o = SampleData.overview
    val y = SampleData.ytd
    Column(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(6.dp))
            .background(TrailColors.CardBg)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(6.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        ProgressRow(
            label = "RUN \u2022 Km ann\u00e9e",
            current = y.runKm,
            target = y.yearTarget.toDouble(),
            bgColor = TrailColors.ProgressRunBg,
            fgColor = TrailColors.ProgressRunFg
        )
        Text(
            "Objectif ann\u00e9e (km) : ${y.yearTarget} \u2022 avance de ${(y.runKm - (y.yearTarget * dayOfYearRatio())).toInt()} km",
            fontSize = 10.sp,
            color = TrailColors.SubtleText
        )
        ProgressRow(
            label = "RUN \u2022 Volume semaine",
            current = o.runKm,
            target = o.runTargetKm.toDouble(),
            bgColor = TrailColors.ProgressVolumeBg,
            fgColor = TrailColors.ProgressVolumeFg
        )
        ProgressRow(
            label = "RUN \u2022 D+ semaine",
            current = o.runDPlus.toDouble(),
            target = o.runDPlusTarget.toDouble(),
            bgColor = TrailColors.ProgressDPlusBg,
            fgColor = TrailColors.ProgressDPlusFg
        )
    }
}

@Composable
private fun YearLegend() {
    val years = SampleData.yearSeries.map { it.year }.sortedDescending()
    val palette = listOf(
        Color(0xFF1F77B4), Color(0xFFE45757), Color(0xFFF0A020),
        Color(0xFF4CAF50), Color(0xFF8E63C7), Color(0xFF00ACC1),
        Color(0xFFAB7C00), Color(0xFF5E7CE2), Color(0xFFD47DB4),
        Color(0xFF80A7C2), Color(0xFFBFBF4B), Color(0xFF6F9A5A),
        Color(0xFF9AA0A6), Color(0xFFFF7F50)
    )
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(4.dp))
            .background(TrailColors.CardBg)
            .border(1.dp, TrailColors.Border, RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        years.forEachIndexed { idx, year ->
            val color = if (year == 2026) TrailColors.SeriesBlue else palette[idx % palette.size]
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    Modifier
                        .size(10.dp)
                        .clip(CircleShape)
                        .background(color)
                )
                Spacer(Modifier.width(4.dp))
                Text(
                    year.toString(),
                    fontSize = 10.sp,
                    color = TrailColors.Text,
                    fontWeight = if (year == 2026) FontWeight.Bold else FontWeight.Normal
                )
            }
        }
    }
}

private fun intensitiesSlices(): List<PieSlice> {
    val data = SampleData.intensities
    val palette = listOf(
        TrailColors.PieRuntaf, TrailColors.PieVma, TrailColors.PieSeuil,
        TrailColors.PieCotes, TrailColors.PieSortieLongue, TrailColors.PieFooting,
        TrailColors.PieAutre
    )
    return data.mapIndexed { idx, share -> PieSlice(share.label, share.value, palette[idx % palette.size]) }
}

private fun resampleTo(points: List<Pair<Int, Double>>, n: Int): List<Double> {
    if (points.isEmpty()) return List(n) { 0.0 }
    val sorted = points.sortedBy { it.first }
    val first = sorted.first().first
    val last = sorted.last().first
    val range = (last - first).coerceAtLeast(1)
    val out = DoubleArray(n)
    for (i in 0 until n) {
        val x = first + (range.toDouble() * i / (n - 1))
        val iHi = sorted.indexOfFirst { it.first.toDouble() >= x }
        val y = when {
            iHi <= 0 -> sorted.first().second
            iHi >= sorted.size -> sorted.last().second
            else -> {
                val a = sorted[iHi - 1]
                val b = sorted[iHi]
                val t = (x - a.first) / (b.first - a.first).toDouble()
                a.second + (b.second - a.second) * t
            }
        }
        out[i] = y
    }
    return out.toList()
}

private fun monthXLabels(): List<String> {
    val out = MutableList(120) { "" }
    val months = listOf("01 janv.", "01 mars", "01 mai", "01 juil.", "01 sept.", "01 nov.")
    months.forEachIndexed { idx, label ->
        val pos = (idx * 20).coerceAtMost(out.lastIndex)
        out[pos] = label
    }
    return out
}

private fun dayOfYearRatio(): Double {
    return 106.0 / 365.0
}

private fun format1(v: Double): String =
    if (v % 1.0 == 0.0) "%.0f".format(v) else "%.1f".format(v)

private fun formatThousands(v: Int): String =
    "%,d".format(v).replace(",", " ")
