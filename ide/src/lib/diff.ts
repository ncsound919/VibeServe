/**
 * Native line diff — replaces microdiff dependency.
 * Returns array of { type: 'CREATE'|'REMOVE'|'CHANGE', path, value } for object & array diffs,
 * or simple line-level diff for strings.
 */
export function diffLines(a: string, b: string): string[] {
	const aLines = a.split("\n");
	const bLines = b.split("\n");
	const result: string[] = [];
	const maxLen = Math.max(aLines.length, bLines.length);
	for (let i = 0; i < maxLen; i++) {
		const aLine = aLines[i];
		const bLine = bLines[i];
		if (aLine !== bLine) {
			if (aLine !== undefined) result.push(`- ${aLine}`);
			if (bLine !== undefined) result.push(`+ ${bLine}`);
		}
	}
	return result;
}

export function diffObjects<T>(
	a: T,
	b: T,
): Array<{
	type: "CREATE" | "REMOVE" | "CHANGE";
	path: string[];
	value?: any;
	oldValue?: any;
}> {
	if (Array.isArray(a) && Array.isArray(b)) {
		return diffArrays(a, b);
	}
	const changes: Array<{
		type: "CREATE" | "REMOVE" | "CHANGE";
		path: string[];
		value?: any;
		oldValue?: any;
	}> = [];
	const allKeys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
	for (const key of allKeys) {
		const va = (a as any)?.[key];
		const vb = (b as any)?.[key];
		if (va === undefined && vb !== undefined) {
			changes.push({ type: "CREATE", path: [key], value: vb });
		} else if (va !== undefined && vb === undefined) {
			changes.push({ type: "REMOVE", path: [key], oldValue: va });
		} else if (JSON.stringify(va) !== JSON.stringify(vb)) {
			changes.push({ type: "CHANGE", path: [key], value: vb, oldValue: va });
		}
	}
	return changes;
}

function diffArrays(
	a: any[],
	b: any[],
): Array<{
	type: "CREATE" | "REMOVE" | "CHANGE";
	path: string[];
	value?: any;
	oldValue?: any;
}> {
	const changes: Array<{
		type: "CREATE" | "REMOVE" | "CHANGE";
		path: string[];
		value?: any;
		oldValue?: any;
	}> = [];
	const maxLen = Math.max(a.length, b.length);
	for (let i = 0; i < maxLen; i++) {
		const va = a[i];
		const vb = b[i];
		if (va === undefined && vb !== undefined) {
			changes.push({ type: "CREATE", path: [i], value: vb });
		} else if (va !== undefined && vb === undefined) {
			changes.push({ type: "REMOVE", path: [i], oldValue: va });
		} else if (JSON.stringify(va) !== JSON.stringify(vb)) {
			changes.push({ type: "CHANGE", path: [i], value: vb, oldValue: va });
		}
	}
	return changes;
}

export default diffObjects;
