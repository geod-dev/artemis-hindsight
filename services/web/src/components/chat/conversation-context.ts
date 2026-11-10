"use client";

import { createContext } from "react";

/** The conversation the chat is showing. Lets message renderers build links to that conversation's files. */
export const ConversationIdContext = createContext<string | null>(null);
