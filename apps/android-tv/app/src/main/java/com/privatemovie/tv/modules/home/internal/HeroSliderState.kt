package com.privatemovie.tv.modules.home.internal

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEvent
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.type
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class HeroSliderState(
    val heroes: List<TvHomeHero>,
    val autoAdvanceIntervalMs: Long = 6000L
) {
    var activeIndex: Int by mutableIntStateOf(0)

    var isCtaFocused by mutableStateOf(false)
        private set

    var timerResetToken: Int by mutableIntStateOf(0)
        private set

    val heroCount: Int
        get() = heroes.size

    val activeHero: TvHomeHero?
        get() = if (heroes.isNotEmpty() && activeIndex in heroes.indices) heroes[activeIndex] else null

    fun resetTimer() {
        timerResetToken++
    }

    fun advanceSlide(resetTimer: Boolean = false) {
        if (heroCount > 1) {
            activeIndex = (activeIndex + 1) % heroCount
            if (resetTimer) {
                resetTimer()
            }
        }
    }

    fun previousSlide(resetTimer: Boolean = true) {
        if (heroCount > 1) {
            activeIndex = (activeIndex - 1 + heroCount) % heroCount
            if (resetTimer) {
                resetTimer()
            }
        }
    }

    fun selectSlide(index: Int, resetTimer: Boolean = true) {
        if (index in 0 until heroCount) {
            activeIndex = index
            if (resetTimer) {
                resetTimer()
            }
        }
    }

    fun onCtaFocusChanged(focused: Boolean) {
        isCtaFocused = focused
        if (focused) {
            resetTimer()
        }
    }

    fun onFocusChanged(isFocused: Boolean) {
        onCtaFocusChanged(isFocused)
    }

    fun handleKey(isKeyDown: Boolean, keyCode: Int): Boolean {
        if (isKeyDown) {
            when (keyCode) {
                android.view.KeyEvent.KEYCODE_DPAD_LEFT -> {
                    if (heroCount > 1) {
                        previousSlide(resetTimer = true)
                        return true
                    }
                }
                android.view.KeyEvent.KEYCODE_DPAD_RIGHT -> {
                    if (heroCount > 1) {
                        advanceSlide(resetTimer = true)
                        return true
                    }
                }
            }
        }
        return false
    }

    fun handleKeyEvent(event: KeyEvent): Boolean {
        return handleKey(
            isKeyDown = event.type == KeyEventType.KeyDown,
            keyCode = event.nativeKeyEvent.keyCode
        )
    }

    suspend fun runAutoAdvanceLoop() {
        while (true) {
            delay(autoAdvanceIntervalMs)
            if (isCtaFocused && heroCount > 1) {
                advanceSlide(resetTimer = false)
            }
        }
    }

    fun startAutoAdvance(scope: CoroutineScope): Job {
        return scope.launch {
            runAutoAdvanceLoop()
        }
    }
}

@Composable
fun rememberHeroSliderState(
    heroes: List<TvHomeHero>,
    autoAdvanceIntervalMs: Long = 6000L
): HeroSliderState {
    val state = remember(heroes, autoAdvanceIntervalMs) {
        HeroSliderState(heroes = heroes, autoAdvanceIntervalMs = autoAdvanceIntervalMs)
    }

    LaunchedEffect(state, state.timerResetToken, state.isCtaFocused) {
        if (state.isCtaFocused && state.heroCount > 1) {
            while (true) {
                delay(autoAdvanceIntervalMs)
                state.advanceSlide(resetTimer = false)
            }
        }
    }

    return state
}

