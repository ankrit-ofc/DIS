import {
  useEffect,
  useRef,
  ReactNode,
} from "react";
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  PanResponder,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { modalKeyboardBehavior } from "../lib/screen";
import { colors, radius } from "../lib/theme";

const { height: SCREEN_H } = Dimensions.get("window");

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  snapHeight?: number; // how tall the sheet is, default 0.75 * screen
}

export function BottomSheet({
  visible,
  onClose,
  children,
  snapHeight = SCREEN_H * 0.78,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(snapHeight)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        damping: 20,
        stiffness: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: snapHeight,
        duration: 240,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 5,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80) {
          onClose();
        } else {
          Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      {/* An Android Modal is its own native window and does not inherit the
          Activity's adjustResize, so a sheet with inputs needs explicit padding
          on both platforms or the keyboard covers it. */}
      <KeyboardAvoidingView style={styles.avoider} behavior={modalKeyboardBehavior}>
        <Animated.View
          style={[
            styles.sheet,
            { height: snapHeight, paddingBottom: insets.bottom, transform: [{ translateY }] },
          ]}
          {...panResponder.panHandlers}
        >
          <View style={styles.handle} />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  avoider: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: "hidden",
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray200,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
});
