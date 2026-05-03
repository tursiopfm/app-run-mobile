package com.franck.trailcockpit.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusDirection
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringArrayResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.franck.trailcockpit.R
import com.franck.trailcockpit.network.AuthRepository
import com.franck.trailcockpit.network.AuthResult
import com.franck.trailcockpit.ui.theme.TrailColors
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun AuthScreen(onAuthSuccess: (AuthResult) -> Unit) {
    var selectedTab by remember { mutableIntStateOf(0) }
    // Champs communs
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var passwordVisible by remember { mutableStateOf(false) }
    // Champs inscription
    var firstName by remember { mutableStateOf("") }
    var lastName by remember { mutableStateOf("") }
    var gender by remember { mutableStateOf("") }
    var birthDate by remember { mutableStateOf("") }

    var loading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val focusManager = LocalFocusManager.current
    val scope = rememberCoroutineScope()

    val genres = stringArrayResource(R.array.auth_genders).toList()

    // Pre-fetch error strings (used inside non-composable submit())
    val errEmailPwd = stringResource(R.string.error_email_password_required)
    val errFirstLast = stringResource(R.string.error_first_last_name_required)
    val errGender = stringResource(R.string.error_gender_required)
    val errPwdShort = stringResource(R.string.error_password_too_short)
    val errUnknown = stringResource(R.string.error_unknown)

    fun submit() {
        errorMessage = null
        if (email.isBlank() || password.isBlank()) {
            errorMessage = errEmailPwd
            return
        }
        if (selectedTab == 1) {
            if (firstName.isBlank() || lastName.isBlank()) {
                errorMessage = errFirstLast
                return
            }
            if (gender.isBlank()) {
                errorMessage = errGender
                return
            }
            if (password.length < 6) {
                errorMessage = errPwdShort
                return
            }
        }
        loading = true
        scope.launch {
            val result = runCatching {
                withContext(Dispatchers.IO) {
                    if (selectedTab == 0) {
                        AuthRepository.login(email.trim(), password)
                    } else {
                        AuthRepository.register(
                            email = email.trim(),
                            password = password,
                            firstName = firstName.trim(),
                            lastName = lastName.trim(),
                            gender = gender,
                            birthDate = birthDate.trim()
                        )
                    }
                }
            }
            loading = false
            result.onSuccess { onAuthSuccess(it) }
            result.onFailure { errorMessage = it.message ?: errUnknown }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(TrailColors.Background),
        contentAlignment = Alignment.Center
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 32.dp, vertical = 40.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Titre
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(
                    text = "Trail Cockpit",
                    fontSize = 28.sp,
                    fontWeight = FontWeight.Bold,
                    color = TrailColors.ChargeOrange
                )
                Text(
                    text = stringResource(R.string.auth_subtitle),
                    fontSize = 14.sp,
                    color = TrailColors.SubtleText
                )
            }

            // Tabs
            TabRow(
                selectedTabIndex = selectedTab,
                containerColor = TrailColors.Surface,
                contentColor = TrailColors.ChargeOrange,
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
            ) {
                listOf(stringResource(R.string.auth_tab_login), stringResource(R.string.auth_tab_create_account)).forEachIndexed { index, label ->
                    Tab(
                        selected = selectedTab == index,
                        onClick = { selectedTab = index; errorMessage = null },
                        text = {
                            Text(
                                text = label,
                                color = if (selectedTab == index) TrailColors.ChargeOrange
                                else TrailColors.SubtleText,
                                fontWeight = if (selectedTab == index) FontWeight.SemiBold
                                else FontWeight.Normal,
                                fontSize = 14.sp
                            )
                        }
                    )
                }
            }

            // Champs
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {

                // Champs inscription seulement
                if (selectedTab == 1) {
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        OutlinedTextField(
                            value = firstName,
                            onValueChange = { firstName = it },
                            label = { Text(stringResource(R.string.auth_field_first_name)) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                            keyboardActions = KeyboardActions(
                                onNext = { focusManager.moveFocus(FocusDirection.Right) }
                            ),
                            modifier = Modifier.weight(1f),
                            colors = authFieldColors()
                        )
                        OutlinedTextField(
                            value = lastName,
                            onValueChange = { lastName = it },
                            label = { Text(stringResource(R.string.auth_field_last_name)) },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
                            keyboardActions = KeyboardActions(
                                onNext = { focusManager.moveFocus(FocusDirection.Down) }
                            ),
                            modifier = Modifier.weight(1f),
                            colors = authFieldColors()
                        )
                    }

                    // Genre
                    Column(modifier = Modifier.fillMaxWidth()) {
                        Text(
                            text = stringResource(R.string.auth_field_gender),
                            fontSize = 12.sp,
                            color = TrailColors.SubtleText,
                            modifier = Modifier.padding(bottom = 8.dp)
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            genres.forEach { g ->
                                val selected = gender == g
                                FilterChip(
                                    selected = selected,
                                    onClick = { gender = g },
                                    label = { Text(g, fontSize = 13.sp) },
                                    colors = FilterChipDefaults.filterChipColors(
                                        selectedContainerColor = TrailColors.ChargeOrange,
                                        selectedLabelColor = Color.White,
                                        containerColor = TrailColors.Surface,
                                        labelColor = TrailColors.SubtleText
                                    )
                                )
                            }
                        }
                    }

                    // Date de naissance
                    OutlinedTextField(
                        value = birthDate,
                        onValueChange = { birthDate = it },
                        label = { Text(stringResource(R.string.auth_field_birth_date)) },
                        placeholder = { Text(stringResource(R.string.format_date_placeholder), color = TrailColors.SubtleText) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(
                            keyboardType = KeyboardType.Number,
                            imeAction = ImeAction.Next
                        ),
                        keyboardActions = KeyboardActions(
                            onNext = { focusManager.moveFocus(FocusDirection.Down) }
                        ),
                        modifier = Modifier.fillMaxWidth(),
                        colors = authFieldColors()
                    )
                }

                // Email
                OutlinedTextField(
                    value = email,
                    onValueChange = { email = it; errorMessage = null },
                    label = { Text(stringResource(R.string.auth_field_email)) },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        imeAction = ImeAction.Next
                    ),
                    keyboardActions = KeyboardActions(
                        onNext = { focusManager.moveFocus(FocusDirection.Down) }
                    ),
                    modifier = Modifier.fillMaxWidth(),
                    colors = authFieldColors()
                )

                // Mot de passe
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it; errorMessage = null },
                    label = { Text(stringResource(R.string.auth_field_password)) },
                    singleLine = true,
                    visualTransformation = if (passwordVisible) VisualTransformation.None
                    else PasswordVisualTransformation(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Password,
                        imeAction = ImeAction.Done
                    ),
                    keyboardActions = KeyboardActions(onDone = { submit() }),
                    trailingIcon = {
                        IconButton(onClick = { passwordVisible = !passwordVisible }) {
                            Icon(
                                imageVector = if (passwordVisible) Icons.Default.VisibilityOff
                                else Icons.Default.Visibility,
                                contentDescription = null,
                                tint = TrailColors.SubtleText
                            )
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = authFieldColors()
                )
            }

            // Erreur
            if (errorMessage != null) {
                Text(
                    text = errorMessage!!,
                    color = TrailColors.RunRed,
                    fontSize = 13.sp,
                    modifier = Modifier.fillMaxWidth()
                )
            }

            // Bouton
            Button(
                onClick = { submit() },
                enabled = !loading,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(50.dp),
                shape = RoundedCornerShape(12.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = TrailColors.ChargeOrange,
                    contentColor = Color.White
                )
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                } else {
                    Text(
                        text = if (selectedTab == 0) stringResource(R.string.auth_button_login) else stringResource(R.string.auth_button_create),
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
        }
    }
}

@Composable
private fun authFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = TrailColors.ChargeOrange,
    unfocusedBorderColor = TrailColors.Border,
    focusedLabelColor = TrailColors.ChargeOrange,
    unfocusedLabelColor = TrailColors.SubtleText,
    focusedTextColor = TrailColors.Text,
    unfocusedTextColor = TrailColors.Text,
    cursorColor = TrailColors.ChargeOrange
)
