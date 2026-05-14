import { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";
import { colors } from "../lib/theme";

interface Props {
  children: ReactNode;
  /** Override the screen background. Defaults to brand blue (for auth screens). */
  backgroundColor?: string;
  /** SafeAreaView edges. Defaults to all sides. */
  edges?: Edge[];
  /** Additional style for the scroll container. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** iOS-only offset above the keyboard. */
  keyboardVerticalOffset?: number;
  /** Dismiss the keyboard on tap-outside. Defaults to true. */
  dismissOnTap?: boolean;
}

/**
 * Shared wrapper for auth/form screens — handles SafeArea, keyboard avoidance,
 * scroll-when-needed, and tap-outside-to-dismiss. Solid opaque background.
 */
export function AuthScreenContainer({
  children,
  backgroundColor = "#155ac1",
  edges = ["top", "bottom", "left", "right"],
  contentContainerStyle,
  keyboardVerticalOffset = 0,
  dismissOnTap = true,
}: Props) {
  const inner = (
    <ScrollView
      style={{ flex: 1, backgroundColor }}
      contentContainerStyle={[styles.scroll, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      {children}
    </ScrollView>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor }]} edges={edges}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        {dismissOnTap ? (
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            {inner}
          </TouchableWithoutFeedback>
        ) : (
          inner
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flexGrow: 1 },
});
