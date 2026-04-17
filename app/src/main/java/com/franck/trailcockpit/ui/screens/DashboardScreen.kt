package com.franck.trailcockpit.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.franck.trailcockpit.data.SampleData
import com.franck.trailcockpit.ui.components.*
import com.franck.trailcockpit.ui.theme.*

@Composable
fun DashboardScreen() {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkBg)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // ─── HEADER ───────────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "TRAIL COCKPIT",
                    style = MaterialTheme.typography.headlineLarge,
                    letterSpacing = 2.sp
                )
                Text(
                    text = "FRANCK 2026",
                    style = MaterialTheme.typography.titleMedium,
                    color = TextSecondary
                )
            }
            StatusBadge(
                label = "Zone OK — TSB ${SampleData.chargeTsb.toInt()}",
                color = StatusOk
            )
        }

        // ─── 3 TUILES SEMAINE ─────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            KpiTile(
                title = "RUN",
                value = "${SampleData.weekRunKm} km",
                accentColor = AccentGreen,
                modifier = Modifier.weight(1f)
            )
            KpiTile(
                title = "RUN D+",
                value = "${SampleData.weekRunDPlus} m",
                subtitle = "Suffer ${SampleData.weekSuffer}",
                accentColor = AccentOrange,
                modifier = Modifier.weight(1f)
            )
            KpiTile(
                title = "VÉLO",
                value = "${SampleData.weekBikeKm} km",
                accentColor = AccentBlue,
                modifier = Modifier.weight(1f)
            )
        }

        // ─── TABLEAU HEBDO ────────────────────────────────
        WeekTable(
            days = SampleData.weekDays,
            total = SampleData.weekTotal
        )

        // ─── 3 TUILES YTD ────────────────────────────────
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            KpiTile(
                title = "YTD RUN",
                value = "${SampleData.ytdRunKm} km",
                accentColor = AccentCyan,
                modifier = Modifier.weight(1f)
            )
            KpiTile(
                title = "CHARGE",
                value = "TSB ${SampleData.chargeTsb.toInt()}",
                subtitle = "ATL ${SampleData.chargeAtl.toInt()} · CTL ${SampleData.chargeCtl.toInt()}",
                accentColor = AccentGreen,
                modifier = Modifier.weight(1f)
            )
            KpiTile(
                title = "YTD VÉLO",
                value = "${SampleData.ytdBikeKm} km",
                accentColor = AccentPurple,
                modifier = Modifier.weight(1f)
            )
        }

        // ─── BARRES D'OBJECTIFS ───────────────────────────
        ChartCard(title = "OBJECTIFS") {
            SampleData.objectives.forEachIndexed { i, obj ->
                val color = when (i) {
                    0 -> AccentGreen
                    1 -> AccentBlue
                    else -> AccentOrange
                }
                ProgressRow(objective = obj, barColor = color)
            }
        }

        // ─── GRAPHIQUE 1 : km 16 semaines ────────────────
        ChartCard(title = "KM — 16 SEMAINES") {
            LineChart(
                data = SampleData.weeklyKm,
                lineColor = AccentBlue
            )
        }

        // ─── GRAPHIQUE 2 : D+ 16 semaines ────────────────
        ChartCard(title = "D+ — 16 SEMAINES") {
            LineChart(
                data = SampleData.weeklyDPlus,
                lineColor = AccentOrange
            )
        }

        // ─── GRAPHIQUE 3 : ATL/CTL/TSB ───────────────────
        ChartCard(title = "FITNESS — ATL / CTL / TSB") {
            MultiLineChart(data = SampleData.fitnessData)
        }

        // ─── GRAPHIQUE 4 : Répartition intensités ────────
        ChartCard(title = "RÉPARTITION INTENSITÉS") {
            DonutChart(
                values = SampleData.intensityZones.map { it.percent },
                colors = ZoneColors,
                labels = SampleData.intensityZones.map { it.label }
            )
        }

        // ─── GRAPHIQUE 5 : Suffer 16 sem ─────────────────
        ChartCard(title = "SUFFER SCORE — 16 SEMAINES") {
            BarChart(
                data = SampleData.weeklySuffer,
                barColor = AccentRed
            )
        }

        // ─── GRAPHIQUE 6 : Ratio D+/km ───────────────────
        ChartCard(title = "RATIO D+/KM — 16 SEMAINES") {
            LineChart(
                data = SampleData.weeklyRatio,
                lineColor = AccentPurple
            )
        }

        // ─── GRAPHIQUE 7 : Cumul km par année ────────────
        ChartCard(title = "CUMUL KM PAR ANNÉE (14 SAISONS)") {
            YearlyBarChart(
                years = SampleData.yearlyAccum.map { it.year },
                values = SampleData.yearlyAccum.map { it.totalKm },
                barColor = AccentCyan
            )
        }

        // ─── GRAPHIQUE 8 : Cumul km par mois ─────────────
        ChartCard(title = "CUMUL KM PAR MOIS") {
            val years = listOf("2026", "2025", "2024", "2023")
            val yearData = years.map { year ->
                SampleData.monthlyAccum
                    .filter { it.year == year }
                    .sortedBy { it.month }
                    .map { it.km }
            }
            MonthlyAccumChart(
                yearLabels = years,
                yearData = yearData
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}
