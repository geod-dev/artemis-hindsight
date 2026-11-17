import * as DocumentPicker from "expo-document-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { Folder, ImagePlus, X } from "lucide-react-native";
import { ColorSwatches } from "@/components/color-swatches";
import { ApiError } from "@/lib/api";
import { useSetConversationProject } from "@/queries/conversations";
import { firstUnusedColor, isAvatarColorId, paletteHex, type AvatarColorId } from "@/lib/avatar";
import {
  projectIconSource,
  useCreateProject,
  useDeleteProject,
  useProjects,
  useUpdateProject,
  type PickedIcon,
  type ProjectSummary,
} from "@/queries/projects";
import { usePreferences } from "@/preferences";

// The limits the server checks (packages/contracts/src/projects.ts): the same ones the web dialog shows.
const NAME_MAX = 60;
const DESCRIPTION_MAX = 4000;
const ICON_MAX_BYTES = 2 * 1024 * 1024;
const ICON_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

/**
 * Creates a project (no id) or edits one (`?id=`): its icon, name, color and instructions for the assistant. The same
 * fields as the web's project dialog. Saving opens the project's new chat, with the project selected.
 */
export default function ProjectFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { colors } = usePreferences();
  const projects = useProjects();

  if (!id) return <ProjectForm key="new" existing={null} />;
  if (projects.isPending) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  const existing = projects.data?.find((project) => project.id === id) ?? null;
  if (!existing) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.muted }}>This project no longer exists.</Text>
      </View>
    );
  }
  return <ProjectForm key={existing.id} existing={existing} />;
}

function ProjectForm({ existing }: { existing: ProjectSummary | null }) {
  const { colors } = usePreferences();
  const router = useRouter();
  const isEdit = existing !== null;
  const projects = useProjects();
  const create = useCreateProject();
  const update = useUpdateProject(existing?.id ?? "");
  const remove = useDeleteProject();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  // Set when the form was opened from a conversation's "Move to project": that conversation joins the new project.
  const { moveConversation } = useLocalSearchParams<{ moveConversation?: string }>();
  const moveConversationTo = useSetConversationProject();

  const [name, setName] = useState(existing?.name ?? "");
  const [color, setColor] = useState<AvatarColorId>(() =>
    isAvatarColorId(existing?.color)
      ? existing.color
      : firstUnusedColor((projects.data ?? []).map((project) => project.color)),
  );
  const [description, setDescription] = useState(existing?.description ?? "");
  const [icon, setIcon] = useState<PickedIcon | null>(null);
  // Edit only: the project's current icon is dropped on save.
  const [removeIcon, setRemoveIcon] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The keyboard's own animation: the screen's bottom padding follows it, so the form stays above the keyboard (as sign-in).
  const { height } = useReanimatedKeyboardAnimation();
  const keyboardPadding = useAnimatedStyle(() => ({ paddingBottom: Math.max(0, -height.value) }));

  const busy = create.isPending || update.isPending || remove.isPending;
  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !busy;
  const keepsIcon = existing?.hasIcon === true && !removeIcon && icon === null;

  async function pickIcon() {
    const result = await DocumentPicker.getDocumentAsync({ type: "image/*", copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset) return;
    const type = asset.mimeType ?? ICON_TYPES[asset.name.split(".").pop()?.toLowerCase() ?? ""] ?? "";
    if (!Object.values(ICON_TYPES).includes(type)) {
      setError("The icon must be a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if ((asset.size ?? 0) > ICON_MAX_BYTES) {
      setError("The icon must be 2 MB or smaller.");
      return;
    }
    setError(null);
    setRemoveIcon(false);
    setIcon({ uri: asset.uri, name: asset.name, type });
  }

  function dropIcon() {
    setIcon(null);
    setRemoveIcon(true);
  }

  function save() {
    if (!canSave) return;
    setError(null);
    const draft = {
      name: trimmedName,
      color,
      description,
      ...(icon ? { icon } : {}),
      ...(isEdit && removeIcon && !icon ? { removeIcon: true } : {}),
    };
    const mutation = existing ? update : create;
    mutation.mutate(draft, {
      onSuccess: (saved) => {
        if (moveConversation && !existing) {
          // Created from a conversation's "Move to project": the conversation goes into it, and the chat reopens.
          moveConversationTo.mutate(
            { id: moveConversation, projectId: saved.id },
            {
              onSuccess: () => router.navigate(`/c/${moveConversation}`),
              onError: (cause) => setError(cause instanceof ApiError ? cause.message : "The conversation could not be moved."),
            },
          );
          return;
        }
        // The project's new chat opens with it selected.
        router.navigate(`/new?project=${saved.id}&session=${Date.now()}`);
      },
      onError: (cause) => setError(cause instanceof ApiError ? cause.message : "The project could not be saved."),
    });
  }

  function confirmDelete(target: ProjectSummary) {
    Alert.alert(
      "Delete project",
      `"${target.name}" and its folder, files and icon will be deleted. Its conversations stay in Recents. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () =>
            remove.mutate(target.id, {
              onSuccess: () => router.navigate("/new"),
              onError: (cause) =>
                Alert.alert("Delete failed", cause instanceof ApiError ? cause.message : "Try again later."),
            }),
        },
      ],
    );
  }

  const field = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];
  const hasPreview = icon !== null || keepsIcon;

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: colors.background }, keyboardPadding]}>
      <Stack.Screen options={{ title: isEdit ? "Edit project" : "New project" }} />
      <ScrollView ref={scroll} contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Text style={[styles.label, { color: colors.muted }]}>Icon</Text>
        <View style={styles.iconRow}>
          <View style={[styles.iconBox, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            {icon ? (
              <Image source={{ uri: icon.uri }} style={styles.iconImage} accessibilityIgnoresInvertColors />
            ) : keepsIcon && existing ? (
              <Image source={projectIconSource(existing)} style={styles.iconImage} accessibilityIgnoresInvertColors />
            ) : (
              <Folder size={30} color={paletteHex(color)} fill={paletteHex(color)} />
            )}
          </View>
          <View style={styles.iconActions}>
            <Pressable
              onPress={() => void pickIcon()}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.secondary, { borderColor: colors.border }]}
            >
              <ImagePlus size={16} color={colors.text} />
              <Text style={[styles.secondaryText, { color: colors.text }]}>{hasPreview ? "Change icon" : "Add icon"}</Text>
            </Pressable>
            {hasPreview ? (
              <Pressable onPress={dropIcon} disabled={busy} accessibilityRole="button" style={styles.textAction}>
                <X size={14} color={colors.muted} />
                <Text style={[styles.textActionText, { color: colors.muted }]}>Remove</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX}
          placeholder="Trip to Lisbon"
          placeholderTextColor={colors.muted}
          editable={!busy}
          style={field}
        />

        <Text style={[styles.label, { color: colors.muted }]}>Color</Text>
        <ColorSwatches value={color} onChange={setColor} disabled={busy} />

        <Text style={[styles.label, { color: colors.muted }]}>Instructions (optional)</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          maxLength={DESCRIPTION_MAX}
          multiline
          textAlignVertical="top"
          placeholder="What the assistant should know or follow in this project."
          placeholderTextColor={colors.muted}
          editable={!busy}
          onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250)}
          style={[...field, styles.textarea]}
        />
        <Text style={[styles.hint, { color: colors.muted }]}>Given to the assistant in every conversation of this project.</Text>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          style={[styles.button, { backgroundColor: colors.accent, opacity: canSave ? 1 : 0.4 }]}
        >
          {create.isPending || update.isPending ? (
            <ActivityIndicator color={colors.accentText} />
          ) : (
            <Text style={[styles.buttonText, { color: colors.accentText }]}>{isEdit ? "Save changes" : "Create project"}</Text>
          )}
        </Pressable>

        {existing ? (
          <Pressable
            onPress={() => confirmDelete(existing)}
            disabled={busy}
            accessibilityRole="button"
            style={[styles.deleteButton, { borderColor: colors.border }]}
          >
            <Text style={[styles.deleteText, { color: colors.danger }]}>Delete project</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  form: { gap: 10, padding: 16, paddingBottom: 32 },
  label: { fontSize: 13, fontWeight: "500", marginTop: 8 },
  iconRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  iconBox: { width: 72, height: 72, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  iconImage: { width: 72, height: 72 },
  iconActions: { gap: 6, alignItems: "flex-start" },
  secondary: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14 },
  secondaryText: { fontSize: 14, fontWeight: "500" },
  textAction: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 4, paddingHorizontal: 4 },
  textActionText: { fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  textarea: { minHeight: 120 },
  hint: { fontSize: 12 },
  error: { fontSize: 14, marginTop: 4 },
  button: { marginTop: 16, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  buttonText: { fontSize: 16, fontWeight: "600" },
  deleteButton: { marginTop: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingVertical: 14, alignItems: "center" },
  deleteText: { fontSize: 16, fontWeight: "600" },
});
