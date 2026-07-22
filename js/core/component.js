/**
 * Base class for every KuraMedics UI component.
 *
 * A component is just a plain class that knows how to build its own DOM
 * node (`render`) and, optionally, what to do right after it lands in the
 * document (`afterMount`) or right before it's removed (`beforeUnmount`).
 * There's no virtual DOM and no diffing — for a mostly form/nav/content
 * driven app that's more machinery than we need. Components that need to
 * react to state changes call `this.update()` to re-render themselves.
 */
export class Component {
  /**
   * @param {object} props - Data passed in by whoever mounts this component.
   */
  constructor(props = {}) {
    this.props = props;
    this.el = null;
    this._mountTarget = null;
  }

  /**
   * Build and return the root DOM node for this component.
   * Must be implemented by subclasses.
   * @returns {HTMLElement}
   */
  render() {
    throw new Error(`${this.constructor.name} must implement render()`);
  }

  /**
   * Mount this component into a target element (or CSS selector).
   * @param {HTMLElement|string} target
   * @returns {Component} this, for chaining
   */
  mount(target) {
    const targetEl =
      typeof target === "string" ? document.querySelector(target) : target;

    if (!targetEl) {
      throw new Error(`Mount target not found: ${target}`);
    }

    this._mountTarget = targetEl;
    this.el = this.render();
    targetEl.replaceChildren(this.el);

    if (typeof this.afterMount === "function") {
      this.afterMount();
    }

    return this;
  }

  /**
   * Re-render this component in place, preserving its mount target.
   */
  update() {
    if (!this._mountTarget) return;

    if (typeof this.beforeUnmount === "function") {
      this.beforeUnmount();
    }

    this.el = this.render();
    this._mountTarget.replaceChildren(this.el);

    if (typeof this.afterMount === "function") {
      this.afterMount();
    }
  }

  /**
   * Remove this component's node from the document and run any cleanup
   * (timers, event listeners on window/document, etc).
   */
  unmount() {
    if (typeof this.beforeUnmount === "function") {
      this.beforeUnmount();
    }
    this.el?.remove();
    this.el = null;
    this._mountTarget = null;
  }
}
