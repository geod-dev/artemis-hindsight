import * as DocumentPicker from "expo-document-picker";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { Button, Column, Row, RNHostView, Text, TextInput } from "@expo/ui";
import { Glyph, GlyphView } from "@/components/glyph";
import { ColorSwatches } from "@/components/color-swatches";
import { M3Host } from "@/components/m3";
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
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }
  const existing = projects.data?.find((project) => project.id === id) ?? null;
  if (!existing) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <M3Host matchContents>
          <Text textStyle={{ color: colors.muted }}>This project no longer exists.</Text>
        </M3Host>
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

  const hasPreview = icon !== null || keepsIcon;

  return (
    <Animated.View style={[{ flex: 1, backgroundColor: colors.background }, keyboardPadding]}>
      <Stack.Screen options={{ title: isEdit ? "Edit project" : "New project" }} />
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled">
        <M3Host matchContents={{ vertical: true }}>
          <Column>
            <Text>Icon</Text>
            <Row alignment="center">
              {icon ? (
                <Image source={{ uri: icon.uri }} style={{ width: 72, height: 72 }} accessibilityIgnoresInvertColors />
              ) : keepsIcon && existing ? (
                <Image source={projectIconSource(existing)} style={{ width: 72, height: 72 }} accessibilityIgnoresInvertColors />
              ) : (
                <GlyphView name="folder" color={paletteHex(color)} />
              )}
              <Column>
                <Button variant="outlined" disabled={busy} onPress={() => void pickIcon()}>
                  <Row alignment="center">
                    <Glyph name="imageAdd" />
                    <Text>{hasPreview ? "Change icon" : "Add icon"}</Text>
                  </Row>
                </Button>
                {hasPreview ? <Button variant="text" label="Remove" disabled={busy} onPress={dropIcon} /> : null}
              </Column>
            </Row>

            <Text>Name</Text>
            <TextInput onChangeText={setName} maxLength={NAME_MAX} placeholder="Trip to Lisbon" editable={!busy} />

            <Text>Color</Text>
            <RNHostView matchContents>
              <ColorSwatches value={color} onChange={setColor} disabled={busy} />
            </RNHostView>

            <Text>Instructions (optional)</Text>
            <TextInput
              onChangeText={setDescription}
              maxLength={DESCRIPTION_MAX}
              multiline
              placeholder="What the assistant should know or follow in this project."
              editable={!busy}
              onFocus={() => setTimeout(() => scroll.current?.scrollToEnd({ animated: true }), 250)}
            />
            <Text textStyle={{ color: colors.muted }}>Given to the assistant in every conversation of this project.</Text>

            {error ? <Text textStyle={{ color: colors.danger }}>{error}</Text> : null}

            <Button
              variant="filled"
              disabled={!canSave}
              style={{ backgroundColor: colors.accent }}
              label={create.isPending || update.isPending ? "Saving…" : isEdit ? "Save changes" : "Create project"}
              onPress={save}
            />

            {existing ? (
              <Button variant="outlined" disabled={busy} onPress={() => confirmDelete(existing)}>
                <Text textStyle={{ color: colors.danger }}>Delete project</Text>
              </Button>
            ) : null}
          </Column>
        </M3Host>
      </ScrollView>
    </Animated.View>
  );
}
