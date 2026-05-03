/**
 * UISchema React Renderer v1.0
 * Converts UISchema v1.0 specifications into production-ready React components
 *
 * Features:
 * - Full accessibility (ARIA, keyboard navigation)
 * - Responsive design (mobile/tablet/desktop)
 * - Component composition
 * - Dynamic styling from tokens
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';

/**
 * Token Manager: Provides design system tokens to components
 */
export const createTokenManager = (designSystem) => {
  const { tokens, constraints } = designSystem;
  
  return {
    getColor: (roleId) => {
      const color = tokens.colors?.[roleId];
      return color?.hex || '#000000';
    },
    
    getTypography: (styleId) => {
      const style = tokens.typography?.[styleId];
      return {
        fontFamily: style?.font_family || 'system-ui',
        fontSize: style?.font_size || '1rem',
        fontWeight: style?.font_weight || '400',
        lineHeight: style?.line_height || 1.5,
        letterSpacing: style?.letter_spacing || '0',
      };
    },
    
    getSpacing: (sizeId) => tokens.spacing?.[sizeId] || '1rem',
    getShadow: (shadowId) => tokens.shadows?.[shadowId] || 'none',
    getBorderRadius: (radiusId) => tokens.border_radius?.[radiusId] || '0',
    
    getContrast: (fgRole, bgRole) => {
      const fg = this.getColor(fgRole);
      const bg = this.getColor(bgRole);
      return { fg, bg };
    },
  };
};

/**
 * Component Factory: Renders individual components from spec
 */
export const ComponentRenderer = ({ component, tokens, onInteraction }) => {
  const [state, setState] = useState({
    focused: false,
    hovered: false,
    active: false,
  });
  
  const baseStyles = useMemo(() => {
    const typo = component.visual?.size ? 
      { fontSize: `calc(1rem * ${component.visual.size === 'lg' ? 1.5 : component.visual.size === 'sm' ? 0.875 : 1})` } :
      {};
    
    return {
      padding: tokens.getSpacing('md'),
      fontFamily: tokens.getTypography('body').fontFamily,
      borderRadius: tokens.getBorderRadius('md'),
      cursor: 'pointer',
      transition: 'all 150ms ease-out',
    };
  }, [component, tokens]);
  
  const interactiveStyles = useMemo(() => {
    if (state.hovered) {
      return {
        ...baseStyles,
        opacity: 0.9,
        transform: 'translateY(-2px)',
      };
    }
    if (state.focused) {
      return {
        ...baseStyles,
        outline: `2px solid ${tokens.getColor('primary')}`,
        outlineOffset: '2px',
      };
    }
    return baseStyles;
  }, [state, baseStyles, tokens]);
  
  const handleClick = useCallback(() => {
    onInteraction?.({
      component: component.id,
      action: 'click',
      timestamp: new Date().toISOString(),
    });
  }, [component.id, onInteraction]);
  
  const accessibilityProps = {
    role: component.accessibility?.aria_role || 'button',
    'aria-label': component.accessibility?.aria_label || component.label,
    'aria-describedby': component.accessibility?.aria_describedby,
    'aria-hidden': component.accessibility?.aria_hidden ? 'true' : undefined,
    tabIndex: component.accessibility?.focus_visible ? 0 : -1,
    onFocus: () => setState(s => ({ ...s, focused: true })),
    onBlur: () => setState(s => ({ ...s, focused: false })),
    onMouseEnter: () => setState(s => ({ ...s, hovered: true })),
    onMouseLeave: () => setState(s => ({ ...s, hovered: false })),
    onClick: handleClick,
  };
  
  // Render different component types
  switch (component.type) {
    case 'button':
      return (
        <button
          {...accessibilityProps}
          style={{
            ...interactiveStyles,
            backgroundColor: tokens.getColor(component.visual?.color_role || 'primary'),
            color: '#FFFFFF',
            border: 'none',
            fontWeight: '600',
          }}
        >
          {component.label}
        </button>
      );
    
    case 'card':
      return (
        <div
          {...accessibilityProps}
          style={{
            ...interactiveStyles,
            backgroundColor: tokens.getColor('surface'),
            border: `1px solid ${tokens.getColor('text_secondary')}`,
            boxShadow: tokens.getShadow('md'),
          }}
        >
          {component.label}
        </div>
      );
    
    case 'input':
      return (
        <input
          {...accessibilityProps}
          type="text"
          placeholder={component.label}
          style={{
            ...interactiveStyles,
            backgroundColor: tokens.getColor('surface'),
            color: tokens.getColor('text'),
            border: `2px solid ${tokens.getColor('text_secondary')}`,
            borderRadius: tokens.getBorderRadius('sm'),
          }}
        />
      );
    
    case 'heading':
      const typo = tokens.getTypography('heading');
      return (
        <h1
          {...accessibilityProps}
          style={{
            ...typo,
            color: tokens.getColor('text'),
            margin: 0,
          }}
        >
          {component.label}
        </h1>
      );
    
    case 'text':
      return (
        <p
          {...accessibilityProps}
          style={{
            ...tokens.getTypography('body'),
            color: tokens.getColor('text'),
            margin: 0,
          }}
        >
          {component.label}
        </p>
      );
    
    default:
      return (
        <div
          {...accessibilityProps}
          style={{
            ...interactiveStyles,
            backgroundColor: tokens.getColor('surface'),
            border: '1px dashed #666',
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
export const LayoutRenderer = ({ layout, components, tokens, onInteraction }) => {
  const gridStyle = useMemo(() => {
    const bp = layout.breakpoints?.desktop || layout.breakpoints?.tablet || layout.breakpoints?.mobile;
    const cols = bp?.columns || layout.grid?.columns || 12;
    
    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: tokens.getSpacing('lg'),
      maxWidth: layout.grid?.max_width || '1200px',
      margin: '0 auto',
      padding: tokens.getSpacing('xl'),
    };
  }, [layout, tokens]);
  
  const componentMap = useMemo(
    () => Object.fromEntries(components.map(c => [c.id, c])),
    [components]
  );
  
  return (
    <div style={gridStyle}>
      {components.map(component => (
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
          />
        </div>
      ))}
    </div>
  );
};

/**
 * Main Spec Renderer: Converts complete spec to interactive component
 */
export const UISpecRenderer = ({ spec, onInteraction }) => {
  const tokenManager = useMemo(
    () => createTokenManager(spec.design_system),
    [spec.design_system]
  );
  
  const [viewportWidth, setViewportWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Determine active breakpoint
  const activeBreakpoint = useMemo(() => {
    if (viewportWidth < 768) return 'mobile';
    if (viewportWidth < 1024) return 'tablet';
    return 'desktop';
  }, [viewportWidth]);
  
  // Filter responsive variants
  const effectiveComponents = useMemo(() => {
    return spec.components.map(comp => {
      const responsive = comp.responsive?.[activeBreakpoint];
      return responsive ? { ...comp, ...responsive } : comp;
    });
  }, [spec.components, activeBreakpoint]);
  
  const containerStyle = {
    backgroundColor: tokenManager.getColor('background'),
    color: tokenManager.getColor('text'),
    minHeight: '100vh',
    fontFamily: tokenManager.getTypography('body').fontFamily,
  };
  
  return (
    <div style={containerStyle}>
      {/* Optional: Viewport indicator in development */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          padding: '8px 12px',
          fontSize: '12px',
          backgroundColor: '#333',
          color: '#FFF',
          zIndex: 9999,
          opacity: 0.7,
        }}
      >
        {activeBreakpoint} ({viewportWidth}px)
      </div>
      
      {spec.layouts.map((layout, idx) => (
        <div key={idx}>
          {layout.regions?.map((region, regionIdx) => (
            <section
              key={regionIdx}
              role={region.role}
              style={{
                gridColumn: `${region.span?.columns || 'auto'}`,
              }}
            >
              <LayoutRenderer
                layout={layout}
                components={effectiveComponents.filter(c =>
                  layout.regions?.some(r => r.id === c.id)
                )}
                tokens={tokenManager}
                onInteraction={onInteraction}
              />
            </section>
          ))}
        </div>
      ))}
    </div>
  );
};

/**
 * Hook: Use UISpec in your app
 */
export const useUISpec = (spec) => {
  const [interactions, setInteractions] = useState([]);
  
  const handleInteraction = useCallback((interaction) => {
    setInteractions(prev => [...prev, interaction]);
    console.log('Interaction:', interaction);
  }, []);
  
  return {
    render: (
      <UISpecRenderer
        spec={spec}
        onInteraction={handleInteraction}
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
