"use client";

import { MAX_PROJECT_ICON_BYTES, PROJECT_DESCRIPTION_MAX, PROJECT_ICON_EXTENSIONS, PROJECT_NAME_MAX } from "@artemis/contracts";
import { Folder, X } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { fieldInteractive, ghostButton } from "@/components/assistant-ui/elements/surfaces";
import { ColorSwatches } from "@/components/profile/color-swatches";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { firstUnusedColor, isAvatarColorId, paletteColorCss, type AvatarColorId } from "@/lib/avatar-colors";
import { cn } from "@/lib/utils";
import { type ProjectSummary } from "@/lib/projects";
import { ProjectIcon } from "./project-icon";
import { createProject, updateProject } from "./project-api";

const ICON_ACCEPT = Object.keys(PROJECT_ICON_EXTENSIONS).join(",");

export interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The project being edited. Absent when a new project is created. */
  project?: ProjectSummary | null;
  /** The colors of the user's other projects: a new project starts with a color none of them uses. */
  usedColors: readonly string[];
  /** Called with the saved project, after the server accepted it. */
  onSaved: (project: ProjectSummary) => void;
}

/**
 * Creates or edits a project: its name, color, optional icon and optional instructions for the assistant. The same
 * color picker as the profile's avatar color.
 */
export function ProjectDialog(props: ProjectDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* Radix unmounts the content when the dialog closes, so the form starts from the project each time it opens. */}
      <DialogContent className="gap-0 sm:max-w-md">
        <ProjectForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function ProjectForm({ project, usedColors, onSaved, onOpenChange }: ProjectDialogProps) {
  const isEdit = Boolean(project);
  const nameId = useId();
  const descriptionId = useId();
  const iconInput = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(project?.name ?? "");
  const [color, setColor] = useState<AvatarColorId>(() =>
    isAvatarColorId(project?.color) ? project.color : firstUnusedColor(usedColors),
  );
  const [description, setDescription] = useState(project?.description ?? "");
  const [iconFile, setIconFile] = useState<File | null>(null);
  // Edit only: the project's current icon is dropped on save.
  const [removeIcon, setRemoveIcon] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The preview of a chosen file: an object URL, released when the file changes or the form closes.
  const previewUrl = useMemo(() => (iconFile ? URL.createObjectURL(iconFile) : null), [iconFile]);
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !saving;
  const keepsIcon = project?.hasIcon === true && !removeIcon && !iconFile;

  function chooseIcon(file: File | undefined) {
    if (!file) return;
    if (!(file.type in PROJECT_ICON_EXTENSIONS)) {
      setError("The icon must be a PNG, JPEG, WebP or GIF image.");
      return;
    }
    if (file.size > MAX_PROJECT_ICON_BYTES) {
      setError("The icon must be 2 MB or smaller.");
      return;
    }
    setError(null);
    setRemoveIcon(false);
    setIconFile(file);
  }

  function dropIcon() {
    setIconFile(null);
    setRemoveIcon(true);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);

    const form = new FormData();
    form.set("name", trimmedName);
    form.set("color", color);
    form.set("description", description.trim());
    if (iconFile) form.set("icon", iconFile);
    else if (removeIcon) form.set("removeIcon", "true");

    try {
      const saved = isEdit && project ? await updateProject(project.id, form) : await createProject(form);
      onSaved(saved);
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "the project could not be saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-6">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit project" : "New project"}</DialogTitle>
        <DialogDescription>
          Conversations started in a project share its folder, and the assistant follows its instructions.
        </DialogDescription>
      </DialogHeader>

      {/* The icon sits on the name's line. Clicking it chooses the icon; its corner cross removes the icon. */}
      <div className="flex items-center gap-3">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => iconInput.current?.click()}
            disabled={saving}
            aria-label={previewUrl || keepsIcon ? "Change icon" : "Choose icon"}
            className={cn(
              fieldInteractive,
              "flex size-10 items-center justify-center overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
            )}
          >
            {previewUrl ? (
              // A file the user just picked: its object URL, not a served image.
              <img src={previewUrl} alt="" className="size-full object-cover" />
            ) : keepsIcon && project ? (
              <ProjectIcon project={project} size={40} />
            ) : (
              <Folder aria-hidden className="size-5" fill="currentColor" style={{ color: paletteColorCss(color) }} />
            )}
          </button>
          <input
            ref={iconInput}
            type="file"
            accept={ICON_ACCEPT}
            className="hidden"
            onChange={(event) => {
              chooseIcon(event.target.files?.[0]);
              // Lets the same file be picked again after it was removed.
              event.target.value = "";
            }}
          />
          {(previewUrl || keepsIcon) && (
            <button
              type="button"
              onClick={dropIcon}
              disabled={saving}
              aria-label="Remove icon"
              className={cn(ghostButton, "absolute -top-1.5 -right-1.5 size-5 border bg-background shadow-sm")}
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <Input
          className="min-w-0 flex-1"
          id={nameId}
          aria-label="Name"
          placeholder="Name"
          maxLength={PROJECT_NAME_MAX}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={saving}
          autoFocus
          required
        />
      </div>

      <ColorSwatches value={color} onChange={setColor} disabled={saving} />

      <div className="flex flex-col gap-2">
        <Label htmlFor={descriptionId}>
          Instructions <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={descriptionId}
          maxLength={PROJECT_DESCRIPTION_MAX}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={saving}
          placeholder="What the assistant should know or follow in this project."
        />
        <p className="text-xs text-muted-foreground">Given to the assistant in every conversation of this project.</p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSave}>
          {saving ? "Saving…" : isEdit ? "Save changes" : "Create project"}
        </Button>
      </DialogFooter>
    </form>
  );
}
