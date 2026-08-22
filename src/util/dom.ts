export type ElementAttributeValue = string | number | boolean | null | undefined;

export type ElementAttributes = Readonly<Record<string, ElementAttributeValue>>;

export type ElementChild = Node | string | number;

export type ElementChildren = ElementChild | readonly ElementChild[];

/**
 * Create a typed DOM element without accepting HTML source strings.
 *
 * Attribute values are serialized with setAttribute. Text children are assigned
 * to text nodes so markup-looking input remains text.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: ElementAttributes,
  children?: ElementChildren,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);

  if (attrs !== undefined) {
    for (const [name, value] of Object.entries(attrs)) {
      if (value !== null && value !== undefined) {
        element.setAttribute(name, String(value));
      }
    }
  }

  const childList: readonly ElementChild[] =
    children === undefined ? [] : Array.isArray(children) ? children : [children];

  for (const child of childList) {
    if (typeof child === "string" || typeof child === "number") {
      const textNode = document.createTextNode("");
      textNode.textContent = String(child);
      element.append(textNode);
    } else {
      element.append(child);
    }
  }

  return element;
}
