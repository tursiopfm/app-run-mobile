package com.franck.trailcockpit.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.franck.trailcockpit.data.WeekDay
import com.franck.trailcockpit.ui.theme.*

@Composable
fun WeekTable(
    days: List<WeekDay>,
    total: WeekDay,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .background(CardBg, RoundedCornerShape(12.dp))
            .border(1.dp, CardBorder, RoundedCornerShape(12.dp))
            .padding(12.dp)
    ) {
        Text(
            text = "SEMAINE EN COURS",
            style = MaterialTheme.typography.headlineMedium,
            modifier = Modifier.padding(bottom = 8.dp)
        )

        // Header row
        TableRow(
            day = "Jour",
            session = "Séance",
            volume = "Volume",
            dPlus = "D+",
            isHeader = true
        )

        HorizontalDivider(color = CardBorder, thickness = 1.dp)

        // Data rows
        days.forEach { weekDay ->
            TableRow(
                day = weekDay.day,
                session = weekDay.session,
                volume = weekDay.volume,
                dPlus = weekDay.dPlus,
                isRest = weekDay.session == "Repos"
            )
        }

        HorizontalDivider(color = AccentBlue.copy(alpha = 0.3f), thickness = 1.dp)

        // Total row
        TableRow(
            day = total.day,
            session = total.session,
            volume = total.volume,
            dPlus = total.dPlus,
            isTotal = true
        )
    }
}

@Composable
private fun TableRow(
    day: String,
    session: String,
    volume: String,
    dPlus: String,
    isHeader: Boolean = false,
    isTotal: Boolean = false,
    isRest: Boolean = false
) {
    val textColor = when {
        isHeader -> TextMuted
        isTotal -> AccentGreen
        isRest -> TextMuted
        else -> TextPrimary
    }
    val weight = if (isHeader || isTotal) FontWeight.Bold else FontWeight.Normal
    val fontSize = if (isHeader) 11.sp else 12.sp

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(
                if (isTotal) Modifier.background(AccentGreen.copy(alpha = 0.05f))
                else Modifier
            )
            .padding(vertical = 6.dp, horizontal = 4.dp)
    ) {
        Text(
            text = day,
            modifier = Modifier.weight(0.8f),
            color = textColor,
            fontWeight = weight,
            fontSize = fontSize
        )
        Text(
            text = session,
            modifier = Modifier.weight(1.5f),
            color = textColor,
            fontWeight = weight,
            fontSize = fontSize
        )
        Text(
            text = volume,
            modifier = Modifier.weight(1f),
            color = textColor,
            fontWeight = weight,
            fontSize = fontSize,
            textAlign = TextAlign.End
        )
        Text(
            text = dPlus,
            modifier = Modifier.weight(0.8f),
            color = textColor,
            fontWeight = weight,
            fontSize = fontSize,
            textAlign = TextAlign.End
        )
    }
}
