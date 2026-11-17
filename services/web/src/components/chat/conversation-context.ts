"use client";

import { createContext } from "react";

/** The conversation the chat is showing. Lets message renderers build links to that conversation's files. */
export const ConversationIdContext = createContext<string | null>(null);

/**
 * The CSS color of the chat's project, when the chat has one: the in-chat mascot takes it. Undefined outside a project,
 * where the mascot keeps the theme's color.
 */
export const ProjectColorContext = createContext<string | undefined>(undefined);
