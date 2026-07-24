/**
 * Base class for every KuraMedics UI component.
 *
 * Components are plain JavaScript classes that render DOM nodes and manage
 * their own lifecycle. There is no virtual DOM or diffing. Components that
 * need to reflect state changes should update their state and then call
 * `this.update()`.
 */
export class Component {
    /**
     * @param {object} props
     */
    constructor(props = {}) {
        this.props = props;
        this.el = null;
        this._mountTarget = null;
        this._mounted = false;
    }

    /**
     * Must return the root DOM element for the component.
     * @returns {HTMLElement}
     */
    render() {
        throw new Error(`${this.constructor.name} must implement render()`);
    }

    /**
     * Mount the component into a target element.
     * @param {HTMLElement|string} target
     * @returns {Component}
     */
    mount(target) {
        const targetEl =
            typeof target === "string"
                ? document.querySelector(target)
                : target;

        if (!targetEl) {
            throw new Error(`Mount target not found: ${target}`);
        }

        this._mountTarget = targetEl;
        this.el = this.render();
        this._mountTarget.replaceChildren(this.el);

        this._mounted = true;

        if (typeof this.afterMount === "function") {
            this.afterMount();
        }

        return this;
    }

    /**
     * Re-render the component while preserving its mount target.
     * Does NOT invoke lifecycle hooks.
     */
    update() {
        if (!this._mounted || !this._mountTarget) {
            return;
        }

        const newEl = this.render();

        this._mountTarget.replaceChildren(newEl);

        this.el = newEl;
    }

    /**
     * Remove the component from the DOM and clean up resources.
     */
    unmount() {
        if (!this._mounted) {
            return;
        }

        if (typeof this.beforeUnmount === "function") {
            this.beforeUnmount();
        }

        this.el?.remove();

        this.el = null;
        this._mountTarget = null;
        this._mounted = false;
    }
}
