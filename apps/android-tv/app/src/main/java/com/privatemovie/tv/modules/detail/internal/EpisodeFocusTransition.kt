package com.privatemovie.tv.modules.detail.internal

/**
 * Pure D-pad downward focus-transition logic for the episode carousel.
 *
 * Keeps all branching decisions (target selection, fallback, event consumption)
 * in unit-testable pure functions. Compose callers only perform the scroll and
 * focus-request side effects driven by these decisions.
 */

/**
 * Focus plan for a downward transition into the episode carousel.
 *
 * @param targetIndex clamped index of the episode card to focus first.
 * @param fallbackIndex card to focus when the target cannot acquire focus (Card 0).
 */
data class CarouselFocusPlan(
    val targetIndex: Int,
    val fallbackIndex: Int = 0
)

/**
 * Plans a downward focus transition into the carousel.
 *
 * Returns null when there is no episode to focus — callers must NOT consume
 * the D-pad event in that case so focus can move naturally instead of
 * trapping the user on the CTA or season button.
 */
fun planDownwardFocus(episodeCount: Int, rememberedIndex: Int): CarouselFocusPlan? {
    if (episodeCount <= 0) return null
    return CarouselFocusPlan(targetIndex = rememberedIndex.coerceIn(0, episodeCount - 1))
}

/**
 * Whether a D-pad Down key event may be consumed to start a carousel transition.
 *
 * Returns false when there are no episodes or a transition is already in
 * flight — the event must propagate so the user never gets stuck.
 */
fun shouldConsumeDownKey(episodeCount: Int, transitionInFlight: Boolean): Boolean {
    if (episodeCount <= 0) return false
    if (transitionInFlight) return false
    return true
}

/**
 * Executes a [CarouselFocusPlan] against a focus-request side effect.
 *
 * Scroll synchronization (scrolling the card into view) is the caller's
 * responsibility before invoking this. Tries the target card first; when it
 * fails after the caller's retries, gracefully falls back to Card 0 rather
 * than leaving focus trapped or lost.
 *
 * @return the focused card index, or null when neither target nor fallback
 * could acquire focus.
 */
suspend fun executeCarouselFocus(
    plan: CarouselFocusPlan,
    requestFocus: suspend (index: Int) -> Boolean
): Int? {
    if (requestFocus(plan.targetIndex)) return plan.targetIndex
    if (plan.fallbackIndex != plan.targetIndex && requestFocus(plan.fallbackIndex)) {
        return plan.fallbackIndex
    }
    return null
}
