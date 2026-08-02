import { Platform } from "react-native";
import type { Edge } from "react-native-safe-area-context";

/**
 * Edge-to-edge is on (android/gradle.properties `edgeToEdgeEnabled=true`) and the
 * app targets API 36, so every screen draws under the status bar and the navigation
 * bar. Nothing insets content for us — each screen has to apply the insets itself.
 *
 * The rule, applied everywhere:
 *
 *   SafeAreaView owns the TOP and the SIDES.
 *   Whatever PAINTS the bottom of the screen owns the BOTTOM inset.
 *
 * The bottom is deliberately never given to SafeAreaView: its background is the
 * header colour (brand blue on most screens) while the bottom of the screen is
 * content-coloured, so a `bottom` edge would paint a blue bar above the navigation
 * bar. The bottom inset instead goes on whichever element actually reaches the
 * bottom — a scroll `contentContainerStyle`, a pinned footer bar, or the tab bar.
 *
 * Getting this wrong is invisible on gesture navigation and breaks on 3-button
 * navigation, which is why these are named rather than inlined.
 */
export const SCREEN_EDGES: Edge[] = ["top", "left", "right"];

/**
 * KeyboardAvoidingView behavior for a normal screen.
 *
 * Android sets `windowSoftInputMode="adjustResize"` (AndroidManifest.xml) and
 * `softwareKeyboardLayoutMode: "resize"` (app.json), so the OS already shrinks the
 * window — `undefined` lets it. Passing "height" here double-compensates, which is
 * what made several screens jump when the keyboard opened.
 */
export const keyboardBehavior = Platform.OS === "ios" ? ("padding" as const) : undefined;

/**
 * KeyboardAvoidingView behavior *inside* a React Native <Modal>.
 *
 * An Android Modal is a separate native window and does NOT inherit the Activity's
 * adjustResize, so `undefined` leaves the sheet pinned under the keyboard. Modals
 * need explicit padding on both platforms.
 */
export const modalKeyboardBehavior = "padding" as const;
