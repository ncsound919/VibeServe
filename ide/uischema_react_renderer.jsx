/**
 * UISchema React Renderer v1.0
 * Converts UISchema v1.0 specifications into production-ready React components
 *
 * Features:
 * - Full accessibility (ARIA, keyboard navigation)
 * - Responsive design (mobile/tablet/desktop)
 * - Component composition
 * - Dynamic styling from tokens
 * - Per-component animations
 * - Loading and error states
 * - Dev-only debug overlay
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";

/**
 * Token Manager: Provides design system tokens to components
 */
export const createTokenManager = (designSystem) => {
	const { tokens, constraints } = designSystem;

	return {
		getColor: (roleId) => {
			const color = tokens.colors?.[roleId];
			return color?.hex || "#000000";
		},

		getTypography: (styleId) => {
			const style = tokens.typography?.[styleId];
			return {
				fontFamily: style?.font_family || "system-ui",
				fontSize: style?.font_size || "1rem",
				fontWeight: style?.font_weight || "400",
				lineHeight: style?.line_height || 1.5,
				letterSpacing: style?.letter_spacing || "0",
			};
		},

		getSpacing: (sizeId) => tokens.spacing?.[sizeId] || "1rem",
		getShadow: (shadowId) => tokens.shadows?.[shadowId] || "none",
		getBorderRadius: (radiusId) => tokens.border_radius?.[radiusId] || "0",

		getContrast: (fgRole, bgRole) => {
			const fg = tokens.getColor(fgRole);
			const bg = tokens.getColor(bgRole);
			return { fg, bg };
		},
	};
};

/**
 * Error Boundary: Catches render errors and shows fallback UI
 */
export class ErrorBoundary extends React.Component {
	constructor(props) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error) {
		return { hasError: true, error };
	}

	componentDidCatch(error, errorInfo) {
		if (this.props.onError) {
			this.props.onError(error, errorInfo);
		} else {
			// eslint-disable-next-line no-console
			console.error(
				"UISpecRenderer ErrorBoundary caught an error:",
				error,
				errorInfo,
			);
		}
	}

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}
			return (
				<div
					style={{
						padding: "1rem",
						color: "#b91c1c",
						backgroundColor: "#fef2f2",
						border: "1px solid #fecaca",
						borderRadius: "0.5rem",
						fontFamily: "system-ui, sans-serif",
					}}
					role="alert"
				>
					<strong>Something went wrong rendering this UI.</strong>
					<pre
						style={{
							marginTop: "0.5rem",
							fontSize: "0.875rem",
							whiteSpace: "pre-wrap",
						}}
					>
						{this.state.error?.message}
					</pre>
				</div>
			);
		}
		return this.props.children;
	}
}

/**
 * Component Factory: Renders individual components from spec
 */
export const ComponentRenderer = ({
	component,
	tokens,
	onInteraction,
	componentMap,
}) => {
	const [state, setState] = useState({
		focused: false,
		hovered: false,
		active: false,
	});

	const [entered, setEntered] = useState(false);
	useEffect(() => {
		setEntered(true);
	}, []);

	const animation = component.animation || {};
	const duration = animation.duration || "150ms";
	const easing = animation.easing || "ease-out";
	const entry = animation.entry;

	const animationStyles = useMemo(() => {
		const styles = {
			transition: `all ${duration} ${easing}`,
		};
		if (entry === "fade-in") {
			styles.opacity = entered ? 1 : 0;
		} else if (entry === "slide-up") {
			styles.opacity = entered ? 1 : 0;
			styles.transform = entered ? "translateY(0)" : "translateY(8px)";
		}
		return styles;
	}, [duration, easing, entry, entered]);

	const baseStyles = useMemo(() => {
		const typo = component.visual?.size
			? {
					fontSize: `calc(1rem * ${
						component.visual.size === "lg"
							? 1.5
							: component.visual.size === "sm"
								? 0.875
								: 1
					})`,
				}
			: {};

		return {
			padding: tokens.getSpacing("md"),
			fontFamily: tokens.getTypography("body").fontFamily,
			borderRadius: tokens.getBorderRadius("md"),
			cursor: "pointer",
			...typo,
		};
	}, [component, tokens]);

	const interactiveStyles = useMemo(() => {
		const styles = { ...baseStyles, ...animationStyles };
		if (state.hovered) {
			return {
				...styles,
				opacity: 0.9,
				transform: "translateY(-2px)",
			};
		}
		if (state.focused) {
			return {
				...styles,
				outline: `2px solid ${tokens.getColor("primary")}`,
				outlineOffset: "2px",
			};
		}
		return styles;
	}, [state, baseStyles, animationStyles, tokens]);

	const handleClick = useCallback(() => {
		onInteraction?.({
			component: component.id,
			action: "click",
			timestamp: new Date().toISOString(),
		});
	}, [component.id, onInteraction]);

	const isDisabled = !!component.interaction?.disabled_state;

	const isInteractive = ["button", "input", "card"].includes(component.type);
	const shouldBeTabbable =
		isInteractive && !component.accessibility?.aria_hidden;

	const accessibilityProps = {
		role: component.accessibility?.aria_role || "button",
		"aria-label": component.accessibility?.aria_label || component.label,
		"aria-describedby": component.accessibility?.aria_describedby,
		"aria-hidden": component.accessibility?.aria_hidden ? "true" : undefined,
		tabIndex: shouldBeTabbable ? 0 : undefined,
		onFocus: () => setState((s) => ({ ...s, focused: true })),
		onBlur: () => setState((s) => ({ ...s, focused: false })),
		onMouseEnter: () => setState((s) => ({ ...s, hovered: true })),
		onMouseLeave: () => setState((s) => ({ ...s, hovered: false })),
		onClick: handleClick,
	};

	const disabledStyles = isDisabled
		? {
				opacity: 0.5,
				cursor: "not-allowed",
				pointerEvents: "none",
			}
		: {};

	// Render different component types
	switch (component.type) {
		case "button": {
			const icon = component.visual?.icon;
			return (
				<button
					{...accessibilityProps}
					disabled={isDisabled}
					style={{
						...interactiveStyles,
						...disabledStyles,
						backgroundColor: tokens.getColor(
							component.visual?.color_role || "primary",
						),
						color: "#FFFFFF",
						border: "none",
						fontWeight: "600",
					}}
				>
					{icon ? (
						<span
							style={{
								display: "inline-flex",
								alignItems: "center",
								gap: tokens.getSpacing("sm"),
							}}
						>
							<span aria-hidden="true">{icon}</span>
							{component.label && <span>{component.label}</span>}
						</span>
					) : (
						component.label
					)}
				</button>
			);
		}

		case "card": {
			const children = component.children || [];
			return (
				<div
					{...accessibilityProps}
					style={{
						...interactiveStyles,
						...disabledStyles,
						backgroundColor: tokens.getColor("surface"),
						border: `1px solid ${tokens.getColor("text_secondary")}`,
						boxShadow: tokens.getShadow("md"),
					}}
				>
					{component.label && (
						<div
							style={{ marginBottom: tokens.getSpacing("sm"), fontWeight: 600 }}
						>
							{component.label}
						</div>
					)}
					{children.map((childId) => {
						const child = componentMap?.[childId];
						if (!child) return null;
						return (
							<ComponentRenderer
								key={childId}
								component={child}
								tokens={tokens}
								onInteraction={onInteraction}
								componentMap={componentMap}
							/>
						);
					})}
				</div>
			);
		}

		case "input":
			return (
				<input
					{...accessibilityProps}
					disabled={isDisabled}
					type="text"
					placeholder={component.label}
					style={{
						...interactiveStyles,
						...disabledStyles,
						backgroundColor: tokens.getColor("surface"),
						color: tokens.getColor("text"),
						border: `2px solid ${tokens.getColor("text_secondary")}`,
						borderRadius: tokens.getBorderRadius("sm"),
					}}
				/>
			);

		case "heading": {
			const level = component.visual?.level ?? 1;
			const Tag = `h${Math.min(6, Math.max(1, level))}`;
			const typo = tokens.getTypography("heading");
			return (
				<Tag
					{...accessibilityProps}
					style={{
						...typo,
						...animationStyles,
						color: tokens.getColor("text"),
						margin: 0,
					}}
				>
					{component.label}
				</Tag>
			);
		}

		case "text":
			return (
				<p
					{...accessibilityProps}
					style={{
						...tokens.getTypography("body"),
						...animationStyles,
						color: tokens.getColor("text"),
						margin: 0,
					}}
				>
					{component.label}
				</p>
			);

		case "spinner":
			return (
				<>
					<style>{`
            @keyframes uischema-spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
					<div
						role="status"
						aria-live="polite"
						style={{
							...baseStyles,
							...animationStyles,
							display: "inline-flex",
							alignItems: "center",
							gap: tokens.getSpacing("sm"),
							color: tokens.getColor("text_secondary"),
						}}
					>
						<span
							aria-hidden="true"
							style={{
								display: "inline-block",
								width: "1em",
								height: "1em",
								border: `2px solid ${tokens.getColor("text_secondary")}`,
								borderTopColor: tokens.getColor("primary"),
								borderRadius: "50%",
								animation: "uischema-spin 1s linear infinite",
							}}
						/>
						{component.label || "Loading\u2026"}
					</div>
				</>
			);

		case "alert":
			return (
				<div
					role="alert"
					style={{
						...baseStyles,
						...animationStyles,
						backgroundColor: tokens.getColor("error") || "#dc2626",
						color: "#ffffff",
						fontWeight: 500,
					}}
				>
					{component.label}
				</div>
			);

		default:
			return (
				<div
					{...accessibilityProps}
					style={{
						...interactiveStyles,
						...animationStyles,
						backgroundColor: tokens.getColor("surface"),
						border: "1px dashed #666",
					}}
				>
					[{component.type}] {component.label}
				</div>
			);
	}
};

/**
 * Layout Renderer: Arranges components using grid
 */
export const LayoutRenderer = ({
	layout,
	components,
	tokens,
	onInteraction,
}) => {
	const gridStyle = useMemo(() => {
		const bp =
			layout.breakpoints?.desktop ||
			layout.breakpoints?.tablet ||
			layout.breakpoints?.mobile;
		const cols = bp?.columns || layout.grid?.columns || 12;

		return {
			display: "grid",
			gridTemplateColumns: `repeat(${cols}, 1fr)`,
			gap: tokens.getSpacing("lg"),
			maxWidth: layout.grid?.max_width || "1200px",
			margin: "0 auto",
			padding: tokens.getSpacing("xl"),
		};
	}, [layout, tokens]);

	const componentMap = useMemo(
		() => Object.fromEntries(components.map((c) => [c.id, c])),
		[components],
	);

	return (
		<div style={gridStyle}>
			{components.map((component) => (
				<div
					key={component.id}
					style={{
						gridColumn: `span ${component.visual?.span?.columns || 1}`,
						gridRow: `span ${component.visual?.span?.rows || 1}`,
					}}
				>
					<ComponentRenderer
						component={component}
						tokens={tokens}
						onInteraction={onInteraction}
						componentMap={componentMap}
					/>
				</div>
			))}
		</div>
	);
};

/**
 * Main Spec Renderer: Converts complete spec to interactive component
 */
export const UISpecRenderer = ({
	spec,
	onInteraction,
	debug = false,
	loading = false,
}) => {
	const tokenManager = useMemo(
		() => createTokenManager(spec.design_system),
		[spec.design_system],
	);

	const [viewportWidth, setViewportWidth] = useState(
		typeof window !== "undefined" ? window.innerWidth : 1024,
	);

	useEffect(() => {
		if (typeof window === "undefined") return;
		const handleResize = () => setViewportWidth(window.innerWidth);
		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	// Determine active breakpoint
	const activeBreakpoint = useMemo(() => {
		if (viewportWidth < 768) return "mobile";
		if (viewportWidth < 1024) return "tablet";
		return "desktop";
	}, [viewportWidth]);

	// Filter responsive variants
	const effectiveComponents = useMemo(() => {
		return spec.components.map((comp) => {
			const responsive = comp.responsive?.[activeBreakpoint];
			return responsive ? { ...comp, ...responsive } : comp;
		});
	}, [spec.components, activeBreakpoint]);

	const containerStyle = {
		backgroundColor: tokenManager.getColor("background"),
		color: tokenManager.getColor("text"),
		minHeight: "100vh",
		fontFamily: tokenManager.getTypography("body").fontFamily,
	};

	const isDev =
		typeof process !== "undefined" &&
		process.env &&
		process.env.NODE_ENV === "development";

	if (loading) {
		return (
			<div
				style={{
					...containerStyle,
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
				}}
			>
				<ComponentRenderer
					component={{
						type: "spinner",
						label: "Loading\u2026",
						id: "loading-fallback",
					}}
					tokens={tokenManager}
				/>
			</div>
		);
	}

	return (
		<ErrorBoundary>
			<div style={containerStyle}>
				{/* Optional: Viewport indicator in development */}
				{debug && isDev && (
					<div
						style={{
							position: "fixed",
							top: 0,
							right: 0,
							padding: `${tokenManager.getSpacing("sm")} ${tokenManager.getSpacing("md")}`,
							fontSize: "12px",
							backgroundColor: "#333",
							color: "#FFF",
							zIndex: 9999,
							opacity: 0.7,
						}}
					>
						{activeBreakpoint} ({viewportWidth}px)
					</div>
				)}

				{spec.layouts.map((layout, idx) => (
					<div key={idx}>
						{layout.regions?.map((region, regionIdx) => {
							const regionComponents = effectiveComponents.filter((c) => {
								if (c.region) return c.region === region.id;
								if (c.regions && Array.isArray(c.regions))
									return c.regions.includes(region.id);
								return false;
							});
							return (
								<section
									key={regionIdx}
									role={region.role}
									style={{
										gridColumn: `${region.span?.columns || "auto"}`,
									}}
								>
									<LayoutRenderer
										layout={layout}
										components={regionComponents}
										tokens={tokenManager}
										onInteraction={onInteraction}
									/>
								</section>
							);
						})}
					</div>
				))}
			</div>
		</ErrorBoundary>
	);
};

/**
 * Hook: Use UISpec in your app
 */
export const useUISpec = (spec) => {
	const [interactions, setInteractions] = useState([]);

	const handleInteraction = useCallback((interaction) => {
		setInteractions((prev) => [...prev, interaction]);
		console.log("Interaction:", interaction);
	}, []);

	const isDev =
		typeof process !== "undefined" &&
		process.env &&
		process.env.NODE_ENV === "development";

	return {
		render: (
			<UISpecRenderer
				spec={spec}
				onInteraction={handleInteraction}
				debug={isDev}
			/>
		),
		interactions,
		clearInteractions: () => setInteractions([]),
	};
};

/**
 * Example Usage:
 *
 * function App() {
 *   const spec = { ... }; // From AetherNexus Prime
 *   const { render } = useUISpec(spec);
 *   return render;
 * }
 */

export default UISpecRenderer;
