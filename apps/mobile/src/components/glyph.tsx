import { Host, Icon } from "@expo/ui";

/**
 * The app's icons, all from the platform: an SF Symbol on iOS, a Material Symbol on Android (@expo/ui's Icon). One
 * registry, so a name means the same icon on every screen. Add an icon here, not inline in a screen.
 */
const GLYPHS = {
  chevronLeft: Icon.select({ ios: "chevron.left", android: require("@expo/material-symbols/chevron_left.xml") }),
  chevronRight: Icon.select({ ios: "chevron.right", android: require("@expo/material-symbols/chevron_right.xml") }),
  chevronDown: Icon.select({ ios: "chevron.down", android: require("@expo/material-symbols/keyboard_arrow_down.xml") }),
  close: Icon.select({ ios: "xmark", android: require("@expo/material-symbols/close.xml") }),
  add: Icon.select({ ios: "plus", android: require("@expo/material-symbols/add.xml") }),
  check: Icon.select({ ios: "checkmark", android: require("@expo/material-symbols/check.xml") }),
  arrowUp: Icon.select({ ios: "arrow.up", android: require("@expo/material-symbols/arrow_upward.xml") }),
  arrowDown: Icon.select({ ios: "arrow.down", android: require("@expo/material-symbols/arrow_downward.xml") }),
  stop: Icon.select({ ios: "stop.fill", android: require("@expo/material-symbols/stop.xml") }),
  mic: Icon.select({ ios: "mic.fill", android: require("@expo/material-symbols/mic.xml") }),
  folder: Icon.select({ ios: "folder.fill", android: require("@expo/material-symbols/folder.xml") }),
  folderMove: Icon.select({ ios: "folder.badge.plus", android: require("@expo/material-symbols/drive_file_move.xml") }),
  folderRemove: Icon.select({ ios: "folder.badge.minus", android: require("@expo/material-symbols/folder_off.xml") }),
  edit: Icon.select({ ios: "pencil", android: require("@expo/material-symbols/edit.xml") }),
  delete: Icon.select({ ios: "trash", android: require("@expo/material-symbols/delete.xml") }),
  copy: Icon.select({ ios: "doc.on.doc", android: require("@expo/material-symbols/content_copy.xml") }),
  settings: Icon.select({ ios: "gearshape", android: require("@expo/material-symbols/settings.xml") }),
  archive: Icon.select({ ios: "archivebox", android: require("@expo/material-symbols/archive.xml") }),
  unarchive: Icon.select({ ios: "tray.and.arrow.up", android: require("@expo/material-symbols/unarchive.xml") }),
  sort: Icon.select({ ios: "arrow.up.arrow.down", android: require("@expo/material-symbols/swap_vert.xml") }),
  imageAdd: Icon.select({ ios: "photo.badge.plus", android: require("@expo/material-symbols/add_photo_alternate.xml") }),
  download: Icon.select({ ios: "arrow.down.circle", android: require("@expo/material-symbols/download.xml") }),
  eye: Icon.select({ ios: "eye", android: require("@expo/material-symbols/visibility.xml") }),
  send: Icon.select({ ios: "paperplane.fill", android: require("@expo/material-symbols/send.xml") }),
  user: Icon.select({ ios: "person.fill", android: require("@expo/material-symbols/person.xml") }),
  // File kinds (see lib/file-icons.ts).
  file: Icon.select({ ios: "doc", android: require("@expo/material-symbols/draft.xml") }),
  fileImage: Icon.select({ ios: "photo", android: require("@expo/material-symbols/image.xml") }),
  fileText: Icon.select({ ios: "doc.text", android: require("@expo/material-symbols/description.xml") }),
  fileSheet: Icon.select({ ios: "tablecells", android: require("@expo/material-symbols/table_chart.xml") }),
  fileSlides: Icon.select({ ios: "rectangle.on.rectangle", android: require("@expo/material-symbols/slideshow.xml") }),
  fileArchive: Icon.select({ ios: "doc.zipper", android: require("@expo/material-symbols/folder_zip.xml") }),
  fileCode: Icon.select({ ios: "chevron.left.forwardslash.chevron.right", android: require("@expo/material-symbols/code.xml") }),
  fileAudio: Icon.select({ ios: "music.note", android: require("@expo/material-symbols/audio_file.xml") }),
  fileVideo: Icon.select({ ios: "film", android: require("@expo/material-symbols/movie.xml") }),
  fileTextPlain: Icon.select({ ios: "doc.plaintext", android: require("@expo/material-symbols/article.xml") }),
} as const;

export type GlyphName = keyof typeof GLYPHS;

/** An icon inside a universal layout (a Host, a Column, a ListItem slot). Renders no Host of its own. */
export function Glyph({ name, color }: { name: GlyphName; color?: string }) {
  return <Icon name={GLYPHS[name]} color={color} />;
}

/** An icon in plain React Native code: wrapped in its own Host, sized to the icon. */
export function GlyphView({ name, color }: { name: GlyphName; color?: string }) {
  return (
    <Host matchContents>
      <Glyph name={name} color={color} />
    </Host>
  );
}
