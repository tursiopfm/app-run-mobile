package com.franck.trailcockpit.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable

private val LightColors = lightColorScheme(
    primary = TrailColors.SeriesBlue,
    onPrimary = androidx.compose.ui.graphics.Color.White,
    secondary = TrailColors.ChargeOrange,
    background = TrailColors.Background,
    surface = TrailColors.CardBg,
    onBackground = TrailColors.Text,
    onSurface = TrailColors.Text
)

@Composable
fun TrailCockpitTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = LightColors,
        typography = MaterialTheme.typography,
        content = content
    )
}
