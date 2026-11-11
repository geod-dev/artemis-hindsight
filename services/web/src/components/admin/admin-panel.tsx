"use client";

import { Archive, ArchiveRestore, KeyRound, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// The access key is kept for this browser tab only (sessionStorage) and sent with every admin request.
const KEY_STORAGE = "artemis-admin-key";

interface AdminUser {
  username: string;
  status: "active" | "archived";
  createdAt: string;
}

function readStoredKey(): string | null {
  try {
    return sessionStorage.getItem(KEY_STORAGE);
  } catch {
    return null;
  }
}

function storeKey(key: string | null): void {
  try {
    if (key) sessionStorage.setItem(KEY_STORAGE, key);
    else sessionStorage.removeItem(KEY_STORAGE);
  } catch {
    // Storage can be blocked; the panel then asks for the key again on reload.
  }
}

async function errorOf(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `request failed (HTTP ${res.status})`;
}

export function AdminPanel() {
  const [adminKey, setAdminKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAdminKey(readStoredKey());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!adminKey) {
    return (
      <KeyGate
        onUnlock={(key) => {
          storeKey(key);
          setAdminKey(key);
        }}
      />
    );
  }
  return (
    <UserManager
      adminKey={adminKey}
      onForbidden={() => {
        storeKey(null);
        setAdminKey(null);
      }}
    />
  );
}

function KeyGate({ onUnlock }: { onUnlock: (key: string) => void }) {
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setChecking(true);
    try {
      // Checking the key against a read-only admin request, so a wrong key is rejected before the panel opens.
      const res = await fetch("/api/admin/users", { headers: { "x-admin-key": key } });
      if (!res.ok) {
        setError(await errorOf(res));
        return;
      }
      onUnlock(key);
    } catch {
      setError("could not reach the server");
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-5" /> Admin access
        </CardTitle>
        <CardDescription>Enter the admin access key to manage users.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit} className="grid gap-6">
        <CardContent className="grid gap-2">
          <Label htmlFor="admin-key">Admin access key</Label>
          <Input
            id="admin-key"
            type="password"
            autoComplete="off"
            required
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={checking}>
            {checking ? "Checking..." : "Open admin panel"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

function UserManager({ adminKey, onForbidden }: { adminKey: string; onForbidden: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);

  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [deleteFor, setDeleteFor] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  // Every admin operation goes through here, so the key is always sent.
  async function admin(path: string, init: { method?: string; body?: unknown } = {}): Promise<Response> {
    const res = await fetch(path, {
      method: init.method ?? "GET",
      headers: {
        "x-admin-key": adminKey,
        ...(init.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
    if (res.status === 403) onForbidden();
    return res;
  }

  async function load() {
    setLoading(true);
    try {
      const res = await admin("/api/admin/users");
      if (!res.ok) {
        setMessage({ kind: "error", text: await errorOf(res) });
        return;
      }
      const body = (await res.json()) as { users: AdminUser[] };
      setUsers(body.users);
    } catch {
      setMessage({ kind: "error", text: "could not reach the server" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminKey]);

  /** Runs one admin action, shows its outcome and refreshes the list. */
  async function run(action: () => Promise<Response>, success: string): Promise<boolean> {
    setBusy(true);
    setMessage(null);
    try {
      const res = await action();
      if (!res.ok) {
        setMessage({ kind: "error", text: await errorOf(res) });
        return false;
      }
      setMessage({ kind: "info", text: success });
      await load();
      return true;
    } catch {
      setMessage({ kind: "error", text: "could not reach the server" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    const ok = await run(
      () => admin("/api/admin/users", { method: "POST", body: { username: newUsername, password: newPassword } }),
      `Created ${newUsername.trim().toLowerCase()}.`,
    );
    setCreating(false);
    if (ok) {
      setNewUsername("");
      setNewPassword("");
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6 p-4 md:p-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">Create accounts, reset passwords, archive and delete users.</p>
      </header>

      {message && (
        <p role={message.kind === "error" ? "alert" : "status"} className={message.kind === "error" ? "text-sm text-destructive" : "text-sm text-muted-foreground"}>
          {message.text}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="size-5" /> Create a user
          </CardTitle>
          <CardDescription>
            Usernames are 3-32 characters (a-z, 0-9, _ or -) and cannot be changed later. The password is at least 8 characters.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onCreate} className="grid gap-6">
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="new-username">Username</Label>
              <Input
                id="new-username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={newUsername}
                onChange={(event) => setNewUsername(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">Password</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={creating || busy}>
              {creating ? "Creating..." : "Create user"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>Archived users cannot sign in. Only archived users can be deleted.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              )}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    No users yet.
                  </TableCell>
                </TableRow>
              )}
              {users.map((user) => (
                <TableRow key={user.username}>
                  <TableCell className="font-medium">{user.username}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === "active" ? "secondary" : "outline"}>{user.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" disabled={busy} onClick={() => setResetFor(user.username)}>
                        <KeyRound className="size-4" /> Reset password
                      </Button>
                      {user.status === "active" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => void run(
                            () => admin(`/api/admin/users/${encodeURIComponent(user.username)}/status`, { method: "POST", body: { archived: true } }),
                            `Archived ${user.username}.`,
                          )}
                        >
                          <Archive className="size-4" /> Archive
                        </Button>
                      ) : (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy}
                            onClick={() => void run(
                              () => admin(`/api/admin/users/${encodeURIComponent(user.username)}/status`, { method: "POST", body: { archived: false } }),
                              `Restored ${user.username}.`,
                            )}
                          >
                            <ArchiveRestore className="size-4" /> Restore
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={() => {
                              setDeleteConfirm("");
                              setDeleteFor(user.username);
                            }}
                          >
                            <Trash2 className="size-4" /> Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={resetFor !== null} onOpenChange={(open) => !open && setResetFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password for {resetFor}</DialogTitle>
            <DialogDescription>The user keeps their existing sessions until they expire.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label htmlFor="reset-password">New password</Label>
            <Input
              id="reset-password"
              type="password"
              autoComplete="new-password"
              value={resetPasswordValue}
              onChange={(event) => setResetPasswordValue(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetFor(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || resetPasswordValue.length === 0}
              onClick={async () => {
                const target = resetFor;
                if (!target) return;
                const ok = await run(
                  () => admin(`/api/admin/users/${encodeURIComponent(target)}/password`, { method: "POST", body: { password: resetPasswordValue } }),
                  `Password reset for ${target}.`,
                );
                if (ok) {
                  setResetFor(null);
                  setResetPasswordValue("");
                }
              }}
            >
              Save password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteFor !== null} onOpenChange={(open) => !open && setDeleteFor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteFor} for good?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the account, every conversation and message, all files in their workspace and sandbox, and
              their long-term memory. It cannot be undone. Type the username to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            aria-label="Type the username to confirm"
            autoComplete="off"
            value={deleteConfirm}
            onChange={(event) => setDeleteConfirm(event.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive" })}
              disabled={busy || deleteConfirm !== deleteFor}
              onClick={async (event) => {
                event.preventDefault();
                const target = deleteFor;
                if (!target) return;
                const ok = await run(
                  () => admin(`/api/admin/users/${encodeURIComponent(target)}`, { method: "DELETE", body: { confirm: deleteConfirm } }),
                  `Deleted ${target}.`,
                );
                if (ok) setDeleteFor(null);
              }}
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
