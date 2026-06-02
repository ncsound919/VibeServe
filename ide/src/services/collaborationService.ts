/**
 * Real-time collaboration service using yjs.
 * Manages yjs document, WebSocket sync, awareness (cursors), and Monaco binding.
 */

import type { editor as MonacoEditor } from "monaco-editor";
import * as Y from "yjs";

export interface CollaboratorPresence {
	name: string;
	color: string;
	cursor?: { line: number; column: number };
	selection?: {
		startLine: number;
		startColumn: number;
		endLine: number;
		endColumn: number;
	};
}

const COLORS = [
	"#58a6ff",
	"#3fb950",
	"#d29922",
	"#f85149",
	"#a371f7",
	"#79c0ff",
	"#56d364",
	"#e3b341",
];

let colorIndex = 0;
function nextColor(): string {
	const c = COLORS[colorIndex % COLORS.length];
	colorIndex++;
	return c;
}

class CollabSession {
	doc: Y.Doc;
	room: string;
	userName: string;
	userColor: string;
	ws: WebSocket | null = null;
	textBinding: Y.Text | null = null;
	editor: MonacoEditor.IStandaloneCodeEditor | null = null;
	monaco: MonacoEditor.IStandaloneCodeEditor | null = null;
	remoteDecorations: Map<string, string[]> = new Map(); // userId -> decorationIds
	onPresenceChange?: (presences: CollaboratorPresence[]) => void;
	isConnected = false;
	reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	destroyed = false;
	onConnectionChange?: (connected: boolean) => void;

	constructor(room: string, userName: string) {
		this.doc = new Y.Doc();
		this.room = room;
		this.userName = userName;
		this.userColor = nextColor();
	}

	async connect(url: string) {
		this.ws = new WebSocket(url);
		this.ws.binaryType = "arraybuffer";

		this.ws.onopen = () => {
			this.isConnected = true;
			this.onConnectionChange?.(true);

			// Send initial sync step 1
			const state = Y.encodeStateAsUpdate(this.doc);
			this.ws?.send(state as unknown as BufferSource);

			// Announce presence
			this.sendPresence();
		};

		this.ws.onmessage = (event) => {
			if (event.data instanceof ArrayBuffer) {
				// Binary update
				try {
					Y.applyUpdate(this.doc, new Uint8Array(event.data));
				} catch {
					// Invalid update
				}
			} else if (typeof event.data === "string") {
				try {
					const msg = JSON.parse(event.data);
					if (msg.type === "presence" && msg.userId !== this.userName) {
						this.onPresenceChange?.(msg.presences ?? []);
					}
				} catch {
					// Ignore
				}
			}
		};

		this.ws.onclose = () => {
			this.isConnected = false;
			this.onConnectionChange?.(false);
			if (!this.destroyed) {
				this.reconnectTimer = setTimeout(() => this.connect(url), 2000);
			}
		};

		this.ws.onerror = () => {
			// handled by onclose
		};

		// Listen for yjs doc changes -> send to server
		this.doc.on("update", (update: Uint8Array) => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(update as unknown as BufferSource);
			}
		});
	}

	private sendPresence() {
		if (this.ws?.readyState === WebSocket.OPEN) {
			this.ws.send(
				JSON.stringify({
					type: "presence",
					userId: this.userName,
					presences: [
						{
							name: this.userName,
							color: this.userColor,
							cursor: null,
						},
					],
				}),
			);
		}
	}

	/**
	 * Bind yjs to a Monaco editor model for real-time collaboration.
	 */
	bindEditor(editor: MonacoEditor.IStandaloneCodeEditor) {
		this.editor = editor;

		// Get or create the shared text type for this room
		const ytext = this.doc.getText(this.room);

		// Set initial content from Monaco
		if (ytext.length === 0) {
			this.doc.transact(() => {
				ytext.insert(0, editor.getValue());
			});
		}

		// yjs -> Monaco
		ytext.observe((event: Y.YTextEvent) => {
			const model = editor.getModel();
			if (!model) return;

			let index = 0;
			event.delta.forEach(
				(d: { retain?: number; delete?: number; insert?: string | object }) => {
					if (d.retain) {
						index += d.retain;
					} else if (d.delete) {
						const startPos = model.getPositionAt(index);
						const endPos = model.getPositionAt(index + (d.delete as number));
						editor.executeEdits("collab", [
							{
								range: {
									startLineNumber: startPos.lineNumber,
									startColumn: startPos.column,
									endLineNumber: endPos.lineNumber,
									endColumn: endPos.column,
								},
								text: "",
							},
						]);
					} else if (d.insert) {
						const insertText = typeof d.insert === "string" ? d.insert : "";
						const pos = model.getPositionAt(index);
						editor.executeEdits("collab", [
							{
								range: {
									startLineNumber: pos.lineNumber,
									startColumn: pos.column,
									endLineNumber: pos.lineNumber,
									endColumn: pos.column,
								},
								text: insertText,
							},
						]);
						index += insertText.length;
					}
				},
			);
		});

		// Monaco -> yjs
		editor.onDidChangeModelContent((e) => {
			// Don't sync our own collaborative edits back
			if (e.isFlush) return;

			this.doc.transact(() => {
				e.changes.forEach((change) => {
					const startOffset = editor.getModel()?.getOffsetAt({
						lineNumber: change.range.startLineNumber,
						column: change.range.startColumn,
					});
					if (startOffset !== undefined) {
						ytext.delete(startOffset, change.rangeLength);
						ytext.insert(startOffset, change.text);
					}
				});
			});
		});

		// Cursor awareness
		editor.onDidChangeCursorPosition((e) => {
			if (this.ws?.readyState === WebSocket.OPEN) {
				this.ws.send(
					JSON.stringify({
						type: "presence",
						userId: this.userName,
						presences: [
							{
								name: this.userName,
								color: this.userColor,
								cursor: {
									line: e.position.lineNumber,
									column: e.position.column,
								},
							},
						],
					}),
				);
			}
		});
	}

	/**
	 * Show remote cursor decorations in the editor.
	 */
	updateRemoteCursors(presences: CollaboratorPresence[]) {
		if (!this.editor || !this.monaco) return;

		const model = this.editor.getModel();
		if (!model) return;

		// Clear old decorations
		for (const [, ids] of this.remoteDecorations) {
			if (ids.length) {
				try {
					model.deltaDecorations(ids, []);
				} catch {
					// ignore
				}
			}
		}
		this.remoteDecorations.clear();

		// Add new decorations for each remote user
		for (const presence of presences) {
			if (!presence.cursor) continue;

			const ids = model.deltaDecorations(
				[],
				[
					{
						range: {
							startLineNumber: presence.cursor.line,
							startColumn: presence.cursor.column,
							endLineNumber: presence.cursor.line,
							endColumn: presence.cursor.column + 1,
						},
						options: {
							className: "remote-cursor-decoration",
							after: {
								content: presence.name,
								inlineClassName: "remote-cursor-label",
							},
						},
					},
				],
			);
			this.remoteDecorations.set(presence.name, ids);
		}
	}

	disconnect() {
		this.destroyed = true;
		if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.close();
			this.ws = null;
		}
		this.doc.destroy();
		this.isConnected = false;
		this.onConnectionChange?.(false);
	}
}

/**
 * Active collaboration sessions, keyed by room name.
 */
const sessions = new Map<string, CollabSession>();

export function getCollabSession(
	room: string,
	userName: string,
	serverUrl: string = `ws://${location.host}/ws/collab`,
): CollabSession {
	const key = `${room}:${userName}`;
	if (sessions.has(key)) return sessions.get(key)!;

	const session = new CollabSession(room, userName);
	sessions.set(key, session);
	session.connect(`${serverUrl}?room=${encodeURIComponent(room)}`);
	return session;
}

export function disconnectAllCollabSessions() {
	for (const session of sessions.values()) {
		session.disconnect();
	}
	sessions.clear();
}

export type { CollabSession };
