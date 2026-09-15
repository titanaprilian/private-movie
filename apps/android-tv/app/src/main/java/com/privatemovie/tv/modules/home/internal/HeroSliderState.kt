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

    var isPaused by mutableStateOf(false)
        private set

    val heroCount: Int
        get() = heroes.size

    val activeHero: TvHomeHero?
        get() = if (heroes.isNotEmpty() && activeIndex in heroes.indices) heroes[activeIndex] else null

    fun advanceSlide() {
        if (heroCount > 1) {
            activeIndex = (activeIndex + 1) % heroCount
        }
    }

    fun previousSlide() {
        if (heroCount > 1) {
            activeIndex = (activeIndex - 1 + heroCount) % heroCount
        }
    }

    fun selectSlide(index: Int) {
        if (index in 0 until heroCount) {
            activeIndex = index
        }
    }

    fun onFocusChanged(isFocused: Boolean) {
        isPaused = isFocused
    }

    fun handleKey(isKeyDown: Boolean, keyCode: Int): Boolean {
        if (isKeyDown) {
            when (keyCode) {
                android.view.KeyEvent.KEYCODE_DPAD_LEFT -> {
                    if (heroCount > 1) {
                        previousSlide()
                        return true
                    }
                }
                android.view.KeyEvent.KEYCODE_DPAD_RIGHT -> {
                    if (heroCount > 1) {
                        advanceSlide()
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
            if (!isPaused && heroCount > 1) {
                advanceSlide()
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

    LaunchedEffect(state) {
        state.runAutoAdvanceLoop()
    }

    return state
}

